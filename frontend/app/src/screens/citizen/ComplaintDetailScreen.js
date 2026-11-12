import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
  Share,
  Platform,
  BackHandler
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { makeApiCall, apiClient } from '../../../config/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { refetchComplaintVotes } from '../../utils/voteUtils';
import { handleVoting } from '../../utils/enhancedVoteUtils';
import MapView, { Marker, Circle } from 'react-native-maps';
import { useTranslatedObject, useTranslatedList, useTranslatedText } from '../../context/TranslationContext';
import { formatLocalizedDateTime, formatLocalizedRelativeTime } from '../../utils/dateLocale';
import { getCategoryLabel, getStatusLabel } from '../../utils/priorityUtils';

const { width, height } = Dimensions.get('window');

const ComplaintDetailScreen = ({ route, navigation }) => {
  const { t, i18n } = useTranslation(['citizen', 'common', 'complaint', 'admin']);
  const { complaintId } = route.params || {};
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updatingVote, setUpdatingVote] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [breakdownData, setBreakdownData] = useState(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [geometryRetryLoading, setGeometryRetryLoading] = useState(false);
  const insets = useSafeAreaInsets();

  const translatedComplaint = useTranslatedObject(complaint, [
    'title',
    'description',
    'location_address',
    'geometry_error',
    'resolution_notes',
  ]);
  const translatedUpdates = useTranslatedList(complaint?.updates || [], ['update_notes']);
  const translatedSimilar = useTranslatedList(complaint?.similarComplaints || [], ['title']);
  const reporterRaw =
    complaint?.users?.full_name ||
    complaint?.user?.full_name ||
    complaint?.user_name ||
    complaint?.citizenName ||
    '';
  const translatedReporter = useTranslatedText(reporterRaw);

  // Retry pothole footprint/depth estimation
  const retryGeometry = async () => {
    const imageUrl = complaint?.image_urls && complaint.image_urls.length > 0 ? complaint.image_urls[0] : complaint?.image_url;
    if (!complaint?.id || !imageUrl) {
      Alert.alert(t('citizen:mobileDetail.noticeTitle'), t('citizen:mobileDetail.geometryImageRequired'));
      return;
    }
    setGeometryRetryLoading(true);
    try {
      const response = await makeApiCall(`${apiClient.baseUrl}/api/image-analysis/estimate-geometry`, {
        method: 'POST',
        body: JSON.stringify({
          complaintId: complaint.id,
          imageUrl,
          category: complaint.category,
        }),
      });
      if (response?.success && response.geometry) {
        setComplaint((prev) => (prev ? { ...prev, ...response.geometry } : prev));
        Alert.alert(t('citizen:mobileDetail.successTitle'), t('citizen:mobileDetail.geometryUpdated'));
      } else {
        Alert.alert(t('common:mobileNav.error'), response?.error || t('admin:geometry.failed'));
      }
    } catch (error) {
      console.error('Geometry retry error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:geometry.commError'));
    } finally {
      setGeometryRetryLoading(false);
    }
  };

  // Animation values
  const scrollY = useRef(new Animated.Value(0)).current;
  
  const imageScale = useRef(new Animated.Value(1)).current;
  const headerTranslate = useRef(new Animated.Value(0)).current;
  const animatedHeaderOpacity = useRef(new Animated.Value(0)).current;
  const likeScale = useRef(new Animated.Value(1)).current;
  
  // Fetch complaint details
  useEffect(() => {
    fetchComplaintDetails();
  }, [complaintId]);

  // Handle Android hardware back button
  useEffect(() => {
    const backAction = () => {
      handleBackNavigation();
      return true; // Prevent default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, []);

  // Handle screen focus for navigation
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused
      return () => {
        // Screen is unfocused - cleanup if needed
      };
    }, [])
  );

  // Enhanced back navigation function
  const handleBackNavigation = () => {
    if (loading) {
      // If still loading, show confirmation
      Alert.alert(
        t('citizen:mobileDetail.cancelLoadingTitle'),
        t('citizen:mobileDetail.cancelLoadingDesc'),
        [
          { text: t('citizen:mobileDetail.stay'), style: 'cancel' },
          { text: t('citizen:mobileDetail.goBack'), onPress: () => navigation.goBack() }
        ]
      );
    } else if (updatingVote) {
      // If vote is being updated, show confirmation
      Alert.alert(
        t('citizen:mobileDetail.cancelVoteTitle'),
        t('citizen:mobileDetail.cancelVoteDesc'),
        [
          { text: t('citizen:mobileDetail.stay'), style: 'cancel' },
          { text: t('citizen:mobileDetail.goBack'), onPress: () => navigation.goBack() }
        ]
      );
    } else {
      // Normal navigation back with smooth transition
      try {
        navigation.goBack();
      } catch (error) {
        // Fallback navigation if goBack fails
        console.log('Navigation fallback triggered');
        navigation.navigate('CitizenDashboard');
      }
    }
  };

  // Handle navigation to specific screens
  const handleNavigateToMap = () => {
    if (complaint?.location_latitude && complaint?.location_longitude) {
      navigation.navigate('ComplaintMap', { 
        initialRegion: {
          latitude: complaint.location_latitude,
          longitude: complaint.location_longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        selectedComplaint: complaint
      });
    }
  };

  const handleNavigateToSimilarComplaint = (complaintId) => {
    navigation.push('ComplaintDetail', { complaintId });
  };

  const fetchComplaintDetails = async () => {
    if (!complaintId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/complaints/${complaintId}`,
        { method: 'GET' }
      );
      
      if (response.success && response.complaint) {
        const submitterUser = response.complaint.users || response.complaint.user || {
          full_name: response.complaint.user_name || response.complaint.citizenName || 'Verified Citizen'
        };
        const timeAgo = response.complaint.created_at
          ? getTimeAgo(new Date(response.complaint.created_at))
          : '';

        setComplaint({
          ...response.complaint,
          users: submitterUser,
          user: submitterUser,
          timeAgo,
          voteCount: response.complaint.vote_count || 0,
          userVoted: response.complaint.userVoted || false,
        });
      } else {
        console.error('❌ Error fetching complaint details:', response);
        Alert.alert(
          t('common:mobileNav.error'),
          t('citizen:mobileDetail.loadErrorDesc'),
          [{ text: t('common:mobileNav.ok'), onPress: handleBackNavigation }]
        );
      }
    } catch (error) {
      console.error('❌ Error fetching complaint details:', error);
      Alert.alert(
        t('common:mobileNav.error'),
        t('citizen:mobileDetail.loadExceptionDesc'),
        [{ text: t('common:mobileNav.ok'), onPress: handleBackNavigation }]
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchBreakdownData = async () => {
    if (!complaint || loadingBreakdown) return;
    
    setLoadingBreakdown(true);
    try {
      // Prepare the request data for comprehensive priority calculation
      const requestData = {
        latitude: complaint.location_latitude ?? complaint.latitude,
        longitude: complaint.location_longitude ?? complaint.longitude,
        complaintType: complaint.category || 'pothole',
        locationMeta: {
          privacyLevel: 'exact',
          radiusM: 10
        },
        imageAnalysis: {
          confidence: 0.85, // Default values if not available
          modelConfidence: 0.90
        },
        complaintData: {
          description: complaint.description,
          created_at: complaint.created_at,
          votes: complaint.vote_count || 0,
          status: complaint.status || 'pending'
        }
      };

      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/location-priority/comprehensive`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData)
        }
      );

      if (response.success && response.breakdown) {
        setBreakdownData(response.breakdown);
      } else {
        console.error('❌ Error fetching breakdown data:', response);
      }
    } catch (error) {
      console.error('❌ Error fetching breakdown data:', error);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handleUpvote = async () => {
    if (updatingVote) return;
    
    // Animate like button
    Animated.sequence([
      Animated.timing(likeScale, {
        toValue: 1.3,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(likeScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Make API call to update vote and refetch current vote count
    setUpdatingVote(true);
    try {
      // Use enhanced voting that handles both authenticated and guest voting
      const voteResponse = await handleVoting(complaintId, apiClient, makeApiCall);
      
      if (!voteResponse.success) {
        console.error('❌ Vote failed:', voteResponse);
        Alert.alert(
          t('citizen:mobileFeed.voteFailedTitle'),
          t('citizen:mobileFeed.voteFailedDesc'),
          [{ text: t('common:mobileNav.ok') }]
        );
        return;
      }

      // Always refetch the current vote count from server for accuracy
      const refetchResponse = await refetchComplaintVotes(complaintId, apiClient);
      
      if (refetchResponse.success) {
        setComplaint({
          ...complaint,
          voteCount: refetchResponse.voteCount,
          userVoted: refetchResponse.userVoted
        });
        
        console.log(`✅ Vote updated: ${refetchResponse.userVoted ? 'Voted' : 'Unvoted'}, Count: ${refetchResponse.voteCount}`);
      } else {
        console.error('❌ Failed to refetch vote count');
      }
    } catch (error) {
      console.error('❌ Error voting for complaint:', error);
      Alert.alert(
        t('citizen:mobileFeed.voteFailedTitle'), 
        t('citizen:mobileFeed.voteFailedDesc'),
        [{ text: t('common:mobileNav.ok') }]
      );
    } finally {
      setUpdatingVote(false);
    }
  };
  
  const handleShare = async () => {
    try {
      const shareTarget = translatedComplaint || complaint;
      await Share.share({
        message: t('citizen:mobileDetail.shareMessage', { title: shareTarget.title }),
        url: `https://cityzen.org/complaints/${complaintId}`,
        title: t('citizen:mobileDetail.shareTitle'),
      });
    } catch (error) {
      Alert.alert(t('common:mobileNav.error'), t('citizen:mobileDetail.shareError'));
    }
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    }
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) {
      return `${diffInWeeks}w ago`;
    }
    
    const diffInMonths = Math.floor(diffInDays / 30);
    return `${diffInMonths}mo ago`;
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      // CityZen SAM3 workflow classes
      case 'pothole':
        return <FontAwesome5 name="dot-circle" size={18} color="#f44336" />;
      case 'fallen_tree':
        return <MaterialCommunityIcons name="pine-tree" size={20} color="#4caf50" />;
      case 'garbage_dumping':
        return <MaterialCommunityIcons name="delete" size={20} color="#8bc34a" />;
      case 'stray_cattle':
        return <MaterialCommunityIcons name="cow" size={20} color="#795548" />;
      case 'fallen_electric_pole':
        return <Ionicons name="flash" size={20} color="#ffeb3b" />;
      case 'concrete_structure_damage':
        return <MaterialCommunityIcons name="wall" size={20} color="#9e9e9e" />;
      case 'road_waterlogging':
        return <MaterialCommunityIcons name="home-flood" size={20} color="#03a9f4" />;
      // Legacy categories kept for older complaints already in the database
      case 'road_damage':
        return <MaterialCommunityIcons name="road-variant" size={20} color="#ff9800" />;
      case 'water_leakage':
      case 'water_issue':
        return <Ionicons name="water" size={20} color="#2196f3" />;
      case 'sewage_overflow':
        return <MaterialCommunityIcons name="water-pump" size={20} color="#795548" />;
      case 'garbage_collection':
      case 'garbage':
        return <MaterialCommunityIcons name="delete" size={20} color="#8bc34a" />;
      case 'broken_streetlight':
      case 'streetlight':
        return <Ionicons name="flashlight" size={20} color="#ffc107" />;
      case 'electrical_danger':
      case 'electricity':
        return <Ionicons name="flash" size={20} color="#ffeb3b" />;
      case 'fire_hazard':
        return <MaterialCommunityIcons name="fire" size={20} color="#f44336" />;
      case 'traffic_signal':
        return <MaterialCommunityIcons name="traffic-light" size={20} color="#ff5722" />;
      case 'tree_issue':
        return <MaterialCommunityIcons name="tree" size={20} color="#4caf50" />;
      case 'flooding':
        return <MaterialCommunityIcons name="home-flood" size={20} color="#03a9f4" />;
      case 'others':
        return <MaterialCommunityIcons name="dots-horizontal-circle" size={20} color="#607d8b" />;
      default:
        return <MaterialCommunityIcons name="alert-circle" size={20} color="#9e9e9e" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#f57c00';
      case 'in_progress':
        return '#2196f3';
      case 'resolved':
        return '#4caf50';
      case 'rejected':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };
  
  const getStatusSteps = (status) => {
    const steps = [
      { name: t('citizen:mobileDetail.stepSubmitted'), completed: true },
      { name: t('citizen:mobileDetail.stepVerified'), completed: ['in_progress', 'resolved'].includes(status) },
      { name: t('common:statusFilters.in_progress'), completed: ['in_progress', 'resolved'].includes(status) },
      { name: t('common:statusFilters.resolved'), completed: status === 'resolved' }
    ];
    
    if (status === 'rejected') {
      return [
        { name: t('citizen:mobileDetail.stepSubmitted'), completed: true },
        { name: t('citizen:mobileDetail.stepReviewed'), completed: true },
        { name: t('common:statusFilters.rejected'), completed: true, isRejected: true }
      ];
    }
    
    return steps;
  };
  
  const formatDate = (dateString) => {
    return formatLocalizedDateTime(dateString, i18n.language);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1A1A1A" />
        <Text style={styles.loadingText}>{t('citizen:mobileDetail.loadingDetails')}</Text>
      </View>
    );
  }

  if (!complaint) {
    return (
      <View style={[styles.errorContainer, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={60} color="#f44336" />
        <Text style={styles.errorTitle}>{t('citizen:complaintDetail.notFoundTitle')}</Text>
        <Text style={styles.errorText}>{t('citizen:complaintDetail.notFoundDesc')}</Text>
        <TouchableOpacity 
          style={styles.errorBackButton}
          onPress={handleBackNavigation}
        >
          <Text style={styles.backButtonText}>{t('common:mobileNav.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayComplaint = translatedComplaint || complaint;
  const displayUpdates = translatedUpdates.length > 0 ? translatedUpdates : (complaint.updates || []);
  const displaySimilar = translatedSimilar.length > 0 ? translatedSimilar : (complaint.similarComplaints || []);
  const displayReporter = translatedReporter || t('citizen:feed.verifiedCitizen');

  return (
    <View style={styles.container}>
      {/* Fixed back button - always visible */}
      <TouchableOpacity
        style={[styles.fixedBackButton, { top: insets.top + 10 }]}
        onPress={handleBackNavigation}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      
      {/* Fixed share button - always visible */}
      <TouchableOpacity
        style={[styles.fixedShareButton, { top: insets.top + 10 }]}
        onPress={handleShare}
      >
        <Ionicons name="share-outline" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Animated header */}
      <Animated.View 
        style={[
          styles.animatedHeader, 
          { 
            opacity: 0,
            transform: [{ translateY: 0 }],
            paddingTop: insets.top,
          }
        ]}
      >
        <TouchableOpacity
          style={styles.backIcon}
          onPress={handleBackNavigation}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{displayComplaint.title}</Text>
        <TouchableOpacity style={styles.shareIcon} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
      
      <KeyboardAwareScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* Image section */}
        <Animated.View 
          style={[
            styles.imageContainer,
            { 
              transform: [{ scale: 1 }],
              paddingTop: insets.top,
            }
          ]}
        >
          {displayComplaint.image_urls && displayComplaint.image_urls.length > 0 ? (
            <Image 
              source={{ uri: displayComplaint.image_urls[0] }} 
              style={styles.complaintImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.noImageContainer}>
              <Ionicons name="image" size={80} color="#ddd" />
              <Text style={styles.noImageText}>{t('citizen:mobileFeed.noImage')}</Text>
            </View>
          )}
          
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.imageGradient}
          />
          
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 10 }]}
            onPress={handleBackNavigation}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.imageBottomContent}>
            <View style={styles.categoryBadge}>
              {getCategoryIcon(displayComplaint.category)}
              <Text style={styles.categoryText}>
                {displayComplaint.category ? getCategoryLabel(displayComplaint.category, t) : t('common:mobileNav.general')}
              </Text>
            </View>
            
            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-social" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </Animated.View>
        
        {/* Content section */}
        <View style={styles.contentContainer}>
          {/* Title and status */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{displayComplaint.title || t('citizen:complaintDetail.defaultTitle')}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(displayComplaint.status) }]}>
              <Text style={styles.statusText}>
                {getStatusLabel(displayComplaint.status, t)}
              </Text>
            </View>
          </View>
          
          {/* User and time */}
          <View style={styles.userContainer}>
            <View style={styles.userInfo}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {displayReporter.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={styles.userName}>
                  {displayReporter}
                </Text>
                <Text style={styles.timeAgo}>
                  {formatLocalizedRelativeTime(displayComplaint.created_at, displayComplaint.timeAgo, i18n.language)}
                </Text>
              </View>
            </View>
            
            <TouchableOpacity 
              style={styles.voteButton}
              onPress={handleUpvote}
              disabled={updatingVote}
            >
              <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                <Ionicons 
                  name={displayComplaint.userVoted ? "arrow-up-circle" : "arrow-up-circle-outline"} 
                  size={30} 
                  color={displayComplaint.userVoted ? "#1A1A1A" : "#777"} 
                />
              </Animated.View>
              <Text style={[styles.voteCount, displayComplaint.userVoted && styles.userVotedText]}>
                {displayComplaint.voteCount || 0}
              </Text>
            </TouchableOpacity>
          </View>
          
          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionTitle}>{t('citizen:mobileDetail.description')}</Text>
            <Text style={styles.descriptionText}>{displayComplaint.description}</Text>
          </View>

          {/* Geometric Estimation (Potholes) */}
          {((displayComplaint.geometry_status === 'completed' || (displayComplaint.estimated_width_cm != null && displayComplaint.estimated_length_cm != null)) || displayComplaint.category?.toLowerCase()?.includes('pothole')) && (
            <View style={styles.geometryPanel}>
              <View style={styles.geometryHeader}>
                <Ionicons name="cube-outline" size={18} color="#1A1A1A" />
                <Text style={styles.geometryTitle}>{t('citizen:mobileDetail.geometryTitle')}</Text>
              </View>

              {(displayComplaint.geometry_status === 'completed' || (displayComplaint.estimated_width_cm != null && displayComplaint.estimated_length_cm != null)) && (
                <>
                  <Text style={styles.geometryRow}>
                    {t('citizen:mobileDetail.dimensions', {
                      width: displayComplaint.estimated_width_cm,
                      length: displayComplaint.estimated_length_cm,
                    })}
                  </Text>
                  <Text style={styles.geometryRow}>
                    {t('citizen:mobileDetail.estimatedArea', { area: displayComplaint.estimated_area_cm2 })}
                  </Text>
                  <Text style={styles.geometryDisclaimer}>
                    {t('citizen:mobileDetail.geometryDisclaimer', {
                      pct: Math.round((displayComplaint.geometry_confidence || 0) * 100),
                    })}
                  </Text>
                  <TouchableOpacity
                    style={styles.geometryRetryButtonSecondary}
                    disabled={geometryRetryLoading}
                    onPress={retryGeometry}
                  >
                    <Ionicons name="refresh" size={13} color="#1A1A1A" style={{ marginRight: 4 }} />
                    <Text style={styles.geometryRetrySecondaryText}>
                      {geometryRetryLoading ? t('citizen:mobileDetail.recalculating') : t('citizen:mobileDetail.recalculateSize')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {displayComplaint.geometry_status === 'pending' && (
                <View style={styles.geometryLoadingRow}>
                  <ActivityIndicator size="small" color="#1A1A1A" />
                  <Text style={[styles.geometryRow, { marginLeft: 8 }]}>{t('admin:geometry.computing')}</Text>
                </View>
              )}

              {displayComplaint.geometry_status === 'failed' && (
                <>
                  <Text style={[styles.geometryRow, { color: '#c0392b' }]}>
                    {t('admin:geometry.failed')}
                    {displayComplaint.geometry_error ? `: ${displayComplaint.geometry_error}` : '.'}
                  </Text>
                  <TouchableOpacity
                    style={styles.geometryRetryButton}
                    disabled={geometryRetryLoading}
                    onPress={retryGeometry}
                  >
                    <Ionicons name="refresh" size={14} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.geometryRetryText}>
                      {geometryRetryLoading ? t('citizen:mobileDetail.recalculating') : t('citizen:mobileDetail.retrySizeEstimate')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {displayComplaint.geometry_status !== 'completed' &&
                displayComplaint.geometry_status !== 'pending' &&
                displayComplaint.geometry_status !== 'failed' &&
                displayComplaint.estimated_width_cm == null &&
                displayComplaint.category?.toLowerCase()?.includes('pothole') && (
                <>
                  <Text style={styles.geometryRow}>
                    {t('citizen:mobileDetail.estimatePrompt')}
                  </Text>
                  <TouchableOpacity
                    style={styles.geometryRetryButton}
                    disabled={geometryRetryLoading}
                    onPress={retryGeometry}
                  >
                    <Ionicons name="calculator-outline" size={14} color="#fff" style={{ marginRight: 4 }} />
                    <Text style={styles.geometryRetryText}>
                      {geometryRetryLoading ? t('admin:geometry.running') : t('admin:geometry.execute')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
          
          {/* Location */}
          <View style={styles.locationContainer}>
            <Text style={styles.sectionTitle}>{t('citizen:mobileDetail.location')}</Text>
            <Text style={styles.locationAddress}>{displayComplaint.location_address || t('citizen:complaintDetail.noAddress')}</Text>
            
            {Number.isFinite(Number(displayComplaint.location_latitude)) && Number.isFinite(Number(displayComplaint.location_longitude)) && (
              <View style={styles.mapContainer}>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: Number(displayComplaint.location_latitude),
                    longitude: Number(displayComplaint.location_longitude),
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  scrollEnabled={false}
                  zoomEnabled={false}
                >
                  <Marker
                    coordinate={{
                      latitude: Number(displayComplaint.location_latitude),
                      longitude: Number(displayComplaint.location_longitude),
                    }}
                    title={displayComplaint.title}
                  >
                    <View style={styles.customMarker}>
                      <View style={styles.markerBody}>
                        {getCategoryIcon(displayComplaint.category)}
                      </View>
                      <View style={styles.markerArrow} />
                    </View>
                  </Marker>
                  
                  <Circle
                    center={{
                      latitude: Number(displayComplaint.location_latitude),
                      longitude: Number(displayComplaint.location_longitude),
                    }}
                    radius={150}
                    fillColor="rgba(52, 152, 219, 0.2)"
                    strokeColor="rgba(52, 152, 219, 0.5)"
                    strokeWidth={1}
                  />
                </MapView>
                
                <TouchableOpacity 
                  style={styles.viewOnMapButton}
                  onPress={handleNavigateToMap}
                >
                  <Text style={styles.viewOnMapText}>{t('citizen:mobileDetail.viewFullMap')}</Text>
                  <Ionicons name="map-outline" size={16} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {/* Status Timeline */}
          <View style={styles.statusTimelineContainer}>
            <Text style={styles.sectionTitle}>{t('citizen:mobileDetail.statusUpdates')}</Text>
            <View style={styles.timeline}>
              {getStatusSteps(displayComplaint.status).map((step, index) => (
                <View key={index} style={styles.timelineItem}>
                  <View 
                    style={[
                      styles.timelineDot, 
                      step.completed && styles.completedDot,
                      step.isRejected && styles.rejectedDot
                    ]}
                  />
                  {index < getStatusSteps(displayComplaint.status).length - 1 && (
                    <View 
                      style={[
                        styles.timelineLine,
                        getStatusSteps(displayComplaint.status)[index + 1].completed && styles.completedLine,
                        step.isRejected && styles.rejectedLine
                      ]} 
                    />
                  )}
                  <Text 
                    style={[
                      styles.timelineText,
                      step.completed && styles.completedText,
                      step.isRejected && styles.rejectedText
                    ]}
                  >
                    {step.name}
                  </Text>
                </View>
              ))}
            </View>
            
            {/* Complaint updates */}
            {displayUpdates.length > 0 ? (
              <View style={styles.updatesContainer}>
                {displayUpdates.map((update, index) => (
                  <View key={index} style={styles.updateItem}>
                    <View style={styles.updateHeader}>
                      <Text style={styles.updateTitle}>
                        {t('citizen:mobileDetail.statusChangedTo')}{' '}
                        <Text style={{ 
                          color: getStatusColor(update.new_status),
                          fontWeight: 'bold'
                        }}>
                          {getStatusLabel(update.new_status, t)}
                        </Text>
                      </Text>
                      <Text style={styles.updateTime}>{formatDate(update.created_at)}</Text>
                    </View>
                    {Boolean(update.update_notes) && (
                      <Text style={styles.updateNotes}>{update.update_notes}</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : displayComplaint.resolved_at ? (
              <View style={styles.updateItem}>
                <View style={styles.updateHeader}>
                  <Text style={styles.updateTitle}>
                    {t('citizen:mobileDetail.statusChangedTo')}{' '}
                    <Text style={{ 
                      color: getStatusColor('resolved'),
                      fontWeight: 'bold'
                    }}>
                      {getStatusLabel('resolved', t)}
                    </Text>
                  </Text>
                  <Text style={styles.updateTime}>{formatDate(displayComplaint.resolved_at)}</Text>
                </View>
                {Boolean(displayComplaint.resolution_notes) && (
                  <Text style={styles.updateNotes}>{displayComplaint.resolution_notes}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.noUpdatesText}>
                {t('citizen:mobileDetail.noUpdates')}
              </Text>
            )}
          </View>
          
          {/* Priority Information */}
          <View style={styles.priorityContainer}>
            <Text style={styles.sectionTitle}>{t('citizen:mobileDetail.priorityInfo')}</Text>
            <View style={styles.priorityRow}>
              <View style={styles.priorityItem}>
                <Text style={styles.priorityLabel}>{t('citizen:complaintDetail.priorityScore')}</Text>
                <View style={[styles.priorityBadge, { 
                  backgroundColor: getPriorityColor(displayComplaint.priority_score)
                }]}>
                  <Text style={styles.priorityScore}>
                    {Number.isFinite(Number(displayComplaint.priority_score)) ? Number(displayComplaint.priority_score).toFixed(2) : t('common:mobileNav.na')}
                  </Text>
                </View>
              </View>
              <View style={styles.priorityItem}>
                <Text style={styles.priorityLabel}>{t('citizen:mobileDetail.locationImpact')}</Text>
                <View style={[styles.priorityBadge, { 
                  backgroundColor: getPriorityColor(displayComplaint.location_sensitivity_score)
                }]}>
                  <Text style={styles.priorityScore}>
                    {Number.isFinite(Number(displayComplaint.location_sensitivity_score)) ? Number(displayComplaint.location_sensitivity_score).toFixed(2) : t('common:mobileNav.na')}
                  </Text>
                </View>
              </View>
              <View style={styles.priorityItem}>
                <Text style={styles.priorityLabel}>{t('citizen:mobileDetail.aiConfidence')}</Text>
                <View style={[styles.priorityBadge, { 
                  backgroundColor: getPriorityColor(displayComplaint.ai_confidence_score)
                }]}>
                  <Text style={styles.priorityScore}>
                    {Number.isFinite(Number(displayComplaint.ai_confidence_score)) ? Number(displayComplaint.ai_confidence_score).toFixed(2) : t('common:mobileNav.na')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Compact Algorithm Breakdown Section */}
            <TouchableOpacity 
              style={styles.breakdownToggle}
              onPress={() => {
                if (!showBreakdown && !breakdownData) {
                  fetchBreakdownData();
                }
                setShowBreakdown(!showBreakdown);
              }}
            >
              <View style={styles.breakdownHeader}>
                <Text style={styles.breakdownTitle}>{t('citizen:mobileDetail.algorithmBreakdown')}</Text>
                <Ionicons 
                  name={showBreakdown ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#666" 
                />
              </View>
            </TouchableOpacity>

            {showBreakdown && (
              <View style={styles.breakdownContent}>
                {loadingBreakdown ? (
                  <View style={styles.breakdownLoading}>
                    <ActivityIndicator size="small" color="#1A1A1A" />
                    <Text style={styles.breakdownLoadingText}>{t('citizen:mobileDetail.loadingBreakdown')}</Text>
                  </View>
                ) : breakdownData ? (
                  <View style={styles.algorithmScores}>
                    {/* Infrastructure Score */}
                    <View style={styles.scoreRow}>
                      <View style={styles.scoreInfo}>
                        <Text style={styles.scoreName}>{t('citizen:mobileDetail.infrastructure')}</Text>
                        <Text style={styles.scorePercent}>
                          {Math.round((breakdownData.infrastructureScore || 0) * 100)}%
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill,
                            { 
                              width: `${Math.round((breakdownData.infrastructureScore || 0) * 100)}%`,
                              backgroundColor: '#4CAF50'
                            }
                          ]} 
                        />
                      </View>
                    </View>

                    {/* Image Analysis Score */}
                    <View style={styles.scoreRow}>
                      <View style={styles.scoreInfo}>
                        <Text style={styles.scoreName}>{t('citizen:mobileDetail.imageAnalysis')}</Text>
                        <Text style={styles.scorePercent}>
                          {Math.round((breakdownData.imageValidationScore || 0) * 100)}%
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill,
                            { 
                              width: `${Math.round((breakdownData.imageValidationScore || 0) * 100)}%`,
                              backgroundColor: '#2196F3'
                            }
                          ]} 
                        />
                      </View>
                    </View>

                    {/* Emotion Analysis Score */}
                    <View style={styles.scoreRow}>
                      <View style={styles.scoreInfo}>
                        <Text style={styles.scoreName}>{t('citizen:mobileDetail.emotionAnalysis')}</Text>
                        <Text style={styles.scorePercent}>
                          {Math.round((breakdownData.emotionScore || 0) * 100)}%
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill,
                            { 
                              width: `${Math.round((breakdownData.emotionScore || 0) * 100)}%`,
                              backgroundColor: '#FF9800'
                            }
                          ]} 
                        />
                      </View>
                    </View>

                    {/* Community Voting Score */}
                    <View style={styles.scoreRow}>
                      <View style={styles.scoreInfo}>
                        <Text style={styles.scoreName}>{t('citizen:complaintDetail.communityVotes')}</Text>
                        <Text style={styles.scorePercent}>
                          {Math.round((breakdownData.voteScore || 0) * 100)}%
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View 
                          style={[
                            styles.progressFill,
                            { 
                              width: `${Math.round((breakdownData.voteScore || 0) * 100)}%`,
                              backgroundColor: '#9C27B0'
                            }
                          ]} 
                        />
                      </View>
                    </View>

                    <Text style={styles.weightingNote}>
                      {t('citizen:mobileDetail.weightingNote')}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.breakdownError}>{t('citizen:mobileDetail.breakdownUnavailable')}</Text>
                )}
              </View>
            )}
          </View>
          
          {/* Metadata */}
          <View style={styles.metadataContainer}>
            <Text style={styles.metadataText}>{t('citizen:mobileDetail.complaintId', { id: displayComplaint.id })}</Text>
            <Text style={styles.metadataText}>{t('citizen:mobileReports.submittedOn', { date: formatDate(displayComplaint.created_at) })}</Text>
            {Boolean(displayComplaint.resolved_at) && (
              <Text style={styles.metadataText}>{t('citizen:mobileDetail.resolvedOn', { date: formatDate(displayComplaint.resolved_at) })}</Text>
            )}
          </View>
          
          {/* Similar Complaints */}
          {displaySimilar.length > 0 && (
            <View style={styles.similarContainer}>
              <Text style={styles.sectionTitle}>{t('citizen:mobileDetail.similarNearby')}</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarList}
              >
                {displaySimilar.map((similar, index) => (
                  <TouchableOpacity 
                    key={index}
                    style={styles.similarItem}
                    onPress={() => handleNavigateToSimilarComplaint(similar.id)}
                  >
                    {similar.image_urls && similar.image_urls.length > 0 ? (
                      <Image 
                        source={{ uri: similar.image_urls[0] }} 
                        style={styles.similarImage}
                      />
                    ) : (
                      <View style={styles.noSimilarImage}>
                        <Ionicons name="image" size={20} color="#ddd" />
                      </View>
                    )}
                    <Text style={styles.similarTitle} numberOfLines={1}>{similar.title}</Text>
                    <View style={styles.similarFooter}>
                      <View style={[styles.similarStatus, { 
                        backgroundColor: getStatusColor(similar.status)
                      }]}>
                        <Text style={styles.similarStatusText}>
                          {getStatusLabel(similar.status, t)}
                        </Text>
                      </View>
                      <Text style={styles.similarDistance}>{similar.distance}m</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          
          {/* Bottom space */}
          <View style={{ height: 80 }} />
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

const getPriorityColor = (score) => {
  if (!score) return '#9e9e9e';
  
  if (score >= 0.7) return '#f44336';
  if (score >= 0.5) return '#ff9800';
  if (score >= 0.3) return '#ffc107';
  return '#4caf50';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  animatedHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 90 : 60,
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  backIcon: {
    position: 'absolute',
    left: 16,
    bottom: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareIcon: {
    position: 'absolute',
    right: 16,
    bottom: 14,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    maxWidth: '70%',
  },
  imageContainer: {
    height: 300,
    width: '100%',
    position: 'relative',
  },
  complaintImage: {
    height: '100%',
    width: '100%',
  },
  noImageContainer: {
    height: '100%',
    width: '100%',
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#999',
    marginTop: 10,
    fontSize: 16,
  },
  imageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  imageBottomContent: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  userContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  userName: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: 15,
  },
  timeAgo: {
    color: '#777',
    fontSize: 12,
    marginTop: 2,
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 20,
  },
  voteCount: {
    marginLeft: 6,
    fontWeight: 'bold',
    color: '#777',
    fontSize: 15,
  },
  userVotedText: {
    color: '#1A1A1A',
  },
  descriptionContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  locationContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  locationAddress: {
    fontSize: 14,
    color: '#555',
    marginBottom: 12,
  },
  mapContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  customMarker: {
    alignItems: 'center',
  },
  markerBody: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#1A1A1A',
  },
  viewOnMapButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  viewOnMapText: {
    color: '#1A1A1A',
    fontSize: 12,
    marginRight: 4,
    fontWeight: '500',
  },
  statusTimelineContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeline: {
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ddd',
    marginRight: 10,
  },
  completedDot: {
    backgroundColor: '#4caf50',
  },
  rejectedDot: {
    backgroundColor: '#f44336',
  },
  timelineLine: {
    position: 'absolute',
    top: 16,
    left: 8,
    width: 2,
    height: 30,
    backgroundColor: '#ddd',
  },
  completedLine: {
    backgroundColor: '#4caf50',
  },
  rejectedLine: {
    backgroundColor: '#f44336',
  },
  timelineText: {
    fontSize: 14,
    color: '#777',
  },
  completedText: {
    color: '#4caf50',
    fontWeight: '500',
  },
  rejectedText: {
    color: '#f44336',
    fontWeight: '500',
  },
  updatesContainer: {
    marginTop: 8,
  },
  updateItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  updateTitle: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  updateTime: {
    fontSize: 12,
    color: '#999',
  },
  updateNotes: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  noUpdatesText: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  priorityContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priorityItem: {
    alignItems: 'center',
    flex: 1,
  },
  priorityLabel: {
    fontSize: 12,
    color: '#777',
    marginBottom: 6,
  },
  priorityBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priorityScore: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  metadataContainer: {
    backgroundColor: '#f0f2f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  metadataText: {
    fontSize: 12,
    color: '#777',
    marginBottom: 2,
  },
  similarContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  similarList: {
    paddingVertical: 8,
  },
  similarItem: {
    width: 140,
    marginRight: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    overflow: 'hidden',
  },
  similarImage: {
    width: '100%',
    height: 80,
  },
  noSimilarImage: {
    width: '100%',
    height: 80,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  similarTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    padding: 8,
    paddingBottom: 4,
  },
  similarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  similarStatus: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  similarStatusText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
  },
  similarDistance: {
    fontSize: 10,
    color: '#777',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBackButton: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 10,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fixedBackButton: {
    position: 'absolute',
    left: 16,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  fixedShareButton: {
    position: 'absolute',
    right: 16,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  // Breakdown Section Styles
  breakdownToggle: {
    marginTop: 12,
    paddingVertical: 8,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  breakdownContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  breakdownLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  algorithmScores: {
    paddingVertical: 8,
  },
  scoreRow: {
    marginBottom: 12,
  },
  scoreInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  scoreName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  scorePercent: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#666',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  weightingNote: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  breakdownError: {
    textAlign: 'center',
    color: '#f44336',
    fontSize: 12,
    paddingVertical: 12,
  },
  breakdownLoadingText: {
    marginLeft: 8,
    fontSize: 12,
    color: '#666',
  },
  geometryPanel: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 14,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 4,
    borderLeftColor: '#1A1A1A',
  },
  geometryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  geometryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginLeft: 6,
  },
  geometryRow: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 4,
  },
  geometryDisclaimer: {
    fontSize: 11,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 4,
  },
  geometryLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  geometryRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  geometryRetryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  geometryRetryButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  geometryRetrySecondaryText: {
    color: '#1A1A1A',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default ComplaintDetailScreen;

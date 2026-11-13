import React, { useState, useEffect, useRef } from 'react';
import {
 View,
 Text,
 StyleSheet,
 FlatList,
 Image,
 TouchableOpacity,
 Animated,
 Dimensions,
 RefreshControl,
 ActivityIndicator,
 Platform,
 Alert,
 Linking
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { makeApiCall, apiClient } from '../../../config/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { refetchComplaintVotes } from '../../utils/voteUtils';
import { handleVoting } from '../../utils/enhancedVoteUtils';
import LocationService from '../../services/LocationService';
import FloatingChatbotButton from '../../components/FloatingChatbotButton';
import NewsCarousel from '../../components/NewsCarousel';
import NewsCard from '../../components/NewsCard';
import NewsService from '../../services/NewsService';
import WeatherWidget from '../../components/WeatherWidget';
import { useTranslatedList } from '../../context/TranslationContext';
import { formatLocalizedRelativeTime } from '../../utils/dateLocale';
import { getCategoryLabel, getStatusLabel } from '../../utils/priorityUtils';

const { width } = Dimensions.get('window');
const CARD_HEIGHT = 380;

const ComplaintFeedScreen = ({ navigation }) => {
 const { t, i18n } = useTranslation(['citizen', 'common', 'complaint']);
 const [complaints, setComplaints] = useState([]);
 const translatedComplaints = useTranslatedList(complaints, ['title', 'description', 'location_address', 'reporterName']);
 const [loading, setLoading] = useState(true);
 const [refreshing, setRefreshing] = useState(false);
 const [userLocation, setUserLocation] = useState(null);
 const [locationLoading, setLocationLoading] = useState(true);
 
 // News state - only topNews needed for header carousel
 const [topNews, setTopNews] = useState([]);
 const [newsLoading, setNewsLoading] = useState(true);
 const [feedData, setFeedData] = useState([]);
 
 const insets = useSafeAreaInsets();

 // Animation values
 const scrollY = useRef(new Animated.Value(0)).current;
 const likeAnimations = useRef({});

 // Get current location on component mount
 useEffect(() => {
 fetchUserLocation();
 }, []);

 // Fetch complaints when location is available
 useEffect(() => {
 if (userLocation) {
 fetchNearbyComplaints();
 }
 }, [userLocation]);

 const fetchUserLocation = async () => {
 setLocationLoading(true);
 try {
 // Use the LocationService singleton instance directly
 const locationData = await LocationService.getExactLocation();

 if (locationData) {
 console.log(' User location:', locationData);
 const coords = {
 latitude: locationData.latitude,
 longitude: locationData.longitude,
 };
 setUserLocation(coords);
 return coords;
 } else {
 Alert.alert(
 t('citizen:mobilePrivacy.locationError'),
 t('citizen:mobileFeed.locationDetermineFailed'),
 [{ text: t('common:mobileNav.ok') }]
 );
 return null;
 }
 } catch (error) {
 console.error(' Error getting location:', error);
 Alert.alert(
 t('citizen:mobilePrivacy.locationError'),
 t('citizen:mobileFeed.locationPermissionNeeded'),
 [
 { text: t('common:mobileNav.cancel') },
 { 
 text: t('common:mobileNav.settings'), 
 onPress: async () => {
 if (Platform.OS === 'ios') {
 Linking.openURL('app-settings:');
 } else {
 Linking.openSettings();
 }
 }
 }
 ]
 );
 } finally {
 setLocationLoading(false);
 }
 };

 const fetchNearbyComplaints = async (locationOverride = null) => {
 const targetLocation = locationOverride || userLocation;
 if (!targetLocation) return;
 
 setLoading(true);
 try {
 // Call the backend API to get complaints within 5km
 const response = await makeApiCall(
 `${apiClient.baseUrl}/api/complaints?latitude=${targetLocation.latitude}&longitude=${targetLocation.longitude}&radius=5000`,
 { method: 'GET' }
 );
 
 if (response.success && response.complaints) {
 // Create animation refs for each complaint
 const complaintsWithDetails = response.complaints.map(complaint => {
 // Initialize like animation if it doesn't exist
 if (!likeAnimations.current[complaint.id]) {
 likeAnimations.current[complaint.id] = new Animated.Value(complaint.userVoted ? 1 : 0);
 }
 
 // Calculate time ago
 const timeAgo = getTimeAgo(new Date(complaint.created_at));
 const reporterName = complaint.users?.full_name || complaint.user?.full_name || complaint.user_name || complaint.citizenName || '';
 
 return {
 ...complaint,
 reporterName,
 timeAgo,
 voteCount: complaint.vote_count || 0,
 userVoted: complaint.userVoted || false,
 };
 });
 
 setComplaints(complaintsWithDetails);
 } else {
 console.error(' Error fetching complaints:', response);
 setComplaints([]);
 }
 } catch (error) {
 console.error(' Error fetching nearby complaints:', error);
 Alert.alert(
 t('citizen:mobileFeed.loadErrorTitle'),
 t('citizen:mobileFeed.loadErrorDesc'),
 [{ text: t('common:mobileNav.ok') }]
 );
 setComplaints([]);
 } finally {
 setLoading(false);
 setRefreshing(false);
 }
 };

 const onRefresh = async () => {
 setRefreshing(true);
 const latestLocation = await fetchUserLocation();
 const targetLocation = latestLocation || userLocation;
 if (targetLocation) {
 await fetchNearbyComplaints(targetLocation);
 }
 // Also refresh news
 await fetchNews();
 setRefreshing(false);
 };

 // Fetch civic news for header carousel only
 const fetchNews = async () => {
 try {
 setNewsLoading(true);
 console.log(' Starting to fetch news for header carousel...');
 
 // Clear cache to force fresh API call
 NewsService.clearCache();
 console.log(' Cache cleared, forcing fresh news fetch');
 
 // Fetch top 10 news for carousel
 const topNewsResult = await NewsService.getTopNews(10);
 console.log(' Top news result:', topNewsResult);
 if (topNewsResult.success) {
 setTopNews(topNewsResult.news);
 console.log(' Set top news for header:', topNewsResult.news.length, 'articles');
 console.log(' News source:', topNewsResult.source);
 }
 
 console.log(` Fetched ${topNewsResult.news?.length || 0} news articles for header`);
 } catch (error) {
 console.error(' Error fetching news:', error);
 } finally {
 setNewsLoading(false);
 }
 };

 // Create feed data (only complaints, no interspersed news)
 const createFeedData = () => {
 const sourceList = translatedComplaints.length > 0 ? translatedComplaints : complaints;
 if (!sourceList.length) {
 return [];
 }
 
 // Only return complaint items - news will be shown in header
 return sourceList.map(complaint => ({
 id: complaint.id,
 type: 'complaint',
 data: complaint
 }));
 };

 // Update feed data when complaints change (no news interspersing)
 useEffect(() => {
 const feed = createFeedData();
 setFeedData(feed);
 }, [translatedComplaints, complaints]);

 // Fetch news on component mount
 useEffect(() => {
 fetchNews();
 }, []);

 const handleUpvote = async (complaintId, index) => {
 // Find the complaint in the state
 const complaint = complaints.find(c => c.id === complaintId);
 if (!complaint) return;
 
 // Animate the like button immediately for better UX
 Animated.sequence([
 Animated.timing(likeAnimations.current[complaintId], {
 toValue: complaint.userVoted ? 0 : 1,
 duration: 300,
 useNativeDriver: true,
 }),
 Animated.delay(100),
 Animated.spring(likeAnimations.current[complaintId], {
 toValue: complaint.userVoted ? 0 : 1,
 friction: 3,
 tension: 40,
 useNativeDriver: true,
 })
 ]).start();

 // Make API call to update vote and refetch current vote count
 const complaintIndex = complaints.findIndex(c => c.id === complaintId);
 
 try {
 // Use enhanced voting that handles both authenticated and guest voting
 const voteResponse = await handleVoting(complaintId, apiClient, makeApiCall);
 
 if (!voteResponse.success) {
 console.error(' Vote failed:', voteResponse);
 Alert.alert(
 t('citizen:mobileFeed.voteFailedTitle'),
 t('citizen:mobileFeed.voteFailedDesc'),
 [{ text: t('common:mobileNav.ok') }]
 );
 return;
 }

 // Always refetch the current vote count from server for accuracy
 const refetchResponse = await refetchComplaintVotes(complaintId, apiClient);
 
 if (refetchResponse.success && complaintIndex > -1) {
 const updatedComplaints = [...complaints];
 updatedComplaints[complaintIndex] = {
 ...updatedComplaints[complaintIndex],
 voteCount: refetchResponse.voteCount,
 userVoted: refetchResponse.userVoted
 };
 setComplaints(updatedComplaints);
 
 // Update animation to match server state
 if (likeAnimations.current[complaintId]) {
 Animated.spring(likeAnimations.current[complaintId], {
 toValue: refetchResponse.userVoted ? 1 : 0,
 friction: 3,
 tension: 40,
 useNativeDriver: true,
 }).start();
 }
 
 console.log(` Vote updated: ${refetchResponse.userVoted ? 'Voted' : 'Unvoted'}, Count: ${refetchResponse.voteCount}`);
 } else {
 console.error(' Failed to refetch vote count');
 }
 } catch (error) {
 console.error(' Error voting for complaint:', error);
 // Revert changes if API call errors
 const revertedComplaints = [...complaints];
 revertedComplaints[complaintIndex] = complaint;
 setComplaints(revertedComplaints);
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
 return <FontAwesome5 name="dot-circle" size={16} color="#1A1A1A" />;
 case 'fallen_tree':
 return <MaterialCommunityIcons name="pine-tree" size={18} color="#1A1A1A" />;
 case 'garbage_dumping':
 return <MaterialCommunityIcons name="delete" size={18} color="#1A1A1A" />;
 case 'stray_cattle':
 return <MaterialCommunityIcons name="cow" size={18} color="#1A1A1A" />;
 case 'fallen_electric_pole':
 return <Ionicons name="flash" size={18} color="#1A1A1A" />;
 case 'concrete_structure_damage':
 return <MaterialCommunityIcons name="wall" size={18} color="#1A1A1A" />;
 case 'road_waterlogging':
 return <MaterialCommunityIcons name="home-flood" size={18} color="#1A1A1A" />;
 // Legacy categories kept for older complaints already in the database
 case 'road_damage':
 return <MaterialCommunityIcons name="road-variant" size={18} color="#1A1A1A" />;
 case 'water_issue':
 return <Ionicons name="water" size={18} color="#1A1A1A" />;
 case 'sewage_overflow':
 return <MaterialCommunityIcons name="water-pump" size={18} color="#1A1A1A" />;
 case 'garbage':
 return <MaterialCommunityIcons name="delete" size={18} color="#1A1A1A" />;
 case 'streetlight':
 return <Ionicons name="flashlight" size={18} color="#1A1A1A" />;
 case 'electricity':
 return <Ionicons name="flash" size={18} color="#1A1A1A" />;
 case 'tree_issue':
 return <MaterialCommunityIcons name="tree" size={18} color="#1A1A1A" />;
 case 'flooding':
 return <MaterialCommunityIcons name="home-flood" size={18} color="#1A1A1A" />;
 default:
 return <MaterialCommunityIcons name="alert-circle" size={18} color="#1A1A1A" />;
 }
 };

 const getStatusColor = (status) => {
 switch (status) {
 case 'pending':
 return '#1A1A1A';
 case 'in_progress':
 return '#1A1A1A';
 case 'resolved':
 return '#1A1A1A';
 case 'rejected':
 return '#1A1A1A';
 default:
 return '#1A1A1A';
 }
 };

 // Handle news press
 const handleNewsPress = (article) => {
 Alert.alert(
 article.headline,
 `${article.summary}\n\n${t('citizen:mobileFeed.sourcePrefix', { source: article.source })}`,
 [{ text: t('citizen:mobileFeed.close') }]
 );
 };

 // Render function for feed items (only complaints now)
 const renderFeedItem = ({ item, index }) => {
 console.log(` Rendering complaint ${index}:`, item.data.title);
 
 // Only render complaint cards since news is in header
 return renderComplaintCard({ item: item.data, index });
 };

 const renderComplaintCard = ({ item, index }) => {
 // Calculate animations based on scroll position
 const inputRange = [
 -1, 
 0,
 CARD_HEIGHT * index,
 CARD_HEIGHT * (index + 0.5),
 CARD_HEIGHT * (index + 1),
 ];
 
 const scale = scrollY.interpolate({
 inputRange,
 outputRange: [1, 1, 1, 0.98, 0.95],
 });
 
 const opacity = scrollY.interpolate({
 inputRange,
 outputRange: [1, 1, 1, 0.85, 0.7],
 });

 // Like button animation
 const likeAnim = likeAnimations.current[item.id] || new Animated.Value(item.userVoted ? 1 : 0);
 const likeScale = likeAnim.interpolate({
 inputRange: [0, 0.5, 1],
 outputRange: [1, 1.3, 1],
 });

 return (
 <Animated.View
 style={[
 styles.card,
 {
 transform: [{ scale }],
 opacity,
 }
 ]}
 >
 {/* Card Header */}
 <View style={styles.cardHeader}>
  <View style={styles.userInfo}>
  <View style={styles.userAvatar}>
  <Text style={styles.userAvatarText}>
  {(item.reporterName || t('citizen:feed.verifiedCitizen')).charAt(0).toUpperCase()}
  </Text>
  </View>
  <View>
  <Text style={styles.userName}>
  {item.reporterName || t('citizen:feed.verifiedCitizen')}
  </Text>
 <View style={styles.locationRow}>
 <Ionicons name="location" size={12} color="#777" />
 <Text style={styles.locationText} numberOfLines={1}>
 {item.location_address?.substring(0, 30) || t('citizen:mobileFeed.unknownLocation')}
 </Text>
 </View>
 </View>
 </View>
 <View style={styles.timeContainer}>
 <Text style={styles.timeAgo}>
 {formatLocalizedRelativeTime(item.created_at, item.timeAgo, i18n.language)}
 </Text>
 <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
 <Text style={styles.statusText}>
 {getStatusLabel(item.status, t)}
 </Text>
 </View>
 </View>
 </View>
 
 {/* Card Image */}
 <View style={styles.imageContainer}>
 {item.image_urls && item.image_urls.length > 0 ? (
 <Image 
 source={{ uri: item.image_urls[0] }} 
 style={styles.cardImage}
 resizeMode="cover"
 />
 ) : (
 <View style={styles.noImageContainer}>
 <Ionicons name="image" size={50} color="#ddd" />
 <Text style={styles.noImageText}>{t('citizen:mobileFeed.noImage')}</Text>
 </View>
 )}
 
 <View style={styles.categoryBadge}>
 {getCategoryIcon(item.category)}
 <Text style={styles.categoryText}>
 {item.category ? getCategoryLabel(item.category, t) : t('common:mobileNav.general')}
 </Text>
 </View>
 </View>
 
 {/* Card Content */}
 <View style={styles.cardContent}>
 <Text style={styles.cardTitle} numberOfLines={1}>{item.title || t('citizen:feed.untitledIncident')}</Text>
 <Text style={styles.cardDescription} numberOfLines={2}>
 {item.description}
 </Text>
 </View>
 
 {/* Card Footer */}
 <View style={styles.cardFooter}>
 <TouchableOpacity 
 style={styles.voteButton} 
 onPress={() => handleUpvote(item.id, index)}
 activeOpacity={0.7}
 >
 <Animated.View style={{ transform: [{ scale: likeScale }] }}>
 <Ionicons 
 name={item.userVoted ? "arrow-up-circle" : "arrow-up-circle-outline"} 
 size={26} 
 color={item.userVoted ? "#1A1A1A" : "#777"} 
 />
 </Animated.View>
 <Text style={[styles.voteCount, item.userVoted && styles.userVotedText]}>
 {item.voteCount || 0}
 </Text>
 </TouchableOpacity>
 
 <TouchableOpacity 
 style={styles.detailsButton}
 onPress={() => navigation.navigate('ComplaintDetail', { complaintId: item.id })}
 >
 <Text style={styles.detailsText}>{t('citizen:mobileFeed.viewDetails')}</Text>
 <Ionicons name="chevron-forward" size={16} color="#1A1A1A" />
 </TouchableOpacity>
 </View>
 </Animated.View>
 );
 };

 if (locationLoading) {
 return (
 <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
 <ActivityIndicator size="large" color="#1A1A1A" />
 <Text style={styles.loadingText}>{t('citizen:mobileFeed.gettingLocation')}</Text>
 </View>
 );
 }

 return (
 <View style={[styles.container, { paddingTop: insets.top }]}>
 <View style={styles.header}>
 <Text style={styles.headerTitle}>{t('citizen:mobileFeed.nearbyIssues')}</Text>
 {userLocation && (
 <TouchableOpacity 
 style={styles.locationButton}
 onPress={fetchUserLocation}
 >
 <Ionicons name="locate" size={16} color="#fff" />
 <Text style={styles.locationButtonText}>{t('citizen:mobileFeed.within5km')}</Text>
 </TouchableOpacity>
 )}
 </View>
 
 {loading && !refreshing ? (
 <View style={styles.loadingContainer}>
 <ActivityIndicator size="large" color="#1A1A1A" />
 <Text style={styles.loadingText}>{t('citizen:mobileFeed.loadingNearby')}</Text>
 </View>
 ) : complaints.length === 0 ? (
 <View style={styles.emptyContainer}>
 <Ionicons name="alert-circle-outline" size={60} color="#ccc" />
 <Text style={styles.emptyTitle}>{t('citizen:mobileFeed.noComplaintsTitle')}</Text>
 <Text style={styles.emptyText}>
 {t('citizen:mobileFeed.noComplaintsDesc')}
 </Text>
 <TouchableOpacity 
 style={styles.reportButton}
 onPress={() => navigation.navigate('SubmitComplaint')}
 >
 <Ionicons name="add-circle" size={20} color="#fff" />
 <Text style={styles.reportButtonText}>{t('citizen:mobileFeed.reportIssue')}</Text>
 </TouchableOpacity>
 </View>
 ) : (
 <Animated.FlatList
 data={feedData}
 renderItem={renderFeedItem}
 keyExtractor={(item) => item.id}
 contentContainerStyle={styles.listContainer}
 showsVerticalScrollIndicator={false}
 onScroll={Animated.event(
 [{ nativeEvent: { contentOffset: { y: scrollY } } }],
 { useNativeDriver: true }
 )}
 refreshControl={
 <RefreshControl
 refreshing={refreshing || newsLoading}
 onRefresh={onRefresh}
 colors={['#1A1A1A']}
 tintColor="#1A1A1A"
 />
 }
 ListHeaderComponent={() => {
 return (
 <View style={{ marginBottom: 10 }}>
 <WeatherWidget />
 {/* News Carousel - Always at top */}
 {topNews.length > 0 ? (
 <>
 <View style={{ marginBottom: 8 }}>
 <Text style={{ 
 fontSize: 16, 
 fontWeight: 'bold', 
 color: '#333', 
 marginHorizontal: 16, 
 marginBottom: 8 
 }}>
 {t('citizen:mobileFeed.civicNews')}
 </Text>
 <NewsCarousel
 news={topNews}
 onNewsPress={handleNewsPress}
 />
 </View>
 <View style={{ 
 height: 1, 
 backgroundColor: '#eee', 
 marginHorizontal: 16, 
 marginVertical: 8 
 }} />
 <Text style={{ 
 fontSize: 16, 
 fontWeight: 'bold', 
 color: '#333', 
 marginHorizontal: 16, 
 marginBottom: 8 
 }}>
 {t('citizen:mobileFeed.communityReports')}
 </Text>
 </>
 ) : (
 <>
 <View style={{ padding: 10, backgroundColor: '#f0f0f0', margin: 10, borderRadius: 8 }}>
 <Text style={{ textAlign: 'center', color: '#666' }}>
 {t('citizen:mobileFeed.loadingNews')}
 </Text>
 </View>
 <Text style={{ 
 fontSize: 16, 
 fontWeight: 'bold', 
 color: '#333', 
 marginHorizontal: 16, 
 marginBottom: 8 
 }}>
 {t('citizen:mobileFeed.communityReports')}
 </Text>
 </>
 )}
 </View>
 );
 }}
 />
 )}
 
 {/* ELEGANT BLUE CHATBOT BUTTON */}
 <TouchableOpacity
 style={{
 position: 'absolute',
 bottom: 120,
 right: 20,
 width: 60,
 height: 60,
 borderRadius: 30,
 backgroundColor: '#1A1A1A',
 justifyContent: 'center',
 alignItems: 'center',
 elevation: 8,
 shadowColor: '#1A1A1A',
 shadowOffset: { width: 0, height: 4 },
 shadowOpacity: 0.3,
 shadowRadius: 8,
 borderWidth: 3,
 borderColor: '#FFFFFF',
 zIndex: 1000,
 }}
 onPress={() => {
 console.log(' Blue chatbot button pressed from feed!');
 navigation.navigate('CivicChatbot');
 }}
 activeOpacity={0.8}
 >
 <MaterialCommunityIcons 
 name="robot-happy" 
 size={28} 
 color="#FFFFFF" 
 />
 </TouchableOpacity>
 </View>
 );
};

const styles = StyleSheet.create({
 container: {
 flex: 1,
 backgroundColor: '#f8f9fa',
 },
 header: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 paddingHorizontal: 20,
 paddingVertical: 12,
 backgroundColor: '#fff',
 elevation: 2,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 1,
 },
 headerTitle: {
 fontSize: 20,
 fontWeight: 'bold',
 color: '#333',
 },
 locationButton: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#1A1A1A',
 paddingHorizontal: 10,
 paddingVertical: 5,
 borderRadius: 15,
 },
 locationButtonText: {
 color: '#fff',
 fontSize: 12,
 marginLeft: 4,
 fontWeight: '500',
 },
 listContainer: {
 padding: 16,
 paddingBottom: 80, // Extra padding for bottom nav
 },
 card: {
 backgroundColor: '#fff',
 borderRadius: 16,
 marginBottom: 16,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.1,
 shadowRadius: 4,
 elevation: 3,
 overflow: 'hidden',
 },
 cardHeader: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 padding: 12,
 borderBottomWidth: 1,
 borderBottomColor: '#f5f5f5',
 },
 userInfo: {
 flexDirection: 'row',
 alignItems: 'center',
 },
 userAvatar: {
 width: 36,
 height: 36,
 borderRadius: 18,
 backgroundColor: '#1A1A1A',
 justifyContent: 'center',
 alignItems: 'center',
 marginRight: 10,
 },
 userAvatarText: {
 color: '#fff',
 fontWeight: 'bold',
 fontSize: 16,
 },
 userName: {
 fontWeight: '600',
 color: '#333',
 fontSize: 14,
 },
 locationRow: {
 flexDirection: 'row',
 alignItems: 'center',
 marginTop: 2,
 },
 locationText: {
 fontSize: 11,
 color: '#777',
 marginLeft: 2,
 maxWidth: 150,
 },
 timeContainer: {
 alignItems: 'flex-end',
 },
 timeAgo: {
 fontSize: 11,
 color: '#999',
 marginBottom: 3,
 },
 statusBadge: {
 paddingHorizontal: 8,
 paddingVertical: 2,
 borderRadius: 10,
 },
 statusText: {
 color: '#fff',
 fontSize: 10,
 fontWeight: 'bold',
 },
 imageContainer: {
 width: '100%',
 height: 180,
 position: 'relative',
 },
 cardImage: {
 width: '100%',
 height: '100%',
 },
 noImageContainer: {
 width: '100%',
 height: '100%',
 backgroundColor: '#f9f9f9',
 justifyContent: 'center',
 alignItems: 'center',
 },
 noImageText: {
 color: '#aaa',
 marginTop: 8,
 fontSize: 14,
 },
 categoryBadge: {
 position: 'absolute',
 bottom: 10,
 left: 10,
 backgroundColor: 'rgba(0,0,0,0.7)',
 paddingHorizontal: 10,
 paddingVertical: 5,
 borderRadius: 12,
 flexDirection: 'row',
 alignItems: 'center',
 },
 categoryText: {
 color: '#fff',
 fontSize: 12,
 marginLeft: 4,
 fontWeight: '500',
 textTransform: 'capitalize',
 },
 cardContent: {
 padding: 15,
 },
 cardTitle: {
 fontSize: 16,
 fontWeight: 'bold',
 color: '#333',
 marginBottom: 5,
 },
 cardDescription: {
 fontSize: 14,
 color: '#666',
 lineHeight: 20,
 },
 cardFooter: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 padding: 12,
 borderTopWidth: 1,
 borderTopColor: '#f5f5f5',
 },
 voteButton: {
 flexDirection: 'row',
 alignItems: 'center',
 },
 voteCount: {
 marginLeft: 5,
 fontSize: 14,
 color: '#777',
 fontWeight: '500',
 },
 userVotedText: {
 color: '#1A1A1A',
 fontWeight: 'bold',
 },
 detailsButton: {
 flexDirection: 'row',
 alignItems: 'center',
 },
 detailsText: {
 color: '#1A1A1A',
 fontSize: 14,
 fontWeight: '500',
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
 emptyContainer: {
 flex: 1,
 justifyContent: 'center',
 alignItems: 'center',
 padding: 20,
 },
 emptyTitle: {
 fontSize: 18,
 fontWeight: 'bold',
 color: '#333',
 marginTop: 16,
 marginBottom: 8,
 },
 emptyText: {
 fontSize: 14,
 color: '#666',
 textAlign: 'center',
 marginBottom: 20,
 },
 reportButton: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#1A1A1A',
 paddingHorizontal: 16,
 paddingVertical: 10,
 borderRadius: 20,
 marginTop: 10,
 },
 reportButtonText: {
 color: '#fff',
 fontSize: 14,
 fontWeight: 'bold',
 marginLeft: 8,
 },
 chatbotButton: {
 position: 'absolute',
 bottom: 100, // Above the tab bar
 right: 20,
 width: 70,
 height: 70,
 borderRadius: 35,
 elevation: 8,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 4 },
 shadowOpacity: 0.3,
 shadowRadius: 6,
 zIndex: 1000,
 },
 chatbotGradient: {
 width: '100%',
 height: '100%',
 borderRadius: 35,
 justifyContent: 'center',
 alignItems: 'center',
 borderWidth: 3,
 borderColor: '#fff',
 },
 chatbotText: {
 color: '#fff',
 fontSize: 9,
 fontWeight: 'bold',
 marginTop: 2,
 textAlign: 'center',
 },
});

export default ComplaintFeedScreen;

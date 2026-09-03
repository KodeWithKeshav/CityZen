import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {

  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  SafeAreaView,
  Platform,
  Modal,
  ScrollView,

} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { API_BASE_URL, makeApiCall, apiClient } from '../../../config/supabase';
import { supabase } from '../../../config/supabase';
import LocationPrivacySelector from '../../components/LocationPrivacySelector';
import LocationService from '../../services/LocationService';
import SarvamSpeechService from '../../services/SarvamSpeechService';
import CustomTextInput from '../../components/CustomTextInput';
import InfrastructureService from '../../services/InfrastructureService';

const MultiStepSubmitComplaintScreen = ({ navigation }) => {

  // Overall flow state
  const [currentStep, setCurrentStep] = useState(1);
  const [complaintData, setComplaintData] = useState({
    // Step 1: Issue type and location
    category: '',
    locationData: null,
    locationPriorityScore: null,

    // Step 2: Photo, validated against the Step 1 category
    selectedImage: null,
    imageValidation: null,

    // Step 3: Title, description, emotion + authenticity analysis
    title: '',
    description: '',
    selectedLang: 'hi-IN',
    emotionScore: null,
    contentAnalysis: null,
  });

  // Loading states
  const [loading, setLoading] = useState(false);
  const [validatingImage, setValidatingImage] = useState(false);
  const [autoCapturingLocation, setAutoCapturingLocation] = useState(false);
  const [locationCaptured, setLocationCaptured] = useState(false);

  // Voice input states
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [speechService] = useState(new SarvamSpeechService());
  const lastTranslationRef = useRef(null);

  // Language picker modal state
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  // Infrastructure modal state
  const [showInfrastructureModal, setShowInfrastructureModal] = useState(false);

  // Submission result
  const [submissionResult, setSubmissionResult] = useState(null);
  const [nearbyInfrastructure, setNearbyInfrastructure] = useState(null);
  const [isLoadingInfrastructure, setIsLoadingInfrastructure] = useState(false);

  // Refs for speech service
  // const descriptionInputRef = useRef(null); // Not needed with custom component

  // Language options for voice input
  const languageOptions = [
    { value: 'hi-IN', label: 'Hindi (हिंदी)', nativeName: 'हिंदी' },
    { value: 'en-US', label: 'English', nativeName: 'English' },
    { value: 'te-IN', label: 'Telugu (తెలుగు)', nativeName: 'తెలుగు' },
    { value: 'ta-IN', label: 'Tamil (தமிழ்)', nativeName: 'தமிழ்' },
    { value: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)', nativeName: 'ಕನ್ನಡ' },
    { value: 'mr-IN', label: 'Marathi (मराठी)', nativeName: 'मराठी' },
    { value: 'bn-IN', label: 'Bengali (বাংলা)', nativeName: 'বাংলা' },
    { value: 'gu-IN', label: 'Gujarati (ગુજરાતી)', nativeName: 'ગુજરાતી' },
    { value: 'ml-IN', label: 'Malayalam (മലയാളം)', nativeName: 'മലയാളം' },
    { value: 'pa-IN', label: 'Punjabi (ਪੰਜਾਬੀ)', nativeName: 'ਪੰਜਾਬੀ' },
  ];

  // Complaint categories - kept in sync with the civic issue classes the
  // CityZen SAM3 image workflow can detect and classify.
  const complaintCategories = [
    // Urgent Issues
    { value: 'fallen_electric_pole', label: 'Fallen Electric Pole / Line', urgency: 'urgent', icon: 'flash-outline' },
    { value: 'road_waterlogging', label: 'Road Waterlogging', urgency: 'urgent', icon: 'water-outline' },

    // Safety Issues
    { value: 'concrete_structure_damage', label: 'Concrete Structure Damage', urgency: 'safety', icon: 'construct-outline' },
    { value: 'fallen_tree', label: 'Fallen Tree', urgency: 'safety', icon: 'leaf-outline' },

    // General Infrastructure
    { value: 'pothole', label: 'Pothole', urgency: 'general', icon: 'ellipse-outline' },
    { value: 'garbage_dumping', label: 'Garbage Dumping', urgency: 'general', icon: 'trash-outline' },
    { value: 'stray_cattle', label: 'Stray Cattle on Road', urgency: 'general', icon: 'paw-outline' },

    // Other Issues
    { value: 'others', label: 'Others', urgency: 'general', icon: 'help-circle-outline' },
  ];

  // Memoized category lookup to prevent re-renders
  const selectedCategory = useMemo(() => {
    return complaintCategories.find(cat => cat.value === complaintData.category);
  }, [complaintData.category]);

  // Simple text change handlers - completely fresh approach
  const handleTitleChange = useCallback((text) => {
    setComplaintData(prev => ({ ...prev, title: text }));
  }, []);

  // Description content analysis: runs BOTH the emotion/sentiment analysis and
  // the authenticity / category-match check in one call against the backend's
  // analyze-text endpoint (this endpoint internally also computes the same
  // emotion analysis the old bare /api/emotion/analyze call used to return).
  const analyzeDescriptionContent = useCallback(async (text) => {
    if (!text || text.trim().length < 10) return;

    console.log('🧠 Starting description content analysis for text:', text.substring(0, 50) + '...');
    console.log('🌐 API_BASE_URL:', API_BASE_URL);

    try {
      console.log('📡 Calling analyze-text API:', apiClient.complaints.analyzeText);

      const result = await makeApiCall(apiClient.complaints.analyzeText, {
        method: 'POST',
        body: JSON.stringify({
          description: text,
          category: complaintData.category || 'others',
          imagePrimaryClass: complaintData.imageValidation?.primaryClass || null,
        }),
      });

      console.log('✅ analyze-text result:', result);

      if (result.success) {
        const emotionData = result.emotion ? {
          score: (result.emotion.emotionScore * 100).toFixed(1),
          emotions: result.emotion.emotions,
          analysisMethod: result.emotion.analysisMethod,
          language: result.emotion.language,
        } : null;

        console.log('💡 Setting content analysis data:', { emotionData, authenticity: result.authenticity });

        setComplaintData(prev => ({
          ...prev,
          emotionScore: emotionData,
          contentAnalysis: result.authenticity || null,
        }));
      } else {
        console.log('❌ analyze-text failed: Invalid response structure');
      }
    } catch (error) {
      console.error('❌ Description content analysis failed:', error);
      console.error('❌ Error details:', error.message);
    }
  }, [complaintData.category, complaintData.imageValidation]);

  const handleDescriptionChange = useCallback((text) => {
    setComplaintData(prev => ({ ...prev, description: text }));

    // Debounced content analysis (emotion + authenticity)
    if (text.trim().length > 10) {
      setTimeout(() => {
        analyzeDescriptionContent(text);
      }, 1000); // 1 second delay to avoid too many API calls
    } else {
      // Clear analysis for short text
      setComplaintData(prev => ({ ...prev, emotionScore: null, contentAnalysis: null }));
    }
  }, [analyzeDescriptionContent]);

  const handleLanguageChange = useCallback((itemValue) => {
    setComplaintData(prev => ({ ...prev, selectedLang: itemValue }));
  }, []);

  // ---------------------------------------------------------------------
  // Location capture logic - fires when the user picks/confirms a category
  // in the Issue & Location step (Step 1).
  // ---------------------------------------------------------------------
  const autoCaptureLocation = async (category) => {
    if (autoCapturingLocation || locationCaptured) return;

    setAutoCapturingLocation(true);

    try {
      // Get recommended privacy level for the complaint type
      const recommendedPrivacy = LocationService.getRecommendedPrivacyLevel(category);

      // Show user-friendly message about location capture
      const urgencyLevel = LocationService.determineUrgencyLevel(category);
      const isUrgent = urgencyLevel === 'urgent';

      Alert.alert(
        'Location Required',
        isUrgent
          ? `For ${category} complaints, we need your exact location to prioritize emergency response. This helps us route your complaint to the nearest response team.`
          : `We'll capture your location to help prioritize your complaint and route it to the correct municipal office. Your privacy is protected with street-level accuracy.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setAutoCapturingLocation(false)
          },
          {
            text: isUrgent ? 'Allow Exact Location' : 'Allow Location',
            onPress: () => proceedWithLocationCapture(recommendedPrivacy, category)
          }
        ]
      );

    } catch (error) {
      console.error('Auto location capture error:', error);
      setAutoCapturingLocation(false);
    }
  };

  const proceedWithLocationCapture = async (privacyLevel, category) => {
    try {
      // Capture location with recommended privacy level
      const location = await LocationService.getLocationWithPrivacy(privacyLevel, category);

      setComplaintData(prev => ({ ...prev, locationData: location }));
      setLocationCaptured(true);

      // Immediately calculate priority score
      await calculateLocationPriority(location, category);

      // Get nearby infrastructure after location capture
      await loadNearbyInfrastructure(location);

      // Show success message with location info
      Alert.alert(
        'Location Captured Successfully!',
        `Accuracy: ±${location.radiusM}m (${location.precision})\n` +
        `Privacy Level: ${location.privacyLevel}\n` +
        `Your complaint will be prioritized based on nearby infrastructure.`,
        [{ text: 'Continue', style: 'default' }]
      );

    } catch (error) {
      console.error('Location capture error:', error);
      Alert.alert(
        'Location Error',
        'Unable to capture location. You can try again or submit without location (lower priority).',
        [
          { text: 'Retry', onPress: () => proceedWithLocationCapture(privacyLevel, category) },
          { text: 'Skip Location', style: 'destructive' }
        ]
      );
    } finally {
      setAutoCapturingLocation(false);
    }
  };

  const calculateLocationPriority = async (location, category) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/location-priority/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          complaintType: category,
          locationMeta: {
            privacyLevel: location.privacyLevel,
            radiusM: location.radiusM,
            precision: location.precision,
            description: location.description
          }
        }),
      });

      if (response.ok) {
        const priorityResult = await response.json();
        setComplaintData(prev => ({ ...prev, locationPriorityScore: priorityResult }));

        // Show priority notification for high-priority complaints
        if (priorityResult.priorityLevel === 'CRITICAL') {
          Alert.alert(
            'High Priority Complaint Detected',
            `Your complaint has been marked as ${priorityResult.priorityLevel} priority due to proximity to critical infrastructure. It will receive immediate attention.`,
            [{ text: 'Understood', style: 'default' }]
          );
        }
      } else {
        console.error('Priority calculation failed:', response.status);
      }

    } catch (error) {
      console.error('Failed to calculate location priority:', error);
    }
  };

  const loadNearbyInfrastructure = async (location) => {
    if (!location || !location.latitude || !location.longitude) {
      console.log('Invalid location for infrastructure search');
      return;
    }

    setIsLoadingInfrastructure(true);
    try {
      console.log('Loading nearby infrastructure for location:', location);

      const infrastructure = await InfrastructureService.getNearbyInfrastructure(
        location.latitude,
        location.longitude,
        2000 // 2km radius
      );

      console.log('Nearby infrastructure found:', infrastructure);
      setNearbyInfrastructure(infrastructure);

      // Show infrastructure report to user in a custom modal
      if (infrastructure && (infrastructure.infrastructure?.length > 0 || infrastructure.summary)) {
        setShowInfrastructureModal(true);
      }

    } catch (error) {
      console.error('Error loading nearby infrastructure:', error);
    } finally {
      setIsLoadingInfrastructure(false);
    }
  };

  // Initialize speech service
  useEffect(() => {
    // Initialize SarvamSpeechService with callbacks
    speechService.init({
      onStart: () => {
        setIsRecording(true);
        console.log('Speech recognition started');
      },
      onResult: (result) => {
        if (result && result.value && result.value.length > 0) {
          const voiceText = result.value[0];
          console.log('🎤 Voice input result:', voiceText);

          // Use handleDescriptionChange to ensure emotion analysis is triggered
          handleDescriptionChange(voiceText);
        }
      },
      onTranslation: (translation) => {
        console.log('Translation received:', translation);
        if (translation && translation.trim().length > 0) {
          lastTranslationRef.current = translation;
          console.log('🌐 Stored English translation for emotion analysis:', translation);
        }
      },
      onError: (error) => {
        console.error('Speech recognition error:', error);
        setVoiceError(error.error?.message || 'Error in speech recognition');
        setIsRecording(false);

        Alert.alert(
          'Speech Recognition Error',
          `There was an error processing your speech. Please try again or type your description.`,
          [{ text: 'OK' }]
        );
      },
      onEnd: () => {
        setIsRecording(false);
        console.log('Speech recognition ended');
      }
    });

    return () => {
      // Clean up speech service on component unmount
      if (isRecording) {
        speechService.stopSpeech();
      }
    };
  }, []);

  // Progress indicator
  const renderProgressIndicator = () => {
    const steps = [
      { number: 1, title: 'Issue & Location', icon: 'list-outline' },
      { number: 2, title: 'Photo', icon: 'camera-outline' },
      { number: 3, title: 'Details', icon: 'create-outline' },
      { number: 4, title: 'Success', icon: 'checkmark-circle-outline' }
    ];

    return (
      <View style={styles.progressContainer}>
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <View style={[
              styles.progressStep,
              currentStep >= step.number && styles.progressStepActive,
              currentStep === step.number && styles.progressStepCurrent
            ]}>
              <Ionicons
                name={step.icon}
                size={20}
                color={currentStep >= step.number ? '#fff' : '#666'}
              />
              <Text style={[
                styles.progressStepText,
                currentStep >= step.number && styles.progressStepTextActive
              ]}>
                {step.title}
              </Text>
            </View>
            {index < steps.length - 1 && (
              <View style={[
                styles.progressLine,
                currentStep > step.number && styles.progressLineActive
              ]} />
            )}
          </React.Fragment>
        ))}
      </View>
    );
  };

  // Navigate between steps
  const goToNextStep = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(current => current - 1);
    }
  };

  const renderContent = () => {
    switch (currentStep) {
      case 1:
        return <Step1IssueAndLocation />;
      case 2:
        return <Step2PhotoUpload />;
      case 3:
        return <Step3Details />;
      case 4:
        return <Step4Success />;
      default:
        return <Step1IssueAndLocation />;
    }
  };

  // Step 1: Issue Type Selection and Location Capture
  const Step1IssueAndLocation = () => {
    const handleCategorySelect = async (category) => {
      setComplaintData(prev => {
        const categoryChanged = !!prev.category && prev.category !== category;
        return {
          ...prev,
          category,
          // Changing the category after a photo was already validated against
          // the old one invalidates that validation - force re-validation in
          // the Photo step so a mismatched photo can't ride along silently.
          ...(categoryChanged && (prev.selectedImage || prev.imageValidation)
            ? { selectedImage: null, imageValidation: null }
            : {}),
        };
      });

      // Auto-capture location after category selection
      if (!locationCaptured) {
        await autoCaptureLocation(category);
      }
    };

    const handleContinue = () => {
      if (!complaintData.category) {
        Alert.alert('Error', 'Please select a complaint category');
        return;
      }

      if (!complaintData.locationData) {
        Alert.alert(
          'Location Required',
          'Location is required for priority assessment. Would you like to capture your location now?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Get Location', onPress: () => autoCaptureLocation(complaintData.category) }
          ]
        );
        return;
      }

      goToNextStep();
    };

    return (
      <KeyboardAwareScrollView
        style={styles.stepContainer}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>Step 1: Select Issue Type</Text>
          <Text style={styles.stepSubtitle}>
            What type of civic issue are you reporting? We'll ask for a photo of it next.
          </Text>
        </View>

        <View style={styles.categoriesGrid}>
          {/* Create rows with 2 categories each */}
          {Array.from({ length: Math.ceil(complaintCategories.length / 2) }, (_, rowIndex) => (
            <View key={rowIndex} style={styles.categoryRow}>
              {complaintCategories.slice(rowIndex * 2, rowIndex * 2 + 2).map((category) => (
                <TouchableOpacity
                  key={category.value}
                  style={[
                    styles.categoryCard,
                    complaintData.category === category.value && styles.categoryCardSelected
                  ]}
                  onPress={() => handleCategorySelect(category.value)}
                >
                  <Ionicons
                    name={category.icon}
                    size={28}
                    color={complaintData.category === category.value ? '#1A1A1A' : '#555'}
                    style={styles.categoryIcon}
                  />
                  <Text style={[
                    styles.categoryTitle,
                    complaintData.category === category.value && styles.selectedCategoryLabel
                  ]}>
                    {category.label}
                  </Text>
                  <Text style={[
                    styles.categoryUrgency,
                    category.urgency === 'urgent' && styles.categoryUrgencyHigh
                  ]}>
                    {category.urgency === 'urgent' ? 'Urgent' :
                      category.urgency === 'safety' ? 'Safety' : 'General'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {/* Location Status */}
        {autoCapturingLocation && (
          <View style={styles.locationStatusContainer}>
            <ActivityIndicator size="small" color="#2E7D32" />
            <Text style={styles.locationStatusText}>Capturing your location...</Text>
          </View>
        )}

        {locationCaptured && complaintData.locationData && (
          <View style={styles.locationCapturedContainer}>
            <Text style={styles.locationCapturedTitle}>Location Captured Successfully</Text>
            <Text style={styles.locationDetailText}>
              Accuracy: ±{complaintData.locationData.radiusM}m ({complaintData.locationData.precision})
            </Text>
            <Text style={styles.locationDetailText}>
              Privacy: {complaintData.locationData.description}
            </Text>
            {complaintData.locationPriorityScore && (
              <View style={styles.priorityScoreContainer}>
                <Text style={styles.priorityScoreText}>
                  Priority: {complaintData.locationPriorityScore.priorityLevel} ({Math.round((complaintData.locationPriorityScore.priorityScore || 0) * 100)}%)
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Infrastructure Loading */}
        {isLoadingInfrastructure && (
          <View style={styles.infrastructureLoadingContainer}>
            <ActivityIndicator size="small" color="#2E7D32" />
            <Text style={styles.infrastructureLoadingText}>Analyzing nearby infrastructure...</Text>
          </View>
        )}

        {/* Nearby Infrastructure Display */}
        {nearbyInfrastructure && nearbyInfrastructure.places && nearbyInfrastructure.places.length > 0 && (
          <View style={styles.infrastructureContainer}>
            <Text style={styles.infrastructureTitle}>Nearby Infrastructure</Text>
            <Text style={styles.infrastructureSummary}>{nearbyInfrastructure.summary}</Text>

            <View style={styles.infrastructureList}>
              {nearbyInfrastructure.places.slice(0, 3).map((place, index) => (
                <View key={index} style={styles.infrastructureItem}>
                  <Text style={styles.infrastructureName}>
                    {place.name} ({place.types[0].replace('_', ' ')})
                  </Text>
                  <Text style={styles.infrastructureDistance}>
                    {place.distance}m away
                  </Text>
                </View>
              ))}
              {nearbyInfrastructure.places.length > 3 && (
                <Text style={styles.infrastructureMore}>
                  +{nearbyInfrastructure.places.length - 3} more nearby
                </Text>
              )}
            </View>
          </View>
        )}

        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={styles.backNavigationButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={20} color="#666" />
            <Text style={styles.backNavigationText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.continueButton,
              (!complaintData.category || !complaintData.locationData || autoCapturingLocation) && styles.continueButtonDisabled
            ]}
            onPress={handleContinue}
            disabled={!complaintData.category || !complaintData.locationData || autoCapturingLocation}
          >
            {autoCapturingLocation ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.continueButtonText}>Continue to Photo</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    );
  };

  // Step 2: Photo Upload and AI Validation Against the Selected Category
  const Step2PhotoUpload = () => {
    const pickImage = async () => {
      try {
        // Request permissions
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'Please allow access to your photo library to upload images.');
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
          base64: false,
        });

        if (!result.canceled) {
          setComplaintData(prev => ({ ...prev, selectedImage: result.assets[0], imageValidation: null }));
          await validateImage(result.assets[0]);
        }
      } catch (error) {
        console.error('Image picker error:', error);
        Alert.alert('Error', 'Failed to pick image');
      }
    };

    const takePhoto = async () => {
      try {
        // Request permissions
        const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

        if (permissionResult.granted === false) {
          Alert.alert('Permission Required', 'Please allow access to your camera to take photos.');
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.8,
          base64: false,
        });

        if (!result.canceled) {
          setComplaintData(prev => ({ ...prev, selectedImage: result.assets[0], imageValidation: null }));
          await validateImage(result.assets[0]);
        }
      } catch (error) {
        console.error('Camera error:', error);
        Alert.alert('Error', 'Failed to take photo');
      }
    };

    const validateImage = async (imageAsset) => {
      if (!imageAsset) return;
      setValidatingImage(true);

      try {
        console.log('🔍 Starting image validation against category:', complaintData.category);

        // 1. Upload image to Cloudinary
        const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dsvc9y4rq/image/upload';
        const UPLOAD_PRESET = 'damage';
        const data = new FormData();
        data.append('file', {
          uri: imageAsset.uri,
          type: imageAsset.mimeType || 'image/jpeg',
          name: imageAsset.fileName || 'civic-image.jpg',
        });
        data.append('upload_preset', UPLOAD_PRESET);

        const cloudRes = await fetch(CLOUDINARY_URL, {
          method: 'POST',
          body: data,
        });
        const cloudResult = await cloudRes.json();

        if (!cloudResult.secure_url) throw new Error('Cloudinary upload failed');

        console.log('✅ Image uploaded to Cloudinary:', cloudResult.secure_url);

        // Update selectedImage to use Cloudinary URL
        setComplaintData(prev => ({
          ...prev,
          selectedImage: {
            ...imageAsset,
            uri: cloudResult.secure_url,
            cloudinaryUrl: cloudResult.secure_url,
            publicId: cloudResult.public_id
          }
        }));

        // 2. Send imageUrl + the already-selected category to the backend so
        // it can check the photo actually matches the chosen issue type.
        const validateRes = await fetch(`${API_BASE_URL}/api/image-analysis/validate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl: cloudResult.secure_url, category: complaintData.category }),
        });
        const result = await validateRes.json();

        console.log('📋 Validation result:', result);

        // Trust the backend's own allowUpload decision (the SAM3 workflow already
        // applies its own per-class confidence thresholds and category-match
        // check server-side).
        const validationData = {
          confidence: result.confidence || 0,
          modelConfidence: result.modelConfidence || 0,
          allowUpload: result.allowUpload === true,
          categoryMatch: result.categoryMatch !== false,
          message: result.message || 'No validation message provided',
          detections: Array.isArray(result.detections) ? result.detections : [],
          primaryClass: result.primaryClass || null,
        };

        setComplaintData(prev => ({ ...prev, imageValidation: validationData }));

        if (validationData.allowUpload) {
          // Category already matches (or the backend accepted it) - move on
          // automatically, there's nothing left to confirm. (Advance right
          // away rather than via a delayed timer, so a quick tap on "Back"
          // can't be overridden by a stale timer firing afterwards.)
          goToNextStep();
        }
        // On failure we deliberately do NOT show a dismissible alert with a
        // bypass option - renderImageValidationStatus() below surfaces the
        // backend's message inline and the user must pick a different photo
        // or go back and change the category. No "Continue/Submit Anyway".

      } catch (error) {
        console.error('❌ Image validation error:', error);
        setComplaintData(prev => ({
          ...prev,
          imageValidation: {
            confidence: 0,
            modelConfidence: 0,
            allowUpload: false,
            categoryMatch: false,
            message: 'Failed to validate image. Please check your connection and try again.',
            detections: [],
            primaryClass: null,
          }
        }));
        Alert.alert(
          'Validation Error',
          'Failed to validate image. Please check your connection and try again.',
          [
            { text: 'Retry', onPress: () => validateImage(imageAsset) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } finally {
        setValidatingImage(false);
      }
    };

    const skipPhoto = () => {
      // Only a WRONG photo is disallowed, not having no photo at all - clear
      // any previously-set image/validation so a stale mismatched photo
      // can never leak into submission.
      setComplaintData(prev => ({ ...prev, selectedImage: null, imageValidation: null }));
      goToNextStep();
    };

    const renderImageValidationStatus = () => {
      if (validatingImage) {
        return (
          <View style={styles.validationStatus}>
            <ActivityIndicator size="small" color="#2E7D32" />
            <Text style={styles.validationText}>Validating photo against "{selectedCategory?.label || 'selected issue'}"...</Text>
          </View>
        );
      }

      if (complaintData.imageValidation) {
        if (complaintData.imageValidation.allowUpload) {
          return (
            <View style={[styles.validationStatus, styles.validationSuccess]}>
              <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
              <Text style={styles.validationText}>{complaintData.imageValidation.message}</Text>
            </View>
          );
        } else {
          return (
            <View style={[styles.validationStatus, styles.validationError]}>
              <Ionicons name="close-circle" size={20} color="#F44336" />
              <Text style={styles.validationText}>{complaintData.imageValidation.message}</Text>
            </View>
          );
        }
      }

      return null;
    };

    const showBlockedActions = !validatingImage
      && complaintData.imageValidation
      && !complaintData.imageValidation.allowUpload;

    return (
      <KeyboardAwareScrollView
        style={styles.stepContainer}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.stepHeader}>
          <Text style={styles.stepTitle}>Step 2: Add a Photo</Text>
          <Text style={styles.stepSubtitle}>
            Take or upload a clear photo showing "{selectedCategory?.label || 'the issue'}" - we'll verify it matches before you continue
          </Text>
        </View>

        <View style={styles.selectedCategoryDisplay}>
          <Text style={styles.selectedCategoryTitle}>Selected Issue Type:</Text>
          <View style={styles.selectedCategoryChip}>
            {selectedCategory?.icon && (
              <Ionicons name={selectedCategory.icon} size={16} color="#1A1A1A" style={{ marginRight: 6 }} />
            )}
            <Text style={styles.selectedCategoryChipText}>
              {selectedCategory?.label}
            </Text>
          </View>
        </View>

        <View style={styles.imageSection}>
          {complaintData.selectedImage ? (
            <View style={styles.selectedImageContainer}>
              <Image source={{ uri: complaintData.selectedImage.uri }} style={styles.selectedImage} />
              <TouchableOpacity
                style={styles.changeImageButton}
                onPress={() => setComplaintData(prev => ({ ...prev, selectedImage: null, imageValidation: null }))}
              >
                <Text style={styles.changeImageText}>Change Image</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePickerContainer}>
              <TouchableOpacity style={styles.imagePickerButton} onPress={takePhoto}>
                <Ionicons name="camera" size={32} color="#2E7D32" />
                <Text style={styles.imagePickerText}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                <Ionicons name="images" size={32} color="#2E7D32" />
                <Text style={styles.imagePickerText}>Choose from Gallery</Text>
              </TouchableOpacity>
            </View>
          )}

          {renderImageValidationStatus()}

          {showBlockedActions && (
            <Text style={styles.blockedPhotoHintText}>
              Pick a different photo above, or go back and change the issue type if this photo is correct.
            </Text>
          )}
        </View>

        {!validatingImage && (
          <TouchableOpacity style={styles.skipPhotoLink} onPress={skipPhoto}>
            <Text style={styles.skipPhotoLinkText}>I don't have a photo — continue without one</Text>
          </TouchableOpacity>
        )}

        <View style={styles.navigationButtons}>
          <TouchableOpacity
            style={styles.backNavigationButton}
            onPress={goToPreviousStep}
          >
            <Ionicons name="chevron-back" size={20} color="#666" />
            <Text style={styles.backNavigationText}>Back</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    );
  };

  // Step 3: Details (title, description, emotion + authenticity analysis) and final submission
  const Step3Details = () => {
    const startVoiceInput = async () => {
      setVoiceError(null);

      try {
        // Request audio recording permissions
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please allow microphone access to record your complaint.');
          return;
        }

        // Start recording with Sarvam Speech Service using the selected language
        console.log(`Starting speech recognition with language: ${complaintData.selectedLang}`);
        await speechService.startSpeech(complaintData.selectedLang);

      } catch (err) {
        console.error('Speech recognition setup error:', err);
        setVoiceError(err.message);
        setIsRecording(false);
        Alert.alert('Error', 'Failed to start speech recognition: ' + err.message);
      }
    };

    const stopVoiceInput = async () => {
      try {
        // Stop the speech recording
        await speechService.processAndStopSpeech(complaintData.selectedLang);
        setIsRecording(false);
      } catch (error) {
        console.error('Error stopping speech:', error);
        setIsRecording(false);
      }
    };

    const submitComplaint = async () => {
      setLoading(true);

      try {
        // Prepare submission data
        const submissionData = {
          title: complaintData.title.trim(),
          description: complaintData.description.trim(),
          category: complaintData.category,
          locationData: {
            latitude: complaintData.locationData.latitude,
            longitude: complaintData.locationData.longitude,
            privacyLevel: complaintData.locationData.privacyLevel || 'street',
            accuracy: complaintData.locationData.accuracy || complaintData.locationData.radiusM || 25,
            precision: complaintData.locationData.precision || 'street',
            description: complaintData.locationData.description || 'User location',
            address: complaintData.locationData.address || `${complaintData.locationData.latitude.toFixed(4)}, ${complaintData.locationData.longitude.toFixed(4)}`
          },
          imageValidation: complaintData.imageValidation || {
            allowUpload: true,
            confidence: 0.5,
            success: true
          },
          imageUrl: complaintData.selectedImage?.uri || null,
          emotionAnalysis: complaintData.emotionScore ? {
            score: parseFloat(complaintData.emotionScore.score) / 100, // Convert back to 0-1 range
            emotions: complaintData.emotionScore.emotions,
            analysisMethod: complaintData.emotionScore.analysisMethod,
            language: complaintData.emotionScore.language
          } : null,
        };

        console.log('📤 Submitting complaint with comprehensive data:', submissionData);

        // Submit directly (rather than via makeApiCall) so we can read the
        // structured error body the backend now returns on a hard 400 reject
        // (IMAGE_CATEGORY_MISMATCH / DESCRIPTION_CATEGORY_MISMATCH) instead of
        // losing it behind a generic "HTTP 400" message.
        const token = await AsyncStorage.getItem('authToken');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        let response;
        let result;
        try {
          response = await fetch(apiClient.complaints.submit, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { Authorization: `Bearer ${token}` }),
            },
            body: JSON.stringify(submissionData),
            signal: controller.signal,
          });
          result = await response.json();
        } finally {
          clearTimeout(timeoutId);
        }

        console.log('📋 Response data:', result);

        if (response.ok && result.success) {
          setSubmissionResult(result);
          goToNextStep(); // Go to success page
          return;
        }

        console.error('❌ Backend returned error:', result);
        const submitError = new Error(result?.error || result?.message || `HTTP ${response.status}: Submission failed`);
        submitError.code = result?.code || null;
        submitError.httpStatus = response.status;
        throw submitError;

      } catch (error) {
        console.error('❌ Submission error:', error);

        let errorMessage = 'Please check your connection and try again.';
        let errorTitle = 'Submission Failed';

        if (error.code === 'IMAGE_CATEGORY_MISMATCH') {
          errorTitle = 'Photo Does Not Match Issue Type';
          errorMessage = error.message || 'The photo does not match the selected issue type. Please go back and add a matching photo, or remove it.';
        } else if (error.code === 'DESCRIPTION_CATEGORY_MISMATCH') {
          errorTitle = 'Description Does Not Match Issue Type';
          errorMessage = error.message || 'The description does not appear to match the selected issue type. Please edit your description.';
        } else if (error.name === 'AbortError') {
          errorMessage = 'The request timed out. Please check your connection and try again.';
          errorTitle = 'Connection Error';
        } else if (error.message?.includes('Network request failed')) {
          errorMessage = 'Cannot connect to server. Please check your internet connection.';
          errorTitle = 'Connection Error';
        } else if (error.message?.includes('HTTP 404')) {
          errorMessage = 'API endpoint not found. Please update the app.';
          errorTitle = 'Service Error';
        } else if (error.message?.includes('HTTP 400')) {
          errorMessage = error.message !== 'HTTP 400: Submission failed' ? error.message : 'Invalid data submitted. Please check all fields.';
          errorTitle = 'Validation Error';
        } else if (error.message?.includes('HTTP 500')) {
          errorMessage = 'Server error. Please try again later.';
          errorTitle = 'Server Error';
        } else if (error.message) {
          errorMessage = error.message;
        }

        Alert.alert(
          errorTitle,
          errorMessage,
          [
            { text: 'Retry', onPress: () => submitComplaint() },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      } finally {
        setLoading(false);
      }
    };

    const handleFinalSubmit = async () => {
      if (!complaintData.title.trim()) {
        Alert.alert('Error', 'Please enter a complaint title');
        return;
      }

      if (!complaintData.description.trim()) {
        Alert.alert('Error', 'Please enter a complaint description');
        return;
      }

      // Hard block - the backend no longer accepts a flagged description at
      // all, so there is no "continue anyway" path here. The only ways
      // forward are editing the description (re-triggers analysis) or
      // switching to the suggested category above.
      if (complaintData.contentAnalysis?.flagged) {
        Alert.alert(
          'Description Does Not Match the Issue',
          'This description does not appear to match the selected issue type. Please edit the description, or use the suggested category button above, before submitting.'
        );
        return;
      }

      // Defense in depth: by the time we're on this step, a photo should
      // either be absent or already validated (allowUpload: true) against
      // the current category - the Photo step hard-blocks any mismatch. If
      // it somehow isn't, block here too rather than letting the submit
      // call fail on the server. No "Submit Anyway" bypass.
      if (complaintData.selectedImage && (!complaintData.imageValidation || complaintData.imageValidation.allowUpload !== true)) {
        Alert.alert(
          'Photo Not Validated',
          'Your photo has not been validated against the selected issue type. Please go back to the Photo step to re-validate it, or remove it.',
          [
            { text: 'Go to Photo Step', onPress: () => setCurrentStep(2) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }

      await submitComplaint();
    };

    return (
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContentContainer}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        keyboardShouldPersistTaps="handled"
        extraHeight={120}
        extraScrollHeight={120}
        showsVerticalScrollIndicator={false}
        keyboardOpeningTime={0}
        resetScrollToCoords={{ x: 0, y: 0 }}
        scrollEnabled={true}
      >
        <View style={styles.stepContainer}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepTitle}>Step 3: Add Details</Text>
            <Text style={styles.stepSubtitle}>
              Provide a title and detailed description of the issue
            </Text>
          </View>

          {/* Selected Category Display */}
          <View style={styles.selectedCategoryDisplay}>
            <Text style={styles.selectedCategoryTitle}>Selected Issue Type:</Text>
            <View style={styles.selectedCategoryChip}>
              {selectedCategory?.icon && (
                <Ionicons name={selectedCategory.icon} size={16} color="#1A1A1A" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.selectedCategoryChipText}>
                {selectedCategory?.label}
              </Text>
            </View>
          </View>

          {/* Title Input - Custom Component */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Complaint Title *</Text>
            <CustomTextInput
              value={complaintData.title}
              onChangeText={handleTitleChange}
              placeholder="Brief title describing the issue"
              maxLength={100}
              multiline={false}
              style={styles.customInputContainer}
            />
            <Text style={styles.characterCount}>{complaintData.title.length}/100</Text>
          </View>

          {/* Language Picker - Enhanced */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Select Language for Voice Input</Text>
            <TouchableOpacity
              style={styles.customLanguageSelector}
              onPress={() => setShowLanguagePicker(true)}
            >
              <View style={styles.languageSelectorContent}>
                <View style={styles.selectedLanguageDisplay}>
                  <Ionicons name="language" size={24} color="#2E7D32" />
                  <View style={styles.languageTextContainer}>
                    <Text style={styles.selectedLanguageText}>
                      {languageOptions.find(lang => lang.value === complaintData.selectedLang)?.label || 'Hindi (हिंदी)'}
                    </Text>
                    <Text style={styles.selectedLanguageSubtext}>
                      {languageOptions.find(lang => lang.value === complaintData.selectedLang)?.nativeName || 'हिंदी'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </View>
            </TouchableOpacity>
            <Text style={styles.languageHelper}>
              Voice input will be processed in the selected language
            </Text>
          </View>

          {/* Description Input - Custom Component */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Description *</Text>
            <View style={styles.descriptionWrapper}>
              <CustomTextInput
                value={complaintData.description}
                onChangeText={handleDescriptionChange}
                placeholder="Detailed description of the civic issue"
                maxLength={500}
                multiline={true}
                style={styles.customInputContainer}
              />
            </View>

            {/* Voice Button - Separate from input */}
            <View style={styles.voiceButtonContainer}>
              <TouchableOpacity
                style={styles.voiceButtonEnhanced}
                onPress={isRecording ? stopVoiceInput : startVoiceInput}
                disabled={loading}
              >
                <Ionicons
                  name={isRecording ? 'mic' : 'mic-outline'}
                  size={24}
                  color={isRecording ? '#2E7D32' : loading ? '#ccc' : '#666'}
                />
                <Text style={[
                  styles.voiceButtonText,
                  isRecording && styles.voiceButtonTextActive
                ]}>
                  {isRecording ? 'Stop Recording' : 'Voice Input'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.characterCount}>{complaintData.description.length}/500</Text>

            {/* Emotion Analysis Score */}
            {complaintData.emotionScore ? (
              <View style={styles.emotionScoreContainer}>
                <Text style={styles.emotionScoreLabel}>Emotion Analysis Results</Text>
                <Text style={styles.emotionScoreValue}>
                  Priority Impact: {complaintData.emotionScore.score}%
                </Text>
                <Text style={styles.emotionScoreMethod}>
                  Method: {complaintData.emotionScore.analysisMethod || 'ai-powered'} ({complaintData.emotionScore.language || 'en'})
                </Text>
                {complaintData.emotionScore.emotions && (
                  <View style={styles.emotionDetails}>
                    <Text style={styles.emotionDetailText}>
                      Urgency: {(complaintData.emotionScore.emotions.urgency * 100).toFixed(0)}% |
                      Concern: {(complaintData.emotionScore.emotions.concern * 100).toFixed(0)}% |
                      Frustration: {(complaintData.emotionScore.emotions.frustration * 100).toFixed(0)}%
                    </Text>
                    {complaintData.emotionScore.emotions.anger && (
                      <Text style={styles.emotionDetailText}>
                        Anger: {(complaintData.emotionScore.emotions.anger * 100).toFixed(0)}%
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.emotionScoreContainer}>
                <Text style={styles.emotionScoreLabel}>Emotion Analysis</Text>
                <Text style={styles.emotionScoreMethod}>
                  {complaintData.description.length < 10
                    ? 'Write at least 10 characters for emotion analysis'
                    : 'Analyzing emotions... (Auto-triggers after 1 second)'}
                </Text>
              </View>
            )}

            {complaintData.description.length > 10 && !complaintData.emotionScore && (
              <View style={styles.emotionAnalyzingContainer}>
                <ActivityIndicator size="small" color="#666" />
                <Text style={styles.emotionAnalyzingText}>Analyzing emotion...</Text>
              </View>
            )}

            {/* Authenticity / Category-Match Warning */}
            {complaintData.contentAnalysis && (complaintData.contentAnalysis.mismatchDetected || complaintData.contentAnalysis.flagged) && (
              <View style={[
                styles.authenticityWarningContainer,
                complaintData.contentAnalysis.flagged && styles.authenticityWarningContainerFlagged
              ]}>
                <View style={styles.authenticityWarningHeader}>
                  <Ionicons
                    name={complaintData.contentAnalysis.flagged ? 'alert-circle' : 'information-circle-outline'}
                    size={20}
                    color={complaintData.contentAnalysis.flagged ? '#C62828' : '#B26A00'}
                  />
                  <Text style={styles.authenticityWarningTitle}>
                    {complaintData.contentAnalysis.flagged
                      ? 'This description may not match the photo'
                      : 'Description may not fully match the issue type'}
                  </Text>
                </View>

                {Array.isArray(complaintData.contentAnalysis.reasons) && complaintData.contentAnalysis.reasons.length > 0 && (
                  <View style={styles.authenticityReasonsList}>
                    {complaintData.contentAnalysis.reasons.map((reason, index) => (
                      <Text key={index} style={styles.authenticityReasonText}>• {reason}</Text>
                    ))}
                  </View>
                )}

                {complaintData.contentAnalysis.suggestedCategory && complaintCategories.some(cat => cat.value === complaintData.contentAnalysis.suggestedCategory) && (
                  <TouchableOpacity
                    style={styles.authenticitySuggestionButton}
                    onPress={() => {
                      const newCategory = complaintData.contentAnalysis.suggestedCategory;
                      const categoryChanged = complaintData.category !== newCategory;
                      const hadPhoto = !!complaintData.selectedImage;

                      setComplaintData(prev => ({
                        ...prev,
                        category: newCategory,
                        // A photo already validated against the old category
                        // can't be trusted against the new one - clear it.
                        ...(categoryChanged ? { selectedImage: null, imageValidation: null } : {}),
                      }));

                      if (categoryChanged && hadPhoto) {
                        Alert.alert(
                          'Issue Type Changed',
                          'Since the issue type changed, your photo needs to be re-checked. Please go back to the Photo step and add a photo that matches the new issue type.',
                          [
                            { text: 'Go to Photo Step', onPress: () => setCurrentStep(2) },
                            { text: 'Later', style: 'cancel' }
                          ]
                        );
                      }
                    }}
                  >
                    <Text style={styles.authenticitySuggestionButtonText}>
                      Switch category to "{complaintCategories.find(cat => cat.value === complaintData.contentAnalysis.suggestedCategory)?.label}"
                    </Text>
                  </TouchableOpacity>
                )}

                {complaintData.contentAnalysis.flagged && (
                  <Text style={styles.authenticityBlockedText}>
                    This description must be edited or the category switched above before you can submit — it can't be submitted as-is.
                  </Text>
                )}
              </View>
            )}
          </View>

          {voiceError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{voiceError}</Text>
            </View>
          )}

          {/* Voice Recording Status */}
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <ActivityIndicator size="small" color="#2E7D32" />
              <Text style={styles.recordingText}>Recording... Speak clearly</Text>
            </View>
          )}

          {/* Navigation Buttons */}
          <View style={styles.navigationButtons}>
            <TouchableOpacity
              style={styles.backNavigationButton}
              onPress={goToPreviousStep}
            >
              <Ionicons name="chevron-back" size={20} color="#666" />
              <Text style={styles.backNavigationText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (loading || !complaintData.title.trim() || !complaintData.description.trim() || complaintData.contentAnalysis?.flagged) && styles.submitButtonDisabled
              ]}
              onPress={handleFinalSubmit}
              disabled={loading || !complaintData.title.trim() || !complaintData.description.trim() || complaintData.contentAnalysis?.flagged}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Custom Language Picker Modal */}
          <Modal
            visible={showLanguagePicker}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowLanguagePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.languagePickerModal}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Language</Text>
                  <TouchableOpacity
                    onPress={() => setShowLanguagePicker(false)}
                    style={styles.modalCloseButton}
                  >
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
                  {languageOptions.map((language) => (
                    <TouchableOpacity
                      key={language.value}
                      style={[
                        styles.languageOption,
                        complaintData.selectedLang === language.value && styles.selectedLanguageOption
                      ]}
                      onPress={() => {
                        handleLanguageChange(language.value);
                        setShowLanguagePicker(false);
                      }}
                    >
                      <View style={styles.languageOptionContent}>
                        <View style={styles.languageInfo}>
                          <Text style={[
                            styles.languageOptionLabel,
                            complaintData.selectedLang === language.value && styles.selectedLanguageOptionText
                          ]}>
                            {language.label}
                          </Text>
                          <Text style={[
                            styles.languageNativeName,
                            complaintData.selectedLang === language.value && styles.selectedLanguageNativeText
                          ]}>
                            {language.nativeName}
                          </Text>
                        </View>
                        {complaintData.selectedLang === language.value && (
                          <Ionicons name="checkmark-circle" size={24} color="#2E7D32" />
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAwareScrollView>
    );
  };

  // Step 4: Success Screen
  const Step4Success = () => {
    if (!submissionResult) {
      return (
        <View style={styles.stepContainer}>
          <Text>Error: No submission result available</Text>
        </View>
      );
    }

    const viewOnMap = () => {
      const newComplaint = {
        id: submissionResult.complaint.id,
        title: submissionResult.complaint.title,
        description: complaintData.description,
        category: complaintData.category,
        status: submissionResult.complaint.status || 'pending',
        latitude: complaintData.locationData.latitude,
        longitude: complaintData.locationData.longitude,
        location: complaintData.locationData.description || complaintData.locationData.address,
        created_at: new Date().toISOString()
      };

      navigation.navigate('ComplaintMap', { newComplaint });
    };

    return (
      <KeyboardAwareScrollView
        style={styles.stepContainer}
        contentContainerStyle={styles.successContainer}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.successHeader}>
          <Ionicons name="checkmark-circle" size={80} color="#2E7D32" />
          <Text style={styles.successTitle}>Complaint Successfully Submitted!</Text>
          <Text style={styles.successSubtitle}>
            Your complaint has been received and will be processed according to its priority level.
          </Text>
        </View>

        <View style={styles.complaintDetailsCard}>
          <Text style={styles.detailsCardTitle}>Complaint Details</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Complaint ID:</Text>
            <Text style={styles.detailValue}>{submissionResult.complaint.id}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Title:</Text>
            <Text style={styles.detailValue}>{complaintData.title}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Category:</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons
                name={complaintCategories.find(cat => cat.value === complaintData.category)?.icon || 'help-circle-outline'}
                size={16}
                color="#333"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.detailValue}>
                {complaintCategories.find(cat => cat.value === complaintData.category)?.label}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status:</Text>
            <Text style={styles.detailValue}>{submissionResult.complaint.status || 'Pending'}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Priority Level:</Text>
            <Text style={[styles.detailValue, styles.priorityText]}>
              {submissionResult.priorityAnalysis?.priorityLevel || 'MEDIUM'}
              ({Math.round((submissionResult.priorityAnalysis?.totalScore || 0) * 100)}%)
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Location Accuracy:</Text>
            <Text style={styles.detailValue}>
              ±{complaintData.locationData.radiusM}m ({complaintData.locationData.precision})
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Submitted:</Text>
            <Text style={styles.detailValue}>{new Date().toLocaleString()}</Text>
          </View>
        </View>

        {submissionResult.priorityAnalysis && (
          <View style={styles.priorityAnalysisCard}>
            <Text style={styles.detailsCardTitle}>Priority Analysis</Text>
            <Text style={styles.reasoningText}>
              {submissionResult.priorityAnalysis.reasoning}
            </Text>
          </View>
        )}

        <View style={styles.nextStepsCard}>
          <Text style={styles.detailsCardTitle}>Next Steps</Text>
          {submissionResult.nextSteps?.map((step, index) => (
            <Text key={index} style={styles.nextStepText}>
              {index + 1}. {step}
            </Text>
          ))}
        </View>

        <View style={styles.successActions}>
          <TouchableOpacity style={styles.mapButton} onPress={viewOnMap}>
            <Ionicons name="map" size={20} color="#fff" />
            <Text style={styles.mapButtonText}>View on Map</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => navigation.navigate('FeedbackScreen', {
              complaintId: submissionResult.complaint.id,
              complaintTitle: complaintData.title
            })}
          >
            <Text style={styles.doneButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={currentStep > 1 ? goToPreviousStep : () => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Submit Complaint</Text>
        <View style={styles.headerSpacer} />
      </View>

      {renderProgressIndicator()}

      {renderContent()}

      {/* Infrastructure Report Modal */}
      <Modal
        visible={showInfrastructureModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInfrastructureModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.infrastructureModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nearby Infrastructure Report</Text>
              <TouchableOpacity
                onPress={() => setShowInfrastructureModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infrastructureModalContent} showsVerticalScrollIndicator={false}>
              {nearbyInfrastructure?.infrastructure?.length > 0 ? (
                <>
                  <Text style={styles.infrastructureModalSubtitle}>
                    Location captured successfully! Here are the facilities near your location:
                  </Text>

                  {/* Essential Services */}
                  {nearbyInfrastructure.infrastructure
                    .filter(infra => infra.priority === 'high')
                    .reduce((unique, infra) => {
                      if (!unique.find(u => u.infrastructureType === infra.infrastructureType)) {
                        unique.push(infra);
                      }
                      return unique;
                    }, [])
                    .length > 0 && (
                      <>
                        <Text style={styles.infrastructureSectionTitle}>Essential Services</Text>
                        {nearbyInfrastructure.infrastructure
                          .filter(infra => infra.priority === 'high')
                          .reduce((unique, infra) => {
                            if (!unique.find(u => u.infrastructureType === infra.infrastructureType)) {
                              unique.push(infra);
                            }
                            return unique;
                          }, [])
                          .map((infra, index) => (
                            <View key={`high-${index}`} style={styles.infrastructureModalItem}>
                              <View style={styles.infrastructureItemHeader}>
                                <Text style={styles.infrastructureItemType}>
                                  {infra.infrastructureType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Text>
                                <Text style={styles.infrastructureItemDistance}>{infra.distance}m away</Text>
                              </View>
                              <Text style={styles.infrastructureItemName}>{infra.name}</Text>
                              {infra.vicinity && (
                                <Text style={styles.infrastructureItemVicinity}>{infra.vicinity}</Text>
                              )}
                            </View>
                          ))}
                      </>
                    )}

                  {/* Other Facilities */}
                  {nearbyInfrastructure.infrastructure
                    .filter(infra => infra.priority === 'medium')
                    .reduce((unique, infra) => {
                      if (!unique.find(u => u.infrastructureType === infra.infrastructureType)) {
                        unique.push(infra);
                      }
                      return unique;
                    }, [])
                    .length > 0 && (
                      <>
                        <Text style={styles.infrastructureSectionTitle}>Other Facilities</Text>
                        {nearbyInfrastructure.infrastructure
                          .filter(infra => infra.priority === 'medium')
                          .reduce((unique, infra) => {
                            if (!unique.find(u => u.infrastructureType === infra.infrastructureType)) {
                              unique.push(infra);
                            }
                            return unique;
                          }, [])
                          .slice(0, 4)
                          .map((infra, index) => (
                            <View key={`medium-${index}`} style={styles.infrastructureModalItem}>
                              <View style={styles.infrastructureItemHeader}>
                                <Text style={styles.infrastructureItemType}>
                                  {infra.infrastructureType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </Text>
                                <Text style={styles.infrastructureItemDistance}>{infra.distance}m away</Text>
                              </View>
                              <Text style={styles.infrastructureItemName}>{infra.name}</Text>
                            </View>
                          ))}
                      </>
                    )}

                  <View style={styles.infrastructureModalFooter}>
                    <Text style={styles.infrastructureModalSummary}>
                      Total facilities found: {nearbyInfrastructure.totalFound || nearbyInfrastructure.infrastructure.length}
                    </Text>
                  </View>
                </>
              ) : (
                <Text style={styles.infrastructureModalSubtitle}>
                  Location captured successfully. No nearby infrastructure detected in the immediate area.
                </Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.infrastructureModalButton}
              onPress={() => setShowInfrastructureModal(false)}
            >
              <Text style={styles.infrastructureModalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

};

// Base styles for the multi-step flow
const styles = StyleSheet.create({
 container: {
 flex: 1,
 backgroundColor: '#f8f9fa',
 },
 scrollContentContainer: {
 flexGrow: 1,
 paddingBottom: 120,
 },
 header: {
 backgroundColor: '#1A1A1A',
 flexDirection: 'row',
 alignItems: 'center',
 paddingHorizontal: 20,
 paddingVertical: 15,
 },
 backButton: {
 padding: 5,
 },
 headerTitle: {
 flex: 1,
 fontSize: 20,
 fontWeight: 'bold',
 color: '#fff',
 textAlign: 'center',
 },
 headerSpacer: {
 width: 34,
 },
 progressContainer: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 paddingHorizontal: 20,
 paddingVertical: 20,
 backgroundColor: '#fff',
 marginBottom: 10,
 },
 progressStep: {
 alignItems: 'center',
 flex: 1,
 },
 progressStepActive: {
 opacity: 1,
 },
 progressStepCurrent: {
 backgroundColor: '#1A1A1A',
 borderRadius: 20,
 paddingVertical: 8,
 paddingHorizontal: 12,
 },
 progressStepText: {
 fontSize: 12,
 color: '#666',
 marginTop: 4,
 textAlign: 'center',
 },
 progressStepTextActive: {
 color: '#1A1A1A',
 fontWeight: 'bold',
 },
 progressLine: {
 height: 2,
 backgroundColor: '#ddd',
 flex: 0.3,
 marginHorizontal: 10,
 },
 progressLineActive: {
 backgroundColor: '#1A1A1A',
 },
 stepContainer: {
 flex: 1,
 backgroundColor: '#fff',
 margin: 10,
 borderRadius: 10,
 padding: 20,
 },
 stepHeader: {
 marginBottom: 30,
 },
 stepTitle: {
 fontSize: 24,
 fontWeight: 'bold',
 color: '#333',
 marginBottom: 8,
 },
 stepSubtitle: {
 fontSize: 16,
 color: '#666',
 lineHeight: 24,
 },
 // Step 1: Category Selection
 categoriesGrid: {
 marginBottom: 24,
 },
 categoryRow: {
 flexDirection: 'row',
 marginBottom: 12,
 },
 categoryGrid: {
 flexDirection: 'row',
 flexWrap: 'wrap',
 justifyContent: 'space-between',
 marginBottom: 30,
 },
 categoryCard: {
 flex: 1,
 backgroundColor: '#fff',
 borderRadius: 12,
 padding: 16,
 marginHorizontal: 6,
 alignItems: 'center',
 elevation: 2,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 3,
 borderWidth: 2,
 borderColor: 'transparent',
 },
 categoryCardSelected: {
 borderColor: '#1A1A1A',
 backgroundColor: '#F3F4F6',
 },
 selectedCategoryCard: {
 backgroundColor: '#F3F4F6',
 borderColor: '#1A1A1A',
 },
 categoryIcon: {
 marginBottom: 8,
 },
 categoryTitle: {
 fontSize: 14,
 fontWeight: '600',
 color: '#333',
 textAlign: 'center',
 marginBottom: 4,
 },
 categoryLabel: {
 fontSize: 14,
 fontWeight: '600',
 color: '#333',
 textAlign: 'center',
 marginBottom: 5,
 },
 selectedCategoryLabel: {
 color: '#1A1A1A',
 },
 categoryUrgency: {
 fontSize: 11,
 color: '#666',
 textAlign: 'center',
 },
 categoryUrgencyHigh: {
 color: '#1A1A1A',
 fontWeight: '600',
 },
 urgencyIndicator: {
 fontSize: 11,
 color: '#666',
 textAlign: 'center',
 },
 locationStatusContainer: {
 backgroundColor: '#F3F4F6',
 padding: 15,
 borderRadius: 8,
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: 20,
 borderWidth: 1,
 borderColor: '#1A1A1A',
 },
 locationStatusText: {
 fontSize: 14,
 color: '#856404',
 marginLeft: 10,
 },
 locationCapturedContainer: {
 backgroundColor: '#d4edda',
 padding: 15,
 borderRadius: 8,
 marginBottom: 20,
 borderWidth: 1,
 borderColor: '#28a745',
 },
 locationCapturedTitle: {
 fontSize: 16,
 fontWeight: 'bold',
 color: '#155724',
 marginBottom: 8,
 },
 locationDetailText: {
 fontSize: 14,
 color: '#155724',
 marginBottom: 4,
 },
 priorityScoreContainer: {
 marginTop: 8,
 padding: 8,
 backgroundColor: '#cce5ff',
 borderRadius: 6,
 },
 priorityScoreText: {
 fontSize: 13,
 color: '#0066cc',
 fontWeight: '600',
 },

 // Step 3: Title and Description (selectedCategoryDisplay/Chip is also
 // reused by the Step 2 photo screen to show the category being validated)
 selectedCategoryDisplay: {
 backgroundColor: '#fff',
 borderRadius: 12,
 padding: 16,
 marginBottom: 20,
 elevation: 1,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 3,
 },
 selectedCategoryTitle: {
 fontSize: 14,
 fontWeight: '600',
 color: '#666',
 marginBottom: 8,
 },
 selectedCategoryChip: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F3F4F6',
 borderRadius: 20,
 paddingHorizontal: 12,
 paddingVertical: 6,
 alignSelf: 'flex-start',
 },
 selectedCategoryChipText: {
 fontSize: 14,
 color: '#1A1A1A',
 fontWeight: '600',
 },
 inputSection: {
 marginBottom: 20,
 },
 inputLabel: {
 fontSize: 16,
 fontWeight: '600',
 color: '#333',
 marginBottom: 8,
 },
 textInput: {
 backgroundColor: '#fff',
 borderRadius: 8,
 paddingHorizontal: 16,
 paddingVertical: 12,
 fontSize: 16,
 borderWidth: 1,
 borderColor: '#E0E0E0',
 minHeight: 48,
 },
 customInputContainer: {
 marginBottom: 0,
 },
 simpleTextInput: {
 backgroundColor: '#FFFFFF',
 borderWidth: 2,
 borderColor: '#F3F4F6',
 borderRadius: 10,
 paddingHorizontal: 16,
 paddingVertical: 14,
 fontSize: 16,
 color: '#333333',
 fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
 minHeight: 50,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 2,
 elevation: 2,
 },
 simpleTextArea: {
 backgroundColor: '#FFFFFF',
 borderWidth: 2,
 borderColor: '#F3F4F6',
 borderRadius: 10,
 paddingHorizontal: 16,
 paddingVertical: 14,
 fontSize: 15,
 color: '#333333',
 fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
 minHeight: 120,
 maxHeight: 200,
 textAlignVertical: 'top',
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 2,
 elevation: 2,
 },
 titleInput: {
 fontSize: 16,
 fontWeight: '500',
 },
 descriptionInput: {
 fontSize: 15,
 lineHeight: 20,
 },
 textArea: {
 minHeight: 120,
 textAlignVertical: 'top',
 },
 characterCount: {
 textAlign: 'right',
 fontSize: 12,
 color: '#666',
 marginTop: 4,
 },
 // Emotion Analysis Styles
 emotionScoreContainer: {
 backgroundColor: '#F8F9FA',
 borderRadius: 8,
 padding: 12,
 marginTop: 8,
 borderLeftWidth: 3,
 borderLeftColor: '#1A1A1A',
 },
 emotionScoreLabel: {
 fontSize: 14,
 fontWeight: '600',
 color: '#1A1A1A',
 marginBottom: 4,
 },
 emotionScoreValue: {
 fontSize: 16,
 fontWeight: '700',
 color: '#1B5E20',
 marginBottom: 2,
 },
 emotionScoreMethod: {
 fontSize: 12,
 color: '#666',
 fontStyle: 'italic',
 marginBottom: 4,
 },
 emotionDetails: {
 marginTop: 4,
 },
 emotionDetailText: {
 fontSize: 11,
 color: '#444',
 lineHeight: 16,
 },
 emotionAnalyzingContainer: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'center',
 backgroundColor: '#F5F5F5',
 borderRadius: 6,
 padding: 8,
 marginTop: 8,
 },
 emotionAnalyzingText: {
 fontSize: 12,
 color: '#666',
 marginLeft: 6,
 fontStyle: 'italic',
 },
 pickerContainer: {
 backgroundColor: '#fff',
 borderRadius: 8,
 borderWidth: 1,
 borderColor: '#E0E0E0',
 },
 // Custom Language Picker Styles
 customLanguageSelector: {
 backgroundColor: '#FFFFFF',
 borderWidth: 2,
 borderColor: '#F3F4F6',
 borderRadius: 12,
 paddingHorizontal: 16,
 paddingVertical: 16,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.1,
 shadowRadius: 4,
 elevation: 3,
 },
 languageSelectorContent: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 },
 selectedLanguageDisplay: {
 flexDirection: 'row',
 alignItems: 'center',
 flex: 1,
 },
 languageTextContainer: {
 marginLeft: 12,
 flex: 1,
 },
 selectedLanguageText: {
 fontSize: 16,
 fontWeight: '600',
 color: '#333',
 },
 selectedLanguageSubtext: {
 fontSize: 14,
 color: '#1A1A1A',
 marginTop: 2,
 },

 // Modal Styles
 modalOverlay: {
 flex: 1,
 backgroundColor: 'rgba(0, 0, 0, 0.5)',
 justifyContent: 'flex-end',
 },
 languagePickerModal: {
 backgroundColor: '#fff',
 borderTopLeftRadius: 20,
 borderTopRightRadius: 20,
 maxHeight: '70%',
 paddingBottom: 20,
 },
 modalHeader: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 paddingHorizontal: 20,
 paddingVertical: 16,
 borderBottomWidth: 1,
 borderBottomColor: '#E0E0E0',
 },
 modalTitle: {
 fontSize: 18,
 fontWeight: '600',
 color: '#333',
 },
 modalCloseButton: {
 padding: 4,
 },
 languageList: {
 paddingHorizontal: 20,
 },
 languageOption: {
 paddingVertical: 16,
 borderBottomWidth: 1,
 borderBottomColor: '#F0F0F0',
 },
 selectedLanguageOption: {
 backgroundColor: '#F3F4F6',
 borderRadius: 8,
 borderBottomColor: 'transparent',
 marginVertical: 2,
 paddingHorizontal: 12,
 },
 languageOptionContent: {
 flexDirection: 'row',
 alignItems: 'center',
 justifyContent: 'space-between',
 },
 languageInfo: {
 flex: 1,
 },
 languageOptionLabel: {
 fontSize: 16,
 fontWeight: '500',
 color: '#333',
 },
 selectedLanguageOptionText: {
 color: '#1A1A1A',
 fontWeight: '600',
 },
 languageNativeName: {
 fontSize: 14,
 color: '#666',
 marginTop: 2,
 },
 selectedLanguageNativeText: {
 color: '#1A1A1A',
 },

 languagePickerContainer: {
 backgroundColor: '#FFFFFF',
 borderWidth: 2,
 borderColor: '#F3F4F6',
 borderRadius: 10,
 position: 'relative',
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 2,
 elevation: 2,
 },
 languagePicker: {
 height: 50,
 color: '#333',
 },
 pickerItem: {
 fontSize: 16,
 color: '#333',
 },
 pickerIcon: {
 position: 'absolute',
 right: 15,
 top: 15,
 pointerEvents: 'none',
 },
 languageHelper: {
 fontSize: 13,
 color: '#1A1A1A',
 marginTop: 8,
 fontWeight: '500',
 backgroundColor: '#F3F4F6',
 padding: 10,
 borderRadius: 8,
 textAlign: 'center',
 borderLeftWidth: 3,
 borderLeftColor: '#1A1A1A',
 },
 picker: {
 height: 50,
 },
 descriptionContainer: {
 position: 'relative',
 },
 descriptionWrapper: {
 marginBottom: 12,
 },
 voiceButtonContainer: {
 alignItems: 'center',
 marginBottom: 8,
 },
 voiceButtonEnhanced: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F8F9FA',
 borderWidth: 2,
 borderColor: '#F3F4F6',
 borderRadius: 25,
 paddingHorizontal: 20,
 paddingVertical: 12,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.1,
 shadowRadius: 3,
 elevation: 3,
 },
 voiceButton: {
 position: 'absolute',
 bottom: 8,
 right: 8,
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F5F5F5',
 borderRadius: 20,
 paddingHorizontal: 12,
 paddingVertical: 6,
 elevation: 2,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 2,
 },
 voiceButtonText: {
 marginLeft: 4,
 fontSize: 12,
 color: '#666',
 fontWeight: '500',
 },
 voiceButtonTextActive: {
 color: '#1A1A1A',
 fontWeight: '600',
 },
 recordingIndicator: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F3F4F6',
 borderRadius: 8,
 padding: 12,
 marginBottom: 16,
 },
 recordingText: {
 marginLeft: 8,
 fontSize: 14,
 color: '#1A1A1A',
 fontWeight: '600',
 },
 errorContainer: {
 backgroundColor: '#F3F4F6',
 borderRadius: 8,
 padding: 12,
 marginBottom: 16,
 },
 errorText: {
 color: '#1A1A1A',
 fontSize: 14,
 },

 // Step 2: Image Upload
 imageSection: {
 marginBottom: 24,
 },
 imagePickerContainer: {
 flexDirection: 'row',
 justifyContent: 'space-around',
 marginBottom: 20,
 },
 imagePickerButton: {
 backgroundColor: '#fff',
 borderRadius: 12,
 padding: 20,
 alignItems: 'center',
 elevation: 2,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 1 },
 shadowOpacity: 0.1,
 shadowRadius: 3,
 minWidth: 140,
 },
 imagePickerText: {
 marginTop: 8,
 fontSize: 14,
 fontWeight: '600',
 color: '#333',
 textAlign: 'center',
 },
 selectedImageContainer: {
 alignItems: 'center',
 marginBottom: 16,
 },
 selectedImage: {
 width: 200,
 height: 200,
 borderRadius: 12,
 marginBottom: 12,
 },
 changeImageButton: {
 backgroundColor: '#F3F4F6',
 borderRadius: 8,
 paddingHorizontal: 16,
 paddingVertical: 8,
 },
 changeImageText: {
 color: '#1A1A1A',
 fontSize: 14,
 fontWeight: '600',
 },
 validationStatus: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F5F5F5',
 borderRadius: 8,
 padding: 12,
 marginTop: 16,
 },
 validationSuccess: {
 backgroundColor: '#F3F4F6',
 },
 validationError: {
 backgroundColor: '#F3F4F6',
 },
 validationText: {
 marginLeft: 8,
 fontSize: 14,
 color: '#333',
 },

 // Step 2: Photo - manual fallback link
 skipPhotoLink: {
 alignSelf: 'center',
 marginTop: 8,
 paddingVertical: 8,
 paddingHorizontal: 12,
 },
 skipPhotoLinkText: {
 fontSize: 13,
 color: '#888',
 textDecorationLine: 'underline',
 textAlign: 'center',
 },
 blockedPhotoHintText: {
 fontSize: 12,
 color: '#888',
 textAlign: 'center',
 marginTop: 8,
 paddingHorizontal: 8,
 },

 // Unused since the photo step no longer runs before category selection -
 // left in place in case a future "detected from photo" affordance returns.
 detectedCategoryBanner: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F3F4F6',
 borderRadius: 8,
 padding: 12,
 marginBottom: 16,
 },
 detectedCategoryBannerText: {
 marginLeft: 8,
 fontSize: 14,
 color: '#333',
 flexShrink: 1,
 },
 detectedCategoryBannerHighlight: {
 fontWeight: '700',
 color: '#1A1A1A',
 },

 // Step 3: Authenticity / category-match warning
 authenticityWarningContainer: {
 backgroundColor: '#FFF8E1',
 borderRadius: 8,
 padding: 12,
 marginTop: 16,
 borderWidth: 1,
 borderColor: '#FFE0A3',
 },
 authenticityWarningContainerFlagged: {
 backgroundColor: '#FDECEA',
 borderColor: '#F5C6C3',
 },
 authenticityWarningHeader: {
 flexDirection: 'row',
 alignItems: 'center',
 marginBottom: 8,
 },
 authenticityWarningTitle: {
 marginLeft: 8,
 fontSize: 14,
 fontWeight: '700',
 color: '#333',
 flexShrink: 1,
 },
 authenticityReasonsList: {
 marginBottom: 8,
 },
 authenticityReasonText: {
 fontSize: 13,
 color: '#555',
 marginBottom: 4,
 },
 authenticitySuggestionButton: {
 backgroundColor: '#fff',
 borderRadius: 8,
 paddingVertical: 8,
 paddingHorizontal: 12,
 alignSelf: 'flex-start',
 marginBottom: 8,
 borderWidth: 1,
 borderColor: '#DDD',
 },
 authenticitySuggestionButtonText: {
 fontSize: 13,
 fontWeight: '600',
 color: '#1A1A1A',
 },
 // Unused now that the flagged-description override checkbox has been
 // removed (the backend hard-rejects a flagged description - no bypass).
 authenticityConfirmRow: {
 flexDirection: 'row',
 alignItems: 'center',
 marginTop: 4,
 },
 authenticityConfirmText: {
 marginLeft: 8,
 fontSize: 13,
 color: '#333',
 flexShrink: 1,
 },
 authenticityBlockedText: {
 fontSize: 12,
 fontStyle: 'italic',
 color: '#C62828',
 marginTop: 4,
 },


  // Step 4: Success Screen
  successContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  complaintDetailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    width: '100%',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  detailsCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
    width: 120,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  priorityText: {
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  priorityAnalysisCard: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    width: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  reasoningText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  nextStepsCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    width: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  nextStepText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    lineHeight: 20,
  },
  successActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  mapButton: {
    backgroundColor: '#1976D2',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.48,
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mapButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  doneButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flex: 0.48,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },


 // Navigation Buttons
 navigationButtons: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 marginTop: 32,
 },
 backNavigationButton: {
 flexDirection: 'row',
 alignItems: 'center',
 paddingVertical: 12,
 paddingHorizontal: 16,
 borderRadius: 8,
 backgroundColor: '#F5F5F5',
 },
 backNavigationText: {
 marginLeft: 4,
 fontSize: 16,
 color: '#666',
 fontWeight: '600',
 },
 continueButton: {
 backgroundColor: '#1A1A1A',
 borderRadius: 12,
 paddingVertical: 16,
 paddingHorizontal: 32,
 alignItems: 'center',
 elevation: 2,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.1,
 shadowRadius: 4,
 },
 continueButtonDisabled: {
 backgroundColor: '#BDBDBD',
 },
 continueButtonText: {
 color: '#fff',
 fontSize: 16,
 fontWeight: 'bold',
 },
 submitButton: {
 backgroundColor: '#1A1A1A',
 borderRadius: 12,
 paddingVertical: 16,
 paddingHorizontal: 32,
 alignItems: 'center',
 elevation: 2,
 shadowColor: '#000',
 shadowOffset: { width: 0, height: 2 },
 shadowOpacity: 0.1,
 shadowRadius: 4,
 },
 submitButtonDisabled: {
 backgroundColor: '#BDBDBD',
 },
 submitButtonText: {
 color: '#fff',
 fontSize: 16,
 fontWeight: 'bold',
 },

 // Infrastructure Display Styles
 infrastructureLoadingContainer: {
 flexDirection: 'row',
 alignItems: 'center',
 backgroundColor: '#F3F4F6',
 padding: 12,
 borderRadius: 8,
 marginVertical: 12,
 },
 infrastructureLoadingText: {
 marginLeft: 8,
 fontSize: 14,
 color: '#1A1A1A',
 fontWeight: '600',
 },
 infrastructureContainer: {
 backgroundColor: '#F3F4F6',
 padding: 16,
 borderRadius: 12,
 marginVertical: 12,
 borderLeftWidth: 4,
 borderLeftColor: '#1A1A1A',
 },
 infrastructureTitle: {
 fontSize: 16,
 fontWeight: 'bold',
 color: '#4A148C',
 marginBottom: 8,
 },
 infrastructureSummary: {
 fontSize: 14,
 color: '#6A1B9A',
 marginBottom: 12,
 lineHeight: 20,
 },
 infrastructureList: {
 marginTop: 8,
 },
 infrastructureItem: {
 backgroundColor: 'rgba(156, 39, 176, 0.1)',
 padding: 10,
 borderRadius: 8,
 marginBottom: 6,
 },
 infrastructureName: {
 fontSize: 14,
 fontWeight: '600',
 color: '#4A148C',
 textTransform: 'capitalize',
 },
 infrastructureDistance: {
 fontSize: 12,
 color: '#6A1B9A',
 marginTop: 2,
 },
 infrastructureMore: {
 fontSize: 12,
 color: '#1A1A1A',
 fontStyle: 'italic',
 textAlign: 'center',
 marginTop: 4,
 },

 // Infrastructure Modal Styles
 infrastructureModal: {
 backgroundColor: '#fff',
 borderTopLeftRadius: 20,
 borderTopRightRadius: 20,
 paddingBottom: 20,
 maxHeight: '85%',
 minHeight: '50%',
 },
 infrastructureModalContent: {
 paddingHorizontal: 20,
 paddingVertical: 10,
 },
 infrastructureModalSubtitle: {
 fontSize: 14,
 color: '#666',
 marginBottom: 20,
 lineHeight: 20,
 textAlign: 'center',
 },
 infrastructureSectionTitle: {
 fontSize: 16,
 fontWeight: 'bold',
 color: '#1A1A1A',
 marginTop: 15,
 marginBottom: 10,
 },
 infrastructureModalItem: {
 backgroundColor: '#f8f9fa',
 padding: 12,
 borderRadius: 10,
 marginBottom: 8,
 borderLeftWidth: 3,
 borderLeftColor: '#1A1A1A',
 },
 infrastructureItemHeader: {
 flexDirection: 'row',
 justifyContent: 'space-between',
 alignItems: 'center',
 marginBottom: 4,
 },
 infrastructureItemType: {
 fontSize: 14,
 fontWeight: '600',
 color: '#1A1A1A',
 flex: 1,
 },
 infrastructureItemDistance: {
 fontSize: 12,
 color: '#666',
 backgroundColor: '#F3F4F6',
 paddingHorizontal: 8,
 paddingVertical: 2,
 borderRadius: 10,
 },
 infrastructureItemName: {
 fontSize: 13,
 color: '#444',
 fontWeight: '500',
 },
 infrastructureItemVicinity: {
 fontSize: 11,
 color: '#777',
 marginTop: 2,
 fontStyle: 'italic',
 },
 infrastructureModalFooter: {
 marginTop: 20,
 paddingTop: 15,
 borderTopWidth: 1,
 borderTopColor: '#eee',
 },
 infrastructureModalSummary: {
 fontSize: 13,
 color: '#666',
 textAlign: 'center',
 fontWeight: '500',
 },
 infrastructureModalButton: {
 backgroundColor: '#1A1A1A',
 borderRadius: 10,
 paddingVertical: 12,
 paddingHorizontal: 30,
 alignItems: 'center',
 marginHorizontal: 20,
 marginTop: 10,
 },
 infrastructureModalButtonText: {
 color: '#fff',
 fontSize: 16,
 fontWeight: '600',
 },
});

export default MultiStepSubmitComplaintScreen;
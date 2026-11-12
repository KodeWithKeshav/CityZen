import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Image,
  Dimensions,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { apiClient, makeApiCall } from '../../../config/supabase';
import { useTranslatedObject, useTranslatedList } from '../../context/TranslationContext';
import { formatLocalizedDate, formatLocalizedDateTime } from '../../utils/dateLocale';
import { getCategoryLabel, getStatusLabel, getPriorityTier } from '../../utils/priorityUtils';

const { width } = Dimensions.get('window');

const CitizenDetails = ({ route, navigation }) => {
  const { t, i18n } = useTranslation(['admin', 'common', 'complaint', 'citizen']);
  const { citizenId } = route.params || {};
  const [citizenData, setCitizenData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const translatedCitizen = useTranslatedObject(citizenData?.citizen, ['full_name']);
  const translatedComplaints = useTranslatedList(citizenData?.complaints, ['title', 'description', 'location']);
  const translatedStages = useTranslatedList(selectedComplaint?.trackingStages, ['name', 'description', 'officer', 'contractor']);

  const displayComplaints = translatedComplaints.length > 0 ? translatedComplaints : (citizenData?.complaints || []);
  const activeModalComplaint = selectedComplaint
    ? (displayComplaints.find((c) => c.id === selectedComplaint.id) || selectedComplaint)
    : null;
  const displayStages = translatedStages.length > 0 ? translatedStages : (activeModalComplaint?.trackingStages || []);

  useEffect(() => {
    if (!citizenId) {
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.missingCitizenId'));
      navigation.goBack();
      return;
    }
    loadCitizenDetails();
  }, [citizenId]);

  const loadCitizenDetails = async () => {
    try {
      setLoading(true);
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/citizens/${citizenId}/details`
      );
      
      if (response.success) {
        setCitizenData(response.data);
      } else {
        Alert.alert(t('common:mobileNav.error'), response.message || t('admin:mobileAdmin.loadCitizenDetailsFailed'));
        navigation.goBack();
      }
    } catch (error) {
      console.error('Load citizen details error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.connectError'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCitizenDetails();
    setRefreshing(false);
  };

  const handleDeleteCitizen = async () => {
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/citizens/${citizenId}`,
        { method: 'DELETE' }
      );
      
      if (response.success) {
        Alert.alert(t('common:buttons.success'), t('admin:mobileAdmin.citizenDeleted'), [
          { text: t('common:buttons.ok'), onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert(t('common:mobileNav.error'), response.message || t('admin:mobileAdmin.deleteCitizenFailed'));
      }
    } catch (error) {
      console.error('Delete citizen error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.connectError'));
    }
    setShowDeleteConfirm(false);
  };

  const openComplaintDetails = (complaint) => {
    setSelectedComplaint(complaint);
    setShowComplaintModal(true);
  };

  const renderTrackingStage = (stage, isActive, isCompleted, isLast) => {
    const getStageColor = () => {
      if (isCompleted) return '#1A1A1A';
      if (isActive) return '#1A1A1A';
      return '#bdc3c7';
    };

    const getStageIcon = () => {
      if (isCompleted) return 'checkmark-circle';
      if (isActive) return 'radio-button-on';
      return 'radio-button-off';
    };

    return (
      <View key={stage.id} style={styles.trackingStage}>
        <View style={styles.stageIconContainer}>
          <Ionicons 
            name={getStageIcon()} 
            size={24} 
            color={getStageColor()} 
          />
          {!isLast && (
            <View style={[
              styles.stageLine, 
              { backgroundColor: isCompleted ? '#1A1A1A' : '#bdc3c7' }
            ]} />
          )}
        </View>
        
        <View style={styles.stageContent}>
          <View style={styles.stageHeader}>
            <Text style={[styles.stageName, { color: getStageColor() }]}>
              {stage.icon} {stage.name}
            </Text>
            {Boolean(stage.date) && (
              <Text style={styles.stageDate}>
                {formatLocalizedDate(stage.date, i18n.language)}
              </Text>
            )}
          </View>
          
          <Text style={styles.stageDescription}>
            {stage.description}
          </Text>
          
          {Boolean(stage.officer) && (
            <Text style={styles.stageAssignment}>
              {t('admin:mobileAdmin.officerSimple', { name: stage.officer })}
            </Text>
          )}
          
          {Boolean(stage.contractor) && (
            <Text style={styles.stageAssignment}>
              {t('admin:mobileAdmin.contractorSimple', { name: stage.contractor })}
            </Text>
          )}
          
          {Boolean(stage.estimatedCost) && (
            <Text style={styles.stageAssignment}>
              {t('admin:mobileAdmin.estimatedCostLine', { cost: stage.estimatedCost })}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderComplaintCard = (complaint) => {
    const getStatusColor = (status) => {
      const colors = {
        'pending': '#1A1A1A',
        'in_progress': '#1A1A1A',
        'resolved': '#1A1A1A',
        'cancelled': '#95a5a6'
      };
      return colors[status] || '#95a5a6';
    };

    return (
      <TouchableOpacity
        key={complaint.id}
        style={styles.complaintCard}
        onPress={() => openComplaintDetails(complaint)}
      >
        <View style={styles.complaintHeader}>
          <Text style={styles.complaintTitle} numberOfLines={2}>
            {complaint.title}
          </Text>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: getStatusColor(complaint.status) }
          ]}>
            <Text style={styles.statusText}>
              {getStatusLabel(complaint.status || 'pending', t)}
            </Text>
          </View>
        </View>
        
        <Text style={styles.complaintDescription} numberOfLines={3}>
          {complaint.description}
        </Text>
        
        <View style={styles.complaintMeta}>
          <Text style={styles.complaintDate}>
            {formatLocalizedDate(complaint.created_at, i18n.language)}
          </Text>
          <Text style={styles.complaintLocation}>
            {complaint.location || t('admin:mobileAdmin.locationNotSpecified')}
          </Text>
        </View>
        
        <View style={styles.progressIndicator}>
          <Text style={styles.progressText}>
            {t('admin:mobileAdmin.stageProgressRatio', { current: complaint.currentStage, total: 5 })}
          </Text>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill,
              { width: `${(complaint.currentStage / 5) * 100}%` }
            ]} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>{t('admin:mobileAdmin.loadingCitizenDetails')}</Text>
      </View>
    );
  }

  if (!citizenData) {
    return (
      <View style={styles.errorContainer}>
        <Text>{t('admin:mobileAdmin.citizenNotFound')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>{t('admin:mobileAdmin.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const citizen = translatedCitizen || citizenData.citizen;
  const complaints = displayComplaints;
  const { stats } = citizenData;

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <LinearGradient
        colors={['#1A1A1A', '#1A1A1A']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>{t('admin:mobileAdmin.citizenDetailsTitle')}</Text>
          
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => setShowDeleteConfirm(true)}
          >
            <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Citizen Profile */}
      <View style={styles.profileSection}>
        <View style={styles.profileImageContainer}>
          {citizen.profile_image ? (
            <Image source={{ uri: citizen.profile_image }} style={styles.profileImage} />
          ) : (
            <View style={styles.defaultProfileImage}>
              <Text style={styles.profileInitial}>
                {citizen.full_name ? citizen.full_name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.profileInfo}>
          <Text style={styles.citizenName}>
            {citizen.full_name || t('admin:mobileAdmin.unknownUser')}
          </Text>
          <Text style={styles.citizenEmail}>{citizen.email}</Text>
          <Text style={styles.citizenPhone}>
            {citizen.phone_number || t('admin:mobileAdmin.noPhone')}
          </Text>
          <Text style={styles.joinDate}>
            {t('admin:mobileAdmin.joinedDate', { date: formatLocalizedDate(citizen.created_at, i18n.language) })}
          </Text>
        </View>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalComplaints}</Text>
          <Text style={styles.statLabel}>{t('admin:mobileAdmin.totalLabel')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#1A1A1A' }]}>{stats.resolved}</Text>
          <Text style={styles.statLabel}>{t('common:status.resolved')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#1A1A1A' }]}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>{t('common:status.inProgress')}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#1A1A1A' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>{t('common:status.pending')}</Text>
        </View>
      </View>

      {/* Complaints List */}
      <View style={styles.complaintsSection}>
        <Text style={styles.sectionTitle}>{t('admin:mobileAdmin.complaintsHistory')}</Text>
        {complaints.length === 0 ? (
          <Text style={styles.noComplaints}>{t('admin:mobileAdmin.noComplaintsFound')}</Text>
        ) : (
          complaints.map(complaint => renderComplaintCard(complaint))
        )}
      </View>

      {/* Complaint Details Modal */}
      <Modal
        visible={showComplaintModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('admin:mobileAdmin.complaintTracking')}</Text>
            <TouchableOpacity
              onPress={() => setShowComplaintModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {activeModalComplaint && (
            <ScrollView style={styles.modalContent}>
              {/* Complaint Info */}
              <View style={styles.complaintInfo}>
                <Text style={styles.complaintModalTitle}>
                  {activeModalComplaint.title}
                </Text>
                <Text style={styles.complaintModalDescription}>
                  {activeModalComplaint.description}
                </Text>
                
                {activeModalComplaint.image_url && (
                  <Image 
                    source={{ uri: activeModalComplaint.image_url }} 
                    style={styles.complaintImage}
                  />
                )}
                
                <View style={styles.complaintModalMeta}>
                  <Text style={styles.modalMetaText}>
                    {t('admin:mobileAdmin.submittedDateLine', { date: formatLocalizedDateTime(activeModalComplaint.created_at, i18n.language) })}
                  </Text>
                  <Text style={styles.modalMetaText}>
                    {t('admin:mobileAdmin.locationLine', { location: activeModalComplaint.location || t('admin:mobileAdmin.notSpecified') })}
                  </Text>
                  <Text style={styles.modalMetaText}>
                    {t('admin:mobileAdmin.categoryLine', { category: activeModalComplaint.category ? getCategoryLabel(activeModalComplaint.category, t) : t('admin:mobileAdmin.generalCategory') })}
                  </Text>
                  <Text style={styles.modalMetaText}>
                    {t('admin:mobileAdmin.priorityLine', { priority: activeModalComplaint.priority_score != null ? getPriorityTier(activeModalComplaint.priority_score, t).label : (activeModalComplaint.priority || t('common:priority.medium')) })}
                  </Text>
                </View>
              </View>
              
              {/* Amazon-style Tracking */}
              <View style={styles.trackingContainer}>
                <Text style={styles.trackingTitle}>{t('admin:mobileAdmin.complaintProgress')}</Text>
                {displayStages.map((stage, index) => 
                  renderTrackingStage(
                    stage, 
                    index + 1 === activeModalComplaint.currentStage,
                    stage.status === 'completed',
                    index === displayStages.length - 1
                  )
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent
        animationType="fade"
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>{t('admin:mobileAdmin.deleteCitizenTitle')}</Text>
            <Text style={styles.deleteModalMessage}>
              {t('admin:mobileAdmin.deleteCitizenConfirm')}
            </Text>
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>{t('common:buttons.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={handleDeleteCitizen}
              >
                <Text style={styles.confirmDeleteButtonText}>{t('common:buttons.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  deleteButton: {
    padding: 8,
  },
  profileSection: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: 'white',
    marginHorizontal: 15,
    marginTop: -10,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileImageContainer: {
    marginRight: 15,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  defaultProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
  },
  profileInfo: {
    flex: 1,
  },
  citizenName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  citizenEmail: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 3,
  },
  citizenPhone: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 3,
  },
  joinDate: {
    fontSize: 14,
    color: '#95a5a6',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'space-around',
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    minWidth: 70,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 5,
  },
  complaintsSection: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  noComplaints: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontStyle: 'italic',
    padding: 20,
  },
  complaintCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  complaintTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  complaintDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  complaintMeta: {
    marginBottom: 10,
  },
  complaintDate: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 2,
  },
  complaintLocation: {
    fontSize: 12,
    color: '#95a5a6',
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginRight: 10,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#ecf0f1',
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  complaintInfo: {
    marginBottom: 30,
  },
  complaintModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  complaintModalDescription: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 15,
    lineHeight: 24,
  },
  complaintImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
  },
  complaintModalMeta: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
  },
  modalMetaText: {
    fontSize: 14,
    color: '#5a6c7d',
    marginBottom: 8,
  },
  trackingContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
  },
  trackingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  trackingStage: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  stageIconContainer: {
    alignItems: 'center',
    marginRight: 15,
  },
  stageLine: {
    width: 2,
    flex: 1,
    marginTop: 8,
  },
  stageContent: {
    flex: 1,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  stageName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  stageDate: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  stageDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 5,
  },
  stageAssignment: {
    fontSize: 12,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    width: width - 40,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 10,
  },
  deleteModalMessage: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 20,
    lineHeight: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#ecf0f1',
    borderRadius: 8,
    marginRight: 10,
  },
  cancelButtonText: {
    textAlign: 'center',
    color: '#7f8c8d',
    fontWeight: 'bold',
  },
  confirmDeleteButton: {
    flex: 1,
    padding: 12,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
  },
  confirmDeleteButtonText: {
    textAlign: 'center',
    color: 'white',
    fontWeight: 'bold',
  },
});

export default CitizenDetails;

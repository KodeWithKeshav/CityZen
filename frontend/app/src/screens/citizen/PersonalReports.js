import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { apiClient, makeApiCall } from '../../../config/supabase';

const { width } = Dimensions.get('window');

const PersonalReports = ({ navigation }) => {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  useEffect(() => {
    loadPersonalReports();
  }, []);

  const loadPersonalReports = async () => {
    try {
      setLoading(true);
      const response = await makeApiCall(apiClient.complaints.personalReports);
      
      if (response.success) {
        setReports(response.data.complaints);
        setStats(response.data.stats);
      } else {
        Alert.alert('Error', response.message || 'Failed to load your reports');
      }
    } catch (error) {
      console.error('Load personal reports error:', error);
      Alert.alert('Error', 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPersonalReports();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear stored auth data
              await AsyncStorage.multiRemove(['authToken', 'userData']);
              // Navigate to welcome screen
              navigation.replace('Welcome');
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to logout properly');
            }
          }
        }
      ]
    );
  };

  const openTrackingDetails = (report) => {
    setSelectedReport(report);
    setShowTrackingModal(true);
  };

  const getStageTypeIcon = (stageName) => {
    const n = (stageName || '').toLowerCase();
    if (n.includes('submit') || n.includes('receiv')) return 'document-text-outline';
    if (n.includes('review') || n.includes('assess')) return 'eye-outline';
    if (n.includes('assign') || n.includes('officer')) return 'person-add-outline';
    if (n.includes('inspect') || n.includes('site')) return 'search-outline';
    if (n.includes('work') || n.includes('repair') || n.includes('fix')) return 'construct-outline';
    if (n.includes('complet') || n.includes('resolv') || n.includes('close')) return 'checkmark-done-outline';
    return 'ellipse-outline';
  };

  const renderTrackingStage = (stage, isActive, isCompleted, isLast) => {
    const circleStyle = isCompleted
      ? { bg: '#1A1A1A', border: '#1A1A1A', iconColor: '#fff' }
      : isActive
      ? { bg: '#374151', border: '#374151', iconColor: '#fff' }
      : { bg: '#F9FAFB', border: '#E5E7EB', iconColor: '#9CA3AF' };

    const nameColor = isCompleted ? '#111827' : isActive ? '#1A1A1A' : '#9CA3AF';
    const cardBg    = isActive ? '#F8FAFC' : '#FAFAFA';
    const cardBorder = isActive ? '#D1D5DB' : '#F3F4F6';

    return (
      <View key={stage.id} style={styles.trackingStage}>
        {/* Left: circle + connector */}
        <View style={styles.stageIconContainer}>
          <View style={[
            styles.stageCircle,
            { backgroundColor: circleStyle.bg, borderColor: circleStyle.border },
          ]}>
            <Ionicons
              name={isCompleted ? 'checkmark' : getStageTypeIcon(stage.name)}
              size={14}
              color={circleStyle.iconColor}
            />
          </View>
          {!isLast && (
            <View style={[
              styles.stageLine,
              { backgroundColor: isCompleted ? '#1A1A1A' : '#E5E7EB' },
            ]} />
          )}
        </View>

        {/* Right: card */}
        <View style={[styles.stageCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <View style={styles.stageHeader}>
            <Text style={[styles.stageName, { color: nameColor, flex: 1 }]}>
              {stage.name}
            </Text>
            {isActive && (
              <View style={styles.activeChip}>
                <Text style={styles.activeChipText}>Active</Text>
              </View>
            )}
            {isCompleted && stage.date && (
              <Text style={styles.stageDate}>
                {new Date(stage.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </Text>
            )}
          </View>

          <Text style={styles.stageDescription}>{stage.description}</Text>

          {(stage.officer || stage.contractor || stage.estimatedCost) && (
            <View style={styles.stageMetaGroup}>
              {stage.officer && (
                <View style={styles.stageMetaRow}>
                  <Ionicons name="person-circle-outline" size={12} color="#6B7280" />
                  <Text style={styles.stageAssignment}>Officer: {stage.officer}</Text>
                </View>
              )}
              {stage.contractor && (
                <View style={styles.stageMetaRow}>
                  <Ionicons name="construct-outline" size={12} color="#6B7280" />
                  <Text style={styles.stageAssignment}>Contractor: {stage.contractor}</Text>
                </View>
              )}
              {stage.estimatedCost && (
                <View style={styles.stageMetaRow}>
                  <Ionicons name="cash-outline" size={12} color="#6B7280" />
                  <Text style={styles.stageAssignment}>Est. Cost: ₹{stage.estimatedCost}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderReportCard = (report) => {
    const getStatusColor = (status) => {
      const colors = {
        'pending': '#1A1A1A',
        'in_progress': '#1A1A1A',
        'resolved': '#1A1A1A',
        'cancelled': '#95a5a6'
      };
      return colors[status] || '#95a5a6';
    };

    const getStatusText = (status) => {
      const statusMap = {
        'pending': 'PENDING',
        'in_progress': 'IN PROGRESS',
        'resolved': 'RESOLVED',
        'cancelled': 'CANCELLED'
      };
      return statusMap[status] || status.toUpperCase();
    };

    return (
      <TouchableOpacity
        key={report.id}
        style={styles.reportCard}
        onPress={() => openTrackingDetails(report)}
      >
        <View style={styles.reportHeader}>
          <Text style={styles.reportTitle} numberOfLines={2}>
            {report.title}
          </Text>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: getStatusColor(report.status) }
          ]}>
            <Text style={styles.statusText}>
              {getStatusText(report.status)}
            </Text>
          </View>
        </View>
        
        <Text style={styles.reportDescription} numberOfLines={3}>
          {report.description}
        </Text>
        
        {report.image_url && (
          <Image 
            source={{ uri: report.image_url }} 
            style={styles.reportImage}
          />
        )}
        
        <View style={styles.reportMeta}>
          <Text style={styles.reportDate}>
            Submitted: {new Date(report.created_at).toLocaleDateString()}
          </Text>
          <Text style={styles.reportLocation}>
            {report.location_address || 'Location not specified'}
          </Text>
          <Text style={styles.reportCategory}>
            {report.category || 'General'}
          </Text>

        </View>
        
        <View style={styles.progressIndicator}>
          <View style={styles.progressLabelRow}>
            <Ionicons name="layers-outline" size={12} color="#6B7280" />
            <Text style={styles.progressText}>Stage {report.currentStage} of 5</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill,
              {
                width: `${(report.currentStage / 5) * 100}%`,
                backgroundColor: getStatusColor(report.status),
              }
            ]} />
          </View>
        </View>
        
        <View style={styles.trackingButton}>
          <Ionicons name="eye-outline" size={16} color="#374151" />
          <Text style={styles.trackingButtonText}>View Tracking Details</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading your reports...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>My Reports</Text>
          
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={24} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Statistics */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.totalComplaints || 0}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#1A1A1A' }]}>{stats.resolved || 0}</Text>
          <Text style={styles.statLabel}>Resolved</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#1A1A1A' }]}>{stats.inProgress || 0}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#1A1A1A' }]}>{stats.pending || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Reports List */}
      <View style={styles.reportsSection}>
        <Text style={styles.sectionTitle}>Your Complaint Reports</Text>
        {reports.length === 0 ? (
          <View style={styles.noReports}>
            <Ionicons name="document-outline" size={60} color="#bdc3c7" />
            <Text style={styles.noReportsText}>No reports found</Text>
            <Text style={styles.noReportsSubtext}>
              Submit your first complaint to see it here
            </Text>
            <TouchableOpacity
              style={styles.submitButton}
              onPress={() => navigation.navigate('SubmitComplaint')}
            >
              <Text style={styles.submitButtonText}>Submit Complaint</Text>
            </TouchableOpacity>
          </View>
        ) : (
          reports.map(report => renderReportCard(report))
        )}
      </View>

      {/* Tracking Details Modal */}
      <Modal
        visible={showTrackingModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Complaint Tracking</Text>
            <TouchableOpacity
              onPress={() => setShowTrackingModal(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>
          
          {selectedReport && (
            <ScrollView style={styles.modalContent}>
              {/* Report Info */}
              <View style={styles.reportInfo}>
                <Text style={styles.reportModalTitle}>
                  {selectedReport.title}
                </Text>
                <Text style={styles.reportModalDescription}>
                  {selectedReport.description}
                </Text>
                
                {selectedReport.image_url && (
                  <Image 
                    source={{ uri: selectedReport.image_url }} 
                    style={styles.reportModalImage}
                  />
                )}
                
                <View style={styles.reportModalMeta}>
                  <Text style={styles.modalMetaText}>
                    Submitted: {new Date(selectedReport.created_at).toLocaleDateString()} at {new Date(selectedReport.created_at).toLocaleTimeString()}
                  </Text>
                  <Text style={styles.modalMetaText}>
                    Location: {selectedReport.location_address || 'Not specified'}
                  </Text>
                  <Text style={styles.modalMetaText}>
                    Category: {selectedReport.category || 'General'}
                  </Text>
                  <Text style={styles.modalMetaText}>
                    Priority: {selectedReport.priority || 'Medium'}
                  </Text>
                </View>
              </View>
              
              {/* Amazon-style Tracking */}
              <View style={styles.trackingContainer}>
                <Text style={styles.trackingTitle}>Progress Tracking</Text>
                {selectedReport.trackingStages?.map((stage, index) => 
                  renderTrackingStage(
                    stage, 
                    index + 1 === selectedReport.currentStage,
                    stage.status === 'completed',
                    index === selectedReport.trackingStages.length - 1
                  )
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  header: {
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.2,
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 15,
    justifyContent: 'space-around',
    marginTop: -10,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 8,
    minWidth: 70,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  reportsSection: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 15,
    letterSpacing: -0.2,
  },
  noReports: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  noReportsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#7f8c8d',
    marginTop: 15,
  },
  noReportsSubtext: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 20,
  },
  submitButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 6,
  },
  submitButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  reportDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 10,
    lineHeight: 20,
  },
  reportImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
  },
  reportMeta: {
    marginBottom: 15,
  },
  reportDate: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 3,
  },
  reportLocation: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 3,
  },
  reportCategory: {
    fontSize: 12,
    color: '#95a5a6',
  },
  progressIndicator: {
    marginBottom: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 5,
  },
  progressText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  progressBar: {
    height: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  trackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  trackingButtonText: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 5,
    fontWeight: '500',
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
  reportInfo: {
    marginBottom: 30,
  },
  reportModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  reportModalDescription: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 15,
    lineHeight: 24,
  },
  reportModalImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 15,
  },
  reportModalMeta: {
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
    marginBottom: 4,
  },
  stageIconContainer: {
    alignItems: 'center',
    width: 34,
    marginRight: 10,
  },
  stageCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageLine: {
    width: 2,
    flex: 1,
    minHeight: 16,
    marginVertical: 4,
    borderRadius: 1,
  },
  stageCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  stageContent: {
    flex: 1,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  stageName: {
    fontSize: 14,
    fontWeight: '700',
  },
  activeChip: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activeChipText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  stageDate: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  stageDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 5,
    lineHeight: 17,
  },
  stageMetaGroup: {
    gap: 3,
  },
  stageMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stageAssignment: {
    fontSize: 11,
    color: '#6B7280',
  },
});

export default PersonalReports;

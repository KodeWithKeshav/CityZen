import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { apiClient, makeApiCall } from '../../../config/supabase';
import SimpleDropdown from '../../components/SimpleDropdown';
import { useTranslatedObject, useTranslatedList } from '../../context/TranslationContext';
import { formatLocalizedDate } from '../../utils/dateLocale';
import { getCategoryLabel, getStatusLabel } from '../../utils/priorityUtils';

// The complaints table stores photos as image_urls (array, see
// routes/complaints.js's insert) - there is no image_url column. Some
// older/alternate API shapes have also been seen returning a singular
// imageUrl, so check for that too before giving up.
const getComplaintImageUrl = (complaint) => {
  if (!complaint) return null;
  if (complaint.imageUrl) return complaint.imageUrl;
  if (Array.isArray(complaint.image_urls) && complaint.image_urls.length > 0) {
    return complaint.image_urls[0];
  }
  return null;
};

const AdminComplaintDetails = ({ route, navigation }) => {
  const { t, i18n } = useTranslation(['admin', 'common', 'complaint', 'citizen']);
  const { complaintId } = route.params || {};
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState(null);
  const [newStageStatus, setNewStageStatus] = useState('');
  const [stageNotes, setStageNotes] = useState('');
  const [officers, setOfficers] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [selectedContractor, setSelectedContractor] = useState('');
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiExplainResult, setAiExplainResult] = useState(null);
  const [showAiExplainModal, setShowAiExplainModal] = useState(false);
  const [geometryRetryLoading, setGeometryRetryLoading] = useState(false);

  const normalizedComplaint = useMemo(() => (
    complaint ? {
      ...complaint,
      _citizenName: complaint.users?.full_name || complaint.user?.full_name || complaint.user_name || complaint.citizenName || '',
    } : null
  ), [complaint]);

  const stagesSource = useMemo(() => (
    (complaint?.complaint_stages || []).map((s) => ({
      ...s,
      _officerName: s.officers?.name || '',
      _officerDept: s.officers?.department || '',
      _contractorName: s.contractors?.name || '',
    }))
  ), [complaint]);

  const translatedComplaint = useTranslatedObject(normalizedComplaint, [
    'title', 'description', 'location_address', 'content_flag_reason', '_citizenName'
  ]);
  const translatedStages = useTranslatedList(stagesSource, [
    'stage_name', 'stage_description', 'notes', '_officerName', '_officerDept', '_contractorName'
  ]);
  const translatedOfficers = useTranslatedList(officers, ['name', 'department']);
  const translatedContractors = useTranslatedList(contractors, ['name']);
  const translatedAiExplain = useTranslatedObject(aiExplainResult, ['explanationText']);

  const displayComplaint = translatedComplaint || normalizedComplaint || complaint;
  const displayStages = translatedStages.length > 0 ? translatedStages : stagesSource;
  const displayOfficers = translatedOfficers.length > 0 ? translatedOfficers : officers;
  const displayContractors = translatedContractors.length > 0 ? translatedContractors : contractors;
  const displayAiExplain = translatedAiExplain || aiExplainResult;

  useEffect(() => {
    if (!complaintId) {
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.missingComplaintId'));
      navigation.goBack();
      return;
    }
    loadComplaintDetails();
    loadOfficers();
    loadContractors();
  }, [complaintId]);

  const loadComplaintDetails = async () => {
    try {
      setLoading(true);
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/complaints/${complaintId}/details`
      );
      
      if (response.success) {
        setComplaint(response.data);
      } else {
        Alert.alert(t('common:mobileNav.error'), response.message || t('admin:mobileAdmin.loadComplaintDetailsFailed'));
      }
    } catch (error) {
      console.error('Load complaint details error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.connectError'));
    } finally {
      setLoading(false);
    }
  };

  const loadOfficers = async () => {
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/officers`
      );
      if (response.success) {
        setOfficers(response.data);
      }
    } catch (error) {
      console.error('Load officers error:', error);
    }
  };

  const loadContractors = async () => {
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/contractors`
      );
      if (response.success) {
        setContractors(response.data);
      }
    } catch (error) {
      console.error('Load contractors error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadComplaintDetails();
    setRefreshing(false);
  };

  const openStageModal = (stage) => {
    const rawStage = complaint?.complaint_stages?.find(s => s.id === stage.id) || stage;
    setSelectedStageId(rawStage.id);
    // Ensure we always have a valid status, default to 'pending' if undefined
    const validStatus = rawStage.stage_status && 
      ['pending', 'in_progress', 'completed', 'cancelled'].includes(rawStage.stage_status) 
      ? rawStage.stage_status 
      : 'pending';
    setNewStageStatus(validStatus);
    setStageNotes(rawStage.notes || '');
    setSelectedOfficer(rawStage.assigned_officer_id || '');
    setSelectedContractor(rawStage.assigned_contractor_id || '');
    setShowStageModal(true);
    
    console.log('🔧 Opening stage modal:', { 
      stageId: rawStage.id, 
      originalStatus: rawStage.stage_status, 
      validStatus,
      stage: rawStage 
    });
  };

  const updateStage = async () => {
    try {
      if (!selectedStageId) return;

      const updateData = {
        stage_status: newStageStatus,
        notes: stageNotes,
        assigned_officer_id: selectedOfficer || null,
        assigned_contractor_id: selectedContractor || null,
      };

      console.log('🚀 Sending stage update:', {
        selectedStageId,
        newStageStatus,
        updateData
      });

      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/complaints/${complaintId}/stage/${selectedStageId}`,
        {
          method: 'PUT',
          body: JSON.stringify(updateData)
        }
      );

      if (response.success) {
        Alert.alert(t('common:buttons.success'), t('admin:mobileAdmin.stageUpdatedSuccess'));
        setShowStageModal(false);
        await loadComplaintDetails();
      } else {
        Alert.alert(t('common:mobileNav.error'), response.message || t('admin:mobileAdmin.updateStageFailed'));
      }
    } catch (error) {
      console.error('Update stage error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.connectError'));
    }
  };

  const addNextStage = async () => {
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/complaints/${complaintId}/stage/next`,
        {
          method: 'POST'
        }
      );

      if (response.success) {
        Alert.alert(t('common:buttons.success'), t('admin:mobileAdmin.nextStageAdded'));
        await loadComplaintDetails();
      } else {
        Alert.alert(t('common:mobileNav.error'), response.message || t('admin:mobileAdmin.addNextStageFailed'));
      }
    } catch (error) {
      console.error('Add next stage error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.connectError'));
    }
  };

  const fetchAiExplanation = async () => {
    const imageUrl = getComplaintImageUrl(complaint);
    if (!imageUrl) return;

    setAiExplainLoading(true);
    setShowAiExplainModal(true);

    try {
      const response = await makeApiCall(`${apiClient.baseUrl}/api/image-analysis/explain`, {
        method: 'POST',
        body: JSON.stringify({ imageUrl, category: complaint?.category, complaintId: complaint?.id })
      });

      if (response?.success) {
        setAiExplainResult(response);
      } else {
        Alert.alert(t('common:mobileNav.error'), response?.error || t('admin:mobileAdmin.explainFailed'));
        setShowAiExplainModal(false);
      }
    } catch (error) {
      console.error('AI explanation error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.explainConnectFailed'));
      setShowAiExplainModal(false);
    } finally {
      setAiExplainLoading(false);
    }
  };

  // Retry pothole footprint/depth estimation (used when geometry_status ===
  // 'failed'). See services/potholeGeometryService.js on the backend.
  const retryGeometry = async () => {
    const imageUrl = getComplaintImageUrl(complaint);
    if (!complaint?.id || !imageUrl) return;
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
      } else {
        Alert.alert(t('common:mobileNav.error'), response?.error || t('admin:mobileAdmin.geometryFailed'));
      }
    } catch (error) {
      console.error('Geometry retry error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.geometryConnectFailed'));
    } finally {
      setGeometryRetryLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#1A1A1A',
      'in_progress': '#1A1A1A',
      'completed': '#1A1A1A',
      'cancelled': '#1A1A1A',
      'resolved': '#1A1A1A',
      'rejected': '#1A1A1A'
    };
    return colors[status] || '#95a5a6';
  };

  const getStageIcon = (stageName) => {
    const icons = {
      'initial_assessment': 'document-text-outline',
      'field_verification': 'location-outline',
      'resource_allocation': 'people-outline',
      'work_assignment': 'hammer-outline',
      'work_in_progress': 'construct-outline',
      'quality_check': 'checkmark-circle-outline',
      'final_approval': 'shield-checkmark-outline',
      'completion': 'flag-outline',
    };
    return icons[stageName] || 'ellipse-outline';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>{t('admin:mobileAdmin.loadingComplaintDetails')}</Text>
      </View>
    );
  }

  if (!displayComplaint) {
    return (
      <View style={styles.errorContainer}>
        <Text>{t('admin:mobileAdmin.complaintNotFound')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>{t('admin:mobileAdmin.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStage = displayStages.find(s => s.stage_status === 'in_progress') ||
                     displayStages.find(s => s.stage_status === 'pending');
  const completedStages = displayStages.filter(s => s.stage_status === 'completed').length || 0;
  const totalStages = displayStages.length || 0;
  const complaintImageUrl = getComplaintImageUrl(displayComplaint);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1A1A1A', '#1A1A1A']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin:mobileAdmin.complaintDetailsTitle')}</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Basic Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin:mobileAdmin.basicInfo')}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(displayComplaint.status) }]}>
              <Text style={styles.statusText}>{getStatusLabel(displayComplaint.status || 'pending', t)}</Text>
            </View>
          </View>

          <Text style={styles.complaintTitle}>{displayComplaint.title}</Text>
          <Text style={styles.complaintDescription}>{displayComplaint.description}</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('admin:mobileAdmin.priorityScoreHeaderLabel')}</Text>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(displayComplaint.priority_score) }]}>
                <Text style={styles.priorityText}>{displayComplaint.priority_score}</Text>
              </View>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('admin:mobileAdmin.categoryHeaderLabel')}</Text>
              <Text style={styles.infoValue}>{getCategoryLabel(displayComplaint.category, t)}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('admin:mobileAdmin.submittedByLabel')}</Text>
              <Text style={styles.infoValue}>{displayComplaint._citizenName || t('admin:mobileAdmin.verifiedCitizen')}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('admin:mobileAdmin.locationHeaderLabel')}</Text>
              <Text style={styles.infoValue}>{displayComplaint.location_address}</Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('admin:mobileAdmin.createdHeaderLabel')}</Text>
              <Text style={styles.infoValue}>
                {formatLocalizedDate(displayComplaint.created_at, i18n.language)}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>{t('admin:mobileAdmin.lastUpdatedHeaderLabel')}</Text>
              <Text style={styles.infoValue}>
                {formatLocalizedDate(displayComplaint.updated_at, i18n.language)}
              </Text>
            </View>
          </View>
        </View>

        {/* Authenticity Check (rule-based + multilingual model blend) */}
        {typeof displayComplaint.text_authenticity_score === 'number' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('admin:mobileAdmin.authenticityCheck')}</Text>
              {displayComplaint.content_flagged && (
                <View style={[styles.statusBadge, { backgroundColor: '#C62828' }]}>
                  <Text style={styles.statusText}>{t('admin:mobileAdmin.flaggedForReview')}</Text>
                </View>
              )}
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('admin:mobileAdmin.authenticityScoreLabel')}</Text>
                <Text style={styles.infoValue}>{Math.round(displayComplaint.text_authenticity_score * 100)} / 100</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('admin:mobileAdmin.verificationStatusLabel')}</Text>
                <Text style={styles.infoValue}>{(displayComplaint.verification_status || 'unverified').replace(/_/g, ' ')}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t('admin:mobileAdmin.capturedLanguageLabel')}</Text>
                <Text style={styles.infoValue}>{(displayComplaint.language || 'en').toUpperCase()}</Text>
              </View>
            </View>

            {Boolean(displayComplaint.content_flag_reason) && (
              <Text style={styles.complaintDescription}>{displayComplaint.content_flag_reason}</Text>
            )}
          </View>
        )}

        {/* Images */}
        {complaintImageUrl ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('admin:mobileAdmin.imagesTitle')}</Text>
              <TouchableOpacity style={styles.explainButton} onPress={fetchAiExplanation}>
                <Ionicons name="scan-outline" size={16} color="#fff" />
                <Text style={styles.explainButtonText}>{t('admin:mobileAdmin.explainAi')}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <Image source={{ uri: complaintImageUrl }} style={styles.complaintImage} />
            </ScrollView>

            {/* Pothole size/depth estimate - shown here too (not just
                inside the Explain AI modal) so it's visible without an
                extra tap. See services/potholeGeometryService.js. */}
            {(displayComplaint.geometry_status === 'completed' || (displayComplaint.estimated_width_cm != null && displayComplaint.estimated_length_cm != null)) && (
              <View style={styles.geometryPanel}>
                <Text style={styles.geometryTitle}>{t('admin:mobileAdmin.estimatedSizeTitle')}</Text>
                <Text style={styles.geometryRow}>
                  {t('admin:mobileAdmin.widthLengthRow', { w: displayComplaint.estimated_width_cm, l: displayComplaint.estimated_length_cm })}
                </Text>
                <Text style={styles.geometryRow}>{t('admin:mobileAdmin.areaRow', { area: displayComplaint.estimated_area_cm2 })}</Text>
                <Text style={styles.geometryDisclaimer}>
                  {t('admin:mobileAdmin.geometryDisclaimer', { confidence: Math.round((displayComplaint.geometry_confidence || 0) * 100) })}
                </Text>
                <TouchableOpacity
                  style={[styles.geometryRetryButton, { backgroundColor: '#34495e', marginTop: 10 }]}
                  disabled={geometryRetryLoading}
                  onPress={retryGeometry}
                >
                  <Text style={styles.explainButtonText}>
                    {geometryRetryLoading ? t('admin:mobileAdmin.recalculating') : t('admin:mobileAdmin.recalculateSize')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {displayComplaint.geometry_status === 'pending' && (
              <View style={styles.geometryPanel}>
                <Text style={styles.geometryRow}>{t('admin:mobileAdmin.estimatingSize')}</Text>
              </View>
            )}
            {displayComplaint.geometry_status === 'failed' && (
              <View style={styles.geometryPanel}>
                <Text style={styles.geometryRow}>
                  {t('admin:mobileAdmin.sizeEstimateFailed')}{displayComplaint.geometry_error ? `: ${displayComplaint.geometry_error}` : '.'}
                </Text>
                <TouchableOpacity
                  style={styles.geometryRetryButton}
                  disabled={geometryRetryLoading}
                  onPress={retryGeometry}
                >
                  <Text style={styles.explainButtonText}>
                    {geometryRetryLoading ? t('admin:mobileAdmin.retrying') : t('admin:mobileAdmin.retrySizeEstimate')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            {displayComplaint.geometry_status !== 'completed' &&
              displayComplaint.geometry_status !== 'pending' &&
              displayComplaint.geometry_status !== 'failed' &&
              displayComplaint.estimated_width_cm == null &&
              displayComplaint.category?.toLowerCase()?.includes('pothole') && (
              <View style={styles.geometryPanel}>
                <Text style={styles.geometryRow}>
                  {t('admin:mobileAdmin.noGeometryYet')}
                </Text>
                <TouchableOpacity
                  style={styles.geometryRetryButton}
                  disabled={geometryRetryLoading}
                  onPress={retryGeometry}
                >
                  <Text style={styles.explainButtonText}>
                    {geometryRetryLoading ? t('admin:mobileAdmin.calculating') : t('admin:mobileAdmin.estimatePotholeGeometry')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('admin:mobileAdmin.imagesTitle')}</Text>
            <Text style={styles.noImageText}>{t('admin:mobileAdmin.noPhotoAttached')}</Text>
          </View>
        )}

        {/* Progress Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin:mobileAdmin.progressOverview')}</Text>
          
          <View style={styles.progressOverview}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${totalStages > 0 ? (completedStages / totalStages) * 100 : 0}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {t('admin:mobileAdmin.stagesCompletedPercent', {
                completed: completedStages,
                total: totalStages,
                percent: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0,
              })}
            </Text>
          </View>

          {currentStage && (
            <View style={styles.currentStageCard}>
              <Text style={styles.currentStageLabel}>{t('admin:mobileAdmin.currentStage')}</Text>
              <Text style={styles.currentStageName}>{currentStage.stage_name}</Text>
              <Text style={styles.currentStageDescription}>{currentStage.stage_description}</Text>
              
              {currentStage.officers && (
                <View style={styles.assignmentInfo}>
                  <Ionicons name="person-outline" size={16} color="#1A1A1A" />
                  <Text style={styles.assignmentText}>
                    {t('admin:mobileAdmin.officerLine', { name: currentStage._officerName || currentStage.officers.name, dept: currentStage._officerDept || currentStage.officers.department || '' })}
                  </Text>
                </View>
              )}

              {currentStage.contractors && (
                <View style={styles.assignmentInfo}>
                  <Ionicons name="build-outline" size={16} color="#1A1A1A" />
                  <Text style={styles.assignmentText}>
                    {t('admin:mobileAdmin.contractorSimple', { name: currentStage._contractorName || currentStage.contractors.name })}
                  </Text>
                </View>
              )}

              <TouchableOpacity 
                style={styles.updateStageButton}
                onPress={() => openStageModal(currentStage)}
              >
                <Ionicons name="create-outline" size={20} color="#fff" />
                <Text style={styles.updateStageText}>{t('admin:mobileAdmin.updateStageBtn')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Stages Timeline */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('admin:mobileAdmin.stagesTimeline')}</Text>
            {displayComplaint.status !== 'resolved' && displayComplaint.status !== 'rejected' && (
              <TouchableOpacity style={styles.addStageButton} onPress={addNextStage}>
                <Ionicons name="add" size={20} color="#1A1A1A" />
                <Text style={styles.addStageText}>{t('admin:mobileAdmin.addNextStage')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {displayStages.map((stage, index) => (
            <TouchableOpacity
              key={stage.id}
              style={styles.stageItem}
              onPress={() => openStageModal(stage)}
            >
              <View style={styles.stageIndicator}>
                <View style={[
                  styles.stageCircle,
                  { backgroundColor: getStatusColor(stage.stage_status) }
                ]}>
                  <Ionicons 
                    name={getStageIcon(stage.stage_name)} 
                    size={16} 
                    color="#fff" 
                  />
                </View>
                {index < displayStages.length - 1 && (
                  <View style={styles.stageLine} />
                )}
              </View>

              <View style={styles.stageContent}>
                <View style={styles.stageHeader}>
                  <Text style={styles.stageName}>{stage.stage_name}</Text>
                  <View style={[
                    styles.stageStatusBadge,
                    { backgroundColor: getStatusColor(stage.stage_status) }
                  ]}>
                    <Text style={styles.stageStatusText}>
                      {getStatusLabel(stage.stage_status || 'pending', t)}
                    </Text>
                  </View>
                </View>

                <Text style={styles.stageDescription}>{stage.stage_description}</Text>

                {Boolean(stage.notes) && (
                  <Text style={styles.stageNotes}>{t('admin:mobileAdmin.notesLine', { notes: stage.notes })}</Text>
                )}

                {Boolean(stage.officers) && (
                  <Text style={styles.stageAssignment}>
                    {t('admin:mobileAdmin.officerSimple', { name: stage._officerName || stage.officers.name })}
                  </Text>
                )}

                {Boolean(stage.contractors) && (
                  <Text style={styles.stageAssignment}>
                    {t('admin:mobileAdmin.contractorSimple', { name: stage._contractorName || stage.contractors.name })}
                  </Text>
                )}

                {Boolean(stage.estimated_cost) && (
                  <Text style={styles.stageCost}>
                    {t('admin:mobileAdmin.estimatedCostLine', { cost: stage.estimated_cost })}
                  </Text>
                )}

                <Text style={styles.stageTimestamp}>
                  {t('admin:mobileAdmin.createdAtLine', { date: formatLocalizedDate(stage.created_at, i18n.language) })}
                  {stage.updated_at !== stage.created_at && 
                    ` • ${t('admin:mobileAdmin.updatedAtLine', { date: formatLocalizedDate(stage.updated_at, i18n.language) })}`
                  }
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Additional Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('admin:mobileAdmin.actionsTitle')}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#1A1A1A' }]}
              onPress={() => Alert.alert(
                t('admin:mobileAdmin.contactUserTitle'), 
                t('admin:mobileAdmin.contactUserDesc'),
                [{ text: t('common:buttons.ok') }]
              )}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>{t('admin:mobileAdmin.contactUserTitle')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#1A1A1A' }]}
              onPress={() => {
                Alert.alert(
                  t('admin:mobileAdmin.markResolvedTitle'),
                  t('admin:mobileAdmin.markResolvedConfirm'),
                  [
                    { text: t('common:buttons.cancel'), style: 'cancel' },
                    { text: t('admin:mobileAdmin.resolveBtn'), onPress: () => updateComplaintStatus('resolved') }
                  ]
                );
              }}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>{t('admin:mobileAdmin.markResolvedBtn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#1A1A1A' }]}
              onPress={() => {
                Alert.alert(
                  t('admin:mobileAdmin.rejectComplaintTitle'),
                  t('admin:mobileAdmin.rejectComplaintConfirm'),
                  [
                    { text: t('common:buttons.cancel'), style: 'cancel' },
                    { text: t('admin:mobileAdmin.rejectBtn'), onPress: () => updateComplaintStatus('rejected') }
                  ]
                );
              }}
            >
              <Ionicons name="close-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>{t('admin:mobileAdmin.rejectBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Stage Update Modal */}
      <Modal
        visible={showStageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.stageModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('admin:mobileAdmin.updateStageBtn')}</Text>
              <TouchableOpacity onPress={() => setShowStageModal(false)}>
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalLabel}>{t('admin:mobileAdmin.stageStatusLabel')}</Text>
              <SimpleDropdown
                value={newStageStatus}
                onValueChange={setNewStageStatus}
                items={[
                  { label: getStatusLabel('pending', t), value: 'pending' },
                  { label: getStatusLabel('in_progress', t), value: 'in_progress' },
                  { label: getStatusLabel('completed', t), value: 'completed' },
                  { label: getStatusLabel('cancelled', t), value: 'cancelled' },
                ]}
              />

              <Text style={styles.modalLabel}>{t('admin:mobileAdmin.assignOfficer')}</Text>
              <SimpleDropdown
                value={selectedOfficer}
                onValueChange={setSelectedOfficer}
                placeholder={t('admin:mobileAdmin.noOfficerAssigned')}
                items={[
                  { label: t('admin:mobileAdmin.noOfficerAssigned'), value: '' },
                  ...displayOfficers.map(officer => ({
                    label: `${officer.name} (${officer.department})`,
                    value: officer.id,
                  })),
                ]}
              />

              <Text style={styles.modalLabel}>{t('admin:mobileAdmin.assignContractor')}</Text>
              <SimpleDropdown
                value={selectedContractor}
                onValueChange={setSelectedContractor}
                placeholder={t('admin:mobileAdmin.noContractorAssigned')}
                items={[
                  { label: t('admin:mobileAdmin.noContractorAssigned'), value: '' },
                  ...displayContractors.map(contractor => ({
                    label: contractor.name,
                    value: contractor.id,
                  })),
                ]}
              />

              <Text style={styles.modalLabel}>{t('admin:mobileAdmin.notesHeaderLabel')}</Text>
              <TextInput
                style={styles.modalTextArea}
                multiline
                numberOfLines={4}
                placeholder={t('admin:mobileAdmin.addStageNotesPlaceholder')}
                value={stageNotes}
                onChangeText={setStageNotes}
              />
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton} 
                onPress={() => setShowStageModal(false)}
              >
                <Text style={styles.modalCancelText}>{t('common:buttons.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalUpdateButton} onPress={updateStage}>
                <Text style={styles.modalUpdateText}>{t('admin:mobileAdmin.updateStageBtn')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* AI Explanation Modal (SAM3 segmentation map) */}
      <Modal
        visible={showAiExplainModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAiExplainModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.stageModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('admin:mobileAdmin.aiImageExplanation')}</Text>
              <TouchableOpacity onPress={() => setShowAiExplainModal(false)}>
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              {aiExplainLoading ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text>{t('admin:mobileAdmin.generatingSam3')}</Text>
                </View>
              ) : displayAiExplain ? (
                <View>
                  <Text style={styles.explanationText}>{displayAiExplain.explanationText}</Text>
                  {displayAiExplain.annotatedImage?.value && (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${displayAiExplain.annotatedImage.value}` }}
                      style={{ width: '100%', height: 250, borderRadius: 8, marginTop: 15, resizeMode: 'contain' }}
                    />
                  )}

                </View>
              ) : (
                <Text style={{ padding: 20 }}>{t('admin:mobileAdmin.noExplanationGenerated')}</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );

  function getPriorityColor(score) {
    if (score >= 8) return '#1A1A1A';
    if (score >= 6) return '#1A1A1A';
    if (score >= 4) return '#1A1A1A';
    return '#95a5a6';
  }

  async function updateComplaintStatus(newStatus) {
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/complaints/${complaintId}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        }
      );

      if (response.success) {
        Alert.alert(t('common:buttons.success'), t('admin:mobileAdmin.complaintStatusChangedSuccess', { status: getStatusLabel(newStatus, t) }));
        await loadComplaintDetails();
      } else {
        Alert.alert(t('common:mobileNav.error'), response.message || t('admin:mobileAdmin.complaintStatusChangeFailed'));
      }
    } catch (error) {
      console.error('Update status error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.connectError'));
    }
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
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
  backButton: {
    color: '#1A1A1A',
    fontSize: 16,
    marginTop: 10,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 15,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  complaintTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  complaintDescription: {
    fontSize: 16,
    color: '#7f8c8d',
    lineHeight: 24,
    marginBottom: 15,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  infoItem: {
    width: '48%',
    marginBottom: 15,
  },
  infoLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 16,
    color: '#2c3e50',
    fontWeight: '500',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  priorityText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  complaintImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
    marginRight: 10,
  },
  noImageText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  progressOverview: {
    marginBottom: 15,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#ecf0f1',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  currentStageCard: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1A1A1A',
  },
  currentStageLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
    marginBottom: 4,
  },
  currentStageName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  currentStageDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  assignmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  assignmentText: {
    fontSize: 14,
    color: '#7f8c8d',
    marginLeft: 5,
  },
  updateStageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  updateStageText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  addStageButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addStageText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  stageItem: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  stageIndicator: {
    alignItems: 'center',
    marginRight: 15,
  },
  stageCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageLine: {
    width: 2,
    height: 40,
    backgroundColor: '#ecf0f1',
    marginTop: 4,
  },
  stageContent: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  stageStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stageStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  stageDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  stageNotes: {
    fontSize: 14,
    color: '#2c3e50',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  stageAssignment: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  stageCost: {
    fontSize: 12,
    color: '#1A1A1A',
    fontWeight: '600',
    marginBottom: 4,
  },
  stageTimestamp: {
    fontSize: 11,
    color: '#95a5a6',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalContent: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 15,
  },
  modalTextArea: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#ecf0f1',
    paddingVertical: 12,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '600',
  },
  modalUpdateButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 10,
    alignItems: 'center',
  },
  modalUpdateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  explainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6', // Blue color for AI explanation
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  explainButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  geometryPanel: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  geometryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 6,
  },
  geometryRow: {
    fontSize: 13,
    color: '#2c3e50',
    marginBottom: 3,
  },
  geometryDisclaimer: {
    fontSize: 11,
    color: '#888',
    fontStyle: 'italic',
    marginTop: 6,
  },
  geometryRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e67e22',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  explanationText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#2c3e50',
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  }
});

export default AdminComplaintDetails;

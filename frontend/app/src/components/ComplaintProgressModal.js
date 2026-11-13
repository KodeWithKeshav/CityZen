import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { makeApiCall, apiClient } from '../../config/supabase';
import { useTranslatedText, useTranslatedList } from '../context/TranslationContext';
import { formatLocalizedDate, formatLocalizedDateTime } from '../utils/dateLocale';
import { getCategoryLabel, getStatusLabel } from '../utils/priorityUtils';

const { width, height } = Dimensions.get('window');

const ComplaintProgressModal = ({ visible, onClose, complaintId, complaintTitle }) => {
  const { t, i18n } = useTranslation(['citizen', 'common', 'complaint']);
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modalAnimation] = useState(new Animated.Value(0));

  const translatedComplaintTitle = useTranslatedText(complaintTitle || '');

  const currentStageSource = React.useMemo(() => {
    const cs = progressData?.progress?.current_stage;
    if (!cs) return [];
    return [{
      ...cs,
      officerName: cs.officers?.name || '',
      officerDept: cs.officers?.department || '',
    }];
  }, [progressData?.progress?.current_stage]);
  const [translatedCurrentStage] = useTranslatedList(currentStageSource, [
    'stage_name',
    'stage_description',
    'officerName',
    'officerDept',
  ]);

  const stagesSource = React.useMemo(() => {
    return (progressData?.stages || []).map((s) => ({
      ...s,
      officerName: s.officers?.name || '',
      contractorName: s.contractors?.name || '',
    }));
  }, [progressData?.stages]);
  const translatedStages = useTranslatedList(stagesSource, [
    'stage_name',
    'stage_description',
    'officerName',
    'contractorName',
  ]);

  const translatedTimeline = useTranslatedList(progressData?.timeline || [], ['action_description']);
  const reporterRaw =
    progressData?.complaint?.users?.full_name ||
    progressData?.complaint?.user?.full_name ||
    progressData?.complaint?.user_name ||
    progressData?.complaint?.citizenName ||
    '';
  const translatedReporter = useTranslatedText(reporterRaw);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      fetchComplaintProgress();
      Animated.spring(modalAnimation, {
        toValue: 1,
        tension: 65,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalAnimation, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, complaintId]);

  const fetchComplaintProgress = async () => {
    if (!complaintId) {
      setLoading(false);
      return;
    }

    try {
      const response = await makeApiCall(`${apiClient.baseUrl}/api/complaint-details/${complaintId}/progress`);
      if (response.success) {
        setProgressData(response.data);
      } else {
        Alert.alert(t('common:mobileNav.error'), t('citizen:mobileProgress.loadFailed'));
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
      Alert.alert(t('common:mobileNav.error'), t('citizen:mobileProgress.loadUnavailable'));
    } finally {
      setLoading(false);
    }
  };

  // Returns icon name + color for each stage state
  const getStageVisuals = (stageStatus) => {
    switch (stageStatus) {
      case 'completed':
        return { icon: 'checkmark-circle', color: '#16a34a', bg: '#dcfce7', border: '#16a34a' };
      case 'in_progress':
        return { icon: 'ellipse', color: '#1A1A1A', bg: '#1A1A1A', border: '#1A1A1A', active: true };
      case 'pending':
      default:
        return { icon: 'ellipse-outline', color: '#9CA3AF', bg: '#F9FAFB', border: '#E5E7EB' };
    }
  };

  const getStatusColors = (status) => {
    switch (status) {
      case 'pending':    return ['#F59E0B', '#D97706'];
      case 'in_progress': return ['#1A1A1A', '#374151'];
      case 'resolved':   return ['#16a34a', '#15803d'];
      case 'rejected':   return ['#DC2626', '#B91C1C'];
      default:           return ['#6B7280', '#4B5563'];
    }
  };

  const getTimelineIcon = (actionType) => {
    const map = {
      'complaint_submitted': 'document-text-outline',
      'status_updated':      'refresh-outline',
      'stage_completed':     'checkmark-done-outline',
      'officer_assigned':    'person-add-outline',
      'contractor_assigned': 'construct-outline',
      'note_added':          'chatbubble-outline',
    };
    return map[actionType] || 'ellipse-outline';
  };

  const formatTimelineAction = (action) => {
    const mapKey = {
      complaint_submitted: 'complaintSubmitted',
      status_updated: 'statusUpdated',
      stage_completed: 'stageCompleted',
      officer_assigned: 'officerAssigned',
      contractor_assigned: 'contractorAssigned',
      note_added: 'noteAdded',
    }[action];
    if (mapKey) {
      return t(`citizen:mobileProgress.actions.${mapKey}`);
    }
    return (action || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!visible) return null;

  const activeStage = translatedCurrentStage || progressData?.progress?.current_stage;
  const displayStages = translatedStages.length > 0 ? translatedStages : (progressData?.stages || []);
  const displayTimeline = translatedTimeline.length > 0 ? translatedTimeline : (progressData?.timeline || []);

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                { scale: modalAnimation.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
                { translateY: modalAnimation.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) },
              ],
              opacity: modalAnimation,
            },
          ]}
        >
          {/* ── Header ── */}
          <View style={styles.modalHeader}>
            <View style={styles.headerRow}>
              <View style={styles.headerIconWrap}>
                <Ionicons name="analytics" size={20} color="#1A1A1A" />
              </View>
              <Text style={styles.modalTitle}>{t('citizen:mobileProgress.title')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Complaint title strip */}
          <View style={styles.titleStrip}>
            <Ionicons name="document-text-outline" size={14} color="#6B7280" />
            <Text style={styles.complaintTitleText} numberOfLines={2}>{translatedComplaintTitle}</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#1A1A1A" />
              <Text style={styles.loadingText}>{t('citizen:mobileProgress.loading')}</Text>
            </View>
          ) : progressData ? (
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>

              {/* ── Progress Overview Card ── */}
              <View style={styles.section}>
                <LinearGradient
                  colors={getStatusColors(progressData.complaint.status)}
                  style={styles.overviewCard}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.overviewLeft}>
                    <Text style={styles.overviewPercent}>{progressData.progress.percentage}%</Text>
                    <Text style={styles.overviewPercentLabel}>{t('citizen:mobileProgress.complete')}</Text>
                  </View>
                  <View style={styles.overviewDivider} />
                  <View style={styles.overviewRight}>
                    <Text style={styles.overviewStages}>
                      {t('citizen:mobileProgress.stagesDone', {
                        completed: progressData.progress.completed_stages,
                        total: progressData.progress.total_stages,
                      })}
                    </Text>
                    <View style={styles.overviewStatusRow}>
                      <View style={styles.overviewStatusDot} />
                      <Text style={styles.overviewStatusLabel}>
                        {getStatusLabel(progressData.complaint.status, t)}
                      </Text>
                    </View>
                    {/* Mini progress bar */}
                    <View style={styles.miniBarTrack}>
                      <View style={[styles.miniBarFill, { width: `${progressData.progress.percentage}%` }]} />
                    </View>
                  </View>
                </LinearGradient>
              </View>

              {/* ── Current Stage ── */}
              {activeStage && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('citizen:mobileProgress.activeStage')}</Text>
                  <View style={styles.currentStageCard}>
                    <View style={styles.currentStageHeader}>
                      <View style={styles.currentStagePulse}>
                        <Ionicons name="pulse" size={16} color="#1A1A1A" />
                      </View>
                      <Text style={styles.currentStageName}>
                        {activeStage.stage_name}
                      </Text>
                    </View>
                    <Text style={styles.currentStageDesc}>
                      {activeStage.stage_description}
                    </Text>
                    {activeStage.estimated_completion_date && (
                      <View style={styles.metaRow}>
                        <Ionicons name="calendar-outline" size={13} color="#6B7280" />
                        <Text style={styles.metaText}>
                          {t('citizen:mobileProgress.expectedBy', {
                            date: formatLocalizedDate(activeStage.estimated_completion_date, {}, i18n.language) || activeStage.formatted_estimated_date,
                          })}
                        </Text>
                      </View>
                    )}
                    {activeStage.officers && (
                      <View style={styles.metaRow}>
                        <Ionicons name="person-circle-outline" size={13} color="#6B7280" />
                        <Text style={styles.metaText}>
                          {activeStage.officerName || activeStage.officers.name} · {activeStage.officerDept || activeStage.officers.department}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* ── Stages Timeline ── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('citizen:mobileProgress.allStages')}</Text>
                {displayStages.map((stage, index) => {
                  const visuals = getStageVisuals(stage.stage_status);
                  const isLast = index === displayStages.length - 1;
                  return (
                    <View key={stage.id || index} style={styles.timelineRow}>
                      {/* Left column: icon + connector */}
                      <View style={styles.timelineLeft}>
                        <View style={[
                          styles.stageCircle,
                          { backgroundColor: visuals.active ? visuals.bg : visuals.bg, borderColor: visuals.border },
                        ]}>
                          <Ionicons
                            name={visuals.icon}
                            size={visuals.active ? 10 : 18}
                            color={visuals.active ? '#fff' : visuals.color}
                          />
                        </View>
                        {!isLast && (
                          <View style={[
                            styles.connector,
                            { backgroundColor: stage.stage_status === 'completed' ? '#16a34a' : '#E5E7EB' },
                          ]} />
                        )}
                      </View>

                      {/* Right column: content */}
                      <View style={[styles.stageCard, !isLast && { marginBottom: 0 }]}>
                        <View style={styles.stageCardHeader}>
                          <Text style={[
                            styles.stageCardName,
                            stage.stage_status === 'completed' && { color: '#16a34a' },
                            stage.stage_status === 'in_progress' && { color: '#1A1A1A' },
                            stage.stage_status === 'pending' && { color: '#9CA3AF' },
                          ]}>
                            {stage.stage_name}
                          </Text>
                          {stage.stage_status === 'in_progress' && (
                            <View style={styles.activeChip}>
                              <Text style={styles.activeChipText}>{t('citizen:mobileReports.activeBadge')}</Text>
                            </View>
                          )}
                          {stage.stage_status === 'completed' && (
                            <View style={styles.doneChip}>
                              <Text style={styles.doneChipText}>{t('citizen:mobileProgress.doneBadge')}</Text>
                            </View>
                          )}
                        </View>

                        {Boolean(stage.stage_description) && (
                          <Text style={styles.stageCardDesc}>{stage.stage_description}</Text>
                        )}

                        <View style={styles.stageMetaGroup}>
                          {stage.stage_status === 'completed' && (stage.completion_date || stage.formatted_completion_date) && (
                            <View style={styles.metaRow}>
                              <Ionicons name="checkmark-circle-outline" size={12} color="#16a34a" />
                              <Text style={[styles.metaText, { color: '#16a34a' }]}>
                                {t('citizen:mobileProgress.completedDate', {
                                  date: stage.completion_date
                                    ? formatLocalizedDate(stage.completion_date, {}, i18n.language)
                                    : stage.formatted_completion_date,
                                })}
                              </Text>
                            </View>
                          )}
                          {stage.stage_status === 'in_progress' && (stage.estimated_completion_date || stage.formatted_estimated_date) && (
                            <View style={styles.metaRow}>
                              <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                              <Text style={styles.metaText}>
                                {t('citizen:mobileProgress.expectedDate', {
                                  date: stage.estimated_completion_date
                                    ? formatLocalizedDate(stage.estimated_completion_date, {}, i18n.language)
                                    : stage.formatted_estimated_date,
                                })}
                              </Text>
                            </View>
                          )}
                          {stage.officers && (
                            <View style={styles.metaRow}>
                              <Ionicons name="person-circle-outline" size={12} color="#6B7280" />
                              <Text style={styles.metaText}>
                                {t('citizen:mobileReports.officer', { name: stage.officerName || stage.officers.name })}
                              </Text>
                            </View>
                          )}
                          {stage.contractors && (
                            <View style={styles.metaRow}>
                              <Ionicons name="construct-outline" size={12} color="#6B7280" />
                              <Text style={styles.metaText}>
                                {t('citizen:mobileReports.contractor', { name: stage.contractorName || stage.contractors.name })}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* ── Recent Activity ── */}
              {displayTimeline && displayTimeline.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('citizen:mobileProgress.recentActivity')}</Text>
                  <View style={styles.activityCard}>
                    {displayTimeline.slice(0, 5).map((entry, index) => (
                      <View key={entry.id || index} style={[
                        styles.activityRow,
                        index < Math.min(displayTimeline.length, 5) - 1 && styles.activityRowBorder,
                      ]}>
                        <View style={styles.activityIconWrap}>
                          <Ionicons name={getTimelineIcon(entry.action_type)} size={14} color="#1A1A1A" />
                        </View>
                        <View style={styles.activityContent}>
                          <Text style={styles.activityAction}>{formatTimelineAction(entry.action_type)}</Text>
                          <Text style={styles.activityDesc}>{entry.action_description}</Text>
                          <Text style={styles.activityDate}>
                            {entry.created_at ? formatLocalizedDateTime(entry.created_at, i18n.language) : entry.formatted_date}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* ── Report Info ── */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('citizen:mobileProgress.reportInfo')}</Text>
                <View style={styles.infoCard}>
                  {[
                    {
                      label: t('citizen:mobileProgress.submitted'),
                      value: progressData.complaint.created_at
                        ? formatLocalizedDate(progressData.complaint.created_at, {}, i18n.language)
                        : progressData.complaint.formatted_created_date,
                      icon: 'calendar-outline',
                    },
                    {
                      label: t('citizen:complaintDetail.category'),
                      value: progressData.complaint.category
                        ? getCategoryLabel(progressData.complaint.category, t)
                        : t('common:mobileNav.general'),
                      icon: 'pricetag-outline',
                    },
                    {
                      label: t('citizen:mobileProgress.priority'),
                      value: Number.isFinite(Number(progressData.complaint.priority_score))
                        ? `${Number(progressData.complaint.priority_score).toFixed(1)} / 10`
                        : t('common:mobileNav.na'),
                      icon: 'speedometer-outline',
                      highlight: true,
                    },
                    {
                      label: t('citizen:mobileProgress.reporter'),
                      value: translatedReporter || t('citizen:feed.verifiedCitizen'),
                      icon: 'person-outline',
                    },
                  ].map((row, i, arr) => (
                    <View key={row.label} style={[styles.infoRow, i < arr.length - 1 && styles.infoRowBorder]}>
                      <View style={styles.infoLabelGroup}>
                        <Ionicons name={row.icon} size={13} color="#9CA3AF" />
                        <Text style={styles.infoLabel}>{row.label}</Text>
                      </View>
                      <Text style={[styles.infoValue, row.highlight && { color: '#DC2626' }]}>
                        {row.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>
          ) : (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={48} color="#DC2626" />
              <Text style={styles.errorText}>{t('citizen:mobileProgress.loadUnavailable')}</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: width - 40,
    maxHeight: height - 100,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },

  // ── Header ──
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  complaintTitleText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },

  // ── Loading / Error ──
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  errorText: {
    marginTop: 14,
    fontSize: 15,
    color: '#DC2626',
    textAlign: 'center',
  },

  // ── Sections ──
  modalContent: { flex: 1 },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // ── Overview Card ──
  overviewCard: {
    borderRadius: 14,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewLeft: {
    alignItems: 'center',
    marginRight: 16,
  },
  overviewPercent: {
    fontSize: 38,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 44,
  },
  overviewPercentLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  overviewDivider: {
    width: 1,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginRight: 16,
  },
  overviewRight: { flex: 1 },
  overviewStages: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  overviewStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  overviewStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginRight: 6,
  },
  overviewStatusLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  miniBarTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },

  // ── Current Stage ──
  currentStageCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  currentStageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  currentStagePulse: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentStageName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  currentStageDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
  },

  // ── Stages Timeline ──
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 36,
    marginRight: 12,
  },
  stageCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connector: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 4,
    borderRadius: 1,
  },
  stageCard: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  stageCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stageCardName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
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
  doneChip: {
    backgroundColor: '#DCFCE7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  doneChipText: {
    fontSize: 10,
    color: '#16a34a',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  stageCardDesc: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 17,
    marginBottom: 6,
  },
  stageMetaGroup: { gap: 2 },

  // ── Recent Activity ──
  activityCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'flex-start',
  },
  activityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  activityContent: { flex: 1 },
  activityAction: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  activityDesc: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
    marginBottom: 3,
  },
  activityDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  // ── Report Info ──
  infoCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
    textTransform: 'capitalize',
    maxWidth: '55%',
    textAlign: 'right',
  },
});

export default ComplaintProgressModal;

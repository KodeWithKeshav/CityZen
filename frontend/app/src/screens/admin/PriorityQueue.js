import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import SimpleDropdown from '../../components/SimpleDropdown';
import { apiClient, makeApiCall } from '../../../config/supabase';
import { useTranslatedList } from '../../context/TranslationContext';
import { formatLocalizedDate } from '../../utils/dateLocale';
import { getCategoryLabel, getStatusLabel } from '../../utils/priorityUtils';

const { height } = Dimensions.get('window');

const PriorityQueue = ({ navigation }) => {
  const { t, i18n } = useTranslation(['admin', 'common', 'complaint', 'citizen']);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterDateRange, setFilterDateRange] = useState('');
  const [filterAssigned, setFilterAssigned] = useState('');
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

  // Status change modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [officers, setOfficers] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [selectedContractor, setSelectedContractor] = useState('');
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);

  const pqSource = useMemo(() => (complaints || []).map((c) => {
    const cs = c.complaint_stages?.find(s => s.stage_status === 'in_progress') ||
      c.complaint_stages?.find(s => s.stage_status === 'pending');
    return {
      ...c,
      _citizenName: c.users?.full_name || c.user?.full_name || c.user_name || c.citizenName || '',
      _stageName: cs?.stage_name || '',
      _officerName: cs?.officers?.name || '',
      _officerDept: cs?.officers?.department || '',
      _contractorName: cs?.contractors?.name || '',
      _contractorCompany: cs?.contractors?.company_name || '',
    };
  }), [complaints]);

  const translatedComplaints = useTranslatedList(pqSource, [
    'title', 'location_address', '_citizenName', '_stageName',
    '_officerName', '_officerDept', '_contractorName', '_contractorCompany'
  ]);
  const translatedOfficers = useTranslatedList(officers, ['name', 'department']);
  const translatedContractors = useTranslatedList(contractors, ['name', 'specialization']);

  const displayComplaints = translatedComplaints.length > 0 ? translatedComplaints : pqSource;
  const displayOfficers = translatedOfficers.length > 0 ? translatedOfficers : officers;
  const displayContractors = translatedContractors.length > 0 ? translatedContractors : contractors;

  const categories = [
    'pothole', 'fallen_tree', 'garbage_dumping', 'stray_cattle',
    'fallen_electric_pole', 'concrete_structure_damage', 'road_waterlogging', 'others'
  ];

  const statusOptions = ['pending', 'in_progress', 'resolved', 'rejected'];

  const priorityOptions = [
    { label: t('admin:mobileAdmin.priorityLowOpt'), value: 'low' },
    { label: t('admin:mobileAdmin.priorityMedOpt'), value: 'medium' },
    { label: t('admin:mobileAdmin.priorityHighOpt'), value: 'high' },
    { label: t('admin:mobileAdmin.priorityCritOpt'), value: 'critical' }
  ];

  const dateRangeOptions = [
    { label: t('admin:mobileAdmin.last24h'), value: '1' },
    { label: t('admin:mobileAdmin.last3d'), value: '3' },
    { label: t('admin:mobileAdmin.lastWeek'), value: '7' },
    { label: t('admin:mobileAdmin.lastMonth'), value: '30' },
    { label: t('admin:mobileAdmin.last3Months'), value: '90' }
  ];

  const assignmentOptions = [
    { label: t('admin:mobileAdmin.unassigned'), value: 'unassigned' },
    { label: t('admin:mobileAdmin.assignedOfficer'), value: 'officer_assigned' },
    { label: t('admin:mobileAdmin.assignedContractor'), value: 'contractor_assigned' },
    { label: t('admin:mobileAdmin.fullyAssigned'), value: 'fully_assigned' }
  ];

  useEffect(() => {
    loadComplaints();
  }, [searchText, filterLocation, filterCategory, filterStatus, filterPriority, filterDateRange, filterAssigned, filterFlagged]);

  const loadComplaints = async (page = 1) => {
    try {
      if (page === 1) setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });

      if (searchText) params.append('search', searchText);
      if (filterLocation) params.append('location', filterLocation);
      if (filterCategory) params.append('category', filterCategory);
      if (filterStatus) params.append('status', filterStatus);
      if (filterPriority) params.append('priority', filterPriority);
      if (filterDateRange) params.append('days', filterDateRange);
      if (filterAssigned) params.append('assigned', filterAssigned);
      if (filterFlagged) params.append('flagged', 'true');

      console.log('Loading complaints with filters:', {
        searchText, filterLocation, filterCategory, filterStatus,
        filterPriority, filterDateRange, filterAssigned, filterFlagged
      });

      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/complaints/priority-queue?${params}`
      );

      if (response.success) {
        if (page === 1) {
          setComplaints(response.data.complaints);
        } else {
          setComplaints(prev => [...prev, ...response.data.complaints]);
        }
        setPagination(response.data.pagination);
        console.log(`Loaded ${response.data.complaints.length} complaints`);
      } else {
        Alert.alert(t('common:mobileNav.error'), response.message || t('admin:mobileAdmin.loadComplaintsFailed'));
      }
    } catch (error) {
      console.error('Load complaints error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.connectError'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadComplaints(1);
    setRefreshing(false);
  };

  const loadMoreComplaints = async () => {
    if (pagination.page < pagination.totalPages) {
      await loadComplaints(pagination.page + 1);
    }
  };

  const clearFilters = () => {
    setSearchText('');
    setFilterLocation('');
    setFilterCategory('');
    setFilterStatus('');
    setFilterPriority('');
    setFilterDateRange('');
    setFilterAssigned('');
    setFilterFlagged(false);
    setShowFilters(false);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (searchText) count++;
    if (filterLocation) count++;
    if (filterCategory) count++;
    if (filterStatus) count++;
    if (filterPriority) count++;
    if (filterDateRange) count++;
    if (filterAssigned) count++;
    if (filterFlagged) count++;
    return count;
  };

  const navigateToComplaintDetails = (complaintId) => {
    navigation.navigate('ComplaintDetails', { complaintId });
  };

  // Load officers and contractors when component mounts
  useEffect(() => {
    loadOfficersAndContractors();
  }, []);

  const loadOfficersAndContractors = async () => {
    try {
      const [officersResponse, contractorsResponse] = await Promise.all([
        makeApiCall(`${apiClient.baseUrl}/api/admin-enhanced/officers`),
        makeApiCall(`${apiClient.baseUrl}/api/admin-enhanced/contractors`)
      ]);

      if (officersResponse.success) {
        setOfficers(officersResponse.data || []);
      }
      if (contractorsResponse.success) {
        setContractors(contractorsResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to load officers/contractors:', error);
      // Set empty arrays on error to prevent crashes
      setOfficers([]);
      setContractors([]);
    }
  };

  const showStatusChangeModal = (complaint) => {
    setSelectedComplaint(complaint);
    setNewStatus(''); // Start with empty selection to force user choice
    setStatusNotes('');
    setSelectedOfficer('');
    setSelectedContractor('');
    setShowStatusModal(true);

    // Load officers and contractors if not already loaded
    if (officers.length === 0 || contractors.length === 0) {
      loadOfficersAndContractors();
    }
  };

  const updateComplaintStatus = async () => {
    if (!selectedComplaint || !newStatus) {
      Alert.alert(t('complaint:mobileSubmit.validationErrorTitle'), t('admin:mobileAdmin.selectNewStatusError'));
      return;
    }

    if (newStatus === selectedComplaint.status) {
      Alert.alert(t('admin:mobileAdmin.noChangesTitle'), t('admin:mobileAdmin.sameStatusDesc'));
      return;
    }

    setStatusChangeLoading(true);
    try {
      console.log('Updating complaint status:', {
        complaintId: selectedComplaint.id,
        currentStatus: selectedComplaint.status,
        newStatus: newStatus,
        officer: selectedOfficer,
        contractor: selectedContractor
      });

      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/complaints/${selectedComplaint.id}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({
            status: newStatus,
            notes: statusNotes,
            oldStatus: selectedComplaint.status,
            adminId: selectedOfficer || null,
            assignedOfficerId: selectedOfficer || null,
            assignedContractorId: selectedContractor || null
          })
        }
      );

      if (response.success) {
        const officerName = selectedOfficer ?
          displayOfficers.find(o => o.id.toString() === selectedOfficer)?.name : null;
        const contractorName = selectedContractor ?
          displayContractors.find(c => c.id.toString() === selectedContractor)?.name : null;

        let successMessage = t('admin:mobileAdmin.statusUpdatedTo', { status: getStatusLabel(newStatus, t) });
        if (officerName) successMessage += `\n${t('admin:mobileAdmin.officerAssignedLine', { name: officerName })}`;
        if (contractorName) successMessage += `\n${t('admin:mobileAdmin.contractorAssignedLine', { name: contractorName })}`;

        Alert.alert(
          t('common:buttons.success'),
          successMessage,
          [{
            text: t('common:buttons.ok'),
            onPress: () => {
              setShowStatusModal(false);
              // Reset form
              setNewStatus('');
              setStatusNotes('');
              setSelectedOfficer('');
              setSelectedContractor('');
              // Refresh the list
              loadComplaints(1);
            }
          }]
        );
      } else {
        console.error('Status update failed:', response);
        Alert.alert(t('admin:mobileAdmin.updateFailedTitle'), response.message || t('admin:mobileAdmin.updateStatusFailed'));
      }
    } catch (error) {
      console.error('Status update error:', error);
      Alert.alert(
        t('admin:mobileAdmin.networkErrorTitle'),
        t('admin:mobileAdmin.networkErrorDesc')
      );
    } finally {
      setStatusChangeLoading(false);
    }
  };

  const renderComplaintCard = (complaint) => {
    const stagesCompleted = complaint.complaint_stages?.filter(s => s.stage_status === 'completed').length || 0;
    const totalStages = complaint.complaint_stages?.length || 0;
    const currentStage = complaint.complaint_stages?.find(s => s.stage_status === 'in_progress') ||
      complaint.complaint_stages?.find(s => s.stage_status === 'pending');

    return (
      <TouchableOpacity
        key={complaint.id}
        style={styles.complaintCard}
        onPress={() => navigateToComplaintDetails(complaint.id)}
      >
        {/* Priority Badge */}
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(complaint.priority_score) }]}>
          <Text style={styles.priorityScore}>{complaint.priority_score}</Text>
        </View>

        {/* Main Content */}
        <View style={styles.complaintContent}>
          <View style={styles.complaintHeader}>
            <Text style={styles.complaintTitle} numberOfLines={2}>
              {complaint.title}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(complaint.status) }]}>
              <Text style={styles.statusText}>{getStatusLabel(complaint.status || 'pending', t)}</Text>
            </View>
          </View>

          {complaint.content_flagged && (
            <View style={[styles.statusBadge, { backgroundColor: '#C62828', alignSelf: 'flex-start', marginBottom: 4 }]}>
              <Text style={styles.statusText}>{t('admin:mobileAdmin.flaggedForReview')}</Text>
            </View>
          )}

          <Text style={styles.complaintLocation} numberOfLines={1}>
            {complaint.location_address || t('admin:mobileAdmin.locationNotSpecified')}
          </Text>

          {complaint.geometry_status === 'completed' && (
            <Text style={styles.geometrySummary} numberOfLines={1}>
              {t('admin:mobileAdmin.geometryEstShort', { w: complaint.estimated_width_cm, l: complaint.estimated_length_cm })}
            </Text>
          )}

          <Text style={styles.complaintUser}>
            {complaint._citizenName || t('admin:mobileAdmin.verifiedCitizen')}
          </Text>

          {/* Progress Bar */}
          {totalStages > 0 && (
            <View style={styles.progressSection}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(stagesCompleted / totalStages) * 100}%` }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {t('admin:mobileAdmin.stagesCompletedCount', { completed: stagesCompleted, total: totalStages })}
              </Text>
            </View>
          )}

          {/* Current Stage */}
          {currentStage && (
            <View style={styles.currentStageSection}>
              <Text style={styles.currentStageLabel}>{t('admin:mobileAdmin.currentStageLabel')}</Text>
              <Text style={styles.currentStageName}>{complaint._stageName || t('admin:mobileAdmin.processing')}</Text>
              {currentStage.officers && (
                <Text style={styles.assignedOfficer}>
                  {t('admin:mobileAdmin.officerLine', { name: complaint._officerName || currentStage.officers.name, dept: complaint._officerDept || t('admin:mobileAdmin.noDept') })}
                </Text>
              )}
              {currentStage.contractors && (
                <Text style={styles.assignedContractor}>
                  {t('admin:mobileAdmin.contractorLine', { name: complaint._contractorName || currentStage.contractors.name, company: complaint._contractorCompany ? ` - ${complaint._contractorCompany}` : '' })}
                </Text>
              )}
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => navigateToComplaintDetails(complaint.id)}
            >
              <Ionicons name="eye-outline" size={16} color="#1A1A1A" />
              <Text style={styles.buttonText}>{t('admin:mobileAdmin.viewStatus')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editButton}
              onPress={() => showStatusChangeModal(complaint)}
            >
              <Ionicons name="create-outline" size={16} color="#1A1A1A" />
              <Text style={styles.buttonText}>{t('admin:mobileAdmin.changeStatus')}</Text>
            </TouchableOpacity>
          </View>

          {/* Timestamp */}
          <Text style={styles.timestamp}>
            {t('admin:mobileAdmin.createdUpdatedDates', {
              created: formatLocalizedDate(complaint.created_at, i18n.language),
              updated: formatLocalizedDate(complaint.updated_at, i18n.language),
            })}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const getPriorityColor = (score) => {
    if (score >= 8) return '#1A1A1A';
    if (score >= 6) return '#1A1A1A';
    if (score >= 4) return '#1A1A1A';
    return '#9CA3AF';
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#1A1A1A',
      'in_progress': '#1A1A1A',
      'resolved': '#1A1A1A',
      'rejected': '#1A1A1A'
    };
    return colors[status] || '#9CA3AF';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin:mobileAdmin.priorityQueueTitle')}</Text>
        <TouchableOpacity
          style={styles.filterButtonContainer}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter-outline" size={24} color="#374151" />
          {getActiveFilterCount() > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{getActiveFilterCount()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#7f8c8d" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin:mobileAdmin.searchByIssueOrLoc')}
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#7f8c8d"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={20} color="#7f8c8d" />
            </TouchableOpacity>
          )}
        </View>

        {/* Flagged-for-review quick toggle */}
        <TouchableOpacity
          style={[styles.filterChip, { alignSelf: 'flex-start', backgroundColor: filterFlagged ? '#C62828' : '#95a5a6', marginTop: 8 }]}
          onPress={() => setFilterFlagged(v => !v)}
        >
          <Ionicons name="alert-circle-outline" size={14} color="#fff" />
          <Text style={styles.filterChipText}>{t('admin:mobileAdmin.flaggedToggle')}</Text>
        </TouchableOpacity>

        {/* Active Filters Display */}
        {(filterLocation || filterCategory || filterStatus || filterPriority || filterDateRange || filterAssigned) && (
          <View style={styles.activeFilters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {Boolean(filterLocation) && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>{filterLocation}</Text>
                  <TouchableOpacity onPress={() => setFilterLocation('')}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              {Boolean(filterCategory) && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>{getCategoryLabel(filterCategory, t)}</Text>
                  <TouchableOpacity onPress={() => setFilterCategory('')}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              {Boolean(filterStatus) && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>{getStatusLabel(filterStatus, t)}</Text>
                  <TouchableOpacity onPress={() => setFilterStatus('')}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              {Boolean(filterPriority) && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>{priorityOptions.find(p => p.value === filterPriority)?.label || filterPriority}</Text>
                  <TouchableOpacity onPress={() => setFilterPriority('')}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              {Boolean(filterDateRange) && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>{dateRangeOptions.find(d => d.value === filterDateRange)?.label || filterDateRange}</Text>
                  <TouchableOpacity onPress={() => setFilterDateRange('')}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              {Boolean(filterAssigned) && (
                <View style={styles.filterChip}>
                  <Text style={styles.filterChipText}>{assignmentOptions.find(a => a.value === filterAssigned)?.label || filterAssigned}</Text>
                  <TouchableOpacity onPress={() => setFilterAssigned('')}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={styles.clearAllChip} onPress={clearFilters}>
                <Text style={styles.clearAllText}>{t('admin:mobileAdmin.clearAll')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
      </View>

      {/* Complaints List */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            loadMoreComplaints();
          }
        }}
        scrollEventThrottle={400}
      >
        {loading && complaints.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text>{t('admin:mobileAdmin.loadingComplaints')}</Text>
          </View>
        ) : (
          <>
            {displayComplaints.map(renderComplaintCard)}

            {pagination.page < pagination.totalPages && (
              <TouchableOpacity style={styles.loadMoreButton} onPress={loadMoreComplaints}>
                <Text style={styles.loadMoreText}>{t('admin:mobileAdmin.loadMore')}</Text>
              </TouchableOpacity>
            )}

            {complaints.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="document-outline" size={50} color="#bdc3c7" />
                <Text style={styles.emptyText}>{t('admin:mobileAdmin.noComplaintsFound')}</Text>
                <Text style={styles.emptySubtext}>{t('admin:mobileAdmin.adjustSearchCriteria')}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Enhanced Filter Modal */}
      <Modal
        visible={showFilters}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModal}>
            <View style={styles.modalHeader}>
              <View style={styles.headerTitleContainer}>
                <Ionicons name="filter-outline" size={24} color="#2c3e50" />
                <Text style={styles.modalTitle}>{t('admin:mobileAdmin.filterComplaints')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Ionicons name="close" size={24} color="#2c3e50" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.filterContent} showsVerticalScrollIndicator={false}>
              {/* Search by Location */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>{t('admin:mobileAdmin.searchByLocationLabel')}</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder={t('admin:mobileAdmin.locationPlaceholder')}
                  placeholderTextColor="#bdc3c7"
                  value={filterLocation}
                  onChangeText={setFilterLocation}
                />
              </View>

              {/* Category Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>{t('admin:mobileAdmin.complaintCategoryLabel')}</Text>
                <SimpleDropdown
                  value={filterCategory}
                  onValueChange={setFilterCategory}
                  placeholder={t('admin:mobileAdmin.allCategories')}
                  items={[
                    { label: t('admin:mobileAdmin.allCategories'), value: '' },
                    ...categories.map(cat => ({
                      label: getCategoryLabel(cat, t),
                      value: cat,
                    })),
                  ]}
                />
              </View>

              {/* Status Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>{t('admin:mobileAdmin.complaintStatusLabel')}</Text>
                <SimpleDropdown
                  value={filterStatus}
                  onValueChange={setFilterStatus}
                  placeholder={t('admin:mobileAdmin.allStatuses')}
                  items={[
                    { label: t('admin:mobileAdmin.allStatuses'), value: '' },
                    ...statusOptions.map(status => ({
                      label: getStatusLabel(status, t),
                      value: status,
                    })),
                  ]}
                />
              </View>

              {/* Priority Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>{t('admin:mobileAdmin.priorityLevelLabel')}</Text>
                <SimpleDropdown
                  value={filterPriority}
                  onValueChange={setFilterPriority}
                  placeholder={t('admin:mobileAdmin.allPriorityLevels')}
                  items={[{ label: t('admin:mobileAdmin.allPriorityLevels'), value: '' }, ...priorityOptions]}
                />
              </View>

              {/* Date Range Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>{t('admin:mobileAdmin.dateRangeLabel')}</Text>
                <SimpleDropdown
                  value={filterDateRange}
                  onValueChange={setFilterDateRange}
                  placeholder={t('admin:mobileAdmin.allTime')}
                  items={[{ label: t('admin:mobileAdmin.allTime'), value: '' }, ...dateRangeOptions]}
                />
              </View>

              {/* Assignment Filter */}
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>{t('admin:mobileAdmin.assignmentStatusLabel')}</Text>
                <SimpleDropdown
                  value={filterAssigned}
                  onValueChange={setFilterAssigned}
                  placeholder={t('admin:mobileAdmin.allAssignments')}
                  items={[{ label: t('admin:mobileAdmin.allAssignments'), value: '' }, ...assignmentOptions]}
                />
              </View>

              {/* Filter Summary */}
              {getActiveFilterCount() > 0 && (
                <View style={styles.filterSummary}>
                  <Text style={styles.filterSummaryTitle}>
                    {t('admin:mobileAdmin.activeFiltersTitle', { count: getActiveFilterCount() })}
                  </Text>
                  <Text style={styles.filterSummaryText}>
                    {t('admin:mobileAdmin.filtersAppliedCount', { count: getActiveFilterCount() })}
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
                <Ionicons name="refresh-outline" size={20} color="#7f8c8d" />
                <Text style={styles.clearButtonText}>{t('admin:mobileAdmin.clearAll')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.applyButton}
                onPress={() => setShowFilters(false)}
              >
                <Ionicons name="checkmark-outline" size={20} color="#fff" />
                <Text style={styles.applyButtonText}>{t('admin:mobileAdmin.applyFilters')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Status Change Modal - Modern Interface */}
      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modernStatusModal}>
            {/* Header */}
            <View style={styles.modernModalHeader}>
              <View style={styles.headerTitleContainer}>
                <Ionicons name="settings-outline" size={24} color="#2c3e50" />
                <Text style={styles.modernModalTitle}>{t('admin:mobileAdmin.updateComplaintStatus')}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowStatusModal(false)}
              >
                <Ionicons name="close" size={24} color="#7f8c8d" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modernModalBody} showsVerticalScrollIndicator={false}>
              {/* Complaint Info Card */}
              {selectedComplaint && (
                <View style={styles.modernComplaintInfo}>
                  <View style={styles.complaintIconContainer}>
                    <Ionicons name="document-text" size={20} color="#1A1A1A" />
                  </View>
                  <View style={styles.complaintDetails}>
                    <Text style={styles.modernComplaintTitle} numberOfLines={2}>
                      {selectedComplaint.title}
                    </Text>
                    <View style={styles.currentStatusContainer}>
                      <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(selectedComplaint.status) }]} />
                      <Text style={styles.modernCurrentStatus}>
                        {t('admin:mobileAdmin.currentStatusInline', { status: getStatusLabel(selectedComplaint.status || 'pending', t) })}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Status Selection */}
              <View style={styles.modernFieldContainer}>
                <View style={styles.labelRow}>
                  <Ionicons name="flag-outline" size={16} color="#1A1A1A" />
                  <Text style={styles.modernFieldLabel}>{t('admin:mobileAdmin.newStatusRequired')}</Text>
                </View>
                <SimpleDropdown
                  value={newStatus}
                  onValueChange={setNewStatus}
                  placeholder={t('admin:mobileAdmin.chooseNewStatus')}
                  items={[
                    { label: getStatusLabel('pending', t), value: 'pending' },
                    { label: getStatusLabel('in_progress', t), value: 'in_progress' },
                    { label: getStatusLabel('resolved', t), value: 'resolved' },
                    { label: getStatusLabel('rejected', t), value: 'rejected' },
                  ]}
                />
              </View>

              {/* Officer Assignment */}
              <View style={styles.modernFieldContainer}>
                <View style={styles.labelRow}>
                  <Ionicons name="person-outline" size={16} color="#1A1A1A" />
                  <Text style={styles.modernFieldLabel}>{t('admin:mobileAdmin.assignOfficer')}</Text>
                </View>
                <SimpleDropdown
                  value={selectedOfficer}
                  onValueChange={setSelectedOfficer}
                  placeholder={t('admin:mobileAdmin.selectOfficerOptional')}
                  items={[
                    { label: t('admin:mobileAdmin.selectOfficerOptional'), value: '' },
                    ...displayOfficers.map(officer => ({
                      label: `${officer.name} - ${officer.department || t('admin:mobileAdmin.noDept')}`,
                      value: officer.id.toString(),
                    })),
                  ]}
                />
              </View>

              {/* Contractor Assignment */}
              <View style={styles.modernFieldContainer}>
                <View style={styles.labelRow}>
                  <Ionicons name="construct-outline" size={16} color="#1A1A1A" />
                  <Text style={styles.modernFieldLabel}>{t('admin:mobileAdmin.assignContractor')}</Text>
                </View>
                <SimpleDropdown
                  value={selectedContractor}
                  onValueChange={setSelectedContractor}
                  placeholder={t('admin:mobileAdmin.selectContractorOptional')}
                  items={[
                    { label: t('admin:mobileAdmin.selectContractorOptional'), value: '' },
                    ...displayContractors.map(contractor => ({
                      label: `${contractor.name}${contractor.specialization ? ` - ${contractor.specialization}` : ''}`,
                      value: contractor.id.toString(),
                    })),
                  ]}
                />
              </View>

              {/* Notes Section */}
              <View style={styles.modernFieldContainer}>
                <View style={styles.labelRow}>
                  <Ionicons name="document-text-outline" size={16} color="#1A1A1A" />
                  <Text style={styles.modernFieldLabel}>{t('admin:mobileAdmin.notesAndComments')}</Text>
                </View>
                <View style={styles.modernTextInputContainer}>
                  <TextInput
                    style={styles.modernNotesInput}
                    placeholder={t('admin:mobileAdmin.addNotesPlaceholder')}
                    placeholderTextColor="#bdc3c7"
                    value={statusNotes}
                    onChangeText={setStatusNotes}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Preview Section */}
              {newStatus && (
                <View style={styles.previewSection}>
                  <View style={styles.previewTitleRow}>
                    <Ionicons name="eye-outline" size={16} color="#1A1A1A" />
                    <Text style={styles.previewTitle}>{t('admin:mobileAdmin.previewChanges')}</Text>
                  </View>
                  <View style={styles.previewContent}>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>{t('admin:mobileAdmin.statusPreviewLabel')}</Text>
                      <Text style={[styles.previewValue, { color: getStatusColor(newStatus) }]}>
                        {getStatusLabel(newStatus, t)}
                      </Text>
                    </View>
                    {selectedOfficer && (
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>{t('admin:mobileAdmin.officerPreviewLabel')}</Text>
                        <Text style={styles.previewValue}>
                          {displayOfficers.find(o => o.id.toString() === selectedOfficer)?.name || t('common:common.unknown')}
                        </Text>
                      </View>
                    )}
                    {selectedContractor && (
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>{t('admin:mobileAdmin.contractorPreviewLabel')}</Text>
                        <Text style={styles.previewValue}>
                          {displayContractors.find(c => c.id.toString() === selectedContractor)?.name || t('common:common.unknown')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.modernModalActions}>
              <TouchableOpacity
                style={styles.modernCancelButton}
                onPress={() => setShowStatusModal(false)}
              >
                <Ionicons name="close-outline" size={20} color="#7f8c8d" />
                <Text style={styles.modernCancelText}>{t('common:buttons.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modernUpdateButton,
                  statusChangeLoading && styles.buttonDisabled,
                  !newStatus && styles.buttonDisabled
                ]}
                onPress={updateComplaintStatus}
                disabled={statusChangeLoading || !newStatus}
              >
                {statusChangeLoading ? (
                  <>
                    <Ionicons name="sync-outline" size={20} color="#fff" />
                    <Text style={styles.modernUpdateText}>{t('admin:mobileAdmin.updating')}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-outline" size={20} color="#fff" />
                    <Text style={styles.modernUpdateText}>{t('admin:mobileAdmin.updateStatus')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  filterButtonContainer: {
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchSection: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#2c3e50',
  },
  activeFilters: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 5,
  },
  filterChipText: {
    color: '#fff',
    fontSize: 12,
    marginRight: 5,
    fontWeight: '500',
  },
  clearAllChip: {
    backgroundColor: '#1A1A1A',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  clearAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  complaintCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 15,
    marginVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  priorityBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 1,
  },
  priorityScore: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  complaintContent: {
    padding: 15,
  },
  complaintHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingRight: 50, // Space for priority badge
  },
  complaintTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  complaintLocation: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 4,
  },
  geometrySummary: {
    fontSize: 12,
    color: '#4CAF50',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  complaintUser: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  progressSection: {
    marginBottom: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#ecf0f1',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1A1A1A',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  currentStageSection: {
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  currentStageLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  currentStageName: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
    marginTop: 2,
  },
  assignedOfficer: {
    fontSize: 12,
    color: '#1A1A1A',
    marginTop: 2,
  },
  assignedContractor: {
    fontSize: 12,
    color: '#1A1A1A',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginRight: 5,
    justifyContent: 'center',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginLeft: 5,
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#95a5a6',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#7f8c8d',
    marginTop: 15,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bdc3c7',
    marginTop: 5,
    textAlign: 'center',
  },
  loadMoreButton: {
    backgroundColor: '#1A1A1A',
    margin: 15,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
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
  filterContent: {
    padding: 20,
    maxHeight: 500,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterSummary: {
    backgroundColor: '#e8f5e8',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    marginTop: 8,
  },
  filterSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  filterSummaryText: {
    fontSize: 12,
    color: '#2c3e50',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    gap: 12,
  },
  clearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  clearButtonText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Status Modal Styles
  statusModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
    maxHeight: '80%',
  },
  statusModalBody: {
    maxHeight: 400,
  },
  complaintInfo: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  complaintModalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  currentStatus: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
    marginTop: 15,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  pickerStyle: {
    height: 50,
    color: '#2c3e50',
  },
  notesInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
    backgroundColor: '#fff',
  },

  // Modern Status Modal Styles
  modernStatusModal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    margin: 15,
    maxHeight: '90%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  modernModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    backgroundColor: '#f8f9fa',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modernModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginLeft: 10,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#ecf0f1',
  },
  modernModalBody: {
    padding: 20,
    maxHeight: 500,
  },
  modernComplaintInfo: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#1A1A1A',
  },
  complaintIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  complaintDetails: {
    flex: 1,
  },
  modernComplaintTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 6,
  },
  currentStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  modernCurrentStatus: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  modernFieldContainer: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modernFieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 8,
  },
  modernTextInputContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  modernNotesInput: {
    padding: 15,
    fontSize: 14,
    color: '#2c3e50',
    minHeight: 100,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  previewSection: {
    backgroundColor: '#f0f8f0',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#d4edda',
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: 8,
  },
  previewContent: {
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  previewLabel: {
    fontSize: 13,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  previewValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
    textAlign: 'right',
  },
  modernModalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
    backgroundColor: '#f8f9fa',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  modernCancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  modernCancelText: {
    color: '#7f8c8d',
    fontSize: 16,
    fontWeight: '600',
  },
  modernUpdateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  modernUpdateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
    backgroundColor: '#bdc3c7',
  },
});

export default PriorityQueue;

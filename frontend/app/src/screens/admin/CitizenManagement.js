import React, { useState, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { apiClient, makeApiCall } from '../../../config/supabase';
import { useTranslatedList, useTranslatedObject } from '../../context/TranslationContext';
import { formatLocalizedDate } from '../../utils/dateLocale';
import { getStatusLabel } from '../../utils/priorityUtils';

const { width } = Dimensions.get('window');

const CitizenManagement = ({ navigation }) => {
  const { t, i18n } = useTranslation(['admin', 'common', 'citizen']);
  const [citizens, setCitizens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedCitizen] = useState(null);
  const [showCitizenModal, setShowCitizenModal] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [sortBy, setSortBy] = useState('recent'); // recent, complaints_count, name

  const translatedCitizens = useTranslatedList(citizens, ['full_name']);
  const translatedSelectedCitizen = useTranslatedObject(selectedCitizen, ['full_name']);
  const translatedModalComplaints = useTranslatedList(selectedCitizen?.complaints, ['title']);

  const displayCitizens = translatedCitizens.length > 0 ? translatedCitizens : citizens;
  const activeSelectedCitizen = translatedSelectedCitizen || selectedCitizen;
  const modalComplaints = translatedModalComplaints.length > 0 ? translatedModalComplaints : (selectedCitizen?.complaints || []);

  useEffect(() => {
    loadCitizens();
  }, [searchText, sortBy]);

  const loadCitizens = async (page = 1) => {
    try {
      if (page === 1) setLoading(true);

      const params = new URLSearchParams({
        sort: sortBy
      });

      // Remove the limit parameter to get all users
      // if (searchText) params.append('search', searchText);
      if (searchText && searchText.trim()) {
        params.append('search', searchText.trim());
      }

      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/citizens?${params}`
      );

      if (response.success) {
        if (page === 1) {
          setCitizens(response.data.citizens);
        } else {
          setCitizens(prev => [...prev, ...response.data.citizens]);
        }
        setPagination(response.data.pagination);
      } else {
        Alert.alert(t('common:mobileNav.error'), response.message || t('admin:mobileAdmin.loadCitizensFailed'));
      }
    } catch (error) {
      console.error('Load citizens error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.connectError'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCitizens(1);
    setRefreshing(false);
  };

  const loadMoreCitizens = async () => {
    if (pagination.page < pagination.totalPages) {
      await loadCitizens(pagination.page + 1);
    }
  };

  const openCitizenDetails = (citizen) => {
    // Navigate to the new CitizenDetails screen
    navigation.navigate('CitizenDetails', { citizenId: citizen.id });
  };

  const updateCitizenStatus = async (citizenId, newStatus) => {
    try {
      const response = await makeApiCall(
        `${apiClient.baseUrl}/api/admin-enhanced/citizens/${citizenId}/status`,
        {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (response.success) {
        Alert.alert(t('common:buttons.success'), t('admin:mobileAdmin.citizenStatusUpdated', { status: getStatusLabel(newStatus, t) }));
        setShowCitizenModal(false);
        await loadCitizens(1);
      } else {
        Alert.alert(t('common:mobileNav.error'), response.message || t('admin:mobileAdmin.updateCitizenStatusFailed'));
      }
    } catch (error) {
      console.error('Update citizen status error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.connectError'));
    }
  };

  const renderCitizenCard = (citizen) => {
    const getStatusColor = (status) => {
      const colors = {
        'active': '#1A1A1A',
        'inactive': '#95a5a6',
        'banned': '#1A1A1A',
        'suspended': '#1A1A1A'
      };
      return colors[status] || '#95a5a6';
    };

    const getEngagementLevel = (complaintsCount) => {
      if (complaintsCount >= 10) return { level: t('admin:mobileAdmin.engagementHigh'), color: '#1A1A1A' };
      if (complaintsCount >= 5) return { level: t('admin:mobileAdmin.engagementMedium'), color: '#1A1A1A' };
      if (complaintsCount >= 1) return { level: t('admin:mobileAdmin.engagementLow'), color: '#1A1A1A' };
      return { level: t('admin:mobileAdmin.engagementNone'), color: '#95a5a6' };
    };

    const engagement = getEngagementLevel(citizen.complaints_count || 0);

    return (
      <TouchableOpacity
        key={citizen.id}
        style={styles.citizenCard}
        onPress={() => openCitizenDetails(citizen)}
      >
        {/* Profile Image */}
        <View style={styles.profileSection}>
          {citizen.profile_image ? (
            <Image source={{ uri: citizen.profile_image }} style={styles.profileImage} />
          ) : (
            <View style={styles.defaultProfileImage}>
              <Text style={styles.profileInitial}>
                {citizen.full_name ? citizen.full_name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
          )}

          {/* Status Indicator */}
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(citizen.status) }]} />
        </View>

        {/* Citizen Info */}
        <View style={styles.citizenInfo}>
          <Text style={styles.citizenName} numberOfLines={1}>
            {citizen.full_name || t('admin:mobileAdmin.unknownUser')}
          </Text>

          <Text style={styles.citizenEmail} numberOfLines={1}>
            {citizen.email}
          </Text>

          <Text style={styles.citizenPhone} numberOfLines={1}>
            {citizen.phone_number || t('admin:mobileAdmin.noPhone')}
          </Text>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{citizen.complaints_count || 0}</Text>
              <Text style={styles.statLabel}>{t('admin:mobileAdmin.complaintsLabel')}</Text>
            </View>

            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{citizen.votes_count || 0}</Text>
              <Text style={styles.statLabel}>{t('admin:mobileAdmin.votesLabel')}</Text>
            </View>

            <View style={[styles.engagementBadge, { backgroundColor: engagement.color }]}>
              <Text style={styles.engagementText}>{engagement.level}</Text>
            </View>
          </View>

          {/* Join Date */}
          <Text style={styles.joinDate}>
            {t('admin:mobileAdmin.joinedDate', { date: formatLocalizedDate(citizen.created_at, i18n.language) })}
          </Text>

          {/* Last Activity */}
          {citizen.last_complaint_date && (
            <Text style={styles.lastActivity}>
              {t('admin:mobileAdmin.lastComplaintDate', { date: formatLocalizedDate(citizen.last_complaint_date, i18n.language) })}
            </Text>
          )}
        </View>

        {/* Action Arrow */}
        <View style={styles.actionArrow}>
          <Ionicons name="chevron-forward" size={20} color="#bdc3c7" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1A1A1A', '#1A1A1A']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin:mobileAdmin.citizenManagement')}</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Search and Filters */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#7f8c8d" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('admin:mobileAdmin.searchByNameEmail')}
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

        {/* Sort Options */}
        <View style={styles.sortSection}>
          <Text style={styles.sortLabel}>{t('admin:mobileAdmin.sortByLabel')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'recent' && styles.activeSortButton]}
              onPress={() => setSortBy('recent')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'recent' && styles.activeSortText]}>
                {t('admin:mobileAdmin.sortRecent')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'complaints_count' && styles.activeSortButton]}
              onPress={() => setSortBy('complaints_count')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'complaints_count' && styles.activeSortText]}>
                {t('admin:mobileAdmin.sortMostActive')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sortButton, sortBy === 'name' && styles.activeSortButton]}
              onPress={() => setSortBy('name')}
            >
              <Text style={[styles.sortButtonText, sortBy === 'name' && styles.activeSortText]}>
                {t('admin:mobileAdmin.sortName')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      {/* Citizens List */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            loadMoreCitizens();
          }
        }}
        scrollEventThrottle={400}
      >
        {loading && citizens.length === 0 ? (
          <View style={styles.loadingContainer}>
            <Text>{t('admin:mobileAdmin.loadingCitizens')}</Text>
          </View>
        ) : (
          <>
            {displayCitizens.map(renderCitizenCard)}

            {pagination.page < pagination.totalPages && (
              <TouchableOpacity style={styles.loadMoreButton} onPress={loadMoreCitizens}>
                <Text style={styles.loadMoreText}>{t('admin:mobileAdmin.loadMore')}</Text>
              </TouchableOpacity>
            )}

            {citizens.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={50} color="#bdc3c7" />
                <Text style={styles.emptyText}>{t('admin:mobileAdmin.noCitizensFound')}</Text>
                <Text style={styles.emptySubtext}>{t('admin:mobileAdmin.adjustSearchCriteria')}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Citizen Details Modal */}
      <Modal
        visible={showCitizenModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCitizenModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.citizenModal}>
            {activeSelectedCitizen && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('admin:mobileAdmin.citizenDetailsTitle')}</Text>
                  <TouchableOpacity onPress={() => setShowCitizenModal(false)}>
                    <Ionicons name="close" size={24} color="#2c3e50" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalContent}>
                  {/* Profile Section */}
                  <View style={styles.modalProfileSection}>
                    {activeSelectedCitizen.profile_image ? (
                      <Image
                        source={{ uri: activeSelectedCitizen.profile_image }}
                        style={styles.modalProfileImage}
                      />
                    ) : (
                      <View style={styles.modalDefaultProfile}>
                        <Text style={styles.modalProfileInitial}>
                          {activeSelectedCitizen.full_name ? activeSelectedCitizen.full_name.charAt(0).toUpperCase() : 'U'}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.modalCitizenName}>
                      {activeSelectedCitizen.full_name || t('admin:mobileAdmin.unknownUser')}
                    </Text>

                    <View style={[
                      styles.modalStatusBadge,
                      { backgroundColor: getStatusColor(activeSelectedCitizen.status) }
                    ]}>
                      <Text style={styles.modalStatusText}>
                        {getStatusLabel(activeSelectedCitizen.status || 'active', t)}
                      </Text>
                    </View>
                  </View>

                  {/* Contact Information */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>{t('admin:mobileAdmin.contactInformation')}</Text>
                    <View style={styles.modalInfoItem}>
                      <Text style={styles.modalInfoLabel}>{t('admin:mobileAdmin.emailLabel')}</Text>
                      <Text style={styles.modalInfoValue}>{activeSelectedCitizen.email}</Text>
                    </View>
                    <View style={styles.modalInfoItem}>
                      <Text style={styles.modalInfoLabel}>{t('admin:mobileAdmin.phoneLabel')}</Text>
                      <Text style={styles.modalInfoValue}>
                        {activeSelectedCitizen.phone_number || t('admin:mobileAdmin.notProvided')}
                      </Text>
                    </View>
                  </View>

                  {/* Activity Statistics */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>{t('admin:mobileAdmin.activityStats')}</Text>
                    <View style={styles.modalStatsGrid}>
                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatNumber}>
                          {activeSelectedCitizen.complaints?.length || 0}
                        </Text>
                        <Text style={styles.modalStatLabel}>{t('admin:mobileAdmin.totalComplaints')}</Text>
                      </View>

                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatNumber}>
                          {activeSelectedCitizen.resolved_complaints || 0}
                        </Text>
                        <Text style={styles.modalStatLabel}>{t('common:status.resolved')}</Text>
                      </View>

                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatNumber}>
                          {activeSelectedCitizen.votes_count || 0}
                        </Text>
                        <Text style={styles.modalStatLabel}>{t('admin:mobileAdmin.votesCast')}</Text>
                      </View>

                      <View style={styles.modalStatCard}>
                        <Text style={styles.modalStatNumber}>
                          {activeSelectedCitizen.reputation_score || 0}
                        </Text>
                        <Text style={styles.modalStatLabel}>{t('admin:mobileAdmin.reputationLabel')}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Recent Complaints */}
                  {modalComplaints && modalComplaints.length > 0 && (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>{t('admin:mobileAdmin.recentComplaints')}</Text>
                      {modalComplaints.slice(0, 3).map((complaint) => (
                        <TouchableOpacity
                          key={complaint.id}
                          style={styles.modalComplaintItem}
                          onPress={() => {
                            setShowCitizenModal(false);
                            navigation.navigate('ComplaintDetails', {
                              complaintId: complaint.id
                            });
                          }}
                        >
                          <Text style={styles.modalComplaintTitle} numberOfLines={1}>
                            {complaint.title}
                          </Text>
                          <Text style={styles.modalComplaintStatus}>
                            {getStatusLabel(complaint.status || 'pending', t)}
                          </Text>
                          <Text style={styles.modalComplaintDate}>
                            {formatLocalizedDate(complaint.created_at, i18n.language)}
                          </Text>
                        </TouchableOpacity>
                      ))}

                      {modalComplaints.length > 3 && (
                        <TouchableOpacity
                          style={styles.viewAllButton}
                          onPress={() => {
                            setShowCitizenModal(false);
                            navigation.navigate('PriorityQueue', {
                              filterUserId: activeSelectedCitizen.id
                            });
                          }}
                        >
                          <Text style={styles.viewAllText}>
                            {t('admin:mobileAdmin.viewAllCitizenComplaints', { count: modalComplaints.length })}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Account Information */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>{t('admin:mobileAdmin.accountInformation')}</Text>
                    <View style={styles.modalInfoItem}>
                      <Text style={styles.modalInfoLabel}>{t('admin:mobileAdmin.memberSinceLabel')}</Text>
                      <Text style={styles.modalInfoValue}>
                        {formatLocalizedDate(activeSelectedCitizen.created_at, i18n.language)}
                      </Text>
                    </View>
                    <View style={styles.modalInfoItem}>
                      <Text style={styles.modalInfoLabel}>{t('admin:mobileAdmin.lastActivityLabel')}</Text>
                      <Text style={styles.modalInfoValue}>
                        {activeSelectedCitizen.last_sign_in_at
                          ? formatLocalizedDate(activeSelectedCitizen.last_sign_in_at, i18n.language)
                          : t('admin:mobileAdmin.never')
                        }
                      </Text>
                    </View>
                  </View>
                </ScrollView>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalActionButton, { backgroundColor: '#1A1A1A' }]}
                    onPress={() => {
                      setShowCitizenModal(false);
                      Alert.alert(t('admin:mobileAdmin.comingSoonTitle'), t('admin:mobileAdmin.messagingNotAvailable'));
                    }}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                    <Text style={styles.modalActionText}>{t('admin:mobileAdmin.messageBtn')}</Text>
                  </TouchableOpacity>

                  {activeSelectedCitizen.status === 'active' ? (
                    <TouchableOpacity
                      style={[styles.modalActionButton, { backgroundColor: '#1A1A1A' }]}
                      onPress={() => {
                        Alert.alert(
                          t('admin:mobileAdmin.suspendCitizenTitle'),
                          t('admin:mobileAdmin.suspendCitizenConfirm'),
                          [
                            { text: t('common:buttons.cancel'), style: 'cancel' },
                            {
                              text: t('admin:mobileAdmin.suspendBtn'),
                              onPress: () => updateCitizenStatus(activeSelectedCitizen.id, 'suspended')
                            }
                          ]
                        );
                      }}
                    >
                      <Ionicons name="pause-circle-outline" size={18} color="#fff" />
                      <Text style={styles.modalActionText}>{t('admin:mobileAdmin.suspendBtn')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.modalActionButton, { backgroundColor: '#1A1A1A' }]}
                      onPress={() => updateCitizenStatus(activeSelectedCitizen.id, 'active')}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.modalActionText}>{t('admin:mobileAdmin.activateBtn')}</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.modalActionButton, { backgroundColor: '#1A1A1A' }]}
                    onPress={() => {
                      Alert.alert(
                        t('admin:mobileAdmin.banCitizenTitle'),
                        t('admin:mobileAdmin.banCitizenConfirm'),
                        [
                          { text: t('common:buttons.cancel'), style: 'cancel' },
                          {
                            text: t('admin:mobileAdmin.banBtn'),
                            style: 'destructive',
                            onPress: () => updateCitizenStatus(activeSelectedCitizen.id, 'banned')
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="ban-outline" size={18} color="#fff" />
                    <Text style={styles.modalActionText}>{t('admin:mobileAdmin.banBtn')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );

  function getStatusColor(status) {
    const colors = {
      'active': '#1A1A1A',
      'inactive': '#95a5a6',
      'banned': '#1A1A1A',
      'suspended': '#1A1A1A'
    };
    return colors[status] || '#95a5a6';
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
  searchSection: {
    padding: 15,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#2c3e50',
  },
  sortSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7f8c8d',
    marginRight: 10,
  },
  sortButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#ecf0f1',
    marginRight: 8,
  },
  activeSortButton: {
    backgroundColor: '#1A1A1A',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  activeSortText: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  citizenCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  profileSection: {
    position: 'relative',
    marginRight: 15,
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultProfileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  citizenInfo: {
    flex: 1,
  },
  citizenName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  citizenEmail: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  citizenPhone: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statItem: {
    alignItems: 'center',
    marginRight: 20,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  statLabel: {
    fontSize: 10,
    color: '#7f8c8d',
  },
  engagementBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  engagementText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  joinDate: {
    fontSize: 11,
    color: '#95a5a6',
  },
  lastActivity: {
    fontSize: 11,
    color: '#95a5a6',
  },
  actionArrow: {
    marginLeft: 10,
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
    fontSize: 16,
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  citizenModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: width * 0.9,
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
    flex: 1,
  },
  modalProfileSection: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  modalProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  modalDefaultProfile: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalProfileInitial: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  modalCitizenName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  modalStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modalStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 15,
  },
  modalInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalInfoLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  modalInfoValue: {
    fontSize: 14,
    color: '#2c3e50',
  },
  modalStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  modalStatCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modalStatLabel: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
  },
  modalComplaintItem: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalComplaintTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  modalComplaintStatus: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 2,
  },
  modalComplaintDate: {
    fontSize: 11,
    color: '#95a5a6',
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  viewAllText: {
    color: '#1A1A1A',
    fontSize: 14,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#ecf0f1',
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  modalActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});

export default CitizenManagement;

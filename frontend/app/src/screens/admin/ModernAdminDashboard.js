import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Alert,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { apiClient, makeApiCall } from '../../../config/supabase';
import { useTranslatedText } from '../../context/TranslationContext';

const { width } = Dimensions.get('window');

const ModernAdminDashboard = ({ navigation }) => {
  const { t } = useTranslation(['admin', 'common', 'citizen']);
  const [userData, setUserData] = useState(null);
  const translatedAdminName = useTranslatedText(userData?.fullName || '');
  const [dashboardData, setDashboardData] = useState({
    totalComplaints: 0,
    resolvedComplaints: 0,
    pendingComplaints: 0,
    inProgressComplaints: 0,
    resolutionRate: 0,
    totalCitizens: 0
  });
  const [, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUserData();
    loadDashboardData();
  }, []);

  const loadUserData = async () => {
    try {
      const storedUserData = await AsyncStorage.getItem('userData');
      if (storedUserData) {
        setUserData(JSON.parse(storedUserData));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await makeApiCall(`${apiClient.baseUrl}/api/admin/dashboard`);

      if (response.success && response.data) {
        const apiData = response.data;
        const complaints = apiData.complaints;
        const users = apiData.users;

        const mappedData = {
          totalComplaints: complaints.total || 0,
          resolvedComplaints: complaints.resolved || 0,
          pendingComplaints: complaints.pending || 0,
          inProgressComplaints: complaints.inProgress || 0,
          resolutionRate: complaints.resolutionRate || 0,
          totalCitizens: users.citizens || 0,
          avgResolutionDays: complaints.avgResolutionDays || 0
        };

        setDashboardData(mappedData);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
      Alert.alert(t('common:mobileNav.error'), t('admin:mobileAdmin.loadDashboardFailed'));
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      t('citizen:mobileReports.logoutTitle'),
      t('citizen:mobileReports.logoutConfirm'),
      [
        { text: t('common:mobileNav.cancel'), style: 'cancel' },
        {
          text: t('citizen:mobileReports.logoutTitle'),
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.multiRemove(['authToken', 'userData']);
            navigation.replace('Welcome');
          },
        },
      ]
    );
  };

  const statCards = [
    { label: t('admin:mobileAdmin.totalLabel'), value: dashboardData.totalComplaints, icon: 'document-text-outline', color: '#1A1A1A' },
    { label: t('common:statusFilters.resolved').toUpperCase(), value: dashboardData.resolvedComplaints, icon: 'checkmark-circle-outline', color: '#1A1A1A' },
    { label: t('common:statusFilters.pending').toUpperCase(), value: dashboardData.pendingComplaints, icon: 'time-outline', color: '#1A1A1A' },
    { label: t('common:statusFilters.in_progress').toUpperCase(), value: dashboardData.inProgressComplaints, icon: 'sync-outline', color: '#6366F1' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brandMark}>CITYZEN</Text>
          <Text style={styles.brandSub}>{t('admin:mobileAdmin.adminConsole')}</Text>
        </View>
        <TouchableOpacity style={styles.avatarButton} onPress={handleLogout}>
          <Text style={styles.avatarText}>
            {(translatedAdminName || userData?.fullName)?.charAt(0)?.toUpperCase() || 'A'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A1A1A" />
        }
      >
        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.greetingText}>
            {t('admin:mobileAdmin.helloAdmin', { name: translatedAdminName || userData?.fullName || t('admin:mobileAdmin.adminDefault') })}
          </Text>
          <Text style={styles.headerSubtitle}>{t('admin:mobileAdmin.civicManagement')}</Text>
        </View>

        {/* Stat cards */}
        <View style={styles.statsGrid}>
          {statCards.map((card, index) => (
            <View key={index} style={styles.statCard}>
              <View style={[styles.statIconBox, { backgroundColor: card.color + '10' }]}>
                <Ionicons name={card.icon} size={20} color={card.color} />
              </View>
              <Text style={styles.statNumber}>{card.value}</Text>
              <Text style={styles.statLabel}>{card.label}</Text>
            </View>
          ))}
        </View>

        {/* Resolution rate */}
        <View style={styles.resolutionCard}>
          <View style={styles.resolutionLeft}>
            <Text style={styles.resolutionRate}>{dashboardData.resolutionRate}%</Text>
            <Text style={styles.resolutionLabel}>{t('citizen:mobileTransparency.resolutionRate')}</Text>
          </View>
          <View style={styles.resolutionBar}>
            <View style={[styles.resolutionFill, { width: `${Math.min(dashboardData.resolutionRate, 100)}%` }]} />
          </View>
        </View>

        {/* Citizens card */}
        <View style={styles.citizensCard}>
          <View style={styles.citizensRow}>
            <View style={styles.citizensIconBox}>
              <Ionicons name="people-outline" size={22} color="#1A1A1A" />
            </View>
            <View>
              <Text style={styles.citizensNumber}>{dashboardData.totalCitizens}</Text>
              <Text style={styles.citizensLabel}>{t('admin:mobileAdmin.registeredCitizens')}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={[styles.navItem, styles.activeNavItem]}>
          <Ionicons name="grid" size={22} color="#1A1A1A" />
          <Text style={[styles.navText, styles.activeNavText]}>{t('admin:mobileAdmin.navDashboard')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('PriorityQueue')}
        >
          <Ionicons name="list-outline" size={22} color="#9CA3AF" />
          <Text style={styles.navText}>{t('admin:mobileAdmin.navQueue')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('CitizenManagement')}
        >
          <Ionicons name="people-outline" size={22} color="#9CA3AF" />
          <Text style={styles.navText}>{t('admin:mobileAdmin.navCitizens')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AdminComplaintMap')}
        >
          <Ionicons name="map-outline" size={22} color="#9CA3AF" />
          <Text style={styles.navText}>{t('common:mobileNav.map')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: {},
  brandMark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 1,
  },
  brandSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  avatarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 18,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  statNumber: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1.2,
  },
  resolutionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
  },
  resolutionLeft: {
    marginBottom: 14,
  },
  resolutionRate: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  resolutionLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  resolutionBar: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  resolutionFill: {
    height: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 3,
  },
  citizensCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
  },
  citizensRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  citizensIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  citizensNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  citizensLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    paddingVertical: 12,
    paddingBottom: 28,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  activeNavItem: {
    // Active state
  },
  navText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  activeNavText: {
    color: '#1A1A1A',
    fontWeight: '600',
  },
});

export default ModernAdminDashboard;
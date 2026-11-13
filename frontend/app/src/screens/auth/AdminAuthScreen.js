import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

const AdminAuthScreen = ({ navigation }) => {
  const { t } = useTranslation(['auth', 'admin']);
  const features = [
    { icon: 'clipboard-outline', text: t('admin:mobileAdmin.recentComplaints', 'Manage all citizen complaints') },
    { icon: 'flash-outline', text: t('admin:mobileAdmin.viewPriorityQueue', 'Priority queue management') },
    { icon: 'people-outline', text: t('admin:mobileAdmin.manageCitizens', 'User management system') },
    { icon: 'analytics-outline', text: t('admin:mobileAdmin.overview', 'Analytics and reporting') },
    { icon: 'map-outline', text: t('admin:mobileAdmin.openMap', 'City-wide complaint heatmaps') },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAFA" />

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={20} color="#374151" />
      </TouchableOpacity>

      <View style={styles.header}>
        <View style={styles.iconBox}>
          <Ionicons name="shield-checkmark-outline" size={32} color="#1A1A1A" />
        </View>
        <Text style={styles.title}>{t('welcome.adminPortal.title', 'Admin Portal')}</Text>
        <Text style={styles.subtitle}>
          {t('welcome.adminPortal.desc', 'Manage and oversee civic operations efficiently')}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate('AdminLogin')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>{t('login.tabLogin', 'ADMIN LOGIN')}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('AdminSignup')}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>{t('adminSignup.tagline', 'REGISTER AS ADMIN')}</Text>
          <Ionicons name="arrow-forward" size={18} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* Notice */}
      <View style={styles.noticeCard}>
        <Ionicons name="information-circle-outline" size={18} color="#1A1A1A" />
        <Text style={styles.noticeText}>
          {t('adminSignup.leftDesc', 'Admin accounts require approval from system administrators')}
        </Text>
      </View>

      <View style={styles.featuresCard}>
        <Text style={styles.featuresTitle}>{t('admin:mobileAdmin.adminConsole', 'ADMIN CAPABILITIES')}</Text>
        {features.map((item, index) => (
          <View key={index} style={styles.featureItem}>
            <Ionicons name={item.icon} size={18} color="#6B7280" />
            <Text style={styles.featureText}>{item.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  buttonContainer: {
    marginBottom: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 1.2,
  },
  noticeCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  noticeText: {
    fontSize: 13,
    color: '#92400E',
    flex: 1,
    lineHeight: 18,
  },
  featuresCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 20,
  },
  featuresTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
});

export default AdminAuthScreen;

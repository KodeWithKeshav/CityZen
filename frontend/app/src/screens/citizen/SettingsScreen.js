import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { apiClient, makeApiCall } from '../../../config/supabase';
import { useAccessibility } from '../../context/AccessibilityContext';

const TABS = ['profile', 'password', 'accessibility', 'danger'];

const SettingsScreen = ({ navigation }) => {
  const { t } = useTranslation(['citizen', 'common']);
  const { settings, updateSetting } = useAccessibility();
  const [tab, setTab] = useState('profile');

  const [userData, setUserData] = useState(null);
  const [profileForm, setProfileForm] = useState({ fullName: '', phoneNumber: '', address: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem('userData');
      if (raw) {
        const parsed = JSON.parse(raw);
        setUserData(parsed);
        setProfileForm({
          fullName: parsed.fullName || '',
          phoneNumber: parsed.phoneNumber || '',
          address: parsed.address || '',
        });
      }
    })();
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      const res = await makeApiCall(apiClient.auth.profile, { method: 'PUT', body: JSON.stringify(profileForm) });
      if (res?.success) {
        const updated = { ...userData, ...res.data.user };
        await AsyncStorage.setItem('userData', JSON.stringify(updated));
        setUserData(updated);
        Alert.alert(t('common:buttons.success', 'Success'), t('citizen:settings.profileUpdated'));
      } else {
        Alert.alert(t('common:mobileNav.error'), res?.message || t('citizen:settings.updateFailed'));
      }
    } catch (err) {
      Alert.alert(t('common:mobileNav.error'), err.message || t('citizen:settings.updateFailed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      Alert.alert(t('common:mobileNav.error'), t('citizen:settings.passwordMismatch'));
      return;
    }
    setSavingPassword(true);
    try {
      const res = await makeApiCall(apiClient.auth.password, {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      });
      if (res?.success) {
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        Alert.alert(t('common:buttons.success', 'Success'), t('citizen:settings.passwordUpdated'));
      } else {
        Alert.alert(t('common:mobileNav.error'), res?.message || t('citizen:settings.updateFailed'));
      }
    } catch (err) {
      Alert.alert(t('common:mobileNav.error'), err.message || t('citizen:settings.updateFailed'));
    } finally {
      setSavingPassword(false);
    }
  };

  const deleteAccount = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    if (!deletePassword) {
      Alert.alert(t('common:mobileNav.error'), t('citizen:settings.passwordRequired'));
      return;
    }
    setDeleting(true);
    try {
      const res = await makeApiCall(apiClient.auth.deleteAccount, {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      if (res?.success) {
        await AsyncStorage.multiRemove(['authToken', 'userData']);
        navigation.replace('Welcome');
      } else {
        Alert.alert(t('common:mobileNav.error'), res?.message || t('citizen:settings.deleteFailed'));
      }
    } catch (err) {
      Alert.alert(t('common:mobileNav.error'), err.message || t('citizen:settings.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const Segmented = ({ options, value, onChange }) => (
    <View style={styles.segmentedRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onChange(opt.value)}
          style={[styles.segmentButton, value === opt.value && styles.segmentButtonActive]}
        >
          <Text style={[styles.segmentButtonText, value === opt.value && styles.segmentButtonTextActive]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const Toggle = ({ checked, onChange }) => (
    <TouchableOpacity onPress={() => onChange(!checked)} style={[styles.toggle, checked && styles.toggleActive]}>
      <View style={[styles.toggleKnob, checked && styles.toggleKnobActive]} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('citizen:settings.title')}</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map(tKey => (
          <TouchableOpacity
            key={tKey}
            onPress={() => setTab(tKey)}
            style={[styles.tabButton, tab === tKey && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, tab === tKey && styles.tabButtonTextActive]}>
              {t(`citizen:settings.tabs.${tKey}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {tab === 'profile' && (
          <View style={styles.card}>
            <Text style={styles.label}>{t('citizen:settings.fullName')}</Text>
            <TextInput
              style={styles.input}
              value={profileForm.fullName}
              onChangeText={v => setProfileForm({ ...profileForm, fullName: v })}
            />
            <Text style={styles.label}>{t('citizen:settings.phoneNumber')}</Text>
            <TextInput
              style={styles.input}
              value={profileForm.phoneNumber}
              onChangeText={v => setProfileForm({ ...profileForm, phoneNumber: v })}
              keyboardType="phone-pad"
            />
            <Text style={styles.label}>{t('citizen:settings.address')}</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={profileForm.address}
              onChangeText={v => setProfileForm({ ...profileForm, address: v })}
              multiline
            />
            <TouchableOpacity style={styles.primaryButton} onPress={saveProfile} disabled={savingProfile}>
              <Text style={styles.primaryButtonText}>
                {savingProfile ? t('citizen:settings.saving') : t('citizen:settings.saveChanges')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'password' && (
          <View style={styles.card}>
            <Text style={styles.label}>{t('citizen:settings.currentPassword')}</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={passwordForm.currentPassword}
              onChangeText={v => setPasswordForm({ ...passwordForm, currentPassword: v })}
            />
            <Text style={styles.label}>{t('citizen:settings.newPassword')}</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={passwordForm.newPassword}
              onChangeText={v => setPasswordForm({ ...passwordForm, newPassword: v })}
            />
            <Text style={styles.label}>{t('citizen:settings.confirmPassword')}</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={passwordForm.confirmPassword}
              onChangeText={v => setPasswordForm({ ...passwordForm, confirmPassword: v })}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={savePassword} disabled={savingPassword}>
              <Text style={styles.primaryButtonText}>
                {savingPassword ? t('citizen:settings.saving') : t('citizen:settings.changePassword')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'accessibility' && (
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabelGroup}>
                <Text style={styles.settingLabel}>{t('common:accessibility.contrast.label')}</Text>
                <Text style={styles.settingDesc}>{t('common:accessibility.contrast.desc')}</Text>
              </View>
              <Segmented
                options={[
                  { value: 'normal', label: t('common:accessibility.contrast.normal') },
                  { value: 'high', label: t('common:accessibility.contrast.high') },
                ]}
                value={settings.contrast}
                onChange={v => updateSetting('contrast', v)}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelGroup}>
                <Text style={styles.settingLabel}>{t('common:accessibility.fontScale.label')}</Text>
                <Text style={styles.settingDesc}>{t('common:accessibility.fontScale.desc')}</Text>
              </View>
              <Segmented
                options={[
                  { value: 'normal', label: t('common:accessibility.fontScale.normal') },
                  { value: 'large', label: t('common:accessibility.fontScale.large') },
                  { value: 'xlarge', label: t('common:accessibility.fontScale.xlarge') },
                ]}
                value={settings.fontScale}
                onChange={v => updateSetting('fontScale', v)}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelGroup}>
                <Text style={styles.settingLabel}>{t('common:accessibility.reduceMotion.label')}</Text>
                <Text style={styles.settingDesc}>{t('common:accessibility.reduceMotion.desc')}</Text>
              </View>
              <Toggle checked={settings.reduceMotion} onChange={v => updateSetting('reduceMotion', v)} />
            </View>
          </View>
        )}

        {tab === 'danger' && (
          <View style={[styles.card, styles.dangerCard]}>
            <Text style={styles.dangerTitle}>{t('citizen:settings.deleteAccount')}</Text>
            <Text style={styles.dangerDesc}>{t('citizen:settings.deleteAccountDesc')}</Text>
            {confirmingDelete && (
              <TextInput
                style={styles.input}
                secureTextEntry
                placeholder={t('citizen:settings.enterPasswordToConfirm')}
                value={deletePassword}
                onChangeText={setDeletePassword}
              />
            )}
            <TouchableOpacity style={styles.dangerButton} onPress={deleteAccount} disabled={deleting}>
              <Text style={styles.dangerButtonText}>
                {confirmingDelete ? t('citizen:settings.confirmDeleteAccount') : t('citizen:settings.deleteAccount')}
              </Text>
            </TouchableOpacity>
            {confirmingDelete && (
              <TouchableOpacity onPress={() => { setConfirmingDelete(false); setDeletePassword(''); }}>
                <Text style={styles.cancelText}>{t('common:mobileNav.cancel')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#E0E0E0',
  },
  backButton: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  tabButton: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#E0E0E0' },
  tabButtonActive: { backgroundColor: '#1A1A1A', borderColor: '#1A1A1A' },
  tabButtonText: { fontSize: 12, fontWeight: '600', color: '#374151', textTransform: 'uppercase' },
  tabButtonTextActive: { color: '#FFFFFF' },
  content: { flex: 1 },
  contentInner: { padding: 16 },
  card: { borderWidth: 1, borderColor: '#1A1A1A', padding: 16, backgroundColor: '#FFFFFF' },
  label: { fontSize: 11, fontWeight: '700', color: '#374151', textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#E0E0E0', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1A1A1A',
  },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  primaryButton: { backgroundColor: '#1A1A1A', paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13, textTransform: 'uppercase' },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  settingLabelGroup: { flex: 1, marginRight: 12 },
  settingLabel: { fontSize: 13, fontWeight: '700', color: '#1A1A1A', textTransform: 'uppercase' },
  settingDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  segmentedRow: { flexDirection: 'row', borderWidth: 1, borderColor: '#E0E0E0' },
  segmentButton: { paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 1, borderLeftColor: '#E0E0E0' },
  segmentButtonActive: { backgroundColor: '#1A1A1A' },
  segmentButtonText: { fontSize: 11, fontWeight: '600', color: '#374151' },
  segmentButtonTextActive: { color: '#FFFFFF' },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#E0E0E0', padding: 2 },
  toggleActive: { backgroundColor: '#1A1A1A' },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  toggleKnobActive: { transform: [{ translateX: 20 }] },
  dangerCard: { borderColor: '#C62828', backgroundColor: '#FEF2F2' },
  dangerTitle: { fontSize: 16, fontWeight: '700', color: '#C62828', textTransform: 'uppercase' },
  dangerDesc: { fontSize: 13, color: '#991B1B', marginTop: 8 },
  dangerButton: { backgroundColor: '#C62828', paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  dangerButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13, textTransform: 'uppercase' },
  cancelText: { textAlign: 'center', color: '#6B7280', marginTop: 12, fontSize: 13 },
});

export default SettingsScreen;

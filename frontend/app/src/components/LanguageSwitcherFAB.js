import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

/**
 * Global, always-on-top language switcher. Rendered once as a sibling of
 * the Stack.Navigator (see App.js) rather than per-screen, since no shared
 * top-bar component exists across the app's ~25 screens - this avoids
 * touching every screen's individual header just to add a switcher.
 */
export default function LanguageSwitcherFAB() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setOpen(true)}
        accessibilityLabel="Change language"
      >
        <Ionicons name="language" size={22} color="#fff" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <SafeAreaView style={styles.sheetWrapper}>
            <View style={styles.sheet}>
              <Text style={styles.title}>Language</Text>
              {SUPPORTED_LANGUAGES.map(({ code, label }) => (
                <TouchableOpacity
                  key={code}
                  style={[styles.option, i18n.language === code && styles.optionSelected]}
                  onPress={() => {
                    i18n.changeLanguage(code);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, i18n.language === code && styles.optionTextSelected]}>
                    {label}
                  </Text>
                  {i18n.language === code && (
                    <Ionicons name="checkmark-circle" size={20} color="#2E7D32" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 999,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetWrapper: {
    width: '100%',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  optionSelected: {
    backgroundColor: '#F1F8F2',
  },
  optionText: {
    fontSize: 15,
    color: '#374151',
  },
  optionTextSelected: {
    fontWeight: '700',
    color: '#2E7D32',
  },
});

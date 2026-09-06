import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Drop-in replacement for @react-native-picker/picker in this app's admin
 * forms. That library's iOS wheel renders with no visible item text under
 * React Native's New Architecture (app.json: newArchEnabled: true) - a
 * known @react-native-picker/picker + Fabric incompatibility as of 2.11.1 -
 * leaving a large blank box with only the empty selection-highlight pill
 * showing (see AdminComplaintDetails.js's "Update Stage" modal).
 *
 * Expands its option list INLINE (pushing following content down) rather
 * than in a popup/Modal - every current call site already lives inside a
 * ScrollView nested in a Modal, and stacking a second native Modal there
 * risks the same iOS double-modal-visible flicker already fixed once in
 * AdminComplaintMapScreen.js (two <Modal>s both visible at once).
 *
 * items: [{ label: string, value: string }]
 */
const SimpleDropdown = ({ value, onValueChange, items, placeholder = 'Select…' }) => {
  const [open, setOpen] = useState(false);
  const selected = items.find((item) => item.value === value);

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.field, open && styles.fieldOpen]}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.7}
      >
        <Text style={[styles.fieldText, !selected && styles.placeholderText]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#7f8c8d" />
      </TouchableOpacity>

      {open && (
        <View style={styles.optionsList}>
          {items.map((item, index) => {
            const isSelected = item.value === value;
            return (
              <TouchableOpacity
                key={`${item.value}-${index}`}
                style={[styles.option, index < items.length - 1 && styles.optionDivider]}
                onPress={() => {
                  onValueChange(item.value);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]} numberOfLines={1}>
                  {item.label}
                </Text>
                {isSelected && <Ionicons name="checkmark" size={16} color="#1A1A1A" />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 15,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  fieldOpen: {
    borderColor: '#1A1A1A',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  fieldText: {
    fontSize: 16,
    color: '#2c3e50',
    flex: 1,
    marginRight: 8,
  },
  placeholderText: {
    color: '#95a5a6',
  },
  optionsList: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#1A1A1A',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#fff',
    maxHeight: 260,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  optionText: {
    fontSize: 15,
    color: '#2c3e50',
    flex: 1,
    marginRight: 8,
  },
  optionTextSelected: {
    fontWeight: '600',
  },
});

export default SimpleDropdown;

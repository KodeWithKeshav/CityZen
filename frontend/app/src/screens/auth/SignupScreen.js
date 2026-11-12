import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import SimpleDropdown from '../../components/SimpleDropdown';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { apiClient, makeApiCall } from '../../../config/supabase';

const SignupScreen = ({ navigation }) => {
  const { t } = useTranslation(['auth', 'common']);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    userType: 'citizen',
    address: '',
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSignup = async () => {
    const fullName = formData.fullName.trim();
    const email = formData.email.trim().toLowerCase();
    const phoneNumber = formData.phoneNumber.trim();
    const address = formData.address ? formData.address.trim() : '';

    // Validation
    if (!fullName || !email || !phoneNumber || !formData.password) {
      Alert.alert(t('common:mobileNav.error', 'Error'), t('citizenSignup.fillRequired', 'Please fill in all required fields'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert(t('common:mobileNav.error', 'Error'), t('citizenSignup.passwordMismatch', 'Passwords do not match'));
      return;
    }

    if (formData.password.length < 6) {
      Alert.alert(t('common:mobileNav.error', 'Error'), t('citizenSignup.passwordTooShort', 'Password must be at least 6 characters long'));
      return;
    }

    if (phoneNumber.replace(/\D/g, '').length < 10) {
      Alert.alert(t('common:mobileNav.error', 'Error'), t('citizenSignup.fillRequired', 'Please enter a valid phone number'));
      return;
    }

    setLoading(true);
    try {
      const signupData = {
        fullName,
        email,
        phoneNumber,
        password: formData.password,
        userType: formData.userType,
        address,
      };

      const response = await makeApiCall(apiClient.auth.signup, {
        method: 'POST',
        body: JSON.stringify(signupData),
      });

      if (response.success) {
        // Store auth token and user data
        await AsyncStorage.setItem('authToken', response.data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));

        Alert.alert(t('common:mobileNav.ok', 'Success'), t('citizenSignup.accountCreated', 'Account created successfully!'));
        
        // Navigate based on user type
        if (response.data.user.userType === 'admin') {
          navigation.replace('EnhancedAdminDashboard');
        } else {
          navigation.replace('InstagramFeed');
        }
      }
    } catch (error) {
      Alert.alert(t('common:mobileNav.error', 'Error'), error.message || t('citizenSignup.signupFailed', 'Signup failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('citizenSignup.createAccount', 'Create Account')}</Text>
        <Text style={styles.subtitle}>{t('citizenSignup.tagline', 'Join CityZen Community')}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t('citizenSignup.fullName', 'Full Name *')}
            value={formData.fullName}
            onChangeText={(value) => handleInputChange('fullName', value)}
          />

          <TextInput
            style={styles.input}
            placeholder={t('citizenSignup.email', 'Email *')}
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TextInput
            style={styles.input}
            placeholder={t('citizenSignup.phone', 'Phone Number *')}
            value={formData.phoneNumber}
            onChangeText={(value) => handleInputChange('phoneNumber', value)}
            keyboardType="phone-pad"
          />

          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>{t('welcome.portalLabel', 'User Type *')}</Text>
            <SimpleDropdown
              value={formData.userType}
              onValueChange={(value) => handleInputChange('userType', value)}
              items={[
                { label: t('welcome.citizenPortal.title', 'Citizen'), value: 'citizen' },
                { label: t('welcome.adminPortal.title', 'Admin'), value: 'admin' },
              ]}
            />
          </View>

          <TextInput
            style={styles.input}
            placeholder={t('citizenSignup.addressPlaceholder', 'Address (Optional)')}
            value={formData.address}
            onChangeText={(value) => handleInputChange('address', value)}
            multiline
            numberOfLines={3}
          />

          <TextInput
            style={styles.input}
            placeholder={t('citizenSignup.password', 'Password *')}
            value={formData.password}
            onChangeText={(value) => handleInputChange('password', value)}
            secureTextEntry
          />

          <TextInput
            style={styles.input}
            placeholder={t('citizenSignup.confirmPassword', 'Confirm Password *')}
            value={formData.confirmPassword}
            onChangeText={(value) => handleInputChange('confirmPassword', value)}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t('citizenSignup.createAccount', 'Create Account')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.linkText}>
              {t('citizenSignup.alreadyHaveAccount', 'Already have an account?')} {t('citizenSignup.login', 'Login')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    width: '100%',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 15,
  },
  pickerLabel: {
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  button: {
    backgroundColor: '#2E7D32',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 10,
  },
  linkText: {
    color: '#2E7D32',
    fontSize: 16,
  },
});

export default SignupScreen;

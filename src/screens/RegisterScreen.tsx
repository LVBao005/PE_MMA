import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/movie';
import { useAuth } from '../context/AuthContext';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Register'>;

export default function RegisterScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const validate = (emailVal: string, passVal: string, confirmVal: string) => {
    const errs: { email?: string; password?: string; confirmPassword?: string } = {};
    const trimmedEmail = emailVal.trim();

    // Email validation
    if (!trimmedEmail) {
      errs.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        errs.email = 'Please enter a valid email address';
      }
    }

    // Password validation
    if (!passVal) {
      errs.password = 'Password is required';
    } else if (passVal.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    // Confirm password validation
    if (!confirmVal) {
      errs.confirmPassword = 'Confirm password is required';
    } else if (confirmVal !== passVal) {
      errs.confirmPassword = 'Passwords do not match';
    }

    return errs;
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (hasSubmitted) {
      const errs = validate(val, password, confirmPassword);
      setErrors((prev) => ({ ...prev, email: errs.email }));
    }
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (hasSubmitted) {
      const errs = validate(email, val, confirmPassword);
      setErrors((prev) => ({ 
        ...prev, 
        password: errs.password,
        confirmPassword: errs.confirmPassword 
      }));
    }
  };

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    if (hasSubmitted) {
      const errs = validate(email, password, val);
      setErrors((prev) => ({ ...prev, confirmPassword: errs.confirmPassword }));
    }
  };

  const handleSubmit = async () => {
    setHasSubmitted(true);
    setAuthError(null);
    setSuccessMessage(null);

    const validationErrors = validate(email, password, confirmPassword);
    setErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await register(email.trim(), password);
      setSuccessMessage('Registration successful');
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'List' }],
        });
      }, 2500);
    } catch (err: any) {
      const message = err.message || 'Registration failed';
      setAuthError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.headerBox}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join CineList to organize your watchlist</Text>
          </View>

          {authError ? (
            <View style={styles.errorBanner}>
              <Text testID="error-auth" style={styles.authErrorText}>{authError}</Text>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.successBanner}>
              <Text testID="form-success" style={styles.successText}>{successMessage}</Text>
            </View>
          ) : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              placeholder="name@example.com"
              placeholderTextColor="#64748B"
              value={email}
              onChangeText={handleEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[styles.input, errors.password ? styles.inputError : null]}
              placeholder="At least 6 characters"
              placeholderTextColor="#64748B"
              value={password}
              onChangeText={handlePasswordChange}
              secureTextEntry
            />
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={[styles.input, errors.confirmPassword ? styles.inputError : null]}
              placeholder="Re-enter password"
              placeholderTextColor="#64748B"
              value={confirmPassword}
              onChangeText={handleConfirmPasswordChange}
              secureTextEntry
            />
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
          </View>

          <TouchableOpacity 
            style={styles.submitBtn} 
            onPress={handleSubmit} 
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.submitBtnText}>Register</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  container: {
    width: '100%',
  },
  headerBox: {
    marginBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
  },
  errorBanner: {
    backgroundColor: '#451A1A',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  authErrorText: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '500',
  },
  successBanner: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    color: '#6EE7B7',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#F8FAFC',
    fontSize: 15,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  submitBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  linkText: {
    color: '#38BDF8',
    fontWeight: '600',
    fontSize: 14,
  },
});


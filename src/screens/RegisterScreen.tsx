import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth, authErrorMessage } from '../services/AuthContext';
import { AuthStackParamList } from '../navigation/types';
import { COLORS, FONT, RADIUS, SPACING } from '../components/theme';
import { ScalePressable } from '../components/ScalePressable';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focus, setFocus] = useState<'name' | 'email' | 'password' | null>(null);

  const onSubmit = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please fill out all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Invalid password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (error) {
      Alert.alert('Registration failed', authErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>IRON{`\n`}LOG</Text>
        <Text style={styles.tagline}>TRACK · ANALYSE · DOMINATE</Text>

        <Text style={styles.heading}>Create account</Text>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>FULL NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            accessibilityLabel="Full name"
            placeholder="Your name"
            placeholderTextColor={COLORS.muted}
            autoCapitalize="words"
            style={[styles.input, focus === 'name' && styles.inputFocus]}
            onFocus={() => setFocus('name')}
            onBlur={() => setFocus(null)}
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>EMAIL</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            accessibilityLabel="Email"
            placeholder="you@example.com"
            placeholderTextColor={COLORS.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, focus === 'email' && styles.inputFocus]}
            onFocus={() => setFocus('email')}
            onBlur={() => setFocus(null)}
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            accessibilityLabel="Password"
            placeholder="Minimum 6 characters"
            placeholderTextColor={COLORS.muted}
            secureTextEntry
            style={[styles.input, focus === 'password' && styles.inputFocus]}
            onFocus={() => setFocus('password')}
            onBlur={() => setFocus(null)}
          />
        </View>

        <ScalePressable
          style={styles.primaryButton}
          onPress={onSubmit}
          disabled={loading}
          accessibilityLabel="Create account"
          accessibilityState={{ busy: loading }}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.primaryButtonText}>CREATE ACCOUNT</Text>
          )}
        </ScalePressable>

        <Text style={styles.footerText}>
          Have an account?{' '}
          <Text
            style={styles.link}
            onPress={() => navigation.navigate('Login')}
            accessibilityRole="link"
            accessibilityLabel="Log in"
          >
            Log in
          </Text>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxl
  },
  logo: {
    color: COLORS.accent,
    fontFamily: FONT.display,
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 72,
    lineHeight: 64
  },
  tagline: {
    color: COLORS.muted,
    fontFamily: FONT.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontSize: 10,
    marginTop: SPACING.sm
  },
  heading: {
    marginTop: SPACING.xl,
    color: COLORS.text,
    fontFamily: FONT.bodyBold,
    fontSize: 28
  },
  fieldWrap: {
    marginTop: SPACING.md
  },
  label: {
    color: COLORS.muted,
    fontFamily: FONT.bodyBold,
    letterSpacing: 1.5,
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs
  },
  input: {
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontFamily: FONT.bodyMedium,
    fontSize: 16,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2
  },
  inputFocus: {
    borderColor: COLORS.accent
  },
  primaryButton: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52
  },
  primaryButtonText: {
    color: '#000',
    fontFamily: FONT.display,
    fontSize: 24,
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  footerText: {
    marginTop: SPACING.lg,
    color: COLORS.muted,
    fontFamily: FONT.body,
    textAlign: 'center'
  },
  link: {
    color: COLORS.accent,
    fontFamily: FONT.bodyBold
  }
});

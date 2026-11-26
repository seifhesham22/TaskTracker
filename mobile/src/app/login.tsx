import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextInputInstance } from 'react-native';

import {
  AuthScreen,
  FormMessage,
  PasswordToggle,
  ScreenTitle,
  StatusLine,
  SwitchPrompt,
  TextField,
  authStyles,
} from '../components/auth/AuthForm';
import { Button } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { SESSION_EXPIRED_SCREEN } from '../domain/access';
import { SESSION_EXPIRED, toLoginErrors } from '../domain/authErrors';
import { useCredentialsForm } from '../hooks/useCredentialsForm';
import { colors } from '../theme/tokens';

/**
 * US-2: log in. Once signed in, the root layout's guard swaps this screen for the user's projects.
 * After a logout it first confirms that the session ended.
 */
export default function LoginScreen() {
  const { login, notice, clearNotice } = useAuth();
  const { email: registeredEmail } = useLocalSearchParams<{ email?: string }>();
  // The expired-session screen comes first; Log in on it opens the form.
  const [continued, setContinued] = useState(false);

  if (notice === 'loggedOut') {
    return (
      <AuthScreen testID="logged-out-screen">
        <StatusLine>Session ended</StatusLine>
        <ScreenTitle
          afterStatus
          title="You’re logged out"
          subtitle="Your session has ended. Log in again whenever you’re ready."
        />
        <Button
          label="Back to log in"
          size="lg"
          block
          onPress={clearNotice}
          style={authStyles.submit}
          testID="back-to-login"
        />
      </AuthScreen>
    );
  }

  if (notice === 'expired' && !continued) {
    return (
      <AuthScreen testID="session-expired-screen">
        <ScreenTitle title={SESSION_EXPIRED_SCREEN.title} subtitle={SESSION_EXPIRED_SCREEN.subtitle} />
        <Text style={styles.note}>{SESSION_EXPIRED_SCREEN.note}</Text>
        <Button
          label="Log in"
          size="lg"
          block
          onPress={() => setContinued(true)}
          style={authStyles.submit}
          testID="session-expired-login"
        />
      </AuthScreen>
    );
  }

  return (
    <LoginForm
      initialEmail={typeof registeredEmail === 'string' ? registeredEmail : ''}
      sessionExpired={notice === 'expired'}
      onSubmit={async (credentials) => {
        await login(credentials);
      }}
      onEdit={notice ? clearNotice : undefined}
    />
  );
}

function LoginForm({
  initialEmail,
  sessionExpired,
  onSubmit,
  onEdit,
}: {
  initialEmail: string;
  sessionExpired: boolean;
  onSubmit: Parameters<typeof useCredentialsForm>[0]['submit'];
  onEdit?: () => void;
}) {
  const router = useRouter();
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const form = useCredentialsForm({ submit: onSubmit, toErrors: toLoginErrors, initialEmail, emailRef, passwordRef });
  const formMessage = form.errors.form ?? (sessionExpired ? SESSION_EXPIRED : undefined);

  return (
    <AuthScreen testID="login-screen">
      <ScreenTitle title="Welcome back" subtitle="Log in to access your projects." />
      <View style={{ height: 24 }} />
      {formMessage ? <FormMessage>{formMessage}</FormMessage> : null}

      <View style={authStyles.fields}>
        <TextField
          ref={emailRef}
          label="Email"
          value={form.email}
          onChangeText={(value) => {
            form.setEmail(value);
            onEdit?.();
          }}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="username"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!form.submitting}
          error={form.errors.email}
          errorTestID="email-error"
          testID="email-input"
        />
        <TextField
          ref={passwordRef}
          label="Password"
          value={form.password}
          onChangeText={(value) => {
            form.setPassword(value);
            onEdit?.();
          }}
          placeholder="Enter your password"
          secureTextEntry={!form.passwordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={form.onSubmit}
          editable={!form.submitting}
          error={form.errors.password}
          errorTestID="password-error"
          testID="password-input"
        />
        <PasswordToggle
          visible={form.passwordVisible}
          onToggle={form.togglePasswordVisible}
          disabled={form.submitting}
        />
      </View>

      <Button
        label={form.submitting ? 'Logging in…' : 'Log in'}
        size="lg"
        block
        loading={form.submitting}
        onPress={form.onSubmit}
        style={authStyles.submit}
        testID="submit-button"
      />
      <SwitchPrompt
        prompt="New to TaskTracker?"
        action="Create an account"
        onPress={() => router.push('/register')}
        disabled={form.submitting}
        testID="go-to-register"
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: 16, fontSize: 16, lineHeight: 24, color: colors.foreground },
});

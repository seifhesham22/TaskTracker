import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';

import { registerRequest } from '../api/auth';
import {
  AuthScreen,
  FormMessage,
  PasswordToggle,
  RequiredNote,
  ScreenTitle,
  StatusLine,
  SwitchPrompt,
  TextField,
  authStyles,
} from '../components/auth/AuthForm';
import { Button } from '../components/ui';
import { toRegisterErrors } from '../domain/authErrors';
import { useCredentialsForm } from '../hooks/useCredentialsForm';

/** US-1: create an account with an email and a password, then continue to log in. */
export default function RegisterScreen() {
  const router = useRouter();
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const form = useCredentialsForm({
    emailRef,
    passwordRef,
    submit: async (credentials) => {
      const user = await registerRequest(credentials);
      setRegisteredEmail(user.email);
    },
    toErrors: toRegisterErrors,
  });

  const goToLogin = (email?: string) =>
    router.dismissTo(email ? { pathname: '/login', params: { email } } : '/login');

  if (registeredEmail) {
    return (
      <AuthScreen testID="register-success">
        <StatusLine>Account created</StatusLine>
        <ScreenTitle
          afterStatus
          title="You’re ready to get started."
          subtitle="Your TaskTracker account has been created. Log in to access your projects."
        />
        <Button
          label="Continue to log in"
          size="lg"
          block
          onPress={() => goToLogin(registeredEmail)}
          style={authStyles.submit}
          testID="continue-to-login"
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen testID="register-screen">
      <ScreenTitle title="Create your account" subtitle="Keep your team’s work moving, together." />
      <RequiredNote />
      {form.errors.form ? <FormMessage>{form.errors.form}</FormMessage> : null}

      <View style={authStyles.fields}>
        <TextField
          ref={emailRef}
          label="Email"
          value={form.email}
          onChangeText={form.setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
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
          onChangeText={form.setPassword}
          placeholder="Enter your password"
          secureTextEntry={!form.passwordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
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
        label={form.submitting ? 'Creating account…' : 'Create account'}
        size="lg"
        block
        loading={form.submitting}
        onPress={form.onSubmit}
        style={authStyles.submit}
        testID="submit-button"
      />
      <SwitchPrompt
        prompt="Already have an account?"
        action="Log in"
        onPress={() => goToLogin()}
        disabled={form.submitting}
        testID="go-to-login"
      />
    </AuthScreen>
  );
}

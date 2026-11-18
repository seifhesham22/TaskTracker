import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { TextInputInstance } from 'react-native';

import type { Credentials } from '../api/auth';
import { hasErrors, validateCredentials, type AuthFormErrors } from '../domain/authErrors';

/**
 * State shared by the registration and login forms: the two fields, the password's visibility,
 * validation, and a submission that can't be started twice. The password is kept only in this
 * component state and is never logged.
 */
export function useCredentialsForm({
  submit,
  toErrors,
  initialEmail = '',
  emailRef,
  passwordRef,
}: {
  /** Sends the credentials. Rejects with the backend's error, which `toErrors` turns into messages. */
  submit: (credentials: Credentials) => Promise<void>;
  toErrors: (error: unknown) => AuthFormErrors;
  initialEmail?: string;
  /** Focused when their field has the first error. */
  emailRef: RefObject<TextInputInstance | null>;
  passwordRef: RefObject<TextInputInstance | null>;
}) {
  const [email, setEmailValue] = useState(initialEmail);
  const [password, setPasswordValue] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // A ref, not state, so a second tap in the same frame is ignored too.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const focusFirstError = (found: AuthFormErrors) => {
    if (found.email) emailRef.current?.focus();
    else if (found.password) passwordRef.current?.focus();
  };

  const setEmail = useCallback((value: string) => {
    setEmailValue(value);
    setErrors((e) => (e.email ? { ...e, email: undefined } : e));
  }, []);

  const setPassword = useCallback((value: string) => {
    setPasswordValue(value);
    setErrors((e) => (e.password ? { ...e, password: undefined } : e));
  }, []);

  const onSubmit = async () => {
    if (inFlight.current) return;
    const invalid = validateCredentials(email, password);
    if (hasErrors(invalid)) {
      setErrors(invalid);
      focusFirstError(invalid);
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setErrors({});
    try {
      await submit({ email: email.trim(), password });
    } catch (error) {
      if (mounted.current) {
        const found = toErrors(error);
        setErrors(found);
        focusFirstError(found);
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    passwordVisible,
    togglePasswordVisible: () => setPasswordVisible((v) => !v),
    errors,
    submitting,
    /** For press and keyboard handlers, which must not receive a promise. */
    onSubmit: () => {
      void onSubmit();
    },
  };
}

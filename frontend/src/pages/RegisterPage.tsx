import { useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { api, AuthError } from '../api';
import { RegistrationValidator, type FieldErrors } from '../domain/validators/RegistrationValidator';
import './auth.css';

/** Error code returned by the backend when an email is already taken. */
const EMAIL_TAKEN_CODE = 'BAD_USER_INPUT';

/**
 * Registration page — US-1.
 *
 * Renders a centered auth card with email and password fields,
 * validates on submit, calls the backend register mutation,
 * and shows a success confirmation screen before navigating to /login.
 *
 * States (Figma specification):
 *   01 · Default form
 *   02 · Required fields error
 *   03 · Invalid email error
 *   04 · Loading (opacity 0.6 on interactive elements)
 *   05 · Email already used (server error on email field)
 *   06 · Success (confirmation screen with "Continue to login" button)
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const validator = useMemo(() => new RegistrationValidator(), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);

      const errors = validator.validate({ email, password });
      setFieldErrors(errors);

      if (Object.keys(errors).length > 0) {
        const firstInvalidId = errors.email ? 'register-email' : 'register-password';
        document.getElementById(firstInvalidId)?.focus();
        return;
      }

      setLoading(true);

      try {
        await api.auth.register({ email: email.trim(), password });
        setRegistered(true);
      } catch (err: unknown) {
        if (err instanceof AuthError && (err.code === EMAIL_TAKEN_CODE || err.message.toLowerCase().includes('already exists'))) {
          setFieldErrors({ email: err.message });
          document.getElementById('register-email')?.focus();
        } else if (err instanceof AuthError) {
          setFormError(err.message);
        } else {
          setFormError('Something went wrong. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    },
    [email, password, validator]
  );

  const clearFieldError = useCallback((field: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleContinueToLogin = useCallback(() => {
    navigate('/login', { state: { registered: true } });
  }, [navigate]);

  if (registered) {
    return (
      <div className="auth-page">
        <header className="auth-brand-header">
          <Link to="/" className="brand-link" aria-label="TaskTracker home">
            <span className="brand-mark">
              <img src="/assets/d3037.svg" alt="" width="16" height="16" />
            </span>
            <strong className="brand-name">TaskTracker</strong>
          </Link>
        </header>

        <div className="auth-content">
          <div className="auth-card">
            <div className="auth-success" data-testid="register-success">
              <span className="auth-success-marker">Success</span>
              <h1 className="auth-heading">Account created</h1>
              <p className="auth-subtitle">
                Your account has been created successfully. You can now log in
                with your credentials.
              </p>
              <button
                type="button"
                className="auth-button"
                onClick={handleContinueToLogin}
              >
                Continue to login
              </button>
            </div>
          </div>

          <p className="auth-footer">TaskTracker &copy; {new Date().getFullYear()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <header className="auth-brand-header">
        <Link to="/" className="brand-link" aria-label="TaskTracker home">
          <span className="brand-mark">
            <img src="/assets/d3037.svg" alt="" width="16" height="16" />
          </span>
          <strong className="brand-name">TaskTracker</strong>
        </Link>
      </header>

      <div className="auth-content">
        <div className="auth-card">
          <form
            className={`auth-form${loading ? ' auth-form--loading' : ''}`}
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="auth-introduction">
              <h1 className="auth-heading">Create account</h1>
              <p className="auth-subtitle">Enter your email and password to get started.</p>
            </div>

            <p className="auth-required-notice">All fields are required</p>

            {formError && (
              <div className="auth-form-error" role="alert">
                {formError}
              </div>
            )}

            <div className="auth-field">
              <label className="auth-field-label" htmlFor="register-email">
                Email
              </label>
              <input
                id="register-email"
                className="auth-input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
                disabled={loading}
              />
              {fieldErrors.email && (
                <p id="register-email-error" className="auth-field-error" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div className="auth-field">
              <label className="auth-field-label" htmlFor="register-password">
                Password
              </label>
              <input
                id="register-password"
                className="auth-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="At least 10 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearFieldError('password');
                }}
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'register-password-error' : undefined}
                disabled={loading}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                disabled={loading}
              >
                {showPassword ? 'Hide password' : 'Show password'}
              </button>
              {fieldErrors.password && (
                <p id="register-password-error" className="auth-field-error" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>

            <p className="auth-link-row">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </form>
        </div>

        <p className="auth-footer">TaskTracker &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}

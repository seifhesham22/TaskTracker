import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/useAuth';
import { loginValidator, type LoginValidationErrors } from '../domain/validators/LoginValidator';
import './auth.css';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<LoginValidationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const validation = loginValidator.validate({ email, password });
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      await login({ email, password });
      const targetPath = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/projects';
      navigate(targetPath, { replace: true });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <main className="auth-content">
        <section className="auth-card" aria-labelledby="login-title">
          <form
            className={`auth-form ${isSubmitting ? 'auth-form--loading' : ''}`}
            onSubmit={handleSubmit}
            noValidate
          >
            <div className="auth-introduction">
              <h1 id="login-title" className="auth-heading">
                Log in
              </h1>
              <p className="auth-subtitle">
                Enter your email and password to access your account.
              </p>
              <p className="auth-required-notice">All fields are required</p>
            </div>

            {formError && (
              <div className="auth-form-error" role="alert">
                <span>{formError}</span>
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="login-email" className="auth-field-label">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                className="auth-input"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'login-email-error' : undefined}
                required
              />
              {errors.email && (
                <p id="login-email-error" className="auth-field-error" role="alert">
                  {errors.email}
                </p>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="login-password" className="auth-field-label">
                Password
              </label>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) {
                    setErrors((prev) => ({ ...prev, password: undefined }));
                  }
                }}
                disabled={isSubmitting}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'login-password-error' : undefined}
                required
              />
              {errors.password && (
                <p id="login-password-error" className="auth-field-error" role="alert">
                  {errors.password}
                </p>
              )}

              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                disabled={isSubmitting}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide password' : 'Show password'}
              </button>
            </div>

            <button type="submit" className="auth-button" disabled={isSubmitting}>
              {isSubmitting ? 'Logging in…' : 'Log in'}
            </button>

            <p className="auth-link-row">
              Don't have an account? <Link to="/register">Register</Link>
            </p>
          </form>
        </section>

        <p className="auth-footer">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </main>
    </div>
  );
}

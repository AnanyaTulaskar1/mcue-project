import React, { useState } from 'react';
import { authAPI } from '../services/api';

const saveSession = (data, onLoginSuccess) => {
  if (data.user?.role !== 'admin') throw new Error('Only a studio administrator can sign in here.');
  localStorage.setItem('token', data.token);
  localStorage.setItem('userRole', data.user.role);
  localStorage.setItem('user', JSON.stringify(data.user));
  onLoginSuccess?.();
};

const Login = ({ onLoginSuccess, authMessage = '' }) => {
  const [view, setView] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState(authMessage);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      const response = await authAPI.login({ email, password });
      saveSession(response.data, onLoginSuccess);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetRequest = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      const response = await authAPI.requestPasswordReset({ email });
      setMessage(response.data.message);
      setView('verify');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not request a password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetConfirm = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      const response = await authAPI.confirmPasswordReset({ email, otp, newPassword });
      saveSession(response.data, onLoginSuccess);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not reset the password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchView = (nextView) => {
    setError('');
    setMessage('');
    setView(nextView);
  };

  return (
    <section className="admin-login-card" aria-labelledby="login-title">
      <a className="brand login-brand" href="#login" aria-label="MCue Studio admin login">
        <span className="brand-mark">M</span>
        <span className="brand-name">MCue</span>
        <span className="brand-divider" />
        <span className="brand-caption">STUDIO MANAGER</span>
      </a>
      <span className="eyebrow login-eyebrow">PRIVATE WORKSPACE</span>
      <h1 id="login-title">{view === 'login' ? 'Welcome back' : 'Reset your password'}</h1>
      {error && <div className="notice notice-error login-notice" role="alert">{error}</div>}
      {message && <div className="login-message" role="status">{message}</div>}

      {view === 'login' && (
        <form className="login-form" onSubmit={handleLogin}>
          <label className="form-field">Admin email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" required /></label>
          <label className="form-field">Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>
          <button className="button button-primary login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in to the studio'}</button>
          <button className="login-reset-link" type="button" onClick={() => switchView('request')}>Forgot password?</button>
        </form>
      )}

      {view === 'request' && (
        <form className="login-form" onSubmit={handleResetRequest}>
          <p className="login-step-copy">Enter your admin email. We’ll send a one-time reset code if an admin account matches.</p>
          <label className="form-field">Admin email<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" required autoFocus /></label>
          <button className="button button-primary login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending code…' : 'Send reset code'}</button>
          <button className="login-reset-link" type="button" onClick={() => switchView('login')}>Back to sign in</button>
        </form>
      )}

      {view === 'verify' && (
        <form className="login-form" onSubmit={handleResetConfirm}>
          <label className="form-field">Six-digit reset code<input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value)} maxLength={6} placeholder="000000" required autoFocus /></label>
          <label className="form-field">New password<input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={8} placeholder="At least 8 characters" required /></label>
          <button className="button button-primary login-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Updating password…' : 'Reset password and sign in'}</button>
          <button className="login-reset-link" type="button" onClick={() => switchView('request')}>Request another code</button>
        </form>
      )}
    </section>
  );
};

export default Login;

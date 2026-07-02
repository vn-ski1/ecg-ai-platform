import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { colors, shadows, radius, transitions } from '../theme';

import { API } from '../config';

const IMG_ECG_WAVE = 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1400&q=80';

export default function Login({ onLogin, onPatientLogin }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let loggedIn = false;

      try {
        const res = await axios.post(`${API}/auth/login`, { email, password });
        const { role, token, doctor, patient } = res.data;
        const effectiveRole = role || (doctor ? 'doctor' : patient ? 'patient' : null);

        if (effectiveRole === 'doctor') {
          localStorage.setItem('ecg_token', token);
          localStorage.setItem('ecg_doctor', JSON.stringify(doctor));
          if (onLogin) onLogin(token, doctor);
          navigate('/patients');
          loggedIn = true;
        } else if (effectiveRole === 'patient') {
          localStorage.setItem('ecg_patient_token', token);
          localStorage.setItem('ecg_patient', JSON.stringify(patient));
          if (onPatientLogin) onPatientLogin(token, patient);
          navigate('/patient/home');
          loggedIn = true;
        }
      } catch (firstErr) {
        if (!firstErr.response || firstErr.response.status !== 401) throw firstErr;
        const res = await axios.post(`${API}/patient-auth/login`, { email, password });
        const { token, patient } = res.data;
        localStorage.setItem('ecg_patient_token', token);
        localStorage.setItem('ecg_patient', JSON.stringify(patient));
        if (onPatientLogin) onPatientLogin(token, patient);
        navigate('/patient/home');
        loggedIn = true;
      }

      if (!loggedIn) setError('Invalid email or password.');
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Login failed. ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={{ marginTop: 0, color: colors.primary, fontSize: 24 }}>Sign In</h2>
        <p style={{ color: colors.textMuted, fontSize: 13, marginBottom: 20 }}>
          Welcome back. Enter your credentials below.
        </p>

        <Link to="/" style={styles.backLink}>← Back to home</Link>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <div style={styles.passwordWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{ ...styles.input, paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={styles.eyeBtn}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ fontSize: 13, color: colors.textMuted, marginTop: 20, textAlign: 'center' }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: colors.primary, fontWeight: 600 }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundImage: `linear-gradient(135deg, rgba(15,39,69,0.82) 0%, rgba(31,78,121,0.75) 100%), url(${IMG_ECG_WAVE})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: '40px 16px',
  },
  card: {
    background: colors.bgCard,
    padding: 36,
    borderRadius: radius.lg,
    boxShadow: shadows.xl,
    width: '100%',
    maxWidth: 400,
    border: `1px solid ${colors.borderLight}`,
  },
  backLink: {
    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
    color: colors.primary, textDecoration: 'none', marginBottom: 20, fontWeight: 500,
  },
  field: { marginBottom: 16 },
  passwordWrap: { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer',
    color: colors.textMuted, padding: 0, display: 'flex', alignItems: 'center',
  },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: colors.text },
  input: {
    width: '100%', padding: '10px 14px', fontSize: 14,
    border: `1px solid ${colors.border}`, borderRadius: radius.md,
    background: colors.bgCard, color: colors.text,
    boxSizing: 'border-box', transition: transitions.base, outline: 'none',
  },
  error: {
    background: `${colors.risk.HIGH}15`, color: colors.risk.HIGH,
    padding: '8px 12px', borderRadius: radius.sm, fontSize: 13,
    marginBottom: 12, border: `1px solid ${colors.risk.HIGH}30`,
  },
  button: {
    width: '100%', padding: '12px', background: colors.primary,
    color: '#fff', border: 'none', borderRadius: radius.md,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: transitions.base,
  },
};

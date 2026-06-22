import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { colors, shadows, radius, transitions } from '../theme';

const API = 'http://localhost:3000/api/v1';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('mbarga@hgd.cm');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });
      const { token, doctor } = res.data;

      localStorage.setItem('ecg_token', token);
      localStorage.setItem('ecg_doctor', JSON.stringify(doctor));

      if (onLogin) onLogin(token, doctor);

      navigate('/');
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError('Invalid email or password.');
      } else {
        setError('Login failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={{ marginTop: 0, color: colors.primary }}>Doctor Login</h2>
        <p style={{ color: colors.textMuted, fontSize: 13 }}>
          ECG AI Platform — Hospital Integration Edition
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
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={styles.input}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: colors.textLight, marginTop: 20 }}>
          Demo credentials: <code style={styles.code}>mbarga@hgd.cm</code> / <code style={styles.code}>doctor123</code>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: 60,
    background: colors.bg,
    minHeight: '100vh',
  },
  card: {
    background: colors.bgCard,
    padding: 32,
    borderRadius: radius.lg,
    boxShadow: shadows.lg,
    width: 380,
    border: `1px solid ${colors.borderLight}`,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: colors.primary,
    textDecoration: 'none',
    marginBottom: 16,
    fontWeight: 500,
  },
  field: { marginBottom: 16 },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: colors.text,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    fontSize: 14,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    background: colors.bgCard,
    color: colors.text,
    boxSizing: 'border-box',
    transition: transitions.base,
    outline: 'none',
  },
  error: {
    background: `${colors.risk.HIGH}15`,
    color: colors.risk.HIGH,
    padding: '8px 12px',
    borderRadius: radius.sm,
    fontSize: 13,
    marginBottom: 12,
    border: `1px solid ${colors.risk.HIGH}30`,
  },
  button: {
    width: '100%',
    padding: '11px',
    background: colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: radius.md,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: transitions.base,
  },
  code: {
    background: colors.bgSubtle,
    color: colors.text,
    padding: '2px 6px',
    borderRadius: radius.sm,
    fontSize: 11,
  },
};
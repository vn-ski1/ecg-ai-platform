import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { colors, shadows, radius, transitions } from '../theme';

const API = 'http://localhost:3000/api/v1';

export default function PatientLogin({ onLogin }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('eric.test@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/patient-auth/login`, { email, password });
      const { token, patient } = res.data;
      localStorage.setItem('ecg_patient_token', token);
      localStorage.setItem('ecg_patient', JSON.stringify(patient));
      if (onLogin) onLogin(token, patient);
      navigate('/patient/home');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={{ marginTop: 0, color: colors.accentDark }}>{t('patient_login.title')}</h2>
        <p style={{ color: colors.textMuted, fontSize: 13 }}>{t('patient_login.subtitle')}</p>

        <Link to="/" style={styles.backLink}>{t('nav.back_home')}</Link>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>{t('patient_login.email')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={styles.input} />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>{t('patient_login.password')}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={styles.input} />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? t('patient_login.submitting') : t('patient_login.submit')}
          </button>
        </form>

        <p style={{ fontSize: 13, color: colors.textMuted, marginTop: 16, textAlign: 'center' }}>
          {t('patient_login.new_patient')} <Link to="/patient/signup" style={{ color: colors.accentDark, fontWeight: 600 }}>{t('patient_login.sign_up')}</Link>
        </p>
        <p style={{ fontSize: 12, color: colors.textLight, marginTop: 8, textAlign: 'center' }}>
          {t('patient_login.demo')} <code style={styles.code}>eric.test@example.com</code> / <code style={styles.code}>patient123</code>
        </p>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 60, background: colors.bg, minHeight: '100vh' },
  card: { background: colors.bgCard, padding: 32, borderRadius: radius.lg, boxShadow: shadows.lg, width: 380, border: `1px solid ${colors.borderLight}` },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.accentDark, textDecoration: 'none', marginBottom: 16, fontWeight: 500 },
  field: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: colors.text },
  input: { width: '100%', padding: '10px 14px', fontSize: 14, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.bgCard, color: colors.text, boxSizing: 'border-box', transition: transitions.base, outline: 'none' },
  error: { background: `${colors.risk.HIGH}15`, color: colors.risk.HIGH, padding: '8px 12px', borderRadius: radius.sm, fontSize: 13, marginBottom: 12, border: `1px solid ${colors.risk.HIGH}30` },
  button: { width: '100%', padding: '11px', background: colors.accentDark, color: '#fff', border: 'none', borderRadius: radius.md, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: transitions.base },
  code: { background: colors.bgSubtle, color: colors.text, padding: '2px 6px', borderRadius: radius.sm, fontSize: 11 },
};
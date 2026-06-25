import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { colors, shadows, radius, transitions } from '../theme';

const API = 'http://localhost:3000/api/v1';

export default function PatientSignup({ onSignup }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '', email: '', password: '', date_of_birth: '', phone: '', gender: 'Male'
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const update = (field, value) => setForm({ ...form, [field]: value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/patient-auth/signup`, form);
      const { token, patient } = res.data;
      localStorage.setItem('ecg_patient_token', token);
      localStorage.setItem('ecg_patient', JSON.stringify(patient));
      if (onSignup) onSignup(token, patient);
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
        <h2 style={{ marginTop: 0, color: colors.accentDark }}>{t('patient_signup.title')}</h2>
        <p style={{ color: colors.textMuted, fontSize: 13 }}>{t('patient_signup.subtitle')}</p>

        <Link to="/" style={styles.backLink}>{t('nav.back_home')}</Link>

        <form onSubmit={handleSubmit}>
          <div style={styles.row}>
            <Field label={t('patient_signup.name')} value={form.name} onChange={v => update('name', v)} required />
          </div>
          <div style={styles.row}>
            <Field label={t('patient_signup.email')} type="email" value={form.email} onChange={v => update('email', v)} required />
          </div>
          <div style={styles.row}>
            <Field label={t('patient_signup.password')} type="password" value={form.password} onChange={v => update('password', v)} required />
          </div>
          <div style={styles.row}>
            <Field label={t('patient_signup.dob')} type="date" value={form.date_of_birth} onChange={v => update('date_of_birth', v)} />
          </div>
          <div style={styles.row}>
            <Field label={t('patient_signup.phone')} value={form.phone} onChange={v => update('phone', v)} />
          </div>
          <div style={styles.row}>
            <label style={styles.label}>{t('patient_signup.gender')}</label>
            <select value={form.gender} onChange={e => update('gender', e.target.value)} style={styles.input}>
              <option value="Male">{t('patient_signup.gender_male')}</option>
              <option value="Female">{t('patient_signup.gender_female')}</option>
              <option value="Other">{t('patient_signup.gender_other')}</option>
            </select>
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? t('patient_signup.submitting') : t('patient_signup.submit')}
          </button>
        </form>

        <p style={{ fontSize: 13, color: colors.textMuted, marginTop: 16, textAlign: 'center' }}>
          {t('patient_signup.already_registered')} <Link to="/patient/login" style={{ color: colors.accentDark, fontWeight: 600 }}>{t('patient_signup.log_in')}</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <>
      <label style={styles.label}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required} style={styles.input} />
    </>
  );
}

const styles = {
  wrapper: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 40, background: colors.bg, minHeight: '100vh' },
  card: { background: colors.bgCard, padding: 32, borderRadius: radius.lg, boxShadow: shadows.lg, width: 440, border: `1px solid ${colors.borderLight}` },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.accentDark, textDecoration: 'none', marginBottom: 16, fontWeight: 500 },
  row: { marginBottom: 14 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: colors.text },
  input: { width: '100%', padding: '10px 14px', fontSize: 14, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.bgCard, color: colors.text, boxSizing: 'border-box', transition: transitions.base, outline: 'none' },
  error: { background: `${colors.risk.HIGH}15`, color: colors.risk.HIGH, padding: '8px 12px', borderRadius: radius.sm, fontSize: 13, marginBottom: 12, border: `1px solid ${colors.risk.HIGH}30` },
  button: { width: '100%', padding: '11px', background: colors.accentDark, color: '#fff', border: 'none', borderRadius: radius.md, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: transitions.base },
};
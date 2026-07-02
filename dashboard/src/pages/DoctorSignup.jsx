import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { colors, shadows, radius, transitions } from '../theme';

import { API } from '../config';

export default function DoctorSignup({ onSignup }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    specialty: 'Cardiologie',
    phone: '',
    hospital_code: '',
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
      const res = await axios.post(`${API}/auth/signup`, form);
      const { token, doctor } = res.data;
      localStorage.setItem('ecg_token', token);
      localStorage.setItem('ecg_doctor', JSON.stringify(doctor));
      if (onSignup) onSignup(token, doctor);
      navigate('/patients');
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={{ marginTop: 0, color: colors.primary }}>Doctor Registration</h2>
        <p style={{ color: colors.textMuted, fontSize: 13 }}>
          Create your doctor account. You will need the hospital invite code provided by your administration.
        </p>

        <Link to="/" style={styles.backLink}>← Back to home</Link>

        <form onSubmit={handleSubmit}>
          <Field label="Full Name" value={form.name} onChange={v => update('name', v)} required />
          <Field label="Professional Email" type="email" value={form.email} onChange={v => update('email', v)} required />
          <Field label="Password (min 6 chars)" type="password" value={form.password} onChange={v => update('password', v)} required />

          <label style={styles.label}>Specialty</label>
          <select value={form.specialty} onChange={e => update('specialty', e.target.value)} style={styles.input}>
            <option>Cardiologie</option>
          </select>

          <Field label="Phone (e.g. 674036604)" value={form.phone} onChange={v => update('phone', v)} />

          <Field
            label="Hospital Invite Code"
            value={form.hospital_code}
            onChange={v => update('hospital_code', v)}
            required
            hint="Provided by your hospital administration. Contact them if you don't have one."
          />

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Creating account...' : 'Register as Doctor'}
          </button>
        </form>

        <p style={{ fontSize: 13, color: colors.textMuted, marginTop: 16, textAlign: 'center' }}>
          Already have a doctor account? <Link to="/login" style={{ color: colors.primary, fontWeight: 600 }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={styles.label}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        style={styles.input}
      />
      {hint && <div style={styles.hint}>{hint}</div>}
    </div>
  );
}

const styles = {
  wrapper: { display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 40, background: colors.bg, minHeight: '100vh' },
  card: { background: colors.bgCard, padding: 32, borderRadius: radius.lg, boxShadow: shadows.lg, width: 440, border: `1px solid ${colors.borderLight}` },
  backLink: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: colors.primary, textDecoration: 'none', marginBottom: 16, fontWeight: 500 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: colors.text },
  input: { width: '100%', padding: '10px 14px', fontSize: 14, border: `1px solid ${colors.border}`, borderRadius: radius.md, background: colors.bgCard, color: colors.text, boxSizing: 'border-box', transition: transitions.base, outline: 'none', marginBottom: 4 },
  hint: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  error: { background: `${colors.risk.HIGH}15`, color: colors.risk.HIGH, padding: '8px 12px', borderRadius: radius.sm, fontSize: 13, marginBottom: 12, border: `1px solid ${colors.risk.HIGH}30` },
  button: { width: '100%', padding: '11px', background: colors.primary, color: '#fff', border: 'none', borderRadius: radius.md, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: transitions.base, marginTop: 12 },
};
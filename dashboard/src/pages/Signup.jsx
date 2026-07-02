import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { colors, shadows, radius, transitions } from '../theme';

import { API } from '../config';

export default function Signup({ onDoctorSignup, onPatientSignup }) {
  const [tab, setTab] = useState('patient');
  const navigate = useNavigate();

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <h2 style={{ marginTop: 0, color: colors.primary }}>Create Account</h2>
        <p style={{ color: colors.textMuted, fontSize: 13, marginBottom: 20 }}>
          Choose your account type to get started.
        </p>

        <div style={styles.pillWrap}>
          <button
            type="button"
            onClick={() => setTab('patient')}
            style={tab === 'patient' ? styles.pillActive : styles.pillInactive}
          >
            As a Patient
          </button>
          <button
            type="button"
            onClick={() => setTab('doctor')}
            style={tab === 'doctor' ? styles.pillActive : styles.pillInactive}
          >
            As a Doctor
          </button>
        </div>

        {tab === 'patient'
          ? <PatientForm onPatientSignup={onPatientSignup} navigate={navigate} />
          : <DoctorForm onDoctorSignup={onDoctorSignup} navigate={navigate} />
        }

        <p style={{ fontSize: 13, color: colors.textMuted, marginTop: 20, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: colors.primary, fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function PatientForm({ onPatientSignup, navigate }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', date_of_birth: '', phone: '', gender: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/patient-auth/signup`, form);
      const { token, patient } = res.data;
      localStorage.setItem('ecg_patient_token', token);
      localStorage.setItem('ecg_patient', JSON.stringify(patient));
      if (onPatientSignup) onPatientSignup(token, patient);
      navigate('/patient/home');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Full Name">
        <input type="text" value={form.name} onChange={set('name')} required style={styles.input} />
      </Field>
      <Field label="Email">
        <input type="email" value={form.email} onChange={set('email')} required style={styles.input} />
      </Field>
      <Field label="Password">
        <input type="password" value={form.password} onChange={set('password')} required minLength={6} style={styles.input} />
      </Field>
      <Field label="Date of Birth">
        <input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} style={styles.input} />
      </Field>
      <Field label="Phone">
        <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+237…" style={styles.input} />
      </Field>
      <Field label="Gender">
        <select value={form.gender} onChange={set('gender')} style={styles.input}>
          <option value="">Select…</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </Field>
      {error && <div style={styles.error}>{error}</div>}
      <button type="submit" disabled={loading} style={styles.button}>
        {loading ? 'Creating account…' : 'Sign Up as Patient'}
      </button>
    </form>
  );
}

function DoctorForm({ onDoctorSignup, navigate }) {
  const [form, setForm] = useState({
    name: '', email: '', password: '', specialty: 'Cardiologie', phone: '', hospital_code: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/signup`, form);
      const { token, doctor } = res.data;
      localStorage.setItem('ecg_token', token);
      localStorage.setItem('ecg_doctor', JSON.stringify(doctor));
      if (onDoctorSignup) onDoctorSignup(token, doctor);
      navigate('/patients');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Field label="Full Name">
        <input type="text" value={form.name} onChange={set('name')} required style={styles.input} />
      </Field>
      <Field label="Professional Email">
        <input type="email" value={form.email} onChange={set('email')} required style={styles.input} />
      </Field>
      <Field label="Password">
        <input type="password" value={form.password} onChange={set('password')} required minLength={6} style={styles.input} />
      </Field>
      <Field label="Specialty">
        <select value={form.specialty} onChange={set('specialty')} style={styles.input} disabled>
          <option value="Cardiologie">Cardiologie</option>
        </select>
      </Field>
      <Field label="Phone">
        <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+237…" style={styles.input} />
      </Field>
      <Field label="Hospital Invite Code">
        <div style={styles.passwordWrap}>
          <input
            type={showCode ? 'text' : 'password'}
            value={form.hospital_code}
            onChange={set('hospital_code')}
            required
            style={{ ...styles.input, paddingRight: 42 }}
          />
          <button
            type="button"
            onClick={() => setShowCode(v => !v)}
            style={styles.eyeBtn}
            title={showCode ? 'Hide code' : 'Show code'}
          >
            {showCode ? (
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
      </Field>
      {error && <div style={styles.error}>{error}</div>}
      <button type="submit" disabled={loading} style={styles.button}>
        {loading ? 'Creating account…' : 'Sign Up as Doctor'}
      </button>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
    paddingTop: 40, paddingBottom: 40, background: colors.bg, minHeight: '100vh',
  },
  card: {
    background: colors.bgCard, padding: 32, borderRadius: radius.lg,
    boxShadow: shadows.lg, width: 420, border: `1px solid ${colors.borderLight}`,
  },
  pillWrap: {
    display: 'flex', background: colors.bgSubtle, borderRadius: radius.full,
    padding: 4, marginBottom: 24, gap: 4,
  },
  pillActive: {
    flex: 1, padding: '8px 0', background: colors.primary, color: '#fff',
    border: 'none', borderRadius: radius.full, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: transitions.base,
  },
  pillInactive: {
    flex: 1, padding: '8px 0', background: 'transparent', color: colors.textMuted,
    border: 'none', borderRadius: radius.full, fontSize: 13, fontWeight: 500,
    cursor: 'pointer', transition: transitions.base,
  },
  field: { marginBottom: 14 },
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
    width: '100%', padding: '11px', background: colors.primary,
    color: '#fff', border: 'none', borderRadius: radius.md,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    transition: transitions.base, marginTop: 4,
  },
};

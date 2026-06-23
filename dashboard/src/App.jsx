import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import PatientList from './pages/PatientList';
import PatientDetail from './pages/PatientDetail';
import Login from './pages/Login';
import Alerts from './pages/Alerts';
import Home from './pages/Home';
import PatientSignup from './pages/PatientSignup';
import PatientLogin from './pages/PatientLogin';
import PatientHome from './pages/PatientHome';
import { colors, fonts, shadows, radius, transitions } from './theme';
import { useTheme } from './ThemeContext';

function setupAxiosAuth(token) {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
}
setupAxiosAuth(localStorage.getItem('ecg_token'));
// Global interceptor: auto-logout on expired/invalid tokens
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && error.response?.data?.error?.includes('expired')) {
      // Clear all auth state and redirect to login
      localStorage.removeItem('ecg_token');
      localStorage.removeItem('ecg_doctor');
      localStorage.removeItem('ecg_patient_token');
      localStorage.removeItem('ecg_patient');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

function NavItem({ to, children }) {
  const location = useLocation();
  const active = location.pathname.startsWith(to);
  return (
    <Link to={to} style={{
      color: active ? colors.primary : colors.textMuted,
      textDecoration: 'none',
      padding: '16px 20px',
      fontSize: 14,
      fontWeight: 600,
      borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
      transition: transitions.base,
      display: 'inline-block',
    }}>
      {children}
    </Link>
  );
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('ecg_token'));
  const [doctor, setDoctor] = useState(() => {
    const stored = localStorage.getItem('ecg_doctor');
    return stored ? JSON.parse(stored) : null;
  });

  const [patientToken, setPatientToken] = useState(localStorage.getItem('ecg_patient_token'));
  const [patient, setPatient] = useState(() => {
    const stored = localStorage.getItem('ecg_patient');
    return stored ? JSON.parse(stored) : null;
  });

  const { mode, toggleMode } = useTheme();

  useEffect(() => { setupAxiosAuth(token); }, [token]);

  const handleDoctorLogin = (newToken, newDoctor) => {
    setToken(newToken);
    setDoctor(newDoctor);
  };
  const handleDoctorLogout = () => {
    localStorage.removeItem('ecg_token');
    localStorage.removeItem('ecg_doctor');
    setToken(null);
    setDoctor(null);
  };

  const handlePatientLogin = (newToken, newPatient) => {
    setPatientToken(newToken);
    setPatient(newPatient);
  };
  const handlePatientLogout = () => {
    localStorage.removeItem('ecg_patient_token');
    localStorage.removeItem('ecg_patient');
    setPatientToken(null);
    setPatient(null);
  };

  const isDoctor = !!token;
  const isPatient = !!patientToken;

  return (
    <BrowserRouter>
      <div style={styles.container}>
        {isDoctor && (
          <>
            <header style={styles.header}>
              <div>
                <h1 style={styles.title}>ECG AI Platform — Doctor Dashboard</h1>
                <p style={styles.subtitle}>Hospital Integration Edition · IUC B.Tech Final Project</p>
              </div>
              <div style={styles.headerRight}>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  {doctor?.name} · {doctor?.specialty}
                </div>
                <button onClick={toggleMode} style={styles.themeBtn} title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                  {mode === 'dark' ? '☀️' : '🌙'}
                </button>
                <button onClick={handleDoctorLogout} style={styles.logoutBtn}>Logout</button>
              </div>
            </header>
            <nav style={styles.nav}>
              <NavItem to="/patients">Patients</NavItem>
              <NavItem to="/alerts">Alerts</NavItem>
            </nav>
          </>
        )}

        {isPatient && (
          <header style={{ ...styles.header, background: `linear-gradient(135deg, ${colors.accentDark} 0%, ${colors.accent} 100%)` }}>
            <div>
              <h1 style={styles.title}>ECG AI Platform — Patient Portal</h1>
              <p style={styles.subtitle}>Your personal cardiac analysis dashboard</p>
            </div>
            <div style={styles.headerRight}>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{patient?.name}</div>
              <button onClick={toggleMode} style={styles.themeBtn} title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                {mode === 'dark' ? '☀️' : '🌙'}
              </button>
              <button onClick={handlePatientLogout} style={styles.logoutBtn}>Logout</button>
            </div>
          </header>
        )}

        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />

          {/* Doctor */}
          <Route path="/login" element={
            isDoctor ? <Navigate to="/patients" /> : <Login onLogin={handleDoctorLogin} />
          } />
          <Route path="/patients" element={
            isDoctor ? <main style={styles.main}><PatientList /></main> : <Navigate to="/login" />
          } />
          <Route path="/patients/:id" element={
            isDoctor ? <main style={styles.main}><PatientDetail /></main> : <Navigate to="/login" />
          } />
          <Route path="/alerts" element={
            isDoctor ? <main style={styles.main}><Alerts /></main> : <Navigate to="/login" />
          } />

          {/* Patient */}
          <Route path="/patient/signup" element={
            isPatient ? <Navigate to="/patient/home" /> : <PatientSignup onSignup={handlePatientLogin} />
          } />
          <Route path="/patient/login" element={
            isPatient ? <Navigate to="/patient/home" /> : <PatientLogin onLogin={handlePatientLogin} />
          } />
          <Route path="/patient/home" element={
            isPatient ? <PatientHome /> : <Navigate to="/patient/login" />
          } />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

const styles = {
  container: {
    fontFamily: fonts.sans,
    minHeight: '100vh',
    background: colors.bg,
    color: colors.text,
  },
  header: {
    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
    color: colors.white,
    padding: '20px 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: shadows.md,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: -0.3,
  },
  subtitle: {
    margin: '4px 0 0 0',
    fontSize: 12,
    opacity: 0.85,
    fontWeight: 500,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  themeBtn: {
    background: 'rgba(255,255,255,0.12)',
    color: colors.white,
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: radius.md,
    width: 36,
    height: 36,
    cursor: 'pointer',
    fontSize: 16,
    transition: transitions.base,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    background: 'rgba(255,255,255,0.12)',
    color: colors.white,
    border: '1px solid rgba(255,255,255,0.25)',
    borderRadius: radius.md,
    padding: '8px 18px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    transition: transitions.base,
  },
  nav: {
    background: colors.bgCard,
    borderBottom: `1px solid ${colors.border}`,
    padding: '0 40px',
    display: 'flex',
    gap: 4,
  },
  main: {
    padding: '32px 40px',
    maxWidth: 1400,
    margin: '0 auto',
    animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  },
};

export default App;
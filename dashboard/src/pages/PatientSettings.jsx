import { useState, useEffect } from 'react';
import axios from 'axios';
import { colors, shadows, radius, transitions } from '../theme';
import { useTranslation } from 'react-i18next';

const API = 'http://localhost:3000/api/v1';

export default function PatientSettings() {
  const { t } = useTranslation();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  // Profile form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);

  // Password form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Load patient data
  useEffect(() => {
    const token = localStorage.getItem('ecg_patient_token');
    axios
      .get(`${API}/patient-auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setPatient(res.data.patient);
        setName(res.data.patient.name);
        setEmail(res.data.patient.email);
        setPhone(res.data.patient.phone || '');
        setDateOfBirth(res.data.patient.date_of_birth || '');
        if (res.data.patient.profile_picture) {
          setProfilePicPreview(res.data.patient.profile_picture);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.response?.data?.error || err.message);
        setLoading(false);
      });
  }, []);

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePic(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePicPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const token = localStorage.getItem('ecg_patient_token');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('phone', phone);
    formData.append('date_of_birth', dateOfBirth);
    if (profilePic) {
      formData.append('profile_picture', profilePic);
    }

    try {
      const response = await axios.put(
        `${API}/patient-auth/profile`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      setPatient(response.data.patient);
      setSuccess(t('settings.profile_updated') || 'Profile updated successfully!');
      setProfilePic(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t('settings.password_mismatch') || 'Passwords do not match!');
      return;
    }

    setPasswordLoading(true);
    setError(null);
    setSuccess(null);

    const token = localStorage.getItem('ecg_patient_token');
    try {
      await axios.post(
        `${API}/patient-auth/change-password`,
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setSuccess(t('settings.password_changed') || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <p style={{ color: colors.textMuted }}>{t('common.loading') || 'Loading...'}</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>{t('settings.title') || 'Settings'}</h2>
        <p style={styles.subtitle}>{t('settings.subtitle') || 'Manage your account and preferences'}</p>
      </div>

      {error && <div style={styles.alert.error}>{error}</div>}
      {success && <div style={styles.alert.success}>{success}</div>}

      <div style={styles.tabsContainer}>
        <button
          style={{
            ...styles.tabButton,
            borderBottomColor: activeTab === 'profile' ? colors.primary : 'transparent',
            color: activeTab === 'profile' ? colors.primary : colors.textMuted,
          }}
          onClick={() => setActiveTab('profile')}
        >
          {t('settings.tab_profile') || 'Profile'}
        </button>
        <button
          style={{
            ...styles.tabButton,
            borderBottomColor: activeTab === 'password' ? colors.primary : 'transparent',
            color: activeTab === 'password' ? colors.primary : colors.textMuted,
          }}
          onClick={() => setActiveTab('password')}
        >
          {t('settings.tab_security') || 'Security'}
        </button>
      </div>

      <div style={styles.contentArea}>
        {activeTab === 'profile' && (
          <form onSubmit={handleUpdateProfile} style={styles.form}>
            {/* Profile Picture Section */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t('settings.profile_picture') || 'Profile Picture'}</h3>
              <div style={styles.picContainer}>
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: profilePicPreview
                      ? `url(${profilePicPreview})`
                      : colors.bgSubtle,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: `3px solid ${colors.borderLight}`,
                    marginBottom: 16,
                  }}
                />
                <label style={styles.uploadLabel}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePicChange}
                    style={{ display: 'none' }}
                  />
                  <span style={styles.uploadButton}>{t('settings.upload_picture') || 'Upload Picture'}</span>
                </label>
              </div>
            </div>

            {/* Profile Information */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t('settings.personal_info') || 'Personal Information'}</h3>
              <div style={styles.grid}>
                <div style={styles.field}>
                  <label style={styles.label}>{t('settings.field_name') || 'Full Name'}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={styles.input}
                    placeholder="John Doe"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>{t('settings.field_email') || 'Email'}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={styles.input}
                    placeholder="you@example.com"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>{t('settings.field_phone') || 'Phone'}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    style={styles.input}
                    placeholder="+1234567890"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>{t('settings.field_dob') || 'Date of Birth'}</label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>

            <button type="submit" style={styles.submitButton} disabled={loading}>
              {loading ? (t('common.saving') || 'Saving...') : (t('settings.save_changes') || 'Save Changes')}
            </button>
          </form>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword} style={styles.form}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>{t('settings.change_password') || 'Change Password'}</h3>
              <div style={styles.field} style={{ maxWidth: '500px' }}>
                <label style={styles.label}>{t('settings.current_password') || 'Current Password'}</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.field} style={{ maxWidth: '500px' }}>
                <label style={styles.label}>{t('settings.new_password') || 'New Password'}</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.field} style={{ maxWidth: '500px' }}>
                <label style={styles.label}>{t('settings.confirm_password') || 'Confirm Password'}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>
            </div>

            <button type="submit" style={styles.submitButton} disabled={passwordLoading}>
              {passwordLoading ? (t('common.updating') || 'Updating...') : (t('settings.change_password_btn') || 'Change Password')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '32px',
    maxWidth: '900px',
    margin: '0 auto',
    background: colors.bg,
    minHeight: 'calc(100vh - 100px)',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    color: colors.primary,
    margin: 0,
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    margin: '8px 0 0 0',
  },
  alert: {
    error: {
      background: `${colors.risk.HIGH}15`,
      color: colors.risk.HIGH,
      padding: 16,
      borderRadius: radius.md,
      marginBottom: 24,
      border: `1px solid ${colors.risk.HIGH}30`,
    },
    success: {
      background: '#d4edda',
      color: '#155724',
      padding: 16,
      borderRadius: radius.md,
      marginBottom: 24,
      border: '1px solid #c3e6cb',
    },
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: `1px solid ${colors.borderLight}`,
    marginBottom: 32,
  },
  tabButton: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '16px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: transitions.base,
    color: colors.textMuted,
  },
  contentArea: {
    animation: 'fadeIn 0.3s ease',
  },
  form: {
    background: colors.bgCard,
    padding: 32,
    borderRadius: radius.lg,
    boxShadow: shadows.sm,
    border: `1px solid ${colors.borderLight}`,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    color: colors.text,
    margin: '0 0 20px 0',
    fontWeight: 600,
  },
  picContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  uploadLabel: {
    cursor: 'pointer',
  },
  uploadButton: {
    background: colors.primary,
    color: '#fff',
    padding: '10px 20px',
    borderRadius: radius.md,
    fontWeight: 600,
    fontSize: 14,
    transition: transitions.base,
    display: 'inline-block',
    '&:hover': {
      background: colors.primaryDark,
    },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 24,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: colors.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    padding: '12px 14px',
    border: `1px solid ${colors.border}`,
    borderRadius: radius.md,
    fontSize: 14,
    background: colors.bgSubtle,
    color: colors.text,
    fontFamily: 'inherit',
    transition: transitions.base,
    outline: 'none',
    '&:focus': {
      borderColor: colors.primary,
      background: colors.bg,
    },
  },
  submitButton: {
    background: colors.primary,
    color: '#fff',
    padding: '12px 32px',
    borderRadius: radius.md,
    border: 'none',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: transitions.base,
    marginTop: 16,
  },
};

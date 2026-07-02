import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { colors, shadows, radius, transitions } from '../theme';
import { useTranslation } from 'react-i18next';

const API = `http://${window.location.hostname}:3000/api/v1/auth`;

export default function DoctorSettings() {
  const { t } = useTranslation();
  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ecg_token');
    axios.get(`${API}/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        setDoctor(res.data.doctor);
        setName(res.data.doctor.name);
        setEmail(res.data.doctor.email);
        setSpecialty(res.data.doctor.specialty || '');
        if (res.data.doctor.profile_picture) setProfilePicPreview(res.data.doctor.profile_picture);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoStream]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setVideoStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCapturing(true);
    } catch (err) {
      setError('Camera access denied or unavailable.');
    }
  };

  const stopCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setCapturing(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], 'doctor-profile.jpg', { type: 'image/jpeg' });
        setProfilePic(file);
        setProfilePicPreview(URL.createObjectURL(blob));
      }
    }, 'image/jpeg', 0.9);
  };

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfilePic(file);
      setProfilePicPreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const token = localStorage.getItem('ecg_token');
    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('specialty', specialty);
    if (profilePic) formData.append('profile_picture', profilePic);

    try {
      const res = await axios.put(`${API}/profile`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setDoctor(res.data.doctor);
      setSuccess('Profile updated successfully!');
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
      setError('Passwords do not match');
      return;
    }
    setPasswordLoading(true);
    setError(null);
    setSuccess(null);
    const token = localStorage.getItem('ecg_token');
    try {
      await axios.post(`${API}/change-password`, {
        current_password: currentPassword,
        new_password: newPassword,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Password changed successfully!');
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

  if (loading) return <div style={styles.container}><p style={{ color: colors.textMuted }}>Loading doctor settings...</p></div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Doctor Settings</h2>
        <p style={styles.subtitle}>Manage your profile, webcam photo, and security settings.</p>
      </div>
      {error && <div style={styles.alert.error}>{error}</div>}
      {success && <div style={styles.alert.success}>{success}</div>}

      <div style={styles.tabsContainer}>
        <button
          style={{ ...styles.tabButton, borderBottomColor: activeTab === 'profile' ? colors.primary : 'transparent', color: activeTab === 'profile' ? colors.primary : colors.textMuted }}
          onClick={() => setActiveTab('profile')}
        >Profile</button>
        <button
          style={{ ...styles.tabButton, borderBottomColor: activeTab === 'security' ? colors.primary : 'transparent', color: activeTab === 'security' ? colors.primary : colors.textMuted }}
          onClick={() => setActiveTab('security')}
        >Security</button>
      </div>

      <div style={styles.contentArea}>
        {activeTab === 'profile' && (
          <form onSubmit={handleUpdateProfile} style={styles.form}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Profile Picture</h3>
              <div style={styles.picContainer}>
                <div style={{ ...styles.profilePreview, backgroundImage: profilePicPreview ? `url(${profilePicPreview})` : 'none' }}>
                  {!profilePicPreview && <span style={styles.previewText}>No photo</span>}
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label style={styles.uploadLabel}>
                    <input type="file" accept="image/*" onChange={handleProfilePicChange} style={{ display: 'none' }} />
                    <span style={styles.uploadButton}>Upload Picture</span>
                  </label>
                  {!capturing ? (
                    <button type="button" style={styles.cameraButton} onClick={startCamera}>Use Webcam</button>
                  ) : (
                    <button type="button" style={styles.cameraButton} onClick={capturePhoto}>Capture Photo</button>
                  )}
                  {capturing && <button type="button" style={styles.cancelButton} onClick={stopCamera}>Stop Camera</button>}
                </div>
              </div>
              {capturing && (
                <div style={styles.cameraWrapper}>
                  <video ref={videoRef} autoPlay muted playsInline style={styles.video} />
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>
              )}
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Personal Information</h3>
              <div style={styles.grid}>
                <div style={styles.field}>
                  <label style={styles.label}>Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} style={styles.input} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={styles.input} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Specialty</label>
                  <input value={specialty} onChange={e => setSpecialty(e.target.value)} style={styles.input} />
                </div>
              </div>
            </div>

            <button type="submit" style={styles.submitButton} disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</button>
          </form>
        )}

        {activeTab === 'security' && (
          <form onSubmit={handleChangePassword} style={styles.form}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Security</h3>
              <div style={styles.field}>
                <label style={styles.label}>Current Password</label>
                <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={styles.input} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={styles.input} required />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={styles.input} required />
              </div>
            </div>
            <button type="submit" style={styles.submitButton} disabled={passwordLoading}>{passwordLoading ? 'Updating...' : 'Change Password'}</button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: 32, maxWidth: 940, margin: '0 auto', background: colors.bg, minHeight: 'calc(100vh - 100px)' },
  header: { marginBottom: 28 },
  title: { fontSize: 28, color: colors.primary, margin: 0, fontWeight: 700 },
  subtitle: { marginTop: 8, fontSize: 14, color: colors.textMuted },
  alert: { error: { background: `${colors.risk.HIGH}15`, color: colors.risk.HIGH, padding: 16, borderRadius: radius.md, border: `1px solid ${colors.risk.HIGH}30`, marginBottom: 24 }, success: { background: '#d4edda', color: '#155724', padding: 16, borderRadius: radius.md, border: '1px solid #c3e6cb', marginBottom: 24 } },
  tabsContainer: { display: 'flex', borderBottom: `1px solid ${colors.borderLight}`, marginBottom: 28 },
  tabButton: { background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '14px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: transitions.base, color: colors.textMuted },
  contentArea: { animation: 'fadeIn 0.3s ease' },
  form: { background: colors.bgCard, padding: 28, borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 18, color: colors.text, margin: '0 0 18px 0', fontWeight: 700 },
  picContainer: { display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' },
  profilePreview: { width: 130, height: 130, borderRadius: '50%', background: colors.bgSubtle, backgroundSize: 'cover', backgroundPosition: 'center', border: `3px solid ${colors.borderLight}`, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  previewText: { color: colors.textMuted, fontSize: 12 },
  uploadLabel: { cursor: 'pointer' },
  uploadButton: { background: colors.primary, color: '#fff', padding: '10px 18px', borderRadius: radius.md, fontWeight: 600, fontSize: 14, transition: transitions.base, border: 'none', cursor: 'pointer' },
  cameraButton: { background: colors.accent, color: '#fff', padding: '10px 18px', borderRadius: radius.md, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' },
  cancelButton: { background: '#f8d7da', color: colors.risk.HIGH, padding: '10px 18px', borderRadius: radius.md, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' },
  cameraWrapper: { marginTop: 18, borderRadius: radius.lg, overflow: 'hidden', border: `1px solid ${colors.borderLight}`, maxWidth: 600 },
  video: { width: '100%', display: 'block' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 },
  field: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: 13, fontWeight: 700, marginBottom: 8, color: colors.text },
  input: { padding: '12px 14px', borderRadius: radius.md, border: `1px solid ${colors.border}`, background: colors.bgSubtle, color: colors.text, fontSize: 14, transition: transitions.base, outline: 'none' },
  submitButton: { background: colors.primary, color: '#fff', padding: '12px 28px', borderRadius: radius.md, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 },
};

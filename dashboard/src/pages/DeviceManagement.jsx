import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colors, shadows, radius, transitions } from '../theme';

const API = `http://${window.location.hostname}:3000/api/v1/ecg`;

// Toast notification
function Toast({ message, show }) {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      background: colors.risk.LOW,
      color: colors.white,
      padding: '12px 20px',
      borderRadius: radius.md,
      boxShadow: shadows.lg,
      fontSize: 14,
      fontWeight: 600,
      zIndex: 9999,
      animation: 'slideIn 0.3s ease',
    }}>
      {message}
    </div>
  );
}

// Modal for selecting test rhythm
function RhythmModal({ show, onClose, onSelect, t }) {
  if (!show) return null;
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9998,
    }} onClick={onClose}>
      <div style={{
        background: colors.bgCard,
        borderRadius: radius.lg,
        boxShadow: shadows.xl,
        padding: '40px',
        maxWidth: 600,
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: 20, fontWeight: 700, color: colors.text }}>
          {t('devices.generate_test_ecg')}
        </h2>
        <p style={{ margin: '0 0 30px 0', fontSize: 14, color: colors.textMuted }}>
          {t('devices.select_rhythm_prompt') || 'Select a rhythm type to generate a simulated ECG signal and test the analysis pipeline:'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { key: 'normal', label: t('devices.rhythm_normal'), icon: '💚' },
            { key: 'afib', label: t('devices.rhythm_afib'), icon: '⚠️' },
            { key: 'pvc', label: t('devices.rhythm_pvc'), icon: '❤️' },
            { key: 'brady', label: t('devices.rhythm_brady'), icon: '🐢' },
          ].map(rhythm => (
            <button
              key={rhythm.key}
              onClick={() => onSelect(rhythm.key)}
              style={{
                padding: '16px',
                border: `1px solid ${colors.border}`,
                background: colors.bgCard,
                color: colors.text,
                borderRadius: radius.md,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                transition: transitions.base,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = colors.bgSubtle;
                e.currentTarget.style.borderColor = colors.primary;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = colors.bgCard;
                e.currentTarget.style.borderColor = colors.border;
              }}
            >
              <span style={{ fontSize: 18 }}>{rhythm.icon}</span>
              <span>{rhythm.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 20,
            padding: '10px 20px',
            background: colors.textMuted,
            color: colors.white,
            border: 'none',
            borderRadius: radius.md,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            transition: transitions.base,
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Device card component
function DeviceCard({ icon, name, type, status, onConnect, disabled, t }) {
  return (
    <div style={{
      ...card.base,
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: 12,
    }}>
      <div style={{ fontSize: 32, textAlign: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
          {name}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: radius.full,
            background: colors.primaryLight,
            color: colors.primary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            {type}
          </span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 10px',
            borderRadius: radius.full,
            background: colors.bgSubtle,
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}>
            {status}
          </span>
        </div>
        <button
          disabled={disabled}
          title={disabled ? t('devices.requires_hardware') : ''}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: disabled ? colors.textLight : colors.primary,
            color: colors.white,
            border: 'none',
            borderRadius: radius.md,
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: 13,
            fontWeight: 600,
            transition: transitions.base,
            opacity: disabled ? 0.5 : 1,
          }}
          onMouseEnter={e => !disabled && (e.currentTarget.style.background = colors.primaryDark)}
          onMouseLeave={e => !disabled && (e.currentTarget.style.background = colors.primary)}
          onClick={onConnect}
        >
          {disabled ? t('devices.requires_hardware') : 'Connect'}
        </button>
      </div>
    </div>
  );
}

export default function DeviceManagement() {
  const { t } = useTranslation();
  const [showRhythmModal, setShowRhythmModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);

  const handleGenerateTestECG = (rhythmType) => {
    setShowRhythmModal(false);

    // Show placeholder message
    setToastMessage(t('devices.simulator_actions_placeholder') || 'Simulator actions available in future release');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);

    // Optional: Attempt to call the upload endpoint with simulated data
    // This will fail gracefully if backend is unavailable
    try {
      const sampleRhythmData = {
        'normal': Array(360).fill(0).map((_, i) => Math.sin(i * 0.05) * 10 + 5),
        'afib': Array(360).fill(0).map((_, i) => (Math.random() - 0.5) * 20 + 5),
        'pvc': Array(360).fill(0).map((_, i) => Math.sin(i * 0.08) * 12 + (i === 180 ? 30 : 0)),
        'brady': Array(360).fill(0).map((_, i) => Math.sin(i * 0.03) * 8 + 5),
      };

      // Silent attempt — don't block UI or show errors
      // const uploadData = {
      //   patient_name: 'Simulator Test',
      //   hospital_name: 'Device Management Preview',
      //   patient_dob: '1990-01-01',
      //   ecg_waveform: sampleRhythmData[rhythmType] || sampleRhythmData.normal,
      // };
      // axios.post(`${API}/upload`, uploadData)
      //   .catch(() => {}); // Silent fail
    } catch (e) {
      // Silent error
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: '0 0 8px 0', fontSize: 32, fontWeight: 700, color: colors.text }}>
          {t('devices.title')}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: colors.textMuted }}>
          {t('devices.subtitle')}
        </p>
      </div>

      {/* Preview Mode Banner */}
      <div style={{
        padding: '16px 20px',
        background: '#FEF3C7',
        borderLeft: `4px solid #F59E0B`,
        borderRadius: radius.md,
        marginBottom: 32,
        color: '#92400E',
        fontSize: 13,
        lineHeight: 1.6,
        boxShadow: `0 1px 3px rgba(0,0,0,0.05)`,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>🔬 {t('devices.preview_mode_banner_title')}</div>
        <p style={{ margin: 0 }}>
          {t('devices.preview_mode_banner')}
        </p>
      </div>

      {/* Device Status Section */}
      <div style={{ ...card.base, marginBottom: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 20 }}>
          {t('devices.status_title')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              Connection Status
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: colors.textLight,
              }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
                {t('devices.no_hardware')}
              </span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              {t('devices.active_source')}
            </div>
            <div style={{
              display: 'inline-block',
              padding: '6px 12px',
              background: colors.bgSubtle,
              borderRadius: radius.full,
              fontSize: 13,
              fontWeight: 600,
              color: colors.text,
            }}>
              {t('devices.active_source_badge')}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              {t('devices.sample_rate')}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>360 Hz</div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
              {t('devices.standard_compliance')}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
              SCP-ECG · HL7
            </div>
          </div>
        </div>
      </div>

      {/* Supported Devices Section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 16 }}>
          {t('devices.supported_devices_title')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          <DeviceCard
            icon="🩺"
            name="AliveCor KardiaMobile 6L"
            type="BLE"
            status={t('devices.awaiting_hardware')}
            disabled={true}
            t={t}
          />
          <DeviceCard
            icon="🏥"
            name="Nihon Kohden ECG-1250"
            type="USB"
            status={t('devices.awaiting_hardware')}
            disabled={true}
            t={t}
          />
          <DeviceCard
            icon="🔗"
            name="BioSemi ActiveTwo"
            type="USB"
            status={t('devices.awaiting_hardware')}
            disabled={true}
            t={t}
          />
          <DeviceCard
            icon="⚙️"
            name="Custom SCP-ECG Device"
            type="BLE/USB"
            status={t('devices.awaiting_hardware')}
            disabled={true}
            t={t}
          />
        </div>
      </div>

      {/* Device Abstraction Layer Section */}
      <div style={{ ...card.base, marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 28 }}>⚙️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 12 }}>
              {t('devices.abstraction_layer_title')}
            </div>
            <p style={{ margin: '0', fontSize: 13, color: colors.textMuted, lineHeight: 1.6 }}>
              {t('devices.abstraction_explanation')}
            </p>
          </div>
        </div>
      </div>

      {/* Simulator Actions Section */}
      <div style={{ ...card.base }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.text, marginBottom: 16 }}>
          {t('devices.simulator_actions_title')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 13, color: colors.textMuted }}>
            {t('devices.simulator_actions_description') || 'Test the analysis pipeline with synthetic ECG signals.'}
          </p>
          <button
            onClick={() => setShowRhythmModal(true)}
            style={{
              padding: '10px 20px',
              background: colors.primary,
              color: colors.white,
              border: 'none',
              borderRadius: radius.md,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              transition: transitions.base,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => e.currentTarget.style.background = colors.primaryDark}
            onMouseLeave={e => e.currentTarget.style.background = colors.primary}
          >
            {t('devices.generate_test_ecg')}
          </button>
        </div>
      </div>

      {/* Modals and Toasts */}
      <RhythmModal
        show={showRhythmModal}
        onClose={() => setShowRhythmModal(false)}
        onSelect={handleGenerateTestECG}
        t={t}
      />
      <Toast message={toastMessage} show={showToast} />

      <style>{`
        .fade-in {
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

const card = {
  base: {
    background: colors.bgCard,
    borderRadius: radius.lg,
    padding: '20px',
    boxShadow: shadows.sm,
    border: `1px solid ${colors.borderLight}`,
    transition: transitions.base,
  },
};

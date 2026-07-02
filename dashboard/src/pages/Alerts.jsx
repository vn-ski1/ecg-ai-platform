import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { colors, shadows, radius, transitions, riskColor } from '../theme';

const API = `http://${window.location.hostname}:3000/api/v1/ecg`;

export default function Alerts() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');

  const fetchAlerts = () => {
    setLoading(true);
    const token = localStorage.getItem('ecg_token');
    axios.get(`${API}/alerts`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => { setAlerts(res.data.alerts); setLoading(false); })
      .catch(err => { 
        console.error('API Error:', err);
        setError(err.response?.data?.error || err.message); 
        setLoading(false); 
      });
  };

  useEffect(() => { fetchAlerts(); }, []);

  const acknowledgeAlert = async (alertId) => {
    try {
      const token = localStorage.getItem('ecg_token');
      await axios.patch(`${API}/alerts/${alertId}/acknowledge`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAlerts();
    } catch (err) {
      alert('Failed to acknowledge: ' + err.message);
    }
  };

  if (loading) return <p style={{ color: colors.textMuted }}>{t('alerts.loading')}</p>;
  if (error) return <p style={{ color: colors.risk.HIGH }}>{t('alerts.error')}{error}</p>;

  const filtered = filter === 'ALL' ? alerts : alerts.filter(a => a.status === filter);
  const pendingCount = alerts.filter(a => a.status === 'Pending Resolution').length;
  const resolvedCount = alerts.filter(a => a.status === 'Resolved').length;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ margin: 0, color: colors.text }}>
          {t('alerts.title')} <span style={{ color: colors.risk.HIGH }}>({pendingCount} {t('alerts.pending')})</span>
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <FilterButton active={filter === 'ALL'} onClick={() => setFilter('ALL')}>
            {t('alerts.filter_all')} ({alerts.length})
          </FilterButton>
          <FilterButton active={filter === 'Pending Resolution'} onClick={() => setFilter('Pending Resolution')}>
            {t('alerts.filter_pending')} ({pendingCount})
          </FilterButton>
          <FilterButton active={filter === 'Resolved'} onClick={() => setFilter('Resolved')}>
            {t('alerts.filter_resolved')} ({resolvedCount})
          </FilterButton>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{
          background: colors.bgCard, padding: 40, textAlign: 'center',
          color: colors.textMuted, borderRadius: radius.lg,
          border: `1px solid ${colors.borderLight}`,
        }}>
          {t('alerts.no_alerts')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(a => (
            <div key={a.alert_id} style={{
              background: colors.bgCard,
              borderLeft: `5px solid ${riskColor(a.risk_level)}`,
              padding: 18,
              borderRadius: radius.md,
              boxShadow: shadows.sm,
              border: `1px solid ${colors.borderLight}`,
              borderLeftWidth: 5,
              borderLeftColor: riskColor(a.risk_level),
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>
                    {a.patient_name || t('alerts.unknown_patient')}
                  </div>
                  <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                    {t('alerts.rhythm')} <strong style={{ color: colors.text }}>{a.rhythm_class}</strong> ·
                    {t('alerts.risk_score')} <strong style={{ color: colors.text }}> {a.risk_score}/100</strong> ·
                    {t('alerts.doctor')} {a.doctor_name || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: colors.textLight, marginTop: 4 }}>
                    {new Date(a.created_at).toLocaleString()}
                    {a.resolved_at && ` · ${t('alerts.resolved_at')} ${new Date(a.resolved_at).toLocaleString()}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    background: riskColor(a.risk_level), color: '#fff',
                    padding: '4px 12px', borderRadius: radius.sm,
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {a.risk_level}
                  </span>
                  <span style={{
                    background: a.status === 'Resolved' ? `${colors.risk.LOW}20` : `${colors.risk.MODERATE}20`,
                    color: a.status === 'Resolved' ? colors.risk.LOW : colors.risk.MODERATE,
                    padding: '4px 12px', borderRadius: radius.sm,
                    fontSize: 12, fontWeight: 600,
                  }}>
                    {a.status}
                  </span>
                  <Link to={`/patients/${a.patient_id}`} style={{
                    background: colors.primary, color: '#fff', textDecoration: 'none',
                    padding: '6px 12px', borderRadius: radius.sm, fontSize: 13,
                  }}>{t('alerts.view_patient')}</Link>
                  {a.status !== 'Resolved' && (
                    <button onClick={() => acknowledgeAlert(a.alert_id)} style={{
                      background: colors.risk.LOW, color: '#fff',
                      border: 'none', padding: '6px 12px',
                      borderRadius: radius.sm, fontSize: 13, cursor: 'pointer',
                      fontWeight: 600,
                    }}>
                      {t('alerts.acknowledge')}
                    </button>
                  )}
                </div>
              </div>
              {a.message && (
                <div style={{ marginTop: 10, fontSize: 13, color: colors.textMuted, fontStyle: 'italic' }}>
                  "{a.message}"
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 14px',
      border: `1px solid ${active ? colors.primary : colors.border}`,
      background: active ? colors.primary : colors.bgCard,
      color: active ? '#fff' : colors.text,
      borderRadius: radius.md,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      transition: transitions.base,
    }}>
      {children}
    </button>
  );
}
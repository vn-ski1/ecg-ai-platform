import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { colors, shadows, radius, transitions, riskColor } from '../theme';

const API = 'http://localhost:3000/api/v1/ecg';

export default function PatientList() {
  const { t } = useTranslation();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('risk');

  useEffect(() => {
    axios.get(`${API}/patients`)
      .then(res => { setPatients(res.data.patients); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  const counts = useMemo(() => {
    const c = { ALL: patients.length, HIGH: 0, MODERATE: 0, LOW: 0, NONE: 0 };
    patients.forEach(p => {
      if (p.latest_risk_category) c[p.latest_risk_category]++;
      else c.NONE++;
    });
    return c;
  }, [patients]);

  const totalEcgs = useMemo(() => patients.filter(p => p.last_ecg_at).length, [patients]);

  const donutData = [
    { name: 'HIGH', value: counts.HIGH, color: '#e63946' },
    { name: 'MODERATE', value: counts.MODERATE, color: '#f59e0b' },
    { name: 'LOW', value: counts.LOW, color: '#10b981' },
    { name: 'No data', value: counts.NONE, color: '#94a3b8' },
  ].filter(d => d.value > 0);

  const visible = useMemo(() => {
    let list = patients.slice();
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(s));
    }
    if (riskFilter !== 'ALL') {
      list = list.filter(p => p.latest_risk_category === riskFilter);
    }
    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'risk') {
      const order = { HIGH: 0, MODERATE: 1, LOW: 2, null: 3, undefined: 3 };
      list.sort((a, b) => (order[a.latest_risk_category] ?? 3) - (order[b.latest_risk_category] ?? 3));
    } else if (sortBy === 'lastecg') {
      list.sort((a, b) => new Date(b.last_ecg_at || 0) - new Date(a.last_ecg_at || 0));
    }
    return list;
  }, [patients, search, riskFilter, sortBy]);

  if (loading) return <LoadingState text={t('patient_list.loading')} />;
  if (error) return <ErrorState message={t('patient_list.error') + error} />;

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <KpiCard
            label={t('patient_list.total_patients')}
            value={counts.ALL}
            sub={`${totalEcgs} ${t('patient_list.total_patients_sub')}`}
            color={colors.primary}
            icon="👥"
          />
          <KpiCard
            label={t('patient_list.high_risk')}
            value={counts.HIGH}
            sub={t('patient_list.high_risk_sub')}
            color={colors.risk.HIGH}
            icon="⚠️"
            pulse={counts.HIGH > 0}
          />
          <KpiCard
            label={t('patient_list.healthy')}
            value={counts.LOW}
            sub={t('patient_list.healthy_sub')}
            color={colors.risk.LOW}
            icon="💚"
          />
        </div>

        <div style={card.base}>
          <div style={card.label}>{t('patient_list.risk_distribution')}</div>
          {donutData.length > 0 ? (
            <div style={{ position: 'relative' }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={50} outerRadius={75} paddingAngle={2} strokeWidth={0}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: colors.text }}>{counts.ALL}</div>
                <div style={{ fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('patient_list.total')}</div>
              </div>
            </div>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: 13 }}>
              {t('patient_list.no_data')}
            </div>
          )}
        </div>
      </div>

      <div style={searchBar.container}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div style={searchBar.searchWrap}>
            <span style={searchBar.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder={t('patient_list.search_placeholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={searchBar.input}
            />
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <FilterChip active={riskFilter === 'ALL'} onClick={() => setRiskFilter('ALL')}>
              {t('patient_list.filter_all')} ({counts.ALL})
            </FilterChip>
            <FilterChip active={riskFilter === 'HIGH'} color={colors.risk.HIGH} onClick={() => setRiskFilter('HIGH')}>
              {t('patient_list.filter_high')} ({counts.HIGH})
            </FilterChip>
            <FilterChip active={riskFilter === 'MODERATE'} color={colors.risk.MODERATE} onClick={() => setRiskFilter('MODERATE')}>
              {t('patient_list.filter_moderate')} ({counts.MODERATE})
            </FilterChip>
            <FilterChip active={riskFilter === 'LOW'} color={colors.risk.LOW} onClick={() => setRiskFilter('LOW')}>
              {t('patient_list.filter_low')} ({counts.LOW})
            </FilterChip>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: colors.textMuted, fontWeight: 500 }}>{t('patient_list.sort_by')}</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={searchBar.select}>
            <option value="risk">{t('patient_list.sort_risk')}</option>
            <option value="name">{t('patient_list.sort_name')}</option>
            <option value="lastecg">{t('patient_list.sort_lastecg')}</option>
          </select>
        </div>
      </div>

      <div style={table.wrapper}>
        {visible.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: colors.textMuted }}>
            {t('patient_list.no_matches')}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }} className="tabular-nums">
            <thead>
              <tr style={table.headerRow}>
                <th style={table.th}>{t('patient_list.th_patient')}</th>
                <th style={table.th}>{t('patient_list.th_hospital')}</th>
                <th style={table.th}>{t('patient_list.th_doctor')}</th>
                <th style={table.th}>{t('patient_list.th_rhythm')}</th>
                <th style={table.th}>{t('patient_list.th_risk')}</th>
                <th style={table.th}>{t('patient_list.th_lastecg')}</th>
                <th style={{ ...table.th, width: 90 }}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p, idx) => (
                <PatientRow key={p.patient_id} patient={p} isLast={idx === visible.length - 1} t={t} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color, icon, pulse }) {
  return (
    <div style={{ ...card.base, position: 'relative', overflow: 'hidden', borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={card.label}>{label}</div>
          <div style={{ fontSize: 36, fontWeight: 700, color: colors.text, marginTop: 4, fontFeatureSettings: '"tnum" 1, "lnum" 1', lineHeight: 1 }} className={pulse ? 'pulse-soft' : ''}>
            {value}
          </div>
          <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 8 }}>{sub}</div>
        </div>
        <div style={{ fontSize: 24, opacity: 0.85 }}>{icon}</div>
      </div>
    </div>
  );
}

function FilterChip({ active, color, onClick, children }) {
  const activeColor = color || colors.primary;
  return (
    <button onClick={onClick} style={{
      padding: '7px 14px',
      border: `1px solid ${active ? activeColor : colors.border}`,
      background: active ? activeColor : colors.bgCard,
      color: active ? colors.white : colors.text,
      borderRadius: radius.full,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      transition: transitions.base,
    }}>
      {children}
    </button>
  );
}

function PatientRow({ patient: p, isLast, t }) {
  return (
    <tr style={{ borderBottom: isLast ? 'none' : `1px solid ${colors.borderLight}`, transition: transitions.base }}
      onMouseEnter={e => e.currentTarget.style.background = colors.bgSubtle}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <td style={table.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={avatar(p.name)} />
          <div>
            <div style={{ fontWeight: 600, color: colors.text }}>{p.name}</div>
            <div style={{ fontSize: 11, color: colors.textLight, marginTop: 2 }}>ID #{p.patient_id}</div>
          </div>
        </div>
      </td>
      <td style={table.td}><span style={{ color: colors.textMuted, fontSize: 13 }}>{p.hospital_name || '—'}</span></td>
      <td style={table.td}><span style={{ color: colors.textMuted, fontSize: 13 }}>{p.doctor_name || '—'}</span></td>
      <td style={table.td}>{p.latest_rhythm || <span style={{ color: colors.textLight }}>{t('patient_list.row_no_rhythm')}</span>}</td>
      <td style={table.td}>
        {p.latest_risk_category ? (
          <RiskBadge category={p.latest_risk_category} score={p.latest_risk_score} />
        ) : <span style={{ color: colors.textLight }}>—</span>}
      </td>
      <td style={{ ...table.td, color: colors.textMuted, fontSize: 13 }}>
        {p.last_ecg_at ? new Date(p.last_ecg_at).toLocaleDateString() : '—'}
      </td>
      <td style={table.td}>
        <Link to={`/patients/${p.patient_id}`} style={viewButton}>{t('patient_list.view')}</Link>
      </td>
    </tr>
  );
}

function RiskBadge({ category, score }) {
  const color = riskColor(category);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: `${color}15`, color: color,
      padding: '4px 10px', borderRadius: radius.full,
      fontSize: 12, fontWeight: 700,
      border: `1px solid ${color}30`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {category} · {score}
    </span>
  );
}

function LoadingState({ text }) {
  return (
    <div style={{ padding: 60, textAlign: 'center', color: colors.textMuted, fontSize: 14 }}>
      <div style={{ marginBottom: 12, fontSize: 24 }}>⏳</div>
      {text}
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div style={{ padding: 40, textAlign: 'center', background: '#fef2f2', color: colors.risk.HIGH, borderRadius: radius.md, border: `1px solid #fecaca` }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
      {message}
    </div>
  );
}

function avatar(name) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const hues = [184, 200, 220, 160, 190];
  const hue = hues[hash % hues.length];
  return {
    width: 36, height: 36, borderRadius: '50%',
    background: `linear-gradient(135deg, hsl(${hue}, 45%, 55%), hsl(${hue}, 55%, 40%))`,
    flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'white', fontWeight: 700, fontSize: 13,
  };
}

const card = {
  base: { background: colors.bgCard, padding: 20, borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` },
  label: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 },
};

const searchBar = {
  container: { display: 'flex', alignItems: 'center', gap: 16, background: colors.bgCard, padding: 16, borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}`, marginBottom: 20, flexWrap: 'wrap' },
  searchWrap: { position: 'relative', flex: '0 0 280px' },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.5 },
  input: { width: '100%', padding: '9px 14px 9px 38px', border: `1px solid ${colors.border}`, borderRadius: radius.md, fontSize: 14, background: colors.bgSubtle, color: colors.text, transition: transitions.base, outline: 'none' },
  select: { padding: '8px 12px', border: `1px solid ${colors.border}`, borderRadius: radius.md, fontSize: 13, background: colors.bgCard, color: colors.text, cursor: 'pointer', fontWeight: 500 },
};

const table = {
  wrapper: { background: colors.bgCard, borderRadius: radius.lg, boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}`, overflow: 'hidden' },
  headerRow: { background: colors.bgSubtle, borderBottom: `1px solid ${colors.border}` },
  th: { padding: '12px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { padding: '14px 18px', fontSize: 14, color: colors.text },
};

const viewButton = {
  background: colors.primary, color: colors.white, textDecoration: 'none',
  padding: '7px 14px', borderRadius: radius.md, fontSize: 12, fontWeight: 600,
  transition: transitions.base, display: 'inline-block',
};
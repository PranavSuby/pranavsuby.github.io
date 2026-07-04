import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ArrowLeft, Plus, Trash2, Camera, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { METRICS, logMetric, getMetricHistory, KG_PER_LB, CM_PER_IN } from '../utils/biometrics';
import { getAllProgressPhotos, saveProgressPhoto, deleteProgressPhoto } from '../db';
import { useBackClose } from '../ui';
import { compressImage } from '../utils/image';
import { todayStr } from '../utils/dates';
import { chartTooltip } from '../ui/chart';

// Convert a stored metric value (kg/cm/%) to the user's display unit.
function toDisplay(metric, value, weightUnit) {
  if (metric.kind === 'weight') return weightUnit === 'lbs' ? value / KG_PER_LB : value;
  if (metric.kind === 'len')    return weightUnit === 'lbs' ? value / CM_PER_IN : value; // imperial → inches
  return value;
}
function fromDisplay(metric, value, weightUnit) {
  if (metric.kind === 'weight') return weightUnit === 'lbs' ? value * KG_PER_LB : value;
  if (metric.kind === 'len')    return weightUnit === 'lbs' ? value * CM_PER_IN : value;
  return value;
}
function displayUnit(metric, weightUnit) {
  if (metric.kind === 'weight') return weightUnit === 'lbs' ? 'lbs' : 'kg';
  if (metric.kind === 'len')    return weightUnit === 'lbs' ? 'in' : 'cm';
  return metric.unit;
}
function round1(n) { return Math.round(n * 10) / 10; }

function xLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

export default function MeasuresView({ onBack }) {
  useBackClose(onBack);
  const { settings } = useApp();
  const wUnit = settings.units === 'lbs' ? 'lbs' : 'kg';

  const [activeType, setActiveType] = useState('weight_kg');
  const [history, setHistory] = useState([]);        // ascending for active metric
  const [latest, setLatest] = useState({});           // type → latest value (stored units)
  const [input, setInput] = useState('');
  const [photos, setPhotos] = useState([]);
  const [viewPhoto, setViewPhoto] = useState(null);
  const fileRef = useRef(null);
  const [busyPhoto, setBusyPhoto] = useState(false);

  const metric = METRICS.find(m => m.type === activeType) || METRICS[0];

  const loadActive = useCallback(async (type) => {
    const hist = await getMetricHistory(type);
    setHistory(hist);
  }, []);

  const loadLatest = useCallback(async () => {
    const entries = await Promise.all(METRICS.map(async m => {
      const hist = await getMetricHistory(m.type, 3650);
      return [m.type, hist.length ? hist[hist.length - 1].value : null];
    }));
    setLatest(Object.fromEntries(entries));
  }, []);

  useEffect(() => { loadActive(activeType); }, [activeType, loadActive]);
  useEffect(() => { loadLatest(); getAllProgressPhotos().then(setPhotos); }, [loadLatest]);

  async function handleLog() {
    const raw = parseFloat(input);
    if (isNaN(raw) || raw <= 0) return;
    await logMetric(activeType, fromDisplay(metric, raw, wUnit));
    setInput('');
    await Promise.all([loadActive(activeType), loadLatest()]);
  }

  async function handlePhotoPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusyPhoto(true);
    try {
      const dataUrl = await compressImage(file);
      await saveProgressPhoto({
        id: Date.now().toString(),
        date: todayStr(),
        dataUrl,
      });
      setPhotos(await getAllProgressPhotos());
    } catch {}
    setBusyPhoto(false);
  }

  async function handleDeletePhoto(id) {
    await deleteProgressPhoto(id);
    setPhotos(await getAllProgressPhotos());
    setViewPhoto(null);
  }

  const chartData = useMemo(
    () => history.map(h => ({ date: h.date, value: round1(toDisplay(metric, h.value, wUnit)) })),
    [history, metric, wUnit]
  );

  // Change since first reading in the loaded window.
  const delta = useMemo(() => {
    if (chartData.length < 2) return null;
    return round1(chartData[chartData.length - 1].value - chartData[0].value);
  }, [chartData]);

  const u = displayUnit(metric, wUnit);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 'calc(var(--safe-top) + 16px) 16px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer', display: 'flex' }}>
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)' }}>Measures</h1>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px calc(var(--nav-h) + 24px + var(--safe-bottom))' }}>
        {/* Metric chips */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, marginBottom: 16, WebkitOverflowScrolling: 'touch' }}>
          {METRICS.map(m => {
            const on = m.type === activeType;
            return (
              <button
                key={m.type}
                onClick={() => setActiveType(m.type)}
                style={{
                  flexShrink: 0, padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--accent)' : 'var(--bg2)',
                  color: on ? '#fff' : 'var(--text2)', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Active metric card */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{metric.label}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
                {latest[activeType] != null ? round1(toDisplay(metric, latest[activeType], wUnit)) : '—'}
                <span style={{ fontSize: 15, color: 'var(--text3)', fontWeight: 600, marginLeft: 4 }}>{u}</span>
              </div>
            </div>
            {delta != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700,
                color: delta > 0 ? '#F59E0B' : delta < 0 ? 'var(--pr-green)' : 'var(--text3)' }}>
                {delta > 0 ? <TrendingUp size={15} /> : delta < 0 ? <TrendingDown size={15} /> : <Minus size={15} />}
                {delta > 0 ? '+' : ''}{delta} {u}
              </div>
            )}
          </div>

          {chartData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tickFormatter={xLabel} tick={{ fontSize: 10, fill: 'var(--text3)' }}
                  axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(chartData.length / 4) - 1)} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} width={34} />
                <Tooltip contentStyle={chartTooltip.contentStyle} labelStyle={{ color: 'var(--text3)' }}
                  itemStyle={{ color: 'var(--text)' }} formatter={v => [`${v} ${u}`, metric.label]} />
                <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--accent)' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Log on 2+ days to see your trend.
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              type="number" inputMode="decimal" step="0.1"
              placeholder={`Today's ${metric.label.toLowerCase()} (${u})`}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLog()}
              style={{ flex: 1, padding: '11px 12px', background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--text)', fontSize: 16 }}
            />
            <button onClick={handleLog} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 18px',
              background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              <Plus size={16} /> Log
            </button>
          </div>
        </div>

        {/* Progress photos */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>Progress Photos</h2>
          <button onClick={() => fileRef.current?.click()} disabled={busyPhoto}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--bg3)',
              border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <Camera size={15} /> {busyPhoto ? 'Adding…' : 'Add'}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoPick} style={{ display: 'none' }} />

        {photos.length === 0 ? (
          <div style={{ background: 'var(--bg2)', border: '1px dashed var(--border)', borderRadius: 14, padding: '28px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            <Camera size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.6 }} />
            Snap a photo to track visual progress over time.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {photos.map(p => (
              <button key={p.id} onClick={() => setViewPhoto(p)}
                style={{ position: 'relative', aspectRatio: '3/4', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', padding: 0, cursor: 'pointer', background: 'var(--bg3)' }}>
                <img src={p.dataUrl} alt={p.date} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '8px 6px 5px', fontSize: 10, fontWeight: 600, color: '#fff',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', textAlign: 'left' }}>
                  {new Date(p.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Photo viewer */}
      {viewPhoto && (
        <div onClick={() => setViewPhoto(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'calc(var(--safe-top) + 14px) 18px 14px' }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 600 }}>
              {new Date(viewPhoto.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <button onClick={e => { e.stopPropagation(); handleDeletePhoto(viewPhoto.id); }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.16)', color: 'var(--failure)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <img src={viewPhoto.dataUrl} alt={viewPhoto.date} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12 }} />
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search, Dumbbell, X, ChevronRight, Plus, Check, ArrowLeft, Globe, Loader2 } from 'lucide-react';
import {
  searchAndFilter,
  EQUIPMENT_LIST,
  BODY_PARTS,
  cap,
} from '../utils/exercises';
import {
  saveCustomExercise,
  deleteCustomExercise,
} from '../db';
import { searchWger, getWgerInfo } from '../utils/wgerLookup';
import { useApp } from '../contexts/AppContext';
import ExerciseDetail from './ExerciseDetail';
import { useBackClose } from '../ui';

// ─── palette constants — aliases for the shared design tokens in index.css ──
const BG       = 'var(--bg)';
const SURFACE  = 'var(--bg2)';
const SURFACE2 = 'var(--bg3)';
const BORDER   = 'var(--border)';
const ACCENT   = 'var(--accent-bright)';
const ACCENT_DIM = 'var(--accent-dim)';
const TEXT1    = 'var(--text)';
const TEXT2    = 'var(--text2)';
const TEXT3    = 'var(--text3)';
const PILL_BG  = 'var(--pill-bg)';

// ─── FilterChips ──────────────────────────────────────────────────────────────
function FilterChips({ label, options, value, onChange }) {
  const scrollRef = useRef(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, color: TEXT3, letterSpacing: '0.05em', textTransform: 'uppercase', paddingLeft: 2 }}>
        {label}
      </span>
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {['All', ...options].map(opt => {
          const val = opt === 'All' ? '' : opt;
          const active = value === val;
          return (
            <button
              key={opt}
              onClick={(e) => { onChange(active ? '' : val); e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }); }}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                border: active ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER}`,
                background: active ? ACCENT_DIM : 'transparent',
                color: active ? ACCENT : TEXT2,
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {cap(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── ExerciseRow ──────────────────────────────────────────────────────────────
function ExerciseRow({ exercise, onTap, compact }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <button
      onClick={() => onTap(exercise)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: compact ? '8px 12px' : '11px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: `1px solid ${BORDER}`,
        cursor: 'pointer',
        textAlign: 'left',
        color: TEXT1,
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = SURFACE2)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* thumbnail */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          flexShrink: 0,
          overflow: 'hidden',
          background: SURFACE2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {exercise.imageUrl && !imgErr ? (
          <img
            src={exercise.imageUrl}
            alt={exercise.name}
            onError={() => setImgErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Dumbbell size={22} color={TEXT3} />
        )}
      </div>

      {/* text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: TEXT1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {exercise.name}
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
          {exercise.equipment && (
            <span
              style={{
                fontSize: 11,
                color: TEXT3,
                background: PILL_BG,
                padding: '1px 7px',
                borderRadius: 10,
              }}
            >
              {cap(exercise.equipment)}
            </span>
          )}
          {exercise.bodyPart && (
            <span
              style={{
                fontSize: 11,
                color: TEXT3,
                background: PILL_BG,
                padding: '1px 7px',
                borderRadius: 10,
              }}
            >
              {cap(exercise.bodyPart)}
            </span>
          )}
        </div>
      </div>

      <ChevronRight size={16} color={TEXT3} style={{ flexShrink: 0 }} />
    </button>
  );
}

// ─── CreateModal ──────────────────────────────────────────────────────────────
function CreateModal({ onClose, onSaved, initialName = '' }) {
  const [name, setName]           = useState(initialName);
  const [equipment, setEquipment] = useState('');
  const [bodyPart, setBodyPart]   = useState('');
  const [trackType, setTrackType] = useState('weight_reps');
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  // Online-lookup state. `touched` tracks fields the user edited so a lookup
  // result doesn't overwrite them.
  const touched = useRef({ equipment: false, bodyPart: false, trackType: false });
  const [looking, setLooking]       = useState(false);
  const [candidates, setCandidates] = useState(null); // null | array
  const [lookErr, setLookErr]       = useState('');

  async function handleLookup() {
    if (!name.trim()) return;
    setLooking(true); setLookErr(''); setCandidates(null);
    try {
      setCandidates(await searchWger(name.trim()));
    } catch {
      setLookErr('Could not reach the online database.');
    } finally {
      setLooking(false);
    }
  }

  async function applyCandidate(c) {
    setLooking(true); setLookErr('');
    try {
      const info = await getWgerInfo(c.baseId);
      if (info.instructions.length) setInstructions(info.instructions.join('\n'));
      if (info.bodyPart  && !touched.current.bodyPart)  setBodyPart(info.bodyPart);
      if (info.equipment && !touched.current.equipment) setEquipment(info.equipment);
      setCandidates(null);
    } catch {
      setLookErr('Could not load that exercise.');
    } finally {
      setLooking(false);
    }
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const ex = {
        id: `custom_${Date.now()}`,
        name: name.trim(),
        equipment: equipment || 'body weight',
        bodyPart: bodyPart || 'waist',
        trackingType: trackType,
        instructions: instructions.trim() || null,
        custom: true,
      };
      await saveCustomExercise(ex);
      onSaved();
      onClose();
    } catch (e) {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '10px 12px',
    color: TEXT1,
    fontSize: 16,
    outline: 'none',
  };

  const labelStyle = {
    fontSize: 12,
    color: TEXT3,
    marginBottom: 5,
    display: 'block',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const lookupBtn = (enabled) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flex: 1,
    padding: '8px 0', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
    border: `1px solid ${BORDER}`, background: SURFACE,
    color: enabled ? ACCENT : TEXT3, cursor: enabled ? 'pointer' : 'not-allowed',
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 400,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: 'rgba(2,2,16,0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg2)',
          borderRadius: '20px 20px 0 0',
          padding: '20px 20px 36px',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: `1px solid ${BORDER}`,
          borderBottom: 'none',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* handle */}
        <div
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            background: BORDER,
            margin: '0 auto 20px',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: TEXT1 }}>Create Exercise</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: TEXT3, cursor: 'pointer', padding: 4 }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name */}
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="e.g. Bulgarian Split Squat"
              style={inputStyle}
              autoFocus
            />
            {/* Online lookup */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                onClick={handleLookup}
                disabled={!name.trim() || looking}
                style={lookupBtn(!!name.trim() && !looking)}
              >
                {looking ? <Loader2 size={13} /> : <Globe size={13} />}
                {looking ? 'Searching…' : 'Look up online'}
              </button>
            </div>

            {lookErr && <div style={{ color: 'var(--failure)', fontSize: 12, marginTop: 8 }}>{lookErr}</div>}

            {candidates && (
              <div style={{ marginTop: 8, border: `1px solid ${BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
                {candidates.length === 0 ? (
                  <div style={{ padding: '10px 12px', fontSize: 12.5, color: TEXT3 }}>
                    No online matches. Fill in the details below.
                  </div>
                ) : candidates.map((c, i) => (
                  <button
                    key={c.baseId}
                    type="button"
                    onClick={() => applyCandidate(c)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '10px 12px', textAlign: 'left', cursor: 'pointer',
                      background: 'none', border: 'none',
                      borderTop: i ? `1px solid ${BORDER}` : 'none', color: TEXT1, fontSize: 14,
                    }}
                  >
                    <Globe size={13} color={ACCENT} />
                    <span style={{ flex: 1 }}>{c.name}</span>
                    <span style={{ fontSize: 11, color: TEXT3 }}>use</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Equipment */}
          <div>
            <label style={labelStyle}>Equipment</label>
            <select
              value={equipment}
              onChange={e => { setEquipment(e.target.value); touched.current.equipment = true; }}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              <option value="">Select equipment</option>
              {EQUIPMENT_LIST.map(eq => (
                <option key={eq} value={eq}>{cap(eq)}</option>
              ))}
            </select>
          </div>

          {/* Body Part */}
          <div>
            <label style={labelStyle}>Muscle Group</label>
            <select
              value={bodyPart}
              onChange={e => { setBodyPart(e.target.value); touched.current.bodyPart = true; }}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              <option value="">Select muscle group</option>
              {BODY_PARTS.map(bp => (
                <option key={bp} value={bp}>{cap(bp)}</option>
              ))}
            </select>
          </div>

          {/* Tracking Type */}
          <div>
            <label style={labelStyle}>Tracking Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: 'weight_reps', label: 'Weight + Reps' },
                { value: 'time', label: 'Duration' },
              ].map(opt => {
                const active = trackType === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setTrackType(opt.value); touched.current.trackType = true; }}
                    style={{
                      flex: 1,
                      padding: '9px 0',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      border: active ? `1.5px solid ${ACCENT}` : `1px solid ${BORDER}`,
                      background: active ? ACCENT_DIM : 'transparent',
                      color: active ? ACCENT : TEXT2,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {active && <Check size={13} />}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label style={labelStyle}>Instructions (optional)</label>
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="Describe how to perform the exercise..."
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: 1.5,
              }}
            />
          </div>

          {error && (
            <div style={{ color: 'var(--failure)', fontSize: 13 }}>{error}</div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%',
              padding: '13px 0',
              borderRadius: 10,
              background: saving ? SURFACE2 : 'var(--accent)',
              border: 'none',
              color: saving ? TEXT3 : '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {saving ? 'Saving…' : 'Save Exercise'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── ExercisesTab ─────────────────────────────────────────────────────────────
export default function ExercisesTab({ pickerMode = false, pickerOpen, onPick, onBack }) {
  // Back-gesture closes this view (when used as a standalone screen with a back button,
  // not as the in-sheet exercise picker, which the Sheet itself dismisses).
  useBackClose(onBack, !pickerMode && !!onBack);
  const { customExercises, refreshExercises } = useApp();
  const [query, setQuery]                   = useState('');
  const [bodyPart, setBodyPart]             = useState('');
  const [equipment, setEquipment]           = useState('');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [showCreate, setShowCreate]         = useState(false);
  const listRef = useRef(null);

  // When used inside a keep-mounted picker sheet, reset the search + filters each time
  // the sheet opens so a stale query from a previous add doesn't carry over.
  useEffect(() => {
    if (pickerOpen) { setQuery(''); setBodyPart(''); setEquipment(''); }
  }, [pickerOpen]);

  const filtered = useMemo(
    () => searchAndFilter({ query, bodyPart, equipment }, customExercises),
    [query, bodyPart, equipment, customExercises]
  );

  const rowHeight = pickerMode ? 64 : 72;
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const handleRowTap = (exercise) => {
    if (pickerMode && onPick) {
      onPick(exercise);
    } else {
      setSelectedExercise(exercise);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: BG,
        overflow: 'hidden',
      }}
    >
      {/* Header — normal mode only */}
      {!pickerMode && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: onBack ? '54px 16px 10px' : '16px 16px 10px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {onBack && (
              <button
                onClick={onBack}
                style={{ background: 'none', border: 'none', color: TEXT1, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 8px 0 0' }}
              >
                <ArrowLeft size={22} color={TEXT1} />
              </button>
            )}
            <span style={{ fontSize: 22, fontWeight: 800, color: TEXT1 }}>Exercises</span>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 14px',
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: 'transparent',
              color: ACCENT,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = ACCENT_DIM)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <Plus size={15} />
            Create
          </button>
        </div>
      )}

      {/* In picker mode — show a slim Create button above search */}
      {pickerMode && (
        <div style={{ padding: '8px 12px 0', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 8,
              border: `1px solid ${BORDER}`, background: 'transparent',
              color: ACCENT, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Create
          </button>
        </div>
      )}

      {/* Search + Filters */}
      <div
        style={{
          padding: pickerMode ? '8px 12px 0' : '0 16px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Search bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            padding: '9px 12px',
          }}
        >
          <Search size={16} color={TEXT3} style={{ flexShrink: 0 }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search exercises…"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              color: TEXT1,
              fontSize: 16,
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: TEXT3 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Equipment filter */}
        <FilterChips
          label="Equipment"
          options={EQUIPMENT_LIST}
          value={equipment}
          onChange={setEquipment}
        />

        {/* Body part filter */}
        <FilterChips
          label="Muscle Group"
          options={BODY_PARTS}
          value={bodyPart}
          onChange={setBodyPart}
        />
      </div>

      {/* Result count */}
      <div
        style={{
          padding: pickerMode ? '6px 12px 2px' : '8px 16px 2px',
          flexShrink: 0,
          fontSize: 12,
          color: TEXT3,
        }}
      >
        {filtered.length} exercise{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Exercise list — virtualized */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${BORDER} transparent`,
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: 48,
              color: TEXT3,
            }}
          >
            <Dumbbell size={40} color={TEXT3} />
            <div style={{ fontSize: 15, fontWeight: 600, color: TEXT2 }}>No exercises found</div>
            <div style={{ fontSize: 13, textAlign: 'center', maxWidth: 240 }}>
              Not in the database? Create it and fill in the details.
            </div>
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, marginTop: 4,
                padding: '10px 18px', borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              <Plus size={15} /> {query.trim() ? `Create “${query.trim()}”` : 'Create exercise'}
            </button>
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vRow => (
              <div
                key={vRow.key}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
              >
                <ExerciseRow
                  exercise={filtered[vRow.index]}
                  onTap={handleRowTap}
                  compact={pickerMode}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ExerciseDetail slide-in overlay */}
      {selectedExercise && (
        <ExerciseDetail
          exercise={selectedExercise}
          onBack={() => setSelectedExercise(null)}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          initialName={query.trim()}
          onClose={() => setShowCreate(false)}
          onSaved={refreshExercises}
        />
      )}
    </div>
  );
}

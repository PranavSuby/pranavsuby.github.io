import { useState, useRef } from 'react';
import { ChevronDown, Plus, Clock, Settings } from 'lucide-react';
import { useWorkout } from '../contexts/WorkoutContext';
import { useApp } from '../contexts/AppContext';
import { fmtTime, fmtVolume } from '../utils/format';
import { calcVolume } from '../utils/stats';
import { getExerciseByName } from '../utils/exercises';
import ExercisesTab from './ExercisesTab';
import ExerciseDetail from './ExerciseDetail';
import { Sheet, useBackClose } from '../ui';
import { styles } from './liveworkout/styles';
import { PrBanner, RestTimerOverlay } from './liveworkout/Overlays';
import { SetTypeSheet, RirRpeSheet, WorkoutSettingsSheet } from './liveworkout/Sheets';
import { ExerciseCard, SupersetWrap } from './liveworkout/ExerciseCard';
import { WorkoutComplete } from './liveworkout/WorkoutComplete';

// ── LiveWorkout (main export) ─────────────────────────────────────────────────
export default function LiveWorkout({ onFinished }) {
  const {
    session, elapsed, restTimer, prBanner,
    cancelSession, finishSession, setTitle, addExercise, replaceExercise,
    skipRestTimer, adjustRestTimer, minimize, workoutSettings,
  } = useWorkout();
  const { settings, customExercises } = useApp();

  // Opening an exercise's detail should show the real library exercise (instructions,
  // images, video) — not the trimmed copy stored on the session. Resolve by name against
  // the user's custom exercises first, then the bundled library.
  const resolveForDetail = (ex) => {
    const k = (ex?.name || '').trim().toLowerCase();
    const custom = (customExercises || []).find(c => (c.name || '').trim().toLowerCase() === k);
    return custom || getExerciseByName(ex?.name) || ex;
  };

  const [showMenu, setShowMenu] = useState(null);
  const [showComplete, setShowComplete] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [swapIdx, setSwapIdx] = useState(null);   // exIdx being swapped, or null when adding
  const [showSettings, setShowSettings] = useState(false);
  const [setTypePicker, setSetTypePicker] = useState(null);   // {exIdx, setIdx}
  const [rirRpePicker, setRirRpePicker] = useState(null);    // {exIdx, setIdx}
  const [detailExercise, setDetailExercise] = useState(null);
  const bodyRef = useRef(null);

  // Browser/gesture Back minimizes the workout (one layer at a time) instead of
  // leaving the app; on the complete screen it steps back to the workout first.
  useBackClose(minimize, !!session && !showComplete);
  useBackClose(() => setShowComplete(false), !!session && showComplete);

  if (!session) return null;

  const exercises = session.exercises ?? [];
  const totalSets = exercises.reduce((a, ex) => a + (ex.sets?.length ?? 0), 0);
  const completedSets = exercises.reduce((a, ex) => a + (ex.sets?.filter(s => s.completed).length ?? 0), 0);
  const progressPct = totalSets > 0 ? (completedSets / totalSets) * 100 : 0;
  const totalVolume = calcVolume(exercises);

  function buildGroups(exs) {
    const groups = [];
    let i = 0;
    while (i < exs.length) {
      const ex = exs[i];
      const gid = ex.supersetGroupId;
      if (gid && i + 1 < exs.length && exs[i + 1].supersetGroupId === gid) {
        const members = [{ ex, idx: i }];
        let j = i + 1;
        while (j < exs.length && exs[j].supersetGroupId === gid) {
          members.push({ ex: exs[j], idx: j });
          j++;
        }
        groups.push({ type: 'superset', members });
        i = j;
      } else {
        groups.push({ type: 'single', ex, idx: i });
        i++;
      }
    }
    return groups;
  }

  const groups = buildGroups(exercises);

  async function handlePick(ex) {
    setShowPicker(false);
    if (swapIdx != null) {
      await replaceExercise(swapIdx, ex, settings);
      setSwapIdx(null);
      return;
    }
    await addExercise(ex, settings);
    setTimeout(() => {
      bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  }

  function openSwap(exIdx) {
    setSwapIdx(exIdx);
    setShowPicker(true);
  }

  async function handleFinishConfirm() {
    try {
      await finishSession();
      onFinished?.();
    } catch {
      alert('Could not save workout. Please try again.');
    }
  }

  if (showComplete) {
    return (
      <div style={styles.overlay}>
        <WorkoutComplete
          session={session}
          elapsed={elapsed}
          onSave={handleFinishConfirm}
          onBack={() => setShowComplete(false)}
        />
      </div>
    );
  }

  return (
    <div style={styles.overlay}>
      <PrBanner prBanner={prBanner} />

      {/* Header */}
      <div style={styles.liveHeader}>
        <button style={styles.iconBtn} onClick={minimize}>
          <ChevronDown size={22} color="var(--text)" />
        </button>
        <input
          style={styles.liveTitleInput}
          value={session.title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Log Workout"
        />
        <button style={styles.iconBtn}>
          <Clock size={20} color="var(--text2)" />
        </button>
        <button style={styles.finishBtn} onClick={() => {
          if (completedSets === 0 && !window.confirm('No sets are checked off yet. Finish and save this workout anyway?')) return;
          setShowComplete(true);
        }}>
          Finish
        </button>
      </div>

      {/* Stats bar */}
      <div style={styles.statsBar}>
        <div style={styles.statCell}>
          <span style={styles.statLabel}>Duration</span>
          <span style={{ ...styles.statVal, color: 'var(--accent)' }}>{fmtTime(elapsed)}</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statCell}>
          <span style={styles.statLabel}>Volume</span>
          <span style={styles.statVal}>{fmtVolume(totalVolume, settings.units)}</span>
        </div>
        <div style={styles.statDivider} />
        <div style={styles.statCell}>
          <span style={styles.statLabel}>Sets</span>
          <span style={styles.statVal}>{completedSets}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${progressPct}%`, transition: 'width 0.4s ease' }} />
      </div>

      {/* Scrollable body */}
      <div ref={bodyRef} style={styles.liveBody}>
        {groups.map((group, gi) => {
          if (group.type === 'superset') {
            return (
              <SupersetWrap key={`ss-${gi}`}>
                {group.members.map(({ ex, idx }) => (
                  <ExerciseCard key={idx} ex={ex} exIdx={idx} totalExercises={exercises.length}
                    linkedWithNext={!!ex.supersetGroupId && ex.supersetGroupId === exercises[idx + 1]?.supersetGroupId}
                    showMenu={showMenu === idx}
                    onMenuOpen={i => setShowMenu(i)}
                    onMenuClose={() => setShowMenu(null)}
                    onTypeClick={(ei, si) => setSetTypePicker({ exIdx: ei, setIdx: si })}
                    onRirRpeClick={(ei, si) => setRirRpePicker({ exIdx: ei, setIdx: si })}
                    onOpenDetail={ex => setDetailExercise(resolveForDetail(ex))}
                    onSwap={openSwap}
                  />
                ))}
              </SupersetWrap>
            );
          }
          return (
            <ExerciseCard key={group.idx} ex={group.ex} exIdx={group.idx} totalExercises={exercises.length}
              linkedWithNext={false}
              showMenu={showMenu === group.idx}
              onMenuOpen={i => setShowMenu(i)}
              onMenuClose={() => setShowMenu(null)}
              onTypeClick={(ei, si) => setSetTypePicker({ exIdx: ei, setIdx: si })}
              onRirRpeClick={(ei, si) => setRirRpePicker({ exIdx: ei, setIdx: si })}
              onOpenDetail={ex => setDetailExercise(resolveForDetail(ex))}
              onSwap={openSwap}
            />
          );
        })}

        {exercises.length === 0 && (
          <div style={{ fontSize: 14, color: 'var(--text3)', textAlign: 'center', padding: '48px 0' }}>
            No exercises yet. Tap "+ Add Exercise" below.
          </div>
        )}

        {/* Add Exercise */}
        <button style={styles.addExBtn} onClick={() => setShowPicker(true)}>
          <Plus size={16} style={{ marginRight: 8 }} />
          Add Exercise
        </button>

        {/* Settings + Discard */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={styles.settingsBtn} onClick={() => setShowSettings(true)}>
            <Settings size={15} style={{ marginRight: 6 }} />Settings
          </button>
          <button style={styles.discardBtn} onClick={() => {
            if (window.confirm('Discard this workout? All progress will be lost.')) cancelSession();
          }}>
            Discard Workout
          </button>
        </div>

        <div style={{ height: `calc(${restTimer ? 170 : 32}px + env(safe-area-inset-bottom, 0px))` }} />
      </div>

      <RestTimerOverlay restTimer={restTimer} onSkip={skipRestTimer} onAdjust={adjustRestTimer} />

      {/* Exercise Detail overlay */}
      {detailExercise && (
        <ExerciseDetail exercise={detailExercise} onBack={() => setDetailExercise(null)} />
      )}

      {/* Set type picker sheet */}
      {setTypePicker && (
        <SetTypeSheet
          exIdx={setTypePicker.exIdx}
          setIdx={setTypePicker.setIdx}
          onClose={() => setSetTypePicker(null)}
        />
      )}

      {/* RIR / RPE picker sheet */}
      {rirRpePicker && workoutSettings.intensityMode !== 'none' && (
        <RirRpeSheet
          exIdx={rirRpePicker.exIdx}
          setIdx={rirRpePicker.setIdx}
          mode={workoutSettings.intensityMode}
          onClose={() => setRirRpePicker(null)}
        />
      )}

      {/* Workout settings sheet */}
      {showSettings && (
        <WorkoutSettingsSheet onClose={() => setShowSettings(false)} />
      )}

      {/* Exercise picker sheet — keepMounted to avoid reload lag on reopen */}
      <Sheet
        open={showPicker}
        onClose={() => { setShowPicker(false); setSwapIdx(null); }}
        title={swapIdx != null ? 'Swap Exercise' : 'Add Exercise'}
        tall flex keepMounted
      >
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', marginLeft: -16, marginRight: -16, marginBottom: 'calc(-20px - var(--safe-bottom, 0px))' }}>
          <ExercisesTab pickerMode pickerOpen={showPicker} onPick={handlePick} />
        </div>
      </Sheet>
    </div>
  );
}

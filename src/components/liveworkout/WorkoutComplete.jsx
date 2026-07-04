import { useState, useEffect } from 'react';
import { useWorkout } from '../../contexts/WorkoutContext';
import { useApp } from '../../contexts/AppContext';
import { fmtTime, fmtVolume } from '../../utils/format';
import { calcVolume, calcSets } from '../../utils/stats';
import { estimateCalories } from '../../utils/gymCalories';
import { getBodyWeightKg } from '../../utils/biometrics';
import { styles } from './styles';

// ── Workout Complete Screen ───────────────────────────────────────────────────
export function WorkoutComplete({ session, elapsed, onSave, onBack }) {
  const { setTitle, prs } = useWorkout();
  const { settings } = useApp();
  const [saving, setSaving] = useState(false);
  const [bodyWeightKg, setBodyWeightKg] = useState(null);

  const volume = calcVolume(session?.exercises ?? []);
  const totalSets = calcSets(session?.exercises ?? []);

  // Fetch body weight ONCE — `elapsed` ticks every second while this screen is open,
  // and keying the effect on it re-ran the whole NutriCore DB read per tick.
  useEffect(() => {
    let on = true;
    getBodyWeightKg().then(w => { if (on) setBodyWeightKg(w); });
    return () => { on = false; };
  }, []);
  const kcal = bodyWeightKg != null ? estimateCalories(elapsed, bodyWeightKg) : null;

  async function handleSave() {
    setSaving(true);
    try { await onSave(); } finally { setSaving(false); }
  }

  return (
    <div style={styles.wcScreen}>
      <div style={styles.wcInner}>
        <div style={styles.wcTrophy}>🏆</div>
        <div style={styles.wcTitle}>Workout Complete!</div>
        <input
          style={styles.wcTitleInput}
          value={session?.title ?? ''}
          onChange={e => setTitle(e.target.value)}
          placeholder="Workout Title"
        />
        <div style={styles.wcStatsGrid}>
          {[
            { label: 'Duration', val: fmtTime(elapsed) },
            { label: 'Volume',   val: fmtVolume(volume, settings.units) },
            { label: 'Sets',     val: totalSets },
            { label: 'Calories', val: kcal != null ? `${kcal} kcal` : '—' },
          ].map(({ label, val }) => (
            <div key={label} style={styles.wcStatCell}>
              <div style={styles.wcStatVal}>{val}</div>
              <div style={styles.wcStatLabel}>{label}</div>
            </div>
          ))}
        </div>

        {prs.length > 0 && (
          <div style={styles.wcSection}>
            <div style={styles.wcSectionTitle}>Personal Records</div>
            {prs.map((pr, i) => (
              <div key={i} style={styles.wcPrRow}>
                <span style={styles.wcPrBadge}>PR</span>
                <span style={styles.wcPrName}>{pr.exerciseName}</span>
                {/* pr.weight is stored in the exercise's own unit, not the global one */}
                <span style={styles.wcPrVal}>{pr.weight} {pr.units || settings.units} × {pr.reps}</span>
              </div>
            ))}
          </div>
        )}

        <div style={styles.wcSection}>
          <div style={styles.wcSectionTitle}>Exercises</div>
          {(session?.exercises ?? []).map((ex, i) => {
            const done = ex.sets?.filter(s => s.completed).length ?? 0;
            return (
              <div key={i} style={styles.wcExRow}>
                <span style={styles.wcExName}>{ex.name}</span>
                <span style={styles.wcExSets}>{done}/{ex.sets?.length ?? 0} sets</span>
              </div>
            );
          })}
        </div>

        <button style={{ ...styles.saveWorkoutBtn, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save Workout'}
        </button>
        <button style={styles.wcBackBtn} onClick={onBack}>Back to Workout</button>
      </div>
    </div>
  );
}

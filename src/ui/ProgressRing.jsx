export default function ProgressRing({
  value,
  total,
  size = 64,
  strokeWidth = 4,
  color = 'var(--ui-accent)',
  trackColor = 'var(--ui-surface2)',
  transition = '0.35s ease',
}) {
  const R = (size - strokeWidth * 2) / 2;
  const C = 2 * Math.PI * R;
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size} style={{ display: 'block', transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={color}
        strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
        style={{ transition: `stroke-dashoffset ${transition}` }} />
    </svg>
  );
}

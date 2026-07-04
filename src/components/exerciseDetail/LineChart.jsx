import { useState, useEffect, useRef } from 'react';
import { BORDER, ACCENT, TEXT3, PR_COLOR } from './theme';

// ─── SVG Line Chart layout ────────────────────────────────────────────────────
const CHART_W   = 300;
const CHART_H   = 130;
const MARGIN    = { left: 36, right: 8, top: 8, bottom: 22 };
const INNER_W   = CHART_W - MARGIN.left - MARGIN.right;
const INNER_H   = CHART_H - MARGIN.top - MARGIN.bottom;
const GRAD_ID   = 'chartAreaGrad';

function buildBezier(pts) {
  if (pts.length < 2) return '';
  const d = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const cx = (p0.x + p1.x) / 2;
    d.push(`C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`);
  }
  return d.join(' ');
}

export function LineChart({ points }) {
  const containerRef = useRef(null);
  const [scaleX, setScaleX] = useState(1);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setScaleX(w / CHART_W);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (!points || points.length === 0) {
    return (
      <div
        style={{
          height: CHART_H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: TEXT3,
          fontSize: 13,
        }}
      >
        No data for this period
      </div>
    );
  }

  // Compute value range with padding
  const vals   = points.map(p => p.value);
  const rawMin = Math.min(...vals);
  const rawMax = Math.max(...vals);
  const pad    = (rawMax - rawMin) * 0.15 || rawMax * 0.15 || 1;
  const yMin   = rawMin - pad;
  const yMax   = rawMax + pad;
  const yRange = yMax - yMin;

  // Map to SVG coords
  const xScale = points.length > 1 ? INNER_W / (points.length - 1) : INNER_W;
  const toX = i  => MARGIN.left + (points.length > 1 ? i * xScale : INNER_W / 2);
  const toY = v  => MARGIN.top  + INNER_H - ((v - yMin) / yRange) * INNER_H;

  const svgPts = points.map((p, i) => ({ x: toX(i), y: toY(p.value), ...p }));

  const linePath = buildBezier(svgPts);
  const areaPath =
    linePath +
    ` L ${svgPts[svgPts.length - 1].x} ${MARGIN.top + INNER_H}` +
    ` L ${svgPts[0].x} ${MARGIN.top + INNER_H} Z`;

  // Y-axis ticks (3 ticks)
  const yTicks = [0, 0.5, 1].map(t => ({
    value: yMin + t * yRange,
    y: toY(yMin + t * yRange),
  }));

  // X-axis labels — sample up to 5 evenly
  const xLabelCount = Math.min(5, points.length);
  const xLabelIdxs = Array.from({ length: xLabelCount }, (_, i) =>
    Math.round((i / (xLabelCount - 1 || 1)) * (points.length - 1))
  );
  const uniqueXIdxs = [...new Set(xLabelIdxs)];

  const fmtXLabel = iso => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const fmtYLabel = v => {
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return Math.round(v).toString();
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        style={{ width: '100%', height: CHART_H * scaleX, display: 'block', overflow: 'visible' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={GRAD_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={ACCENT} stopOpacity="0.35" />
            <stop offset="100%" stopColor={ACCENT} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y grid lines + labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={MARGIN.left}
              y1={t.y}
              x2={CHART_W - MARGIN.right}
              y2={t.y}
              stroke={BORDER}
              strokeWidth="0.5"
            />
            <text
              x={MARGIN.left - 4}
              y={t.y + 4}
              fontSize="7"
              fill={TEXT3}
              textAnchor="end"
            >
              {fmtYLabel(t.value)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        {points.length > 1 && (
          <path d={areaPath} fill={`url(#${GRAD_ID})`} />
        )}

        {/* Line */}
        {points.length > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke={ACCENT}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* X-axis date labels */}
        {uniqueXIdxs.map(idx => (
          <text
            key={idx}
            x={toX(idx)}
            y={CHART_H - 4}
            fontSize="6.5"
            fill={TEXT3}
            textAnchor="middle"
          >
            {fmtXLabel(points[idx].date)}
          </text>
        ))}

        {/* Dots */}
        {svgPts.map((p, i) => (
          <g key={i}>
            {p.isPR ? (
              <>
                <circle cx={p.x} cy={p.y} r={5} fill={PR_COLOR} opacity={0.25} />
                <circle cx={p.x} cy={p.y} r={3} fill={PR_COLOR} />
                <text
                  x={p.x}
                  y={p.y - 7}
                  fontSize="5.5"
                  fill={PR_COLOR}
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  PR
                </text>
              </>
            ) : (
              <circle cx={p.x} cy={p.y} r={2.5} fill={ACCENT} />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

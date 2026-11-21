// Small, dependency-free SVG charts. They print crisply, so the PDF report reuses them.
import { useRef, useState } from 'preact/hooks';

export interface LineSeries { id: string; name: string; color: string; points: [number, number][] }

interface Scale { (v: number): number; ticks: number[] }

function niceTicks(lo: number, hi: number, count = 5): number[] {
  const span = hi - lo || 1;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count + 0.5) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toPrecision(12));
  return out;
}

function linear(d0: number, d1: number, r0: number, r1: number, nice = true): Scale {
  const ticks = nice ? niceTicks(d0, d1) : [];
  const hi = nice ? Math.max(d1, ticks[ticks.length - 1] ?? d1) : d1;
  const f = ((v: number) => r0 + ((v - d0) / (hi - d0 || 1)) * (r1 - r0)) as Scale;
  f.ticks = ticks;
  return f;
}

function logScale(d0: number, d1: number, r0: number, r1: number): Scale {
  const l0 = Math.log10(d0), l1 = Math.log10(d1);
  const f = ((v: number) => r0 + ((Math.log10(v) - l0) / (l1 - l0)) * (r1 - r0)) as Scale;
  const ticks: number[] = [];
  for (let e = Math.floor(l0); e <= Math.ceil(l1); e++) for (const m of [1, 2, 5]) {
    const v = m * Math.pow(10, e);
    if (v >= d0 && v <= d1) ticks.push(v);
  }
  f.ticks = ticks;
  return f;
}

const short = (v: number) =>
  Math.abs(v) >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : `${+v.toFixed(2)}`;

export function LineChart(props: {
  series: LineSeries[];
  xLabel: string;
  yLabel: string;
  xLog?: boolean;
  yMin?: number;
  yMax?: number;
  fmtY?: (v: number) => string;
  fmtX?: (v: number) => string;
  marker?: number;
  vlines?: { x: number; label: string }[];
  height?: number;
}) {
  const W = 680, H = props.height ?? 300, ml = 62, mr = 70, mt = 14, mb = 44;
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const clipId = useRef(`clip${Math.random().toString(36).slice(2, 8)}`).current;
  const xs = props.series.flatMap((s) => s.points.map((p) => p[0]));
  const ys = props.series.flatMap((s) => s.points.map((p) => p[1])).filter(Number.isFinite);
  if (!xs.length) return null;
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = props.yMin ?? 0, y1 = props.yMax ?? Math.max(...ys) * 1.05;
  const x = props.xLog ? logScale(x0, x1, ml, W - mr) : linear(x0, x1, ml, W - mr, false);
  if (!props.xLog) x.ticks = niceTicks(x0, x1, 7).filter((t) => t >= x0 && t <= x1);
  const y = linear(y0, y1, H - mb, mt);
  const clampY = (v: number) => Math.max(mt, Math.min(H - mb, y(v)));
  const fx = props.fmtX ?? short, fy = props.fmtY ?? short;
  const base = props.series[0].points;

  function move(e: PointerEvent) {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    base.forEach((p, i) => { const d = Math.abs(x(p[0]) - px); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  }

  // Direct labels at the line ends, nudged apart so they don't collide.
  const ends = props.series.map((s) => ({ s, y: clampY(s.points[s.points.length - 1][1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;

  const hx = hover !== null ? base[hover][0] : null;
  return (
    <div class="chart">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${props.yLabel} by ${props.xLabel}`}
        onPointerMove={move as any} onPointerLeave={() => setHover(null)}>
        {y.ticks.map((t) => (
          <g key={t}>
            <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} class="grid" />
            <text x={ml - 8} y={y(t) + 4} class="tick" text-anchor="end">{fy(t)}</text>
          </g>
        ))}
        {x.ticks.map((t) => (
          <text key={t} x={x(t)} y={H - mb + 16} class="tick" text-anchor="middle">{fx(t)}</text>
        ))}
        <line x1={ml} x2={W - mr} y1={H - mb} y2={H - mb} class="axis" />
        <text x={(ml + W - mr) / 2} y={H - 6} class="axis-label" text-anchor="middle">{props.xLabel}</text>
        <text transform={`translate(14 ${(mt + H - mb) / 2}) rotate(-90)`} class="axis-label" text-anchor="middle">{props.yLabel}</text>
        {props.vlines?.map((v, i) => (
          v.x >= x0 && v.x <= x1 ? (
            <g key={i}>
              <line x1={x(v.x)} x2={x(v.x)} y1={mt} y2={H - mb} class="vline" />
              <text x={x(v.x) + 4} y={mt + 12 + i * 13} class="vline-label">{v.label}</text>
            </g>
          ) : null
        ))}
        {props.marker !== undefined && props.marker >= x0 && props.marker <= x1 && (
          <line x1={x(props.marker)} x2={x(props.marker)} y1={mt} y2={H - mb} class="marker" />
        )}
        <clipPath id={clipId}><rect x={ml} y={mt - 2} width={W - ml - mr} height={H - mb - mt + 4} /></clipPath>
        <g clip-path={`url(#${clipId})`}>
          {props.series.map((s) => (
            <path key={s.id} d={s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('')}
              fill="none" stroke={s.color} stroke-width="2.2" stroke-linejoin="round" />
          ))}
        </g>
        {ends.map(({ s, y: ly }) => (
          <text key={s.id} x={W - mr + 6} y={ly + 4} class="end-label">{s.name}</text>
        ))}
        {hx !== null && (
          <g>
            <line x1={x(hx)} x2={x(hx)} y1={mt} y2={H - mb} class="crosshair" />
            {props.series.map((s) => {
              const p = s.points[hover!];
              return p ? <circle key={s.id} cx={x(p[0])} cy={clampY(p[1])} r="4.5" fill={s.color} stroke="var(--surface)" stroke-width="2" /> : null;
            })}
          </g>
        )}
      </svg>
      {hx !== null && (
        <div class="tooltip" style={{ left: `${(x(hx) / W) * 100}%` }}>
          <div class="tt-head">{props.xLabel}: {fx(hx)}</div>
          {props.series.map((s) => (
            <div key={s.id} class="tt-row"><i style={{ background: s.color }} />{s.name}<b>{fy(s.points[hover!]?.[1] ?? NaN)}</b></div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GroupedBars(props: {
  categories: string[];
  series: { id: string; name: string; color: string; values: number[] }[];
  yLabel: string;
  fmt?: (v: number) => string;
  height?: number;
}) {
  const W = 680, H = props.height ?? 260, ml = 56, mr = 12, mt = 18, mb = 40;
  const fmt = props.fmt ?? short;
  const max = Math.max(...props.series.flatMap((s) => s.values)) * 1.1;
  const y = linear(0, max, H - mb, mt);
  const groupW = (W - ml - mr) / props.categories.length;
  const n = props.series.length;
  const barW = Math.min(46, (groupW * 0.78) / n);
  return (
    <div class="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.yLabel}>
        {y.ticks.map((t) => (
          <g key={t}>
            <line x1={ml} x2={W - mr} y1={y(t)} y2={y(t)} class="grid" />
            <text x={ml - 8} y={y(t) + 4} class="tick" text-anchor="end">{fmt(t)}</text>
          </g>
        ))}
        <text transform={`translate(14 ${(mt + H - mb) / 2}) rotate(-90)`} class="axis-label" text-anchor="middle">{props.yLabel}</text>
        {props.categories.map((c, ci) => {
          const gx = ml + ci * groupW + (groupW - (barW + 2) * n) / 2;
          return (
            <g key={c}>
              {props.series.map((s, si) => {
                const v = s.values[ci];
                const bx = gx + si * (barW + 2);
                const top = y(v);
                const h = H - mb - top;
                const r = Math.min(4, h / 2, barW / 2);
                return (
                  <g key={s.id}>
                    <title>{`${s.name} · ${c}: ${fmt(v)}`}</title>
                    <path d={`M${bx},${H - mb}V${top + r}Q${bx},${top} ${bx + r},${top}H${bx + barW - r}Q${bx + barW},${top} ${bx + barW},${top + r}V${H - mb}Z`} fill={s.color} />
                    {n <= 4 && <text x={bx + barW / 2} y={top - 4} class="bar-label" text-anchor="middle">{fmt(v)}</text>}
                  </g>
                );
              })}
              <text x={ml + ci * groupW + groupW / 2} y={H - mb + 16} class="tick" text-anchor="middle">{c}</text>
            </g>
          );
        })}
        <line x1={ml} x2={W - mr} y1={H - mb} y2={H - mb} class="axis" />
      </svg>
      <Legend items={props.series.map((s) => ({ name: s.name, color: s.color }))} />
    </div>
  );
}

export function StackedBars(props: {
  rows: { id: string; name: string; parts: { key: string; value: number; color: string }[] }[];
  xLabel: string;
  fmt: (v: number) => string;
}) {
  const W = 680, rowH = 34, ml = 70, mr = 82, mt = 8, mb = 34;
  const H = mt + mb + props.rows.length * (rowH + 12);
  const max = Math.max(...props.rows.map((r) => r.parts.reduce((a, p) => a + p.value, 0)));
  const x = linear(0, max, ml, W - mr);
  return (
    <div class="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={props.xLabel}>
        {x.ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={mt} y2={H - mb} class="grid" />
            <text x={x(t)} y={H - mb + 15} class="tick" text-anchor="middle">{props.fmt(t)}</text>
          </g>
        ))}
        <text x={(ml + W - mr) / 2} y={H - 4} class="axis-label" text-anchor="middle">{props.xLabel}</text>
        {props.rows.map((r, ri) => {
          const yy = mt + ri * (rowH + 12);
          let acc = 0;
          const total = r.parts.reduce((a, p) => a + p.value, 0);
          return (
            <g key={r.id}>
              <text x={ml - 8} y={yy + rowH / 2 + 4} class="row-label" text-anchor="end">{r.name}</text>
              {r.parts.map((p) => {
                const x0 = x(acc), x1 = x(acc + p.value);
                acc += p.value;
                return (
                  <g key={p.key}>
                    <title>{`${r.name} · ${p.key}: ${props.fmt(p.value)}/h`}</title>
                    <rect x={x0} y={yy} width={Math.max(0, x1 - x0 - 2)} height={rowH} fill={p.color} rx="2" />
                  </g>
                );
              })}
              <text x={x(total) + 6} y={yy + rowH / 2 + 4} class="row-total">{props.fmt(total)}/h</text>
            </g>
          );
        })}
      </svg>
      <Legend items={props.rows[0]?.parts.map((p) => ({ name: p.key, color: p.color })) ?? []} />
    </div>
  );
}

export function Legend(props: { items: { name: string; color: string }[] }) {
  return (
    <div class="legend">
      {props.items.map((i) => (
        <span key={i.name}><i style={{ background: i.color }} />{i.name}</span>
      ))}
    </div>
  );
}

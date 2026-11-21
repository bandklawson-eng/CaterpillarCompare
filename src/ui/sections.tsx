import type { ComponentChildren } from 'preact';
import { SOURCES, UNIT_LABEL, yearsLabel, type Family } from '../data';
import {
  allInUnitCost, cheapestBands, COST_KEYS, evaluate, fleetProduction, fuelBurn, haulCycle, repairTotal, sizeSteps,
  SWEEP, VOLUME_RANGE, type Result, type Settings, type Step,
} from '../engine/model';
import { FleetIcons, FleetPanel, QtyStepper, fleetName } from './fleet';
import { GroupedBars, LineChart, StackedBars } from './charts';
import { SPEC_ROWS } from './specRows';
import { colorOf, money, money2, n0, n1, n2, PARTS, pct, times, vol } from './format';

interface P { results: Result[]; s: Settings; family: Family }

export function Section(props: { id: string; title: string; lead?: string; children: ComponentChildren }) {
  return (
    <section id={props.id} class="section">
      <h2>{props.title}</h2>
      {props.lead && <p class="lead">{props.lead}</p>}
      {props.children}
    </section>
  );
}

function conditionText(f: Family, s: Settings): string {
  if (f === 'dozer') return `${s.pushFt}-ft average push`;
  if (f === 'excavator') return `${s.swingDeg}° swing, ${s.digDifficulty === 'veryHard' ? 'very hard' : s.digDifficulty} digging`;
  return `${s.haulMiles}-mile haul at ${s.haulGradePct}% grade`;
}

const unitWord = (f: Family) => (f === 'hauler' ? 'ton' : 'yd³');
const perUnit = (f: Family) => (f === 'hauler' ? 'per ton' : 'per yd³');
const per1000 = (f: Family) => (f === 'hauler' ? 'per 1,000 tons' : 'per 1,000 yd³');

// =============================================================== AT A GLANCE
export function Glance({ results, s, family }: P) {
  const base = results[0];
  const cheapest = results.reduce((a, r) => (r.unitCost < a.unitCost ? r : a), results[0]);
  const steps = sizeSteps(results);
  const [lo, hi] = VOLUME_RANGE[family];
  const bands = results.length > 1 ? cheapestBands(results, lo, hi) : [];
  const u = UNIT_LABEL[family];
  return (
    <div class="glance">
      <div class="glance-cards" style={{ gridTemplateColumns: `repeat(${results.length}, minmax(0, 1fr))` }}>
        {results.map((r) => (
          <div class="gcard" key={r.m.id} style={{ borderTopColor: colorOf(r.m.id) }}>
            <FleetIcons r={r} all={results} family={family} />
            <div class="gcard-head">
              <b>{fleetName(r)}</b>
              <span>{yearsLabel(r.m)}</span>
              {r === cheapest && results.length > 1 && <em class="pill good">Lowest cost {perUnit(family)}</em>}
            </div>
            <QtyStepper r={r} />
            <Metric label={`Production (${u}/h)`} value={n0(r.prod)} rel={r === base ? 'baseline' : times(r.prod / base.prod)} />
            <Metric label="Fuel burn (gal/h)" value={n1(r.fuelH)} rel={r === base ? 'baseline' : times(r.fuelH / base.fuelH)} />
            <Metric label={`Fuel ${per1000(family)}`} value={`${n1(r.fuelPerUnit * 1000)} gal`} rel={r === base ? 'baseline' : pct(r.fuelPerUnit / base.fuelPerUnit - 1)} />
            <Metric label="Owning + operating cost" value={`${money(r.costH)}/h`} rel={r === base ? 'baseline' : times(r.costH / base.costH)} />
            <Metric label={`Cost ${perUnit(family)}`} value={money2(r.unitCost)} rel={r === base ? 'baseline' : pct(r.unitCost / base.unitCost - 1)} strong />
          </div>
        ))}
      </div>
      <p class="note">Base case: {conditionText(family, s)}, {s.load === 'med' ? 'medium' : s.load} load, {s.skill} operator,
        {' '}{s.jobMinPerHour}-minute hour. Figures are for the whole fleet.<span class="ui-only"> Change these under <b>Job conditions</b>.</span></p>

      <FleetPanel results={results} s={s} family={family} />

      {results.length > 1 && (
        <div class="breakeven-box">
          <h3>When to move up a size</h3>
          <div class="steps">
            {steps.map((st) => <StepCard key={st.to.m.id} st={st} family={family} />)}
          </div>
          <h4>Cheapest machine by job size (all-in, including mobilization)</h4>
          <BandStrip bands={bands} lo={lo} hi={hi} unit={u} />
          <p class="bottom-line">{bottomLine(bands, family, results)}</p>
        </div>
      )}
    </div>
  );
}

function Metric(props: { label: string; value: string; rel: string; strong?: boolean }) {
  return (
    <div class={`metric${props.strong ? ' strong' : ''}`}>
      <span class="m-label">{props.label}</span>
      <span class="m-value">{props.value}</span>
      <span class="m-rel">{props.rel}</span>
    </div>
  );
}

const CAPABILITY: Record<Family, string> = {
  dozer: 'extra weight and ripping force',
  excavator: 'extra reach, dig depth or lift capacity',
  hauler: 'extra payload or speed on grade',
};

function StepCard({ st, family }: { st: Step; family: Family }) {
  const u = UNIT_LABEL[family];
  const saving = 1 - st.to.unitCost / st.from.unitCost;
  return (
    <div class="step">
      <div class="step-models">
        <span style={{ color: colorOf(st.from.m.id) }}>■</span> {fleetName(st.from)}
        <span class="arrow">→</span>
        <span style={{ color: colorOf(st.to.m.id) }}>■</span> {fleetName(st.to)}
      </div>
      {st.volume === null ? (
        <>
          <div class="step-num muted">Not cheaper</div>
          <p>{fleetName(st.to)} costs more {perUnit(family)} than {fleetName(st.from)} under these conditions at any job size. Move up only when the
            job needs the bigger machine's {CAPABILITY[family]}.</p>
        </>
      ) : st.volume === 0 ? (
        <>
          <div class="step-num">Any job size</div>
          <p>{fleetName(st.to)} is cheaper {perUnit(family)} and costs no more to move.</p>
        </>
      ) : (
        <>
          <div class="step-num">{vol(st.volume)} {u}</div>
          <p>Above about <b>{n0(st.volume)} {u}</b> per job {fleetName(st.to)} is cheaper; it saves {Math.round(saving * 100)}% {perUnit(family)} once
            its higher moving cost ({money(st.to.mobCost)} vs {money(st.from.mobCost)}) is paid off.</p>
        </>
      )}
    </div>
  );
}

export function BandStrip({ bands, lo, hi, unit }: { bands: ReturnType<typeof cheapestBands>; lo: number; hi: number; unit: string }) {
  const W = 680, H = 58, ml = 6, mr = 6;
  const x = (v: number) => ml + (Math.log10(v / lo) / Math.log10(hi / lo)) * (W - ml - mr);
  const ticks: number[] = [];
  for (let e = Math.ceil(Math.log10(lo)); e <= Math.floor(Math.log10(hi)); e++) ticks.push(Math.pow(10, e));
  return (
    <div class="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cheapest machine by job size">
        {bands.map((b, i) => {
          const x0 = x(b.from), x1 = i + 1 < bands.length ? x(bands[i + 1].from) : x(hi);
          return (
            <g key={i}>
              <title>{`${fleetName(b.r)}: ${vol(b.from)}–${vol(i + 1 < bands.length ? bands[i + 1].from : hi)} ${unit}`}</title>
              <rect x={x0} y={4} width={Math.max(0, x1 - x0 - 2)} height={26} rx="3" fill={colorOf(b.r.m.id)} />
              {x1 - x0 > 46 && <text x={(x0 + x1) / 2} y={21} class="band-label" text-anchor="middle">{fleetName(b.r)}</text>}
            </g>
          );
        })}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={32} y2={37} class="axis" />
            <text x={x(t)} y={50} class="tick" text-anchor={x(t) < 30 ? 'start' : x(t) > W - 30 ? 'end' : 'middle'}>{vol(t)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function bottomLine(bands: ReturnType<typeof cheapestBands>, family: Family, results: Result[]): string {
  if (!bands.length) return '';
  const u = UNIT_LABEL[family];
  const parts = bands.map((b, i) => {
    const next = bands[i + 1];
    if (i === 0 && next) return `${fleetName(b.r)} is cheapest below about ${vol(next.from)} ${u} per job`;
    if (next) return `${fleetName(b.r)} from ${vol(b.from)} to ${vol(next.from)} ${u}`;
    return bands.length === 1 ? `${fleetName(b.r)} is cheapest at every job size shown` : `${fleetName(b.r)} above ${vol(b.from)} ${u}`;
  });
  const never = results.filter((r) => !bands.some((b) => b.r === r)).map((r) => fleetName(r));
  let text = `Bottom line: ${parts.join('; ')}.`;
  if (never.length) text += ` ${never.join(' and ')} ${never.length > 1 ? 'are' : 'is'} never the lowest-cost choice under these conditions.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// =============================================================== SPECS
export function SpecsTable({ results, family }: P) {
  return (
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr><th>Specification</th>{results.map((r) => <th key={r.m.id}><span class="sw" style={{ background: colorOf(r.m.id) }} />{r.m.name}</th>)}</tr>
        </thead>
        <tbody>
          <tr><th>Machines in fleet</th>{results.map((r) => <td key={r.m.id}><b>{r.qty}</b></td>)}</tr>
          {SPEC_ROWS[family].map((row) => (
            <tr key={row.label}><th>{row.label}</th>{results.map((r) => <td key={r.m.id}>{row.get(r.m)}</td>)}</tr>
          ))}
          <tr><th>Data status</th>{results.map((r) => (
            <td key={r.m.id}>{r.m.verified ? <span class="pill">Published specs</span> : <span class="pill warn">Partly estimated – verify</span>}</td>
          ))}</tr>
        </tbody>
      </table>
      {results.some((r) => r.m.notes || r.m.fuelNote) && (
        <ul class="notes">
          {results.filter((r) => r.m.notes || r.m.fuelNote).map((r) => (
            <li key={r.m.id}><b>{r.m.name}:</b> {[r.m.notes, r.m.fuelNote].filter(Boolean).join(' ')}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// =============================================================== PRODUCTIVITY
function sweepSeries(results: Result[], s: Settings, f: Family, y: (r: Result, v: number) => number) {
  const sw = SWEEP[f];
  return results.map((r) => ({
    id: r.m.id, name: fleetName(r), color: colorOf(r.m.id),
    points: sw.values.map((v) => [v, y(r, v)] as [number, number]),
  }));
}

const withSweep = (s: Settings, f: Family, v: number): Settings => ({ ...s, [SWEEP[f].key]: v });

export function Productivity({ results, s, family }: P) {
  const sw = SWEEP[family];
  const u = UNIT_LABEL[family];
  const cur = s[sw.key] as number;
  const pts = family === 'dozer' ? [50, 100, 200, 300, 400] : family === 'excavator' ? [45, 90, 135, 180] : [0.5, 1, 2, 3, 4];
  const base = results[0];
  return (
    <>
      <LineChart series={sweepSeries(results, s, family, (r, v) => fleetProduction(r, s, v))}
        xLabel={`${sw.label} (${sw.unit})`} yLabel={`Production (${u} per hour)`} marker={cur} fmtY={n0} />
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>{sw.label}</th>{results.map((r) => <th key={r.m.id}>{fleetName(r)}</th>)}{results.length > 1 && <th>Largest ÷ smallest</th>}</tr></thead>
          <tbody>
            {pts.map((v) => {
              const vals = results.map((r) => fleetProduction(r, s, v));
              return (
                <tr key={v}><th>{v} {sw.unit}</th>{vals.map((p, i) => <td key={i}>{n0(p)}</td>)}
                  {results.length > 1 && <td>{times(vals[vals.length - 1] / vals[0])}</td>}</tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {family === 'hauler' && <HaulDetail results={results} s={s} />}
      <p class="method">{METHOD[family]}</p>
      {results.length > 1 && (
        <p>At the current conditions {fleetName(results[results.length - 1])} moves {times(results[results.length - 1].prod / base.prod)} as much
          material per hour as {fleetName(base)}.</p>
      )}
    </>
  );
}

const METHOD: Record<Family, string> = {
  dozer: 'Method: production = blade capacity × 60 ÷ cycle time × material, slot, grade, operator and job-efficiency factors. Cycle time = 0.10 min fixed + push distance ÷ dozing speed (70% of 1st-forward) + push distance ÷ return speed (90% of 2nd-reverse). This is the standard method behind the Cat Performance Handbook dozer curves.',
  excavator: 'Method: production = bucket capacity × fill factor × 3,600 ÷ cycle time (s) × operator and job-efficiency factors. Cycle time grows with machine size and is adjusted for digging difficulty and swing angle (90° = baseline). Truck spotting and waiting are not included.',
  hauler: 'Method: cycle = loading + loaded travel + dump & spot + empty return. Travel speeds come from net power, gross weight and total resistance (grade + rolling resistance), capped at 65% of top speed to allow for acceleration and corners. Payload is capped by heaped body volume × material density.',
};

function HaulDetail({ results, s }: { results: Result[]; s: Settings }) {
  return (
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Cycle per truck at {s.haulMiles} mi, {s.haulGradePct}% grade</th>{results.map((r) => <th key={r.m.id}>{r.m.name}</th>)}</tr></thead>
        <tbody>
          {(() => {
            const c = results.map((r) => (r.m.family === 'hauler' ? haulCycle(r.m, s, s.haulMiles) : null));
            const row = (label: string, f: (x: NonNullable<(typeof c)[number]>) => string) => (
              <tr><th>{label}</th>{c.map((x, i) => <td key={i}>{x ? f(x) : ''}</td>)}</tr>
            );
            return (<>
              {row('Payload carried (tons)', (x) => `${n1(x.payloadTon)}${x.volumeLimited ? ' (body-volume limited)' : ''}`)}
              {row('Loaded / empty speed (mph)', (x) => `${n1(x.loadedMph)} / ${n1(x.emptyMph)}`)}
              {row('Load + dump time (min)', (x) => n1(x.loadMin + x.dumpMin))}
              {row('Travel time (min)', (x) => n1(x.travelMin))}
              {row('Total cycle (min)', (x) => n1(x.cycleMin))}
            </>);
          })()}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================== FUEL
export function Fuel({ results, s, family }: P) {
  const sw = SWEEP[family];
  const base = results[0];
  return (
    <>
      <GroupedBars categories={['Low load', 'Medium load', 'High load']}
        series={results.map((r) => ({ id: r.m.id, name: fleetName(r) + (r.fuelEstimated ? ' (est.)' : ''), color: colorOf(r.m.id), values: fuelBurn(r.m).burn.map((g) => g * r.qty) }))}
        yLabel="US gal per hour (whole fleet)" fmt={n1} />
      <LineChart series={sweepSeries(results, s, family, (r, v) => (r.fuelH / fleetProduction(r, s, v)) * 1000)}
        xLabel={`${sw.label} (${sw.unit})`} yLabel={`Gallons ${per1000(family)}`} marker={s[sw.key] as number} fmtY={n1} />
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Fuel</th>{results.map((r) => <th key={r.m.id}>{fleetName(r)}</th>)}</tr></thead>
          <tbody>
            <tr><th>Per machine, low / medium / high (gal/h)</th>{results.map((r) => <td key={r.m.id}>{fuelBurn(r.m).burn.map(n1).join(' / ')}{r.fuelEstimated ? ' est.' : ''}</td>)}</tr>
            <tr><th>Whole fleet, selected load (gal/h)</th>{results.map((r) => <td key={r.m.id}>{n1(r.fuelH)}</td>)}</tr>
            <tr><th>Gallons {per1000(family)}</th>{results.map((r) => <td key={r.m.id}>{n1(r.fuelPerUnit * 1000)}</td>)}</tr>
            <tr><th>vs {fleetName(base)}</th>{results.map((r) => <td key={r.m.id}>{r === base ? '—' : pct(r.fuelPerUnit / base.fuelPerUnit - 1)}</td>)}</tr>
            <tr><th>Fuel + DEF cost {perUnit(family)}</th>{results.map((r) => <td key={r.m.id}>{money2(r.breakdown['Fuel + DEF'] / r.prod)}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <p class="method">Hourly fuel figures come from the Cat Performance Handbook, which uses VisionLink telematics from machines in the field and
        includes idle time (about 50% idle at low load, 30% at medium and 10% at high). Models marked “est.” have no published figure; their
        fuel is estimated from engine power.</p>
    </>
  );
}

// =============================================================== COSTS
export function Costs({ results, s, family }: P) {
  const sw = SWEEP[family];
  return (
    <>
      <StackedBars fmt={money} xLabel="Estimated owning + operating cost of the whole fleet, $ per hour"
        rows={results.map((r) => ({ id: r.m.id, name: fleetName(r), parts: COST_KEYS.map((k, i) => ({ key: k, value: r.breakdown[k], color: PARTS[i] })) }))} />
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>$ per hour, whole fleet</th>{results.map((r) => <th key={r.m.id}>{fleetName(r)}</th>)}</tr></thead>
          <tbody>
            {COST_KEYS.map((k) => <tr key={k}><th>{k}</th>{results.map((r) => <td key={r.m.id}>{money2(r.breakdown[k])}</td>)}</tr>)}
            <tr class="total"><th>Total owning + operating</th>{results.map((r) => <td key={r.m.id}>{money2(r.costH)}</td>)}</tr>
            <tr><th>Repair, maintenance & support subtotal</th>{results.map((r) => <td key={r.m.id}>{money2(repairTotal(r.breakdown))}</td>)}</tr>
            <tr><th>Production ({UNIT_LABEL[family]}/h)</th>{results.map((r) => <td key={r.m.id}>{n0(r.prod)}</td>)}</tr>
            <tr class="total"><th>Cost {perUnit(family)}</th>{results.map((r) => <td key={r.m.id}>{money2(r.unitCost)}</td>)}</tr>
            <tr><th>Repair, maintenance & support {per1000(family)}</th>{results.map((r) => <td key={r.m.id}>{money(repairTotal(r.breakdown) / r.prod * 1000)}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <LineChart series={sweepSeries(results, s, family, (r, v) => evaluate(r.m, withSweep(s, family, v), r.costs, r.qty).unitCost)}
        xLabel={`${sw.label} (${sw.unit})`} yLabel={`$ ${perUnit(family)}`} marker={s[sw.key] as number} fmtY={money2} />
      <p class="method">Repair reserve is a share of purchase price spread over the ownership period. Undercarriage (tracked machines) and tires
        (trucks) follow the Cat Performance Handbook approach, where ground conditions (impact, abrasion) matter more than the model:
        severe conditions roughly double the moderate figure. Support & servicing is a fixed amount per machine for service-truck visits,
        fueling, preventive-maintenance labor and admin, so it grows with the number of machines, not their size.
        <span class="ui-only"> Every price and rate can be changed under <b>Prices & costs</b>.</span></p>
    </>
  );
}

// =============================================================== BREAK-EVEN
export function BreakEven({ results, family }: P) {
  const [lo, hi] = VOLUME_RANGE[family];
  const u = UNIT_LABEL[family];
  const vols: number[] = [];
  for (let i = 0; i <= 60; i++) vols.push(lo * Math.pow(hi / lo, i / 60));
  const minAtHi = Math.min(...results.map((r) => allInUnitCost(r, hi)));
  const steps = sizeSteps(results).filter((st) => st.volume && st.volume > 0);
  const table = family === 'hauler' ? [50_000, 250_000, 1_000_000, 5_000_000] : [10_000, 50_000, 100_000, 250_000, 1_000_000];
  return (
    <>
      <LineChart xLog series={results.map((r) => ({ id: r.m.id, name: fleetName(r), color: colorOf(r.m.id),
        points: vols.map((v) => [v, allInUnitCost(r, v)] as [number, number]) }))}
        xLabel={`Job size (${u}), log scale`} yLabel={`All-in $ ${perUnit(family)}`} yMin={0} yMax={minAtHi * 3.2}
        fmtY={money2} fmtX={vol}
        vlines={steps.map((st) => ({ x: st.volume!, label: `${fleetName(st.from)}→${fleetName(st.to)}: ${vol(st.volume!)}` }))} />
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>All-in cost {perUnit(family)} for a job of…</th>{results.map((r) => <th key={r.m.id}>{fleetName(r)}</th>)}</tr></thead>
          <tbody>
            {table.map((v) => {
              const vals = results.map((r) => allInUnitCost(r, v));
              const best = Math.min(...vals);
              return <tr key={v}><th>{n0(v)} {u}</th>{vals.map((x, i) => <td key={i} class={x === best ? 'best' : ''}>{money2(x)}</td>)}</tr>;
            })}
            <tr><th>Moving the fleet (round trip)</th>{results.map((r) => <td key={r.m.id}>{money(r.mobCost)} · {r.loads} load{r.loads > 1 ? 's' : ''}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <p class="method">All-in cost = (mobilization + cost {perUnit(family)} × job size) ÷ job size. A bigger machine wins once the job is large enough
        to pay off its higher cost to move. Idle time is the hidden risk: ownership costs keep running when a large machine sits waiting for work.</p>
    </>
  );
}

// =============================================================== ASSUMPTIONS
export function Assumptions({ results, s, family }: P) {
  const src = Array.from(new Set(results.flatMap((r) => r.m.sources).concat(['fuel', 'handbookOO'])));
  const rows: [string, string][] = [
    ['Fuel / DEF price', `${money2(s.fuelPrice)} / ${money2(s.defPrice)} per gal; DEF at ${Math.round(s.defRatio * 100)}% of fuel`],
    ['Lube, filters, grease', `${Math.round(s.lubePct * 100)}% of fuel cost`],
    ['Operator (burdened)', `${money(s.operatorWage)}/h`],
    ['Ownership', `${s.ownYears} years × ${n0(s.annualHours)} h/yr = ${n0(s.ownYears * s.annualHours)} h`],
    ['Interest, insurance, tax', `${Math.round(s.interestPct * 100)}%/yr of average investment`],
    ['Job efficiency / operator', `${s.jobMinPerHour}-minute hour, ${s.skill} operator`],
    ['Ground conditions', s.ground],
    ['Fleets', `${Math.round(s.availability * 100)}% availability per machine; ${Math.round(s.crowdLossPct * 100)}% production lost per extra machine on the same job; ${money(s.supportPerMachine)}/h support & servicing per machine; ${s.hoursPerDay}-hour days`],
  ];
  return (
    <>
      <div class="table-wrap">
        <table class="data">
          <tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody>
        </table>
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>Per machine</th>{results.map((r) => <th key={r.m.id}>{r.m.name}{r.qty > 1 ? ` (×${r.qty})` : ''}</th>)}</tr></thead>
          <tbody>
            <tr><th>Purchase price</th>{results.map((r) => <td key={r.m.id}>{money(r.costs.price)}</td>)}</tr>
            <tr><th>Residual value</th>{results.map((r) => <td key={r.m.id}>{Math.round(r.costs.residualPct * 100)}%</td>)}</tr>
            <tr><th>Repair reserve (share of price)</th>{results.map((r) => <td key={r.m.id}>{Math.round(r.costs.repairPct * 100)}%</td>)}</tr>
            <tr><th>{family === 'hauler' ? 'Tires' : 'Undercarriage'} at moderate conditions</th>{results.map((r) => <td key={r.m.id}>{money2(r.costs.ucTiresPerHour)}/h</td>)}</tr>
            <tr><th>Wear items</th>{results.map((r) => <td key={r.m.id}>{money2(r.costs.wearPerHour)}/h</td>)}</tr>
            <tr><th>Mobilization, each</th>{results.map((r) => <td key={r.m.id}>{money(r.costs.mobCost)}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <p class="method"><b>Important.</b> Production and cost figures are estimates for comparing models on a common basis. Prices are
        illustrative defaults unless they were replaced with a dealer quote. Actual results depend on material, operator, site layout,
        maintenance and local prices. Specifications vary by region, configuration and build year. This is an independent tool and is not
        published or endorsed by Caterpillar Inc.</p>
      <h3>Sources</h3>
      <ol class="sources">
        {src.filter((k) => SOURCES[k]).map((k) => (
          <li key={k}>{SOURCES[k].title} – <a href={SOURCES[k].url} target="_blank" rel="noopener">{SOURCES[k].url.replace(/^https?:\/\//, '').slice(0, 80)}{SOURCES[k].url.length > 88 ? '…' : ''}</a></li>
        ))}
      </ol>
    </>
  );
}

export { n2 };

// "2 small or 1 big?" – fleet quantities, fleet pictures and the fleet scorecard.
import { FAMILY_ART, sizeKey, UNIT_LABEL, type Family } from '../data';
import { fleetRisk, MAX_QTY, qtyToMatch, type FleetRisk, type Result, type Settings } from '../engine/model';
import { matchFleets, setJobVolume, setQty, setSetting } from '../state';
import { colorOf, money, n0, n1, times, vol } from './format';

export const fleetName = (r: Result) => (r.qty > 1 ? `${r.qty} × ${r.m.name}` : r.m.name);

/** One picture per machine, drawn bigger for bigger machines, so "2 small vs 1 big" reads at a glance. */
export function FleetIcons({ r, all, family, max = 10 }: { r: Result; all: Result[]; family: Family; max?: number }) {
  const biggest = Math.max(...all.map((x) => sizeKey(x.m)));
  const w = Math.max(24, Math.round(64 * Math.sqrt(sizeKey(r.m) / biggest)));
  const shown = Math.min(r.qty, max);
  return (
    <div class="fleet-icons" aria-label={`${r.qty} machine${r.qty > 1 ? 's' : ''}`}>
      {Array.from({ length: shown }, (_, i) => <img key={i} src={FAMILY_ART[family]} alt="" style={{ width: `${w}px` }} />)}
      {r.qty > max && <span class="more">+{r.qty - max}</span>}
    </div>
  );
}

export function QtyStepper({ r }: { r: Result }) {
  return (
    <div class="qty ui-only" role="group" aria-label={`How many ${r.m.name}`}>
      <button onClick={() => setQty(r.m.id, r.qty - 1)} disabled={r.qty <= 1} aria-label="One fewer">−</button>
      <input type="number" min={1} max={MAX_QTY} value={r.qty}
        onChange={(e) => setQty(r.m.id, parseInt((e.target as HTMLInputElement).value, 10) || 1)} aria-label="Quantity" />
      <button onClick={() => setQty(r.m.id, r.qty + 1)} disabled={r.qty >= MAX_QTY} aria-label="One more">+</button>
      <span>{r.qty > 1 ? 'machines' : 'machine'}</span>
    </div>
  );
}

const pct0 = (v: number) => `${Math.round(v * 100)}%`;
const chance = (v: number) => (v < 0.001 ? 'under 0.1%' : v < 0.1 ? `${(v * 100).toFixed(1)}%` : pct0(v));

interface Row { label: string; hint?: string; cell: (r: Result, k: FleetRisk) => string; best?: (r: Result, k: FleetRisk) => number }

export function FleetPanel({ results, s, family }: { results: Result[]; s: Settings; family: Family }) {
  const u = UNIT_LABEL[family];
  const per = family === 'hauler' ? 'ton' : 'yd³';
  const jobVol = s.jobVolume[family];
  const risk = results.map((r) => fleetRisk(r, s, family));
  const rows: Row[] = [
    { label: 'Operators needed', hint: 'one per machine, per shift', cell: (r) => String(r.qty), best: (r) => r.qty },
    { label: 'Money tied up in machines', cell: (r) => money(r.capital), best: (r) => r.capital },
    { label: `Production per hour`, hint: 'whole fleet', cell: (r) => `${n0(r.prod)} ${u}${r.qty > 1 ? ` (${n0(r.single.prod)} each)` : ''}`, best: (r) => -r.prod },
    { label: `Days to finish ${vol(jobVol)} ${u}`, hint: `${s.hoursPerDay}-h days, allowing for breakdowns`, cell: (_, k) => n1(k.daysToFinish), best: (_, k) => k.daysToFinish },
    { label: 'Total cost of the job', hint: 'incl. moving in and out', cell: (_, k) => money(k.jobCost), best: (_, k) => k.jobCost },
    { label: `Cost per ${per}`, cell: (r) => `$${r.unitCost.toFixed(2)}`, best: (r) => r.unitCost },
    { label: 'Moving the fleet', hint: 'round trip', cell: (r) => `${money(r.mobCost)} · ${r.loads} load${r.loads > 1 ? 's' : ''}`, best: (r) => r.mobCost },
    { label: 'Fuel', cell: (r) => `${n1(r.fuelH)} gal/h`, best: (r) => r.fuelPerUnit },
    { label: 'Repair, maintenance & support', cell: (r) => `${money(r.breakdown['Repair reserve'] + r.breakdown['Undercarriage / tires'] + r.breakdown['Wear items'] + r.breakdown['Lube, filters, grease'] + r.breakdown['Support & servicing'])}/h` },
    { label: 'If one machine breaks down', cell: (r, k) => (r.qty === 1 ? 'Job stops' : `${pct0(k.capacityOneDown)} keeps working`), best: (_, k) => -k.capacityOneDown },
    { label: 'Chance the whole fleet is down at once', hint: `at ${pct0(s.availability)} availability`, cell: (_, k) => chance(k.allDown), best: (_, k) => k.allDown },
  ];

  return (
    <div class="fleet-box">
      <div class="fleet-head">
        <h3>{results.length > 1 ? 'Several smaller machines or fewer big ones?' : 'Fleet size'}</h3>
        <div class="fleet-inputs ui-only">
          <label>Job size <input type="number" min={1} step={1000} value={jobVol}
            onChange={(e) => setJobVolume(parseFloat((e.target as HTMLInputElement).value) || jobVol)} /> {u}</label>
          <label>Hours per day <input type="number" min={1} max={24} value={s.hoursPerDay}
            onChange={(e) => setSetting('hoursPerDay', Math.max(1, Math.min(24, parseFloat((e.target as HTMLInputElement).value) || 10)))} /></label>
        </div>
      </div>
      <div class="table-wrap">
        <table class="data fleet-table">
          <thead>
            <tr><th></th>{results.map((r) => (
              <th key={r.m.id}><span class="sw" style={{ background: colorOf(r.m.id) }} />{fleetName(r)}</th>
            ))}</tr>
          </thead>
          <tbody>
            <tr class="icons-row"><th>Fleet</th>{results.map((r) => <td key={r.m.id}><FleetIcons r={r} all={results} family={family} max={12} /></td>)}</tr>
            {rows.map((row) => {
              const scores = row.best ? results.map((r, i) => row.best!(r, risk[i])) : [];
              const bestScore = scores.length ? Math.min(...scores) : NaN;
              const unique = scores.filter((x) => x === bestScore).length < results.length;
              return (
                <tr key={row.label}>
                  <th>{row.label}{row.hint && <small>{row.hint}</small>}</th>
                  {results.map((r, i) => (
                    <td key={r.m.id} class={results.length > 1 && unique && scores[i] === bestScore ? 'best' : ''}>{row.cell(r, risk[i])}</td>
                  ))}
                </tr>
              );
            })}
            {results.length > 1 && (
              <tr class="ui-only"><th>Even up</th>{results.map((r) => (
                <td key={r.m.id}><button class="small-btn" onClick={() => matchFleets(r.m.id)}
                  title={`Change the other fleets' sizes so they produce at least as much as ${fleetName(r)}`}>Match this output</button></td>
              ))}</tr>
            )}
          </tbody>
        </table>
      </div>
      {results.length > 1 && <Verdict results={results} risk={risk} s={s} family={family} />}
      <p class="note">Green marks the best fleet on each line. More machines on one job get in each other's way, so each extra machine loses
        {' '}{pct0(s.crowdLossPct)} of production; every machine also adds {money(s.supportPerMachine)}/h of support and servicing and needs its own operator.</p>
    </div>
  );
}

function Verdict({ results, risk, s, family }: { results: Result[]; risk: FleetRisk[]; s: Settings; family: Family }) {
  const u = UNIT_LABEL[family];
  const idx = results.map((_, i) => i);
  const by = (f: (i: number) => number) => idx.reduce((a, i) => (f(i) < f(a) ? i : a), 0);
  const cheap = by((i) => risk[i].jobCost);
  const fast = by((i) => risk[i].daysToFinish);
  const safe = by((i) => risk[i].allDown);
  const lean = by((i) => results[i].qty);
  const others = idx.filter((i) => i !== cheap);
  const runnerUp = others.length ? others.reduce((a, i) => (risk[i].jobCost < risk[a].jobCost ? i : a), others[0]) : cheap;
  const items: string[] = [];
  items.push(`<b>Lowest total cost:</b> ${fleetName(results[cheap])}, ${money(risk[cheap].jobCost)} for ${n0(s.jobVolume[family])} ${u}` +
    (runnerUp !== cheap ? `, ${money(risk[runnerUp].jobCost - risk[cheap].jobCost)} less than ${fleetName(results[runnerUp])}.` : '.'));
  items.push(`<b>Finishes first:</b> ${fleetName(results[fast])}, in about ${n1(risk[fast].daysToFinish)} working days.`);
  items.push(`<b>Fewest operators to find:</b> ${fleetName(results[lean])} (${results[lean].qty}).`);
  if (results[safe].qty > 1) items.push(`<b>Least risk of a stopped job:</b> ${fleetName(results[safe])}; if one machine breaks down, ${pct0(risk[safe].capacityOneDown)} of the fleet keeps working.`);

  // How many of each smaller model match the biggest single-machine fleet?
  const sorted = [...results].sort((a, b) => sizeKey(b.m) - sizeKey(a.m));
  const big = sorted[0];
  for (const r of sorted.slice(1)) {
    const q = qtyToMatch(r.m, s, big.prod);
    if (q >= MAX_QTY && r.single.prod * MAX_QTY < big.prod) continue;
    items.push(`<b>Matching output:</b> it takes about ${q} × ${r.m.name} to move as much as ${fleetName(big)}` +
      ` (${times((r.single.prod * q * Math.max(0.6, 1 - s.crowdLossPct * (q - 1))) / big.prod)} the output).`);
  }
  return <ul class="verdict">{items.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}</ul>;
}

import { useState } from 'preact/hooks';
import { FAMILY_LABEL, isCurrent, sizeClass, sizeKey, yearsLabel, type Family, type Machine } from '../data';
import { defaultCosts, type CostInputs, type Settings } from '../engine/model';
import {
  available, clearSelection, costsFor, family, MAX_MODELS, overrides, resetOverrides, selected, selection, setOverride,
  setSetting, settings, showPrevious, toggleModel,
} from '../state';
import { colorOf, money } from './format';

export function FamilyTabs() {
  return (
    <div class="family-tabs" role="tablist" aria-label="Equipment line">
      {(Object.keys(FAMILY_LABEL) as Family[]).map((f) => (
        <button key={f} role="tab" aria-selected={family.value === f} class={family.value === f ? 'on' : ''}
          onClick={() => { family.value = f; }}>{FAMILY_LABEL[f]}</button>
      ))}
    </div>
  );
}

export function ModelPicker() {
  const [q, setQ] = useState('');
  const sel = selection.value[family.value];
  const list = available.value
    .filter((m) => showPrevious.value || isCurrent(m) || sel.includes(m.id))
    .filter((m) => !q || m.name.toLowerCase().includes(q.toLowerCase()))
    .slice()
    .sort((a, b) => sizeKey(a) - sizeKey(b));
  const groups = new Map<string, Machine[]>();
  for (const m of list) {
    const g = sizeClass(m);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(m);
  }
  const full = sel.length >= MAX_MODELS;
  return (
    <div class="panel">
      <div class="panel-head">
        <h3>Models <span class="count">{sel.length}/{MAX_MODELS}</span></h3>
        {sel.length > 0 && <button class="link" onClick={clearSelection}>Clear</button>}
      </div>
      <div class="chips">
        {selected.value.map((m) => (
          <button key={m.id} class="chip" onClick={() => toggleModel(m.id)} title="Remove">
            <i style={{ background: colorOf(m.id) }} />{m.name}<span aria-hidden="true">×</span>
          </button>
        ))}
        {!sel.length && <span class="hint">Pick up to {MAX_MODELS} models to compare.</span>}
      </div>
      <div class="picker-tools">
        <input type="search" placeholder="Search models" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <label class="check"><input type="checkbox" checked={showPrevious.value}
          onChange={(e) => { showPrevious.value = (e.target as HTMLInputElement).checked; }} /> Include previous models (2016+)</label>
      </div>
      <div class="picker">
        {[...groups.entries()].map(([g, ms]) => (
          <div key={g} class="pgroup">
            <div class="pgroup-title">{g}</div>
            {ms.map((m) => {
              const on = sel.includes(m.id);
              return (
                <button key={m.id} class={`pitem${on ? ' on' : ''}`} disabled={!on && full} onClick={() => toggleModel(m.id)}
                  aria-pressed={on}>
                  <span class="pname">{on && <i style={{ background: colorOf(m.id) }} />}{m.name}</span>
                  <span class="pmeta">{keySpec(m)} · {yearsLabel(m)}{!m.verified && <em title="Some specs estimated"> ·  verify</em>}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function keySpec(m: Machine): string {
  if (m.family === 'hauler') return `${m.payloadTon} ton`;
  return `${m.netHp} hp, ${Math.round(m.opWeightLb / 1000)}k lb`;
}

// ---------------------------------------------------------------- job conditions
function Num(props: { label: string; k: keyof Settings; step?: number; min?: number; max?: number; suffix?: string; scale?: number }) {
  const scale = props.scale ?? 1;
  const v = settings.value[props.k] as number;
  return (
    <label class="field">
      <span>{props.label}</span>
      <span class="input-wrap">
        <input type="number" inputMode="decimal" value={+(v * scale).toFixed(4)} step={props.step ?? 1} min={props.min} max={props.max}
          onChange={(e) => {
            const n = parseFloat((e.target as HTMLInputElement).value);
            if (Number.isFinite(n)) setSetting(props.k, (n / scale) as never);
          }} />
        {props.suffix && <em>{props.suffix}</em>}
      </span>
    </label>
  );
}

function Sel<K extends keyof Settings>(props: { label: string; k: K; options: [Settings[K], string][] }) {
  const v = settings.value[props.k];
  return (
    <label class="field">
      <span>{props.label}</span>
      <select value={String(v)} onChange={(e) => {
        const raw = (e.target as HTMLSelectElement).value;
        const opt = props.options.find(([o]) => String(o) === raw);
        if (opt) setSetting(props.k, opt[0]);
      }}>
        {props.options.map(([o, l]) => <option key={String(o)} value={String(o)}>{l}</option>)}
      </select>
    </label>
  );
}

export function Conditions() {
  const f = family.value;
  return (
    <details class="panel" open>
      <summary><h3>Job conditions</h3></summary>
      <div class="fields">
        {f === 'dozer' && (<>
          <Num label="Average push distance" k="pushFt" step={10} min={20} max={600} suffix="ft" />
          <Sel label="Blade" k="dozerBlade" options={[['main', 'Main blade (SU / VPAT)'], ['u', 'Universal (U) where offered']]} />
          <Sel label="Material" k="dozerMaterial" options={[['loose', 'Loose stockpile'], ['average', 'Average earth'], ['hard', 'Hard to cut / sticky']]} />
          <Sel label="Slot dozing" k="slotDozing" options={[[false, 'No'], [true, 'Yes (+20%)']]} />
          <Num label="Grade (+ uphill)" k="dozerGradePct" step={1} min={-30} max={30} suffix="%" />
        </>)}
        {f === 'excavator' && (<>
          <Sel label="Digging" k="digDifficulty" options={[['easy', 'Easy (loose sand, gravel)'], ['medium', 'Medium (common earth, clay)'], ['hard', 'Hard (shot rock, hard clay)'], ['veryHard', 'Very hard (poorly shot rock)']]} />
          <Sel label="Swing angle to truck" k="swingDeg" options={[[45, '45°'], [90, '90°'], [135, '135°'], [180, '180°']]} />
        </>)}
        {f === 'hauler' && (<>
          <Num label="One-way haul distance" k="haulMiles" step={0.25} min={0.1} max={10} suffix="mi" />
          <Num label="Grade, loaded direction (+ uphill)" k="haulGradePct" step={1} min={-15} max={20} suffix="%" />
          <Num label="Rolling resistance" k="rollingPct" step={0.5} min={1} max={15} suffix="%" />
          <Num label="Material density (loose)" k="densityTonPerYd3" step={0.05} min={0.5} max={3} suffix="ton/yd³" />
        </>)}
        <Sel label="Fuel load" k="load" options={[['low', 'Low'], ['med', 'Medium'], ['high', 'High']]} />
        <Sel label="Ground (wear)" k="ground" options={[['low', 'Low impact / abrasion'], ['moderate', 'Moderate'], ['severe', 'Severe (rock)']]} />
        <Sel label="Operator" k="skill" options={[['excellent', 'Excellent'], ['average', 'Average'], ['poor', 'Below average']]} />
        <Num label="Productive minutes per hour" k="jobMinPerHour" step={5} min={30} max={60} suffix="min" />
      </div>
    </details>
  );
}

// ---------------------------------------------------------------- money
export function CostEditor() {
  const ms = selected.value;
  const fields: [keyof CostInputs, string, number, string][] = [
    ['price', 'Purchase price', 1, '$'],
    ['mobCost', 'Mobilization, round trip', 1, '$'],
    ['residualPct', 'Residual value', 100, '%'],
    ['repairPct', 'Repair reserve (share of price)', 100, '%'],
    ['ucTiresPerHour', family.value === 'hauler' ? 'Tires $/h' : 'Undercarriage $/h', 1, '$/h'],
    ['wearPerHour', 'Wear items $/h', 1, '$/h'],
  ];
  return (
    <details class="panel">
      <summary><h3>Prices & costs</h3></summary>
      <p class="hint">Defaults are illustrative estimates. Type a dealer quote over any value; it is saved on this device.</p>
      <div class="fields">
        <Num label="Fuel price" k="fuelPrice" step={0.05} suffix="$/gal" />
        <Num label="DEF price" k="defPrice" step={0.05} suffix="$/gal" />
        <Num label="Operator wage (burdened)" k="operatorWage" step={1} suffix="$/h" />
        <Num label="Hours per year" k="annualHours" step={100} suffix="h" />
        <Num label="Ownership period" k="ownYears" step={1} min={1} max={15} suffix="yr" />
        <Num label="Interest, insurance, tax" k="interestPct" step={0.5} scale={100} suffix="%/yr" />
      </div>
      {ms.map((m) => {
        const c = costsFor(m);
        const d = defaultCosts(m);
        const changed = Object.keys(overrides.value[m.id] ?? {}).length > 0;
        return (
          <div key={m.id} class="cost-model">
            <div class="panel-head">
              <b><i class="dot" style={{ background: colorOf(m.id) }} />{m.name}</b>
              {changed && <button class="link" onClick={() => resetOverrides(m.id)}>Reset to defaults</button>}
            </div>
            <div class="fields">
              {fields.map(([k, label, scale, unit]) => (
                <label key={k} class={`field${overrides.value[m.id]?.[k] !== undefined ? ' edited' : ''}`}>
                  <span>{label}</span>
                  <span class="input-wrap">
                    <input type="number" inputMode="decimal" value={+(c[k] * scale).toFixed(2)}
                      onChange={(e) => {
                        const raw = (e.target as HTMLInputElement).value;
                        if (raw === '') { setOverride(m.id, k, undefined); return; }
                        const n = parseFloat(raw) / scale;
                        setOverride(m.id, k, Number.isFinite(n) && Math.abs(n - d[k]) > 1e-9 ? n : undefined);
                      }} />
                    <em>{unit}</em>
                  </span>
                </label>
              ))}
            </div>
            <div class="hint">Default price {money(d.price)}</div>
          </div>
        );
      })}
    </details>
  );
}

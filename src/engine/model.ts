// Production, fuel and cost model. Every assumption lives here or in Settings so the
// app, the charts and the PDF all use the same numbers.
import type { Dozer, Excavator, Family, FuelBurn, Hauler, Machine } from '../data';

const LB_PER_T = 2204.6;
const GAL_PER_HP_H = 0.054; // diesel use per hp-hour at full load (approx. BSFC)

export type Load = 'low' | 'med' | 'high';
export type Ground = 'low' | 'moderate' | 'severe';
export type Skill = 'excellent' | 'average' | 'poor';

export interface Settings {
  fuelPrice: number; // $/gal
  defPrice: number; // $/gal
  defRatio: number; // fraction of fuel
  lubePct: number; // fraction of fuel cost
  operatorWage: number; // burdened $/h
  annualHours: number;
  ownYears: number;
  interestPct: number; // interest + insurance + tax, fraction/yr of average investment
  jobMinPerHour: number; // productive minutes per hour
  load: Load;
  ground: Ground;
  skill: Skill;
  // dozers
  pushFt: number;
  dozerBlade: 'main' | 'u';
  dozerMaterial: 'loose' | 'average' | 'hard';
  slotDozing: boolean;
  dozerGradePct: number; // + uphill
  // excavators
  digDifficulty: 'easy' | 'medium' | 'hard' | 'veryHard';
  swingDeg: 45 | 90 | 135 | 180;
  // haulers
  haulMiles: number;
  haulGradePct: number; // + uphill when loaded
  rollingPct: number;
  densityTonPerYd3: number;
  // fleets
  availability: number; // mechanical availability of each machine, fraction
  crowdLossPct: number; // production lost per extra machine working the same job, fraction
  supportPerMachine: number; // $/h per machine: service-truck visits, fueling, PM labor, admin
  hoursPerDay: number;
  jobVolume: Record<Family, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  fuelPrice: 3.5,
  defPrice: 3.0,
  defRatio: 0.05,
  lubePct: 0.12,
  operatorWage: 60,
  annualHours: 2000,
  ownYears: 5,
  interestPct: 0.08,
  jobMinPerHour: 50,
  load: 'med',
  ground: 'moderate',
  skill: 'average',
  pushFt: 200,
  dozerBlade: 'main',
  dozerMaterial: 'average',
  slotDozing: false,
  dozerGradePct: 0,
  digDifficulty: 'medium',
  swingDeg: 90,
  haulMiles: 1,
  haulGradePct: 5,
  rollingPct: 3,
  densityTonPerYd3: 1.5,
  availability: 0.9,
  crowdLossPct: 0.03,
  supportPerMachine: 10,
  hoursPerDay: 10,
  jobVolume: { dozer: 100_000, excavator: 150_000, hauler: 1_000_000 },
};

/** Per-machine money assumptions the salesperson can override. */
export interface CostInputs {
  price: number;
  residualPct: number;
  repairPct: number; // lifetime repair reserve as a fraction of price, excl. undercarriage/tires
  ucTiresPerHour: number; // undercarriage (tracked) or tires (trucks) at moderate conditions
  wearPerHour: number; // cutting edges, teeth, liners
  mobCost: number; // round-trip mobilization per job
}

const tonnes = (lb: number) => lb / LB_PER_T;
const round = (v: number, step: number) => Math.round(v / step) * step;

export function shipWeightLb(m: Machine): number {
  if (m.family === 'dozer') return m.shipWeightLb ?? m.opWeightLb * 0.76;
  if (m.family === 'excavator') return m.opWeightLb * 0.85;
  return emptyWeightLb(m);
}

export function gvwLb(m: Hauler): number {
  return m.gvwLb ?? m.payloadTon * 2000 * (m.kind === 'articulated' ? 1.75 : 1.8);
}
export function emptyWeightLb(m: Hauler): number {
  return gvwLb(m) - m.payloadTon * 2000;
}

export function defaultCosts(m: Machine): CostInputs {
  if (m.family === 'dozer') {
    const t = tonnes(m.opWeightLb);
    const price = round(24000 * Math.pow(t, 1.1) * (m.electricDrive ? 1.12 : 1), 5000);
    return { price, residualPct: 0.4, repairPct: 0.45, ucTiresPerHour: round(0.24 * t * 0.9 * 1.25, 0.5),
      wearPerHour: round(price * 0.0000045, 0.5), mobCost: mob(shipWeightLb(m)) };
  }
  if (m.family === 'excavator') {
    const t = tonnes(m.opWeightLb);
    const price = round(11500 * Math.pow(t, 1.05), 5000);
    return { price, residualPct: 0.4, repairPct: 0.4, ucTiresPerHour: round(0.07 * t * 0.9 * 1.25, 0.5),
      wearPerHour: round(price * 0.00001, 0.5), mobCost: mob(shipWeightLb(m)) };
  }
  const price = round(
    (m.kind === 'articulated' ? 21000 * m.payloadTon : 48000 * Math.pow(m.payloadTon, 0.8)) * (m.drive === 'electric' ? 1.05 : 1),
    5000,
  );
  const empty = emptyWeightLb(m);
  const mobCost = m.kind === 'articulated' ? 2500 + 0.05 * empty : m.payloadTon <= 110 ? 8000 + 0.08 * empty : 0.03 * price;
  return { price, residualPct: 0.35, repairPct: 0.5, ucTiresPerHour: round(price * 0.000018, 0.5),
    wearPerHour: round(price * 0.000003, 0.5), mobCost: round(mobCost, 500) };
}

function mob(shipLb: number): number {
  return round(2500 + 0.09 * shipLb + (shipLb > 80000 ? 10000 : 0) + (shipLb > 160000 ? 25000 : 0), 500);
}

// ---------------------------------------------------------------- fuel
const FUEL_LF: Record<string, number> = { dozer: 0.44, excavator: 0.36, articulated: 0.25, rigid: 0.3 };

export function fuelBurn(m: Machine): { burn: FuelBurn; estimated: boolean } {
  if (m.fuel) return { burn: m.fuel, estimated: false };
  const key = m.family === 'hauler' ? m.kind : m.family;
  const med = m.netHp * FUEL_LF[key] * GAL_PER_HP_H;
  return { burn: [med * 0.77, med, med * 1.23], estimated: true };
}

export function fuelPerHour(m: Machine, s: Settings): number {
  const [l, md, h] = fuelBurn(m).burn;
  return s.load === 'low' ? l : s.load === 'high' ? h : md;
}

// ---------------------------------------------------------------- production
const SKILL: Record<Family, Record<Skill, number>> = {
  dozer: { excellent: 1, average: 0.75, poor: 0.6 },
  excavator: { excellent: 1, average: 0.85, poor: 0.7 },
  hauler: { excellent: 1, average: 0.95, poor: 0.85 },
};

/** Sweep variable for the "production vs ..." charts. */
export const SWEEP: Record<Family, { label: string; unit: string; values: number[]; key: 'pushFt' | 'swingDeg' | 'haulMiles' }> = {
  dozer: { label: 'Average push distance', unit: 'ft', values: range(50, 400, 10), key: 'pushFt' },
  excavator: { label: 'Swing angle', unit: '°', values: [45, 60, 75, 90, 105, 120, 135, 150, 165, 180], key: 'swingDeg' },
  hauler: { label: 'One-way haul distance', unit: 'mi', values: range(0.25, 4, 0.25), key: 'haulMiles' },
};

function range(a: number, b: number, step: number): number[] {
  const out: number[] = [];
  for (let v = a; v <= b + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

export function dozerSpeeds(m: Dozer): { f1: number; r2: number; estimated: boolean } {
  if (m.f1Mph && m.r2Mph) return { f1: m.f1Mph, r2: m.r2Mph, estimated: false };
  // Class-typical 1st-forward / 2nd-reverse speeds where the spec isn't in the database.
  const hp = m.netHp;
  const f1 = hp < 120 ? 2.0 : hp < 300 ? 2.1 : hp < 500 ? 2.3 : 2.4;
  const r2 = hp < 120 ? 3.8 : hp < 300 ? 4.0 : hp < 500 ? 4.4 : 5.2;
  return { f1, r2, estimated: true };
}

export function dozerBladeYd3(m: Dozer, s: Settings): number {
  return s.dozerBlade === 'u' && m.uBladeYd3 ? m.uBladeYd3 : m.blade.yd3;
}

export function dozerCycleMin(m: Dozer, pushFt: number): number {
  const { f1, r2 } = dozerSpeeds(m);
  return 0.1 + pushFt / (f1 * 0.7 * 88) + pushFt / (r2 * 0.9 * 88);
}

function dozerProd(m: Dozer, s: Settings, pushFt: number): number {
  const mat = s.dozerMaterial === 'loose' ? 1.2 : s.dozerMaterial === 'hard' ? 0.8 : 1;
  const slot = s.slotDozing ? 1.2 : 1;
  const grade = Math.min(1.5, Math.max(0.4, 1 - 0.02 * s.dozerGradePct));
  return (dozerBladeYd3(m, s) * 60) / dozerCycleMin(m, pushFt) * mat * slot * grade * SKILL.dozer[s.skill] * (s.jobMinPerHour / 60);
}

const DIG: Record<Settings['digDifficulty'], { time: number; fill: number }> = {
  easy: { time: 0.85, fill: 1.0 },
  medium: { time: 1.0, fill: 0.9 },
  hard: { time: 1.2, fill: 0.8 },
  veryHard: { time: 1.4, fill: 0.7 },
};

export function excavatorCycleSec(m: Excavator, s: Settings, swing: number): number {
  const swingF = 0.7 + (swing / 90) * 0.3; // 45° 0.85, 90° 1.0, 180° 1.3
  return (12 + 1.2 * Math.sqrt(tonnes(m.opWeightLb))) * DIG[s.digDifficulty].time * swingF;
}

function excavatorProd(m: Excavator, s: Settings, swing: number): number {
  return (m.bucketYd3 * DIG[s.digDifficulty].fill * 3600) / excavatorCycleSec(m, s, swing) * SKILL.excavator[s.skill] * (s.jobMinPerHour / 60);
}

export interface HaulCycle {
  payloadTon: number;
  volumeLimited: boolean;
  loadMin: number;
  loadedMph: number;
  emptyMph: number;
  travelMin: number;
  dumpMin: number;
  cycleMin: number;
}

function speedMph(hp: number, weightLb: number, trPct: number, top: number): number {
  if (trPct <= 0) return 0.5 * top; // retarder-limited downhill
  const v = (hp * 0.75 * 375) / (weightLb * (trPct / 100));
  return Math.min(0.65 * top, v);
}

export function haulCycle(m: Hauler, s: Settings, miles: number): HaulCycle {
  const volCap = m.heapedYd3 ? m.heapedYd3 * s.densityTonPerYd3 : Infinity;
  const payloadTon = Math.min(m.payloadTon, volCap);
  const loaded = gvwLb(m) - (m.payloadTon - payloadTon) * 2000;
  const empty = emptyWeightLb(m);
  const loadedMph = speedMph(m.netHp, loaded, s.rollingPct + s.haulGradePct, m.topSpeedMph);
  const emptyMph = speedMph(m.netHp, empty, Math.max(s.rollingPct - s.haulGradePct, 1.5), m.topSpeedMph);
  const travelMin = (miles / loadedMph + miles / emptyMph) * 60;
  const loadMin = 0.6 + 0.009 * m.payloadTon;
  const dumpMin = 0.6 + 0.0025 * m.payloadTon;
  return { payloadTon, volumeLimited: payloadTon < m.payloadTon, loadMin, loadedMph, emptyMph, travelMin, dumpMin,
    cycleMin: loadMin + travelMin + dumpMin };
}

function haulerProd(m: Hauler, s: Settings, miles: number): number {
  const c = haulCycle(m, s, miles);
  return (c.payloadTon * 60) / c.cycleMin * SKILL.hauler[s.skill] * (s.jobMinPerHour / 60);
}

/** Production per hour in the family's unit (loose yd³ or tons). `sweep` overrides the sweep variable. */
export function production(m: Machine, s: Settings, sweep?: number): number {
  if (m.family === 'dozer') return dozerProd(m, s, sweep ?? s.pushFt);
  if (m.family === 'excavator') return excavatorProd(m, s, sweep ?? s.swingDeg);
  return haulerProd(m, s, sweep ?? s.haulMiles);
}

// ---------------------------------------------------------------- cost
const GROUND_MULT: Record<Ground, number> = { low: 0.45, moderate: 1, severe: 1.9 };

export interface CostBreakdown {
  'Ownership (depreciation)': number;
  'Interest, insurance, tax': number;
  'Fuel + DEF': number;
  'Lube, filters, grease': number;
  'Repair reserve': number;
  'Undercarriage / tires': number;
  'Wear items': number;
  'Support & servicing': number;
  Operator: number;
}
export const COST_KEYS = [
  'Ownership (depreciation)', 'Interest, insurance, tax', 'Fuel + DEF', 'Lube, filters, grease',
  'Repair reserve', 'Undercarriage / tires', 'Wear items', 'Support & servicing', 'Operator',
] as const;

export function hourlyCost(m: Machine, s: Settings, c: CostInputs): CostBreakdown {
  const lifeHours = s.annualHours * s.ownYears;
  const gal = fuelPerHour(m, s);
  const fuel = gal * s.fuelPrice;
  return {
    'Ownership (depreciation)': (c.price * (1 - c.residualPct)) / lifeHours,
    'Interest, insurance, tax': ((c.price * (1 + c.residualPct)) / 2) * s.interestPct / s.annualHours,
    'Fuel + DEF': fuel + gal * s.defRatio * s.defPrice,
    'Lube, filters, grease': fuel * s.lubePct,
    'Repair reserve': (c.price * c.repairPct) / lifeHours,
    'Undercarriage / tires': c.ucTiresPerHour * GROUND_MULT[s.ground],
    'Wear items': c.wearPerHour * GROUND_MULT[s.ground],
    'Support & servicing': s.supportPerMachine,
    Operator: s.operatorWage,
  };
}

export const totalCost = (b: CostBreakdown) => COST_KEYS.reduce((a, k) => a + b[k], 0);
export const repairTotal = (b: CostBreakdown) =>
  b['Repair reserve'] + b['Undercarriage / tires'] + b['Wear items'] + b['Lube, filters, grease'] + b['Support & servicing'];

// ---------------------------------------------------------------- fleets
export const MAX_QTY = 20;

/** Production share kept when `qty` machines work the same job (interference, waiting at the loader). */
export function crowdFactor(qty: number, s: Settings): number {
  return Math.max(0.6, 1 - s.crowdLossPct * (qty - 1));
}

/** Lowboy loads needed to move one machine. */
export function loadsPerMachine(m: Machine): number {
  if (m.family === 'hauler' && m.kind === 'articulated') return 1; // usually driven or one load
  const lb = shipWeightLb(m);
  if (lb <= 80000) return 1;
  if (lb <= 160000) return 2;
  return Math.ceil(lb / 70000);
}

// ---------------------------------------------------------------- comparison
/** A fleet of `qty` identical machines. Every money, fuel and production figure is for the whole fleet. */
export interface Result {
  m: Machine;
  qty: number;
  costs: CostInputs;
  /** One machine on its own (no crowding). */
  single: { prod: number; fuelH: number; costH: number; breakdown: CostBreakdown };
  prod: number;
  fuelH: number;
  fuelEstimated: boolean;
  breakdown: CostBreakdown;
  costH: number;
  unitCost: number;
  fuelPerUnit: number;
  mobCost: number;
  loads: number;
  capital: number;
}

export function evaluate(m: Machine, s: Settings, costs: CostInputs, qty = 1): Result {
  const one = production(m, s);
  const fuel1 = fuelPerHour(m, s);
  const b1 = hourlyCost(m, s, costs);
  const breakdown = Object.fromEntries(COST_KEYS.map((k) => [k, b1[k] * qty])) as unknown as CostBreakdown;
  const prod = one * qty * crowdFactor(qty, s);
  const fuelH = fuel1 * qty;
  const costH = totalCost(breakdown);
  return {
    m, qty, costs,
    single: { prod: one, fuelH: fuel1, costH: totalCost(b1), breakdown: b1 },
    prod, fuelH, fuelEstimated: fuelBurn(m).estimated, breakdown, costH,
    unitCost: costH / prod, fuelPerUnit: fuelH / prod,
    mobCost: costs.mobCost * qty, loads: loadsPerMachine(m) * qty, capital: costs.price * qty,
  };
}

/** Fleet production at a different value of the sweep variable. */
export function fleetProduction(r: Result, s: Settings, sweep?: number): number {
  return production(r.m, s, sweep) * r.qty * crowdFactor(r.qty, s);
}

/** Smallest quantity of this model whose fleet production reaches `target`. */
export function qtyToMatch(m: Machine, s: Settings, target: number): number {
  const one = production(m, s);
  for (let q = 1; q <= MAX_QTY; q++) if (one * q * crowdFactor(q, s) >= target * 0.999) return q;
  return MAX_QTY;
}

export interface FleetRisk {
  /** Expected production allowing for breakdowns. */
  expectedProd: number;
  /** Share of fleet capacity still working when one machine is down. */
  capacityOneDown: number;
  /** Chance that every machine is down at the same time. */
  allDown: number;
  daysToFinish: number;
  jobCost: number;
}

export function fleetRisk(r: Result, s: Settings, family: Family): FleetRisk {
  const a = s.availability;
  const expectedProd = r.prod * a;
  const vol = s.jobVolume[family];
  const capacityOneDown = r.qty <= 1 ? 0 : ((r.qty - 1) * crowdFactor(r.qty - 1, s)) / (r.qty * crowdFactor(r.qty, s));
  return {
    expectedProd,
    capacityOneDown,
    allDown: Math.pow(1 - a, r.qty),
    daysToFinish: vol / expectedProd / s.hoursPerDay,
    jobCost: r.mobCost + r.unitCost * vol,
  };
}

/** All-in cost per unit for a job of `volume` units, including one round-trip mobilization. */
export const allInUnitCost = (r: Result, volume: number) => (r.mobCost + r.unitCost * volume) / volume;

export interface Step {
  from: Result;
  to: Result;
  /** Job size above which the larger machine is cheaper; 0 = always; null = never. */
  volume: number | null;
}

/** Break-even job size for each step up in size (results must be sorted small → large). */
export function sizeSteps(sorted: Result[]): Step[] {
  const out: Step[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i], b = sorted[i + 1];
    let volume: number | null;
    if (b.unitCost >= a.unitCost) volume = b.mobCost <= a.mobCost && b.unitCost === a.unitCost ? 0 : null;
    else volume = Math.max(0, (b.mobCost - a.mobCost) / (a.unitCost - b.unitCost));
    out.push({ from: a, to: b, volume });
  }
  return out;
}

export interface Band { r: Result; from: number; to: number }

/** Which machine is cheapest all-in across job sizes (log-spaced between lo and hi). */
export function cheapestBands(results: Result[], lo: number, hi: number): Band[] {
  const bands: Band[] = [];
  const n = 240;
  for (let i = 0; i <= n; i++) {
    const v = lo * Math.pow(hi / lo, i / n);
    let best = results[0];
    for (const r of results) if (allInUnitCost(r, v) < allInUnitCost(best, v)) best = r;
    const last = bands[bands.length - 1];
    if (last && last.r === best) last.to = v;
    else {
      // Snap the boundary to the exact job size where the two all-in costs cross.
      let from = v;
      if (last && last.r.unitCost !== best.unitCost) {
        const x = (best.mobCost - last.r.mobCost) / (last.r.unitCost - best.unitCost);
        if (x > 0 && Number.isFinite(x)) from = x;
      }
      bands.push({ r: best, from, to: v });
    }
  }
  return bands;
}

export const VOLUME_RANGE: Record<Family, [number, number]> = {
  dozer: [2000, 2_000_000],
  excavator: [2000, 3_000_000],
  hauler: [10_000, 20_000_000],
};

import { yearsLabel, type Machine } from '../data';
import { dozerSpeeds, fuelBurn, gvwLb, shipWeightLb } from '../engine/model';
import { lbToT, n0, n1, ydToM3 } from './format';

export interface SpecRow { label: string; get: (m: Machine) => string; num?: (m: Machine) => number }

const wt = (lb: number) => `${n0(lb)} lb (${n1(lbToT(lb))} t)`;
const yd = (v: number) => `${n1(v)} yd³ (${n1(ydToM3(v))} m³)`;

const common: SpecRow[] = [
  { label: 'Years on sale', get: yearsLabel },
  { label: 'Engine', get: (m) => m.engine },
  { label: 'Net power', get: (m) => `${n0(m.netHp)} hp (${n0(m.netHp * 0.7457)} kW)`, num: (m) => m.netHp },
];

const fuel: SpecRow = {
  label: 'Fuel burn, medium load',
  get: (m) => { const f = fuelBurn(m); return `${n1(f.burn[1])} gal/h${f.estimated ? ' (est.)' : ''}`; },
  num: (m) => fuelBurn(m).burn[1],
};

export const SPEC_ROWS: Record<Machine['family'], SpecRow[]> = {
  dozer: [
    ...common,
    { label: 'Operating weight', get: (m) => (m.family === 'dozer' ? wt(m.opWeightLb) : ''), num: (m) => (m.family === 'dozer' ? m.opWeightLb : 0) },
    { label: 'Shipping weight (approx.)', get: (m) => wt(shipWeightLb(m)), num: shipWeightLb },
    { label: 'Main blade', get: (m) => (m.family === 'dozer' ? `${m.blade.type}, ${yd(m.blade.yd3)}` : ''), num: (m) => (m.family === 'dozer' ? m.blade.yd3 : 0) },
    { label: 'Universal (U) blade', get: (m) => (m.family === 'dozer' && m.uBladeYd3 ? yd(m.uBladeYd3) : '—') },
    { label: 'Ripper available', get: (m) => (m.family === 'dozer' ? (m.ripper ? 'Yes' : 'No') : '') },
    { label: 'Drive', get: (m) => (m.family === 'dozer' ? (m.electricDrive ? 'Electric drive' : m.netHp < 200 ? 'Hydrostatic' : 'Powershift / automatic') : '') },
    { label: 'Dozing / return speed used', get: (m) => {
      if (m.family !== 'dozer') return '';
      const s = dozerSpeeds(m);
      return `${n1(s.f1 * 0.7)} / ${n1(s.r2 * 0.9)} mph${s.estimated ? ' (class typical)' : ''}`;
    } },
    { label: 'Fuel tank', get: (m) => (m.family === 'dozer' && m.fuelTankGal ? `${n1(m.fuelTankGal)} gal` : '—') },
    fuel,
  ],
  excavator: [
    ...common,
    { label: 'Operating weight', get: (m) => (m.family === 'excavator' ? wt(m.opWeightLb) : ''), num: (m) => (m.family === 'excavator' ? m.opWeightLb : 0) },
    { label: 'Max digging depth', get: (m) => (m.family === 'excavator' ? `${n1(m.maxDigDepthFt)} ft` : ''), num: (m) => (m.family === 'excavator' ? m.maxDigDepthFt : 0) },
    { label: 'Typical bucket', get: (m) => (m.family === 'excavator' ? yd(m.bucketYd3) : ''), num: (m) => (m.family === 'excavator' ? m.bucketYd3 : 0) },
    { label: 'Bucket digging force (ISO)', get: (m) => (m.family === 'excavator' && m.bucketForceLbf ? `${n0(m.bucketForceLbf)} lbf` : '—') },
    { label: 'Shipping weight (approx.)', get: (m) => wt(shipWeightLb(m)), num: shipWeightLb },
    fuel,
  ],
  hauler: [
    ...common,
    { label: 'Type', get: (m) => (m.family === 'hauler' ? (m.kind === 'articulated' ? 'Articulated' : 'Rigid frame') + (m.drive === 'electric' ? ', AC electric drive' : '') : '') },
    { label: 'Gross power', get: (m) => (m.family === 'hauler' && m.grossHp ? `${n0(m.grossHp)} hp` : '—') },
    { label: 'Rated payload', get: (m) => (m.family === 'hauler' ? `${n1(m.payloadTon)} tons (${n1(m.payloadTon * 0.9072)} t)` : ''), num: (m) => (m.family === 'hauler' ? m.payloadTon : 0) },
    { label: 'Heaped body (SAE 2:1)', get: (m) => (m.family === 'hauler' && m.heapedYd3 ? yd(m.heapedYd3) : '—') },
    { label: 'Gross machine weight', get: (m) => (m.family === 'hauler' ? `${wt(gvwLb(m))}${m.gvwLb ? '' : ' (est.)'}` : '') },
    { label: 'Power-to-weight (loaded)', get: (m) => (m.family === 'hauler' ? `${n1(m.netHp / (gvwLb(m) / 2000))} hp/ton` : '') },
    { label: 'Top speed, loaded', get: (m) => (m.family === 'hauler' ? `${n1(m.topSpeedMph)} mph` : '') },
    fuel,
  ],
};

// Sanity checks for the database and the model. Run with: npm test
import { MACHINES, byId, sizeKey } from '../src/data/index';
import { DEFAULT_SETTINGS, defaultCosts, evaluate, fleetRisk, qtyToMatch, sizeSteps, type Result } from '../src/engine/model';

let fail = 0;
const ok = (cond: boolean, msg: string) => { if (!cond) { fail++; console.error('FAIL', msg); } };

// Database integrity
const ids = new Set<string>();
for (const [fam, list] of Object.entries(MACHINES)) {
  for (const m of list) {
    ok(!ids.has(m.id), `duplicate id ${m.id}`); ids.add(m.id);
    ok(m.family === fam, `${m.id} family`);
    ok(m.netHp > 0 && sizeKey(m) > 0, `${m.id} power/size`);
    ok(m.years[0] >= 2016 && (m.years[1] === null || m.years[1] >= m.years[0]), `${m.id} years`);
    if (m.fuel) ok(m.fuel[0] < m.fuel[1] && m.fuel[1] < m.fuel[2], `${m.id} fuel order`);
  }
}

function show(idsList: string[]) {
  const rs: Result[] = idsList.map((id) => byId(id)!).sort((a, b) => sizeKey(a) - sizeKey(b))
    .map((m) => evaluate(m, DEFAULT_SETTINGS, defaultCosts(m)));
  for (const r of rs) {
    ok(Number.isFinite(r.unitCost) && r.unitCost > 0, `${r.m.id} unit cost`);
    console.log(`${r.m.name.padEnd(10)} prod ${r.prod.toFixed(0).padStart(6)}  fuel ${r.fuelH.toFixed(1).padStart(5)} gal/h  $${r.costH.toFixed(0).padStart(5)}/h  $${r.unitCost.toFixed(3)}/unit  price $${(r.costs.price/1e6).toFixed(2)}M  mob $${r.costs.mobCost}`);
  }
  for (const s of sizeSteps(rs)) console.log(`   ${s.from.m.name} -> ${s.to.m.name}: ${s.volume === null ? 'never' : Math.round(s.volume).toLocaleString()}`);
}

console.log('--- Dozers'); show(['d1', 'd5', 'd6', 'd8', 'd10', 'd11']);
console.log('--- Excavators'); show(['320', '336', '352', '395']);
console.log('--- Articulated'); show(['725', '735', '745']);
console.log('--- Rigid'); show(['770g', '777g', '785', '793', '797f']);

// The D8 vs D10 customer PDF found ~2.1x production and ~19% lower cost per yd3 for the D10.
const d8 = evaluate(byId('d8')!, DEFAULT_SETTINGS, defaultCosts(byId('d8')!));
const d10 = evaluate(byId('d10')!, DEFAULT_SETTINGS, defaultCosts(byId('d10')!));
ok(Math.abs(d10.prod / d8.prod - 2.14) < 0.05, `D10/D8 production ratio ${(d10.prod / d8.prod).toFixed(2)}`);
ok(d10.unitCost < d8.unitCost, 'D10 cheaper per yd3 than D8');

// Fleets: 2 x D6 vs 1 x D8
const d6 = byId('d6')!;
const two = evaluate(d6, DEFAULT_SETTINGS, defaultCosts(d6), 2);
const one = evaluate(d6, DEFAULT_SETTINGS, defaultCosts(d6), 1);
ok(Math.abs(two.costH - 2 * one.costH) < 1e-6, 'fleet cost/h scales with quantity');
ok(two.prod < 2 * one.prod && two.prod > 1.9 * one.prod, 'crowding loss applied');
ok(two.mobCost === 2 * one.mobCost, 'fleet mobilization');
const rk = fleetRisk(two, DEFAULT_SETTINGS, 'dozer');
ok(Math.abs(rk.allDown - 0.01) < 1e-9, 'two machines at 90% availability: 1% both down');
console.log(`2 x D6: ${two.prod.toFixed(0)} yd3/h, $${two.unitCost.toFixed(2)}/yd3, ${rk.daysToFinish.toFixed(1)} days, job $${rk.jobCost.toFixed(0)}`);
const d8r = fleetRisk(d8, DEFAULT_SETTINGS, 'dozer');
console.log(`1 x D8: ${d8.prod.toFixed(0)} yd3/h, $${d8.unitCost.toFixed(2)}/yd3, ${d8r.daysToFinish.toFixed(1)} days, job $${d8r.jobCost.toFixed(0)}`);
console.log(`D6s to match a D8: ${qtyToMatch(d6, DEFAULT_SETTINGS, d8.prod)}`);

if (fail) { console.error(`${fail} check(s) failed`); process.exit(1); }
console.log('All checks passed');

import { useEffect } from 'preact/hooks';
import { FAMILY_ART, FAMILY_LABEL } from '../data';
import { family, preparedFor, printing, results, settings } from '../state';
import { CostEditor, Conditions, FamilyTabs, ModelPicker } from './Sidebar';
import { Assumptions, BreakEven, Costs, Fuel, Glance, Productivity, Section, SpecsTable } from './sections';
import { Report } from './Report';
import { fleetName } from './fleet';

const NAV = [
  ['glance', 'At a glance'], ['specs', 'Specs'], ['productivity', 'Productivity'], ['fuel', 'Fuel'],
  ['costs', 'Costs'], ['breakeven', 'Break-even'], ['assumptions', 'Assumptions'],
] as const;

export function App() {
  useEffect(() => {
    const done = () => { printing.value = false; };
    window.addEventListener('afterprint', done);
    return () => window.removeEventListener('afterprint', done);
  }, []);

  const rs = results.value;
  const s = settings.value;
  const f = family.value;
  const p = { results: rs, s, family: f };

  function makePdf() {
    printing.value = true;
    setTimeout(() => window.print(), 80);
  }

  return (
    <>
      <div class="app">
        <header class="top">
          <div class="brand">
            <img src="./art/program.webp" alt="CatSize" width="140" height="44" />
          </div>
          <FamilyTabs />
          <div class="top-actions">
            <input class="prepared" placeholder="Prepared for (customer)" value={preparedFor.value}
              onInput={(e) => { preparedFor.value = (e.target as HTMLInputElement).value; }} />
            <button class="primary" disabled={!rs.length} onClick={makePdf}>Create PDF</button>
          </div>
        </header>
        <div class="layout">
          <aside class="side">
            <ModelPicker />
            <Conditions />
            <CostEditor />
          </aside>
          <main class="main">
            {!rs.length ? (
              <div class="empty">
                <img src={FAMILY_ART[f]} alt="" class="empty-art" />
                <h2>Pick {FAMILY_LABEL[f].toLowerCase()} to compare</h2>
                <p>Choose up to four models from the list. The comparison updates as you change models, job conditions or prices.</p>
              </div>
            ) : (
              <>
                <nav class="subnav">{NAV.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav>
                <Section id="glance" title={`At a glance: ${rs.map(fleetName).join(' vs ')}`}>
                  <Glance {...p} />
                </Section>
                <Section id="specs" title="Specifications"><SpecsTable {...p} /></Section>
                <Section id="productivity" title="Productivity"><Productivity {...p} /></Section>
                <Section id="fuel" title="Fuel consumption"><Fuel {...p} /></Section>
                <Section id="costs" title="Owning, operating and repair costs"><Costs {...p} /></Section>
                <Section id="breakeven" title="Break-even by job size"
                  lead="Moving a bigger machine costs more, so it only pays off once the job is big enough. Each line is the all-in cost per unit for a job of that size.">
                  <BreakEven {...p} />
                </Section>
                <Section id="assumptions" title="Assumptions and sources"><Assumptions {...p} /></Section>
              </>
            )}
          </main>
        </div>
      </div>
      {printing.value && rs.length > 0 && <Report {...p} preparedFor={preparedFor.value} />}
    </>
  );
}

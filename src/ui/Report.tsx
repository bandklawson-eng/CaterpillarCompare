// Print layout. "Create PDF" renders this and opens the browser's print dialog, where the
// salesperson picks "Save as PDF". The charts are SVG, so the PDF stays sharp at any zoom.
import { FAMILY_ART, FAMILY_LABEL, type Family } from '../data';
import type { Result, Settings } from '../engine/model';
import { Assumptions, BreakEven, Costs, Fuel, Glance, Productivity, SpecsTable } from './sections';

export function Report(props: { results: Result[]; s: Settings; family: Family; preparedFor: string }) {
  const p = { results: props.results, s: props.s, family: props.family };
  const names = props.results.map((r) => (r.qty > 1 ? `${r.qty} × Cat ${r.m.name}` : `Cat ${r.m.name}`)).join(' vs ');
  const date = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  return (
    <div class="report">
      <div class="cover">
        <img class="cover-art" src={FAMILY_ART[props.family]} alt="" />
        <img class="cover-logo" src="./art/program.webp" alt="CatSize" />
        <div class="cover-kicker">EQUIPMENT COMPARISON · {FAMILY_LABEL[props.family].toUpperCase()}</div>
        <h1>{names}</h1>
        <div class="cover-sub">Productivity, fuel consumption and repair-cost comparison</div>
        <div class="cover-meta">
          <div>Prepared for: {props.preparedFor || '______________________________'}</div>
          <div>Date: {date}</div>
        </div>
      </div>
      <h2 class="r-h">At a glance</h2>
      <Glance {...p} />
      <div class="r-page">
        <h2 class="r-h">1. Specifications</h2>
        <SpecsTable {...p} />
      </div>
      <div class="r-page">
        <h2 class="r-h">2. Productivity</h2>
        <Productivity {...p} />
      </div>
      <div class="r-page">
        <h2 class="r-h">3. Fuel consumption</h2>
        <Fuel {...p} />
      </div>
      <div class="r-page">
        <h2 class="r-h">4. Owning, operating and repair costs</h2>
        <Costs {...p} />
      </div>
      <div class="r-page">
        <h2 class="r-h">5. Break-even by job size</h2>
        <BreakEven {...p} />
      </div>
      <div class="r-page">
        <h2 class="r-h">6. Assumptions and sources</h2>
        <Assumptions {...p} />
      </div>
      <div class="r-foot">Estimates for planning only; confirm with a dealer quote and a site-specific production study.</div>
    </div>
  );
}

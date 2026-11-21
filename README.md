# CatSize – Cat dozers, haulers and excavators

A web app for helping a customer decide when to move **up or down a size** in Caterpillar's
equipment lines. Pick one line (dozers, haulers or excavators), choose up to four models, set the
job conditions, and the app shows productivity, fuel burn, owning and operating costs, repair costs
and the **break-even job size** where the bigger machine starts to pay off. One click turns the
comparison into a customer-ready PDF.

**An independent sales aid, not a Caterpillar product.** Production and cost figures are
engineering estimates for comparing models on the same basis. Prices are illustrative defaults
until a dealer quote is typed in. Confirm anything important with the dealer and a site-specific
production study.

## Using it

1. **Pick a line** in the top bar: Dozers, Haulers or Excavators. Only one line is compared at a time.
2. **Pick up to four models.** The list covers 2016 to today; untick *Include previous models* to
   show only current machines. Models marked **verify** have some specs estimated (see below).
3. **Set fleet sizes** with the − and + buttons on each model (in the side panel or on the At a glance
   cards) to answer "should I buy 2 small dozers or 1 big one?" or "10 small trucks or 5 big ones?".
   Every figure then covers the whole fleet.
4. **Set the job conditions**: push distance and material for dozers, digging difficulty and swing
   angle for excavators, haul distance, grade and rolling resistance for haulers, plus fuel load,
   ground conditions and operator skill.
5. **Prices & costs**: type a dealer quote over any price, mobilization cost, residual value or
   wear rate. Edited fields turn orange; *Reset to defaults* undoes them. Settings are saved in the
   browser on that device.
6. **Create PDF**: type the customer's name in *Prepared for*, press **Create PDF**, then choose
   **Save as PDF** in the print dialog. On iPad or iPhone, use *Print*, then share the preview as a PDF.

### What the sections mean

- **At a glance**: each model's production, fuel per hour, fuel per 1,000 yd³ (or tons), cost per
  hour and cost per yd³ (or ton), compared with the smallest model. Below that, **When to move up a
  size** gives the break-even job size for each step up, a strip showing which model is cheapest at
  each job size, and a one-line bottom line.
- **Several smaller machines or fewer big ones?**: the fleet scorecard. For each fleet it shows the
  operators needed, money tied up, production, days to finish the job (job size and hours per day
  are editable), total job cost including moving, lowboy loads, fuel, repair and support costs, how
  much capacity is left if one machine breaks down, and the chance the whole fleet is stopped at
  once. Green marks the best fleet on each line, a short list says who wins what, and **Match this
  output** resizes the other fleets to produce at least as much as the one you click.
- **Specifications**: published specs side by side, with a data-status row.
- **Productivity / Fuel / Costs**: charts across push distance, swing angle or haul distance, with
  tables underneath and the method used.
- **Break-even**: all-in cost per unit, including mobilization, for jobs from a few thousand to
  millions of yd³ or tons.
- **Assumptions and sources**: every number that drives the result, and where the specs came from.

## How the numbers are worked out

All logic lives in `src/engine/model.ts`.

- **Dozers**: blade capacity × 60 ÷ cycle time, with cycle time = 0.10 min + push distance ÷ dozing
  speed (70% of 1st-forward) + push distance ÷ return speed (90% of 2nd-reverse), then material,
  slot-dozing, grade, operator and job-efficiency factors. This is the method behind the Cat
  Performance Handbook dozer curves.
- **Excavators**: bucket × fill factor × 3,600 ÷ cycle time; cycle time grows with machine size and
  is adjusted for digging difficulty and swing angle.
- **Haulers**: load + loaded travel + dump + empty return. Travel speed comes from net power, gross
  weight and grade plus rolling resistance, capped at 65% of top speed. Payload is capped by heaped
  body volume × material density.
- **Fuel**: Cat Performance Handbook hourly figures from VisionLink telematics (idle included).
  Models with no published figure are estimated from engine power and marked *est.*
- **Costs**: depreciation, interest/insurance/tax, fuel and DEF, lube, a repair reserve (share of
  price over the ownership period), undercarriage or tires (Handbook method, scaled by ground
  conditions), wear items and the operator.
- **Fleets**: a fleet of N machines costs N times as much per hour, moves N times (lowboy loads too)
  and needs N operators. Production is N × one machine, less a crowding loss per extra machine
  (default 3%) for machines getting in each other's way or waiting at the loader. Each machine also
  carries a fixed support & servicing cost (default $10/h for service-truck visits, fueling, PM
  labor and admin), so many small machines pay more overhead than a few big ones. Breakdown risk
  uses each machine's availability (default 90%): with N machines the chance all are down at once is
  (1 − availability)^N. Days to finish = job size ÷ (fleet production × availability) ÷ hours per day.
- **Break-even**: all-in cost per unit = (mobilization + cost per unit × job size) ÷ job size. The
  step from model A to bigger model B pays off above (mobilization B − mobilization A) ÷
  (cost per unit A − cost per unit B).

`npm test` checks the database and runs the model for sample line-ups, including a check that the
D8 vs D10 result matches the original customer PDF this app grew out of.

## The database

The specs live in plain TypeScript files that are easy to edit:

| Line | File | Models |
|---|---|---|
| Dozers (D1–D11, incl. K2, N, T, E and XE models) | `src/data/dozers.ts` | 24 |
| Haulers (725–745 articulated, 770–798 rigid) | `src/data/haulers.ts` | 24 |
| Excavators (320–395, F series and Next Generation) | `src/data/excavators.ts` | 25 |

Each model has `verified: true` when its headline specs were checked against a published source,
and `verified: false` when some values are estimates. These currently need checking against a
spec sheet:

- **Dozers**: D3K2, D4K2, D5K2, D6K2 (power), D6N, D7E (weight, blade), D9T (weight)
- **Haulers**: 725C2, 730C2, 735C, 740 GC, 745C, 772G and 773G (payload, body), 777G (net power, body), 795F AC
- **Excavators**: 323F L, 352F, 325, 335, 352

Sources are listed in `src/data/sources.ts` and appear in the app and in every PDF.

To add a model, copy a similar entry, give it a unique `id`, fill in the specs, and add its source.

## Running it

```sh
npm install
npm run dev       # local development server
npm test          # data and model checks
npm run build     # production build into dist/
npm run preview   # serve the production build
```

Artwork lives in `public/art` (splash, header logo and one picture per equipment line) and
`public/icons` (home-screen icons). The splash screen and its 3-second loading bar are in
`index.html`; change `DURATION` there to make it longer or shorter.

It is a static site (Vite + Preact + TypeScript, no server). After the first visit it works offline
and can be installed to a phone, tablet or desktop home screen.

## Hosting

The repository is private, and free GitHub Pages only publishes public repositories. The workflow
in `.github/workflows/pages.yml` is set to run only when started by hand. To publish the site
either make the repository public or use a GitHub plan that allows Pages for private repositories,
then turn on **Settings → Pages → Source: GitHub Actions** and run the workflow (or add a `push`
trigger to publish on every change to `main`). Any static host (Netlify, Cloudflare Pages, an
internal web server) can serve the `dist/` folder as well.

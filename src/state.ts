import { computed, effect, signal } from '@preact/signals';
import { byId, MACHINES, sizeKey, type Family, type Machine } from './data';
import { DEFAULT_SETTINGS, defaultCosts, evaluate, MAX_QTY, qtyToMatch, type CostInputs, type Result, type Settings } from './engine/model';

const KEY = 'cat-size-compare-v1';
export const MAX_MODELS = 4;

interface Saved {
  family: Family;
  selection: Record<Family, string[]>;
  settings: Settings;
  overrides: Record<string, Partial<CostInputs>>;
  qty: Record<string, number>;
  preparedFor: string;
  showPrevious: boolean;
}

function load(): Saved {
  const fallback: Saved = {
    family: 'dozer',
    selection: { dozer: ['d6', 'd8'], hauler: ['745', '777g'], excavator: ['336', '374'] },
    settings: { ...DEFAULT_SETTINGS },
    overrides: {},
    qty: { d6: 2, '745': 2, '336': 2 },
    preparedFor: '',
    showPrevious: true,
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const s = JSON.parse(raw) as Partial<Saved>;
    return {
      ...fallback,
      ...s,
      selection: { ...fallback.selection, ...(s.selection ?? {}) },
      settings: { ...DEFAULT_SETTINGS, ...(s.settings ?? {}),
        jobVolume: { ...DEFAULT_SETTINGS.jobVolume, ...(s.settings?.jobVolume ?? {}) } },
      overrides: s.overrides ?? {},
      qty: s.qty ?? {},
    };
  } catch {
    return fallback;
  }
}

const saved = load();
export const family = signal<Family>(saved.family);
export const selection = signal<Record<Family, string[]>>(saved.selection);
export const settings = signal<Settings>(saved.settings);
export const overrides = signal<Record<string, Partial<CostInputs>>>(saved.overrides);
export const qty = signal<Record<string, number>>(saved.qty);
export const preparedFor = signal(saved.preparedFor);
export const showPrevious = signal(saved.showPrevious);
export const printing = signal(false);

effect(() => {
  const data: Saved = {
    family: family.value,
    selection: selection.value,
    settings: settings.value,
    overrides: overrides.value,
    qty: qty.value,
    preparedFor: preparedFor.value,
    showPrevious: showPrevious.value,
  };
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode: keep in memory */ }
});

export function setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
  settings.value = { ...settings.value, [k]: v };
}

export function costsFor(m: Machine): CostInputs {
  return { ...defaultCosts(m), ...(overrides.value[m.id] ?? {}) };
}

export function setOverride(id: string, k: keyof CostInputs, v: number | undefined) {
  const cur = { ...(overrides.value[id] ?? {}) };
  if (v === undefined || Number.isNaN(v)) delete cur[k];
  else cur[k] = v;
  overrides.value = { ...overrides.value, [id]: cur };
}

export function resetOverrides(id?: string) {
  if (!id) { overrides.value = {}; return; }
  const next = { ...overrides.value };
  delete next[id];
  overrides.value = next;
}

export const qtyOf = (id: string) => qty.value[id] ?? 1;

export function setQty(id: string, n: number) {
  qty.value = { ...qty.value, [id]: Math.max(1, Math.min(MAX_QTY, Math.round(n))) };
}

/** Set every other fleet's size so it produces at least as much as the given fleet. */
export function matchFleets(toId: string) {
  const target = results.value.find((r) => r.m.id === toId);
  if (!target) return;
  const next = { ...qty.value };
  for (const r of results.value) if (r.m.id !== toId) next[r.m.id] = qtyToMatch(r.m, settings.value, target.prod);
  qty.value = next;
}

export function setJobVolume(v: number) {
  settings.value = { ...settings.value, jobVolume: { ...settings.value.jobVolume, [family.value]: Math.max(1, v) } };
}

export function toggleModel(id: string) {
  const f = family.value;
  const cur = selection.value[f];
  let next: string[];
  if (cur.includes(id)) next = cur.filter((x) => x !== id);
  else if (cur.length >= MAX_MODELS) return;
  else next = [...cur, id];
  selection.value = { ...selection.value, [f]: next };
}

export function clearSelection() {
  selection.value = { ...selection.value, [family.value]: [] };
}

/** Selected machines, smallest first. */
export const selected = computed<Machine[]>(() =>
  selection.value[family.value]
    .map((id) => byId(id))
    .filter((m): m is Machine => !!m && m.family === family.value)
    .sort((a, b) => sizeKey(a) - sizeKey(b)),
);

export const results = computed<Result[]>(() => {
  const s = settings.value;
  overrides.value; // dependency
  return selected.value.map((m) => evaluate(m, s, costsFor(m), qtyOf(m.id)));
});

export const available = computed(() => MACHINES[family.value]);

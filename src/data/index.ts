import type { Family, Machine } from './types';
import { DOZERS } from './dozers';
import { HAULERS } from './haulers';
import { EXCAVATORS } from './excavators';

export * from './types';
export { SOURCES } from './sources';

export const MACHINES: Record<Family, Machine[]> = {
  dozer: DOZERS,
  hauler: HAULERS,
  excavator: EXCAVATORS,
};

export const FAMILY_LABEL: Record<Family, string> = {
  dozer: 'Dozers',
  hauler: 'Haulers',
  excavator: 'Excavators',
};

export const UNIT_LABEL: Record<Family, string> = {
  dozer: 'yd³',
  hauler: 'tons',
  excavator: 'yd³',
};

/** A single number used to sort machines from smallest to largest within a family. */
export function sizeKey(m: Machine): number {
  return m.family === 'hauler' ? m.payloadTon : m.opWeightLb;
}

export function byId(id: string): Machine | undefined {
  for (const list of Object.values(MACHINES)) {
    const m = list.find((x) => x.id === id);
    if (m) return m;
  }
  return undefined;
}

export function isCurrent(m: Machine): boolean {
  return m.years[1] === null;
}

export function yearsLabel(m: Machine): string {
  return m.years[1] === null ? `${m.years[0]}–present` : `${m.years[0]}–${m.years[1]}`;
}

/** Size class used to group the model picker. */
export function sizeClass(m: Machine): string {
  if (m.family === 'dozer') {
    if (m.netHp < 120) return 'Small dozers';
    if (m.netHp < 400) return 'Medium dozers';
    return 'Large dozers';
  }
  if (m.family === 'excavator') {
    const t = m.opWeightLb / 2204.6;
    if (t < 33) return 'Medium excavators (20–33 t)';
    if (t < 60) return 'Large excavators (33–60 t)';
    return 'Large excavators (60–95 t)';
  }
  if (m.kind === 'articulated') return 'Articulated trucks';
  return m.payloadTon <= 110 ? 'Rigid trucks – quarry & construction' : 'Rigid trucks – mining';
}

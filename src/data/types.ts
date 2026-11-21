// Shared types for the machine database.
// All stored values are U.S. customary units; the UI converts to metric when asked.

export type Family = 'dozer' | 'hauler' | 'excavator';

/** Low / medium / high fuel burn in U.S. gallons per hour. */
export type FuelBurn = [low: number, med: number, high: number];

export interface BaseModel {
  id: string;
  family: Family;
  name: string;
  /** First and last model year on sale in North America (null = still current). */
  years: [number, number | null];
  engine: string;
  /** Net power (SAE J1349 / ISO 9249). For rigid trucks where only gross power is published, see grossHp. */
  netHp: number;
  /**
   * Hourly fuel burn from the Cat Performance Handbook (VisionLink telematics data, idle included).
   * null = not published; the engine estimates it from power and flags it.
   */
  fuel: FuelBurn | null;
  /** Note on where the fuel figure came from when it is adjusted from a sister model. */
  fuelNote?: string;
  /** Keys into SOURCES. */
  sources: string[];
  /** true when the headline specs were checked against a published source; false = best available estimate. */
  verified: boolean;
  notes?: string;
}

export interface Dozer extends BaseModel {
  family: 'dozer';
  opWeightLb: number;
  shipWeightLb?: number;
  /** Main blade used for production estimates. */
  blade: { type: string; yd3: number };
  /** Universal (U) blade where offered. */
  uBladeYd3?: number;
  /** 1st forward / 2nd reverse travel speeds (mph). Missing = class typical. */
  f1Mph?: number;
  r2Mph?: number;
  fuelTankGal?: number;
  ripper: boolean;
  electricDrive?: boolean;
}

export interface Hauler extends BaseModel {
  family: 'hauler';
  kind: 'articulated' | 'rigid';
  grossHp?: number;
  /** Rated / nominal payload in U.S. tons. */
  payloadTon: number;
  /** Heaped body capacity, SAE 2:1, yd³. */
  heapedYd3?: number;
  /** Rated gross machine weight (lb). Missing = estimated from payload. */
  gvwLb?: number;
  topSpeedMph: number;
  drive: 'mechanical' | 'electric';
}

export interface Excavator extends BaseModel {
  family: 'excavator';
  opWeightLb: number;
  maxDigDepthFt: number;
  /** Typical general-duty bucket used for production estimates (yd³). */
  bucketYd3: number;
  bucketForceLbf?: number;
}

export type Machine = Dozer | Hauler | Excavator;

export interface Source {
  title: string;
  url: string;
}

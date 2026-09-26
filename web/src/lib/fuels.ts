// Colour follows the fuel, never its position in the current selection.
// Slots map to the validated categorical palette (--s1..--s8) in globals.css.
export const FUEL_SLOT: Record<string, number> = {
  diesel_b7: 1,
  gasohol_95: 2,
  gasohol_91: 3,
  benzine_95: 4,
  diesel_b20: 5,
  gasohol_e20: 6,
  premium_diesel: 7,
  premium_gasohol_95: 8,
};

export const FUEL_LABEL: Record<string, string> = {
  diesel_b7: "ดีเซล B7",
  diesel_b20: "ดีเซล B20",
  premium_diesel: "ดีเซลพรีเมียม",
  gasohol_91: "แก๊สโซฮอล์ 91",
  gasohol_95: "แก๊สโซฮอล์ 95",
  gasohol_e20: "แก๊สโซฮอล์ E20",
  gasohol_e85: "แก๊สโซฮอล์ E85",
  benzine_95: "เบนซิน 95",
  premium_gasohol_95: "แก๊สโซฮอล์ 95 พรีเมียม",
  premium_98: "พรีเมียม 98",
  premium_99: "พรีเมียม 99",
};

/** Fuels offered in chart selectors (the ones with a palette slot and full history). */
export const CHARTABLE_FUELS = Object.keys(FUEL_SLOT);

export const MAX_SERIES = 4;

export function fuelVar(code: string): string {
  const slot = FUEL_SLOT[code];
  return slot ? `--s${slot}` : "--muted";
}

export function fuelLabel(code: string): string {
  return FUEL_LABEL[code] ?? code;
}

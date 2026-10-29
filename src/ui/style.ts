/** Push palette.ui into CSS custom properties so style.css never hardcodes a colour. */
import { palette } from '../data/palette';
import type { BuildingId } from '../data/buildings';

export function applyPaletteCss(): void {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(palette.ui)) {
    root.setProperty(`--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, v);
  }
  const b = palette.building;
  const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
  const icons: Record<BuildingId, number> = {
    house: b.roofRed,
    fisher: b.roofBlue,
    lumber: b.roofGreen,
    sawmill: b.roofPlum,
    market: b.awning,
    lighthouse: b.stripe,
    shrine: b.torii,
    farm: b.field,
    seawall: b.stone,
    monument: b.accent,
  };
  for (const [id, c] of Object.entries(icons)) root.setProperty(`--icon-${id}`, hex(c));
  root.setProperty('--sky', hex(palette.sky));
}

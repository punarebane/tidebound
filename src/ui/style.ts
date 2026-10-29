/** Push palette.ui into CSS custom properties so style.css never hardcodes a colour. */
import { palette } from '../data/palette';

export function applyPaletteCss(): void {
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(palette.ui)) {
    root.setProperty(`--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, v);
  }
  const b = palette.building;
  const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;
  root.setProperty('--icon-house', hex(b.roofRed));
  root.setProperty('--icon-fisher', hex(b.roofBlue));
  root.setProperty('--icon-lumber', hex(b.roofGreen));
  root.setProperty('--icon-sawmill', hex(b.roofPlum));
  root.setProperty('--sky', hex(palette.sky));
}

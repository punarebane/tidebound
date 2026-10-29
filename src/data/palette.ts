/** Every colour in the game. Soft pastels, warm light. */
export const palette = {
  sky: 0xcfe7ee,
  fog: 0xd6eaee,
  hemiSky: 0xfff3dc,
  hemiGround: 0x9cc3b4,
  sun: 0xffefd2,

  waterDeep: 0x6bb1cc,
  waterShallow: 0x9fe0d8,
  foam: 0xf7fcf8,

  seabed: 0xd8c9a2,
  sand: 0xf3e2b8,
  grass: 0xb3d99b,
  meadow: 0x9fcb8f,
  rock: 0xc4b8ad,
  cliff: 0xb3a79e,
  snow: 0xf8f6f1,

  treeLeaf: 0x86c48a,
  treeLeafAlt: 0x6fb38a,
  treeTrunk: 0xb08a6a,
  rockProp: 0xb5aea8,
  shoal: 0xeaf8ff,

  building: {
    wall: 0xfdf3e3,
    wallWarm: 0xf7e1c4,
    roofRed: 0xe99a8b,
    roofBlue: 0x8fb3d9,
    roofGreen: 0x9ccf9f,
    roofPlum: 0xc6a3cf,
    wood: 0xc79c74,
    woodDark: 0x9b765a,
    stone: 0xd2cbc3,
    accent: 0xf4c86a,
  },

  ghostValid: 0xa6ecb4,
  ghostInvalid: 0xf2a2a2,
  influenceRing: 0xffffff,

  /** CSS colours for the DOM UI. */
  ui: {
    text: '#45505a',
    textSoft: '#7b8790',
    panel: 'rgba(255, 252, 245, 0.88)',
    panelBorder: 'rgba(120, 140, 150, 0.18)',
    accent: '#6fb3a5',
    accentStrong: '#4f9b8c',
    plus: '#3f9b6b',
    minus: '#d0605e',
    neutral: '#8a96a0',
    barTrack: 'rgba(110, 130, 140, 0.15)',
    barFill: '#8fd0c0',
    voyage: '#f0b45c',
    selected: '#fff4d6',
    shadow: 'rgba(60, 80, 90, 0.15)',
    overlay: 'rgba(214, 234, 238, 0.55)',
    glow: '#ffffff',
  },
} as const;

export const hexCss = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

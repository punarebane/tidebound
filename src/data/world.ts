/** Island generation tuning. All world units are metres-ish; sea level starts at 0. */
export const WORLD = {
  /** Half-width of the generated square for island 0, and growth per voyage. */
  baseHalfSize: 34,
  halfSizeGrowth: 5,
  maxHalfSize: 64,
  /** Grid cell size of the heightmap. */
  cell: 1,
  /** Island radius as a fraction of the half size. */
  islandRadius: 0.84,
  /** How much the coastline radius wobbles (fraction of radius). */
  coastWobble: 0.22,
  coastWobbleFreq: 1.4,
  /** Terrain noise. */
  noiseFreq: 0.03,
  noiseOctaves: 3,
  /** Height shaping: h = falloff^falloffPow * (landBase + landRelief * noise01) * maxHeight - seaDrop */
  falloffInner: 0.25,
  falloffOuter: 1.05,
  falloffPow: 1.1,
  landBase: 0.42,
  landRelief: 0.85,
  maxHeight: 7.5,
  seaDrop: 1.4,
  /** Extra depth beyond the coast so the sea floor falls away. */
  deepDrop: 2.2,
  /** Terracing: height of one band, and the height below which the beach stays smooth. */
  terraceStep: 1.6,
  terraceRiser: 0.18,
  beachSmoothTop: 1.3,
  /** Colour band thresholds (by face height) and cliff slope (normal.y below this = rock). */
  bands: {
    sandTop: 0.75,
    grassTop: 3.6,
    meadowTop: 4.0,
    rockTop: 5.6,
    cliffNormalY: 0.72,
  },
  /** Props. */
  treeSpacing: 1.25,
  treeMinHeight: 0.8,
  treeMaxHeight: 6.8,
  forestFreq: 0.07,
  forestThreshold: -0.05,
  treeRadius: 0.35,
  rockSpacing: 3.2,
  rockChance: 0.22,
  rockRadius: 0.55,
  shoalSpacing: 4.5,
  shoalMinDepth: 0.3,
  shoalMaxDepth: 2.2,
  shoalChance: 0.85,
  /** Flat grass patches (for farms): lattice spacing and flatness. */
  patchSpacing: 2,
  patchMinHeight: 0.9,
  patchMaxHeight: 4.0,
  patchNormalY: 0.97,
  /** Shrine: top fraction of land height. */
  shrineTopFraction: 0.1,
} as const;

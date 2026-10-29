/** Score thresholds, tide and run economy. Tuned with scripts/sim.ts. */
export const ECONOMY = {
  /**
   * Threshold k on island i (relative to the score at the island's start) is
   * the sum of increments (first + step * k) * islandScale^i.
   */
  thresholdFirst: 6,
  thresholdStep: 2,
  islandScale: 1.1,
  /** Score needed on an island (relative to its start) to sail on: base * growth^i. */
  voyageBase: 40,
  voyageGrowth: 1.12,
  /** Packs offered per threshold. */
  offerCount: 2,
};

export const TIDE = {
  /** Placements between tide rises. */
  every: 6,
  /** Rises per island. */
  maxSteps: 5,
  /** Sea level gained per rise. */
  stepHeight: 0.35,
  /** Seconds the water takes to rise. */
  tweenSeconds: 1.5,
};

export const PLACEMENT = {
  /** Minimum normal.y anywhere under the footprint (cos of max slope). */
  minNormalY: 0.9,
  /** Max height difference across the footprint. */
  maxHeightSpread: 0.5,
  /** Height above the sea needed at every footprint sample. */
  minFreeboard: 0.05,
  /** Samples on the footprint ring. */
  ringSamples: 8,
};

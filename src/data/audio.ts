/** Sound tuning. Everything is synthesised; no audio files. */
export const AUDIO = {
  master: 0.7,
  sea: { volume: 0.22, lowpassHz: 520, surfHz: 2400, surfVolume: 0.05, swellRate: 0.11, surfRate: 0.07 },
  plink: { volume: 0.22, decay: 0.45 },
  /** Major pentatonic steps above the base note for rising scores. */
  scale: [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24],
  baseHz: 392,
  tide: { volume: 0.32, seconds: 1.8 },
  sink: { volume: 0.25 },
  chime: { volume: 0.18, stepSeconds: 0.09 },
};

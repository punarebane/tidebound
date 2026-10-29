/** Camera feel. */
export const CAMERA = {
  fov: 40,
  minPitchDeg: 28,
  maxPitchDeg: 72,
  startPitchDeg: 48,
  startYawDeg: 35,
  minDistance: 12,
  maxDistance: 95,
  startDistanceFactor: 1.15,
  /** Damping rate (higher = snappier). */
  damping: 9,
  panSpeed: 0.9,
  rotateSpeedKeys: 1.6,
  dragRotateSpeed: 0.006,
  zoomStep: 1.12,
  edgePanPx: 14,
  edgePan: true,
  /** Tide cinematic: how far the camera pulls back and tilts up at the peak. */
  cinematicPullBack: 0.28,
  cinematicPitchDeg: 9,
  cinematicYawDeg: 10,
  /** Photo mode limits. */
  photoMinPitchDeg: 4,
  photoMaxPitchDeg: 85,
  photoMaxDistance: 160,
  photoPanBoundsFactor: 1.6,
};

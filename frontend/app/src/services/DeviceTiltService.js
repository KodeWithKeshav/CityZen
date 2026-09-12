import { DeviceMotion } from 'expo-sensors';

/**
 * Reads the phone's downward camera pitch (degrees below horizontal, 0 =
 * pointing at the horizon, 90 = pointing straight down at the ground) from
 * the accelerometer/gravity channel of expo-sensors' DeviceMotion.
 *
 * Backend contract: services/potholeGeometryConfig.js's CAMERA_TILT_DEG is
 * "assumed downward pitch (degrees below horizontal) of the camera at
 * capture time" -- this is the same quantity, measured instead of assumed.
 * services/potholeGeometryService.js substitutes it in directly wherever a
 * caller-supplied deviceTilt is present (Phase 2 in the plan doc).
 *
 * Uses accelerationIncludingGravity rather than the rotation (Euler
 * alpha/beta/gamma) channel: Euler angles are unreliable exactly in the
 * near-vertical range this app operates in (gimbal-lock-like sign flips as
 * gamma approaches +-90), while the gravity-vector projection below is
 * well-behaved through that whole range and needs no platform-specific
 * unwrapping.
 *
 * Derivation: expo-sensors normalizes DeviceMotion to one coordinate frame
 * on both platforms -- x: screen-right, y: screen-up, z: out of the screen
 * face (i.e. AWAY from the rear camera's line of sight). A stationary phone
 * reports accelerationIncludingGravity ~= the reaction force opposing
 * gravity, so +z means "the screen face points away from the ground" (rear
 * camera pointing down). Projecting the rear-camera direction (-z) onto the
 * "straight down" unit vector (-normalize(accel)) collapses to a single
 * dot product: sin(pitch) = accel.z / |accel|.
 *
 *   Phone flat on a table, screen up   -> accel.z ~= +g -> pitch ~= 90 deg
 *     (rear camera pointing straight down, matches the table)
 *   Phone held upright, screen facing you (like reading) -> accel.z ~= 0
 *     -> pitch ~= 0 deg (rear camera pointing level at the horizon)
 *
 * IMPORTANT: this mapping has not been verified against a physical device
 * (this codebase's tooling has no way to). Before trusting the numbers this
 * produces, sanity-check both of the two poses above on a real phone (log
 * getCurrentTiltDeg()'s result) on both iOS and Android -- if a pose comes
 * back with the wrong sign or magnitude, the fix is to adjust the formula
 * below, not the callers. Until verified, treat this as a best-effort
 * upgrade over the fixed 35 degree default, not a calibrated instrument --
 * which is exactly why the backend clamps and falls back rather than
 * trusting it blindly (see routes/complaints.js's use of sanitizeDeviceTilt).
 */

const SAMPLE_UPDATE_INTERVAL_MS = 50;
// How long to wait for a first real DeviceMotion sample before giving up
// and falling back to null (-> backend's assumed default).
const FIRST_SAMPLE_TIMEOUT_MS = 800;

let latestSample = null; // { az, magnitude } from the most recent tick
let subscription = null;
let listenerCount = 0;

function toPitchDeg(accel) {
  const { x, y, z } = accel;
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  if (!Number.isFinite(magnitude) || magnitude < 0.5) return null; // sensor not settled yet

  const sinPitch = Math.max(-1, Math.min(1, z / magnitude));
  return (Math.asin(sinPitch) * 180) / Math.PI;
}

/**
 * Starts a DeviceMotion subscription that keeps `latestSample` fresh.
 * Reference-counted so overlapping start/stop calls (e.g. a fast double-tap
 * on "Take Photo") don't tear down a subscription another caller still
 * needs.
 */
async function start() {
  listenerCount += 1;
  if (subscription) return true;

  const available = await DeviceMotion.isAvailableAsync().catch(() => false);
  if (!available) return false;

  DeviceMotion.setUpdateInterval(SAMPLE_UPDATE_INTERVAL_MS);
  subscription = DeviceMotion.addListener((data) => {
    if (data?.accelerationIncludingGravity) {
      latestSample = data.accelerationIncludingGravity;
    }
  });
  return true;
}

function stop() {
  listenerCount = Math.max(0, listenerCount - 1);
  if (listenerCount === 0 && subscription) {
    subscription.remove();
    subscription = null;
    latestSample = null;
  }
}

/**
 * Begin sampling ahead of a photo capture. Call this right before opening
 * the camera (ImagePicker.launchCameraAsync), and stopTiltCapture() once it
 * resolves -- sampling continues for the whole time the native camera UI is
 * open, so the reading used is whichever pose the phone was in just before
 * the shutter, not a single instant grabbed before the UI even opened.
 */
export async function startTiltCapture() {
  return start();
}

/**
 * Reads the freshest tilt sample and tears down the subscription (or
 * decrements its refcount). Returns a plain number in degrees, or null if
 * no usable sample arrived (sensor unavailable, simulator, timed out).
 */
export async function stopTiltCapture() {
  try {
    if (!latestSample) {
      // Give a just-started subscription a brief window to deliver its
      // first tick (e.g. the camera UI opened and closed almost instantly).
      await new Promise((resolve) => {
        const started = Date.now();
        const check = () => {
          if (latestSample || Date.now() - started > FIRST_SAMPLE_TIMEOUT_MS) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });
    }

    if (!latestSample) return null;
    return toPitchDeg(latestSample);
  } finally {
    stop();
  }
}

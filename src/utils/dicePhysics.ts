import { DiceThrowVector } from '../types/ludo';

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface DiceFrameSample {
  t: number; // seconds
  x: number; // board % (0..100)
  y: number; // board % (0..100)
  z: number; // height above felt (0 = resting on board)
  quat: Quat;
  matrix3d: string;
}

export interface DiceThrowSimulation {
  durationMs: number;
  finalCoord: { x: number; y: number };
  landedQuat: Quat;
  uprightQuat: Quat;
  sampleAt: (elapsedMs: number) => DiceFrameSample;
}

// Target X/Y angles bringing each face (1..6) to point straight at the camera (+Z)
const TARGET_FACE_ANGLES: Record<number, { rx: number; ry: number }> = {
  1: { rx: 0, ry: 0 },
  2: { rx: -Math.PI / 2, ry: 0 },
  3: { rx: 0, ry: -Math.PI / 2 },
  4: { rx: 0, ry: Math.PI / 2 },
  5: { rx: Math.PI / 2, ry: 0 },
  6: { rx: 0, ry: Math.PI },
};

export function quatFromAxisAngle(ax: number, ay: number, az: number, angle: number): Quat {
  const len = Math.hypot(ax, ay, az) || 1;
  const half = angle / 2;
  const s = Math.sin(half) / len;
  return { x: ax * s, y: ay * s, z: az * s, w: Math.cos(half) };
}

export function mulQuat(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function invQuat(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function normalizeQuat(q: Quat): Quat {
  const len = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / len, y: q.y / len, z: q.z / len, w: q.w / len };
}

export function slerpQuat(a: Quat, b: Quat, t: number): Quat {
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;

  let dot = a.x * bx + a.y * by + a.z * bz + a.w * bw;
  if (dot < 0) {
    dot = -dot;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }

  if (dot > 0.9995) {
    return normalizeQuat({
      x: a.x + (bx - a.x) * t,
      y: a.y + (by - a.y) * t,
      z: a.z + (bz - a.z) * t,
      w: a.w + (bw - a.w) * t,
    });
  }

  const theta0 = Math.acos(Math.min(1, Math.max(-1, dot)));
  const theta = theta0 * t;
  const sinTheta0 = Math.sin(theta0);
  const sinTheta = Math.sin(theta);

  const s0 = Math.cos(theta) - (dot * sinTheta) / sinTheta0;
  const s1 = sinTheta / sinTheta0;

  return normalizeQuat({
    x: s0 * a.x + s1 * bx,
    y: s0 * a.y + s1 * by,
    z: s0 * a.z + s1 * bz,
    w: s0 * a.w + s1 * bw,
  });
}

export function quatToMatrix3d(q: Quat): string {
  const xx = q.x * q.x;
  const yy = q.y * q.y;
  const zz = q.z * q.z;
  const xy = q.x * q.y;
  const xz = q.x * q.z;
  const yz = q.y * q.z;
  const wx = q.w * q.x;
  const wy = q.w * q.y;
  const wz = q.w * q.z;

  const m11 = 1 - 2 * (yy + zz);
  const m12 = 2 * (xy + wz);
  const m13 = 2 * (xz - wy);
  const m21 = 2 * (xy - wz);
  const m22 = 1 - 2 * (xx + zz);
  const m23 = 2 * (yz + wx);
  const m31 = 2 * (xz + wy);
  const m32 = 2 * (yz - wx);
  const m33 = 1 - 2 * (xx + yy);

  return `matrix3d(${m11.toFixed(5)},${m12.toFixed(5)},${m13.toFixed(5)},0,${m21.toFixed(5)},${m22.toFixed(5)},${m23.toFixed(5)},0,${m31.toFixed(5)},${m32.toFixed(5)},${m33.toFixed(5)},0,0,0,0,1)`;
}

export function getFaceQuaternion(faceValue: number, twistZRad = 0): Quat {
  const angles = TARGET_FACE_ANGLES[faceValue] ?? TARGET_FACE_ANGLES[1];
  const qx = quatFromAxisAngle(1, 0, 0, angles.rx);
  const qy = quatFromAxisAngle(0, 1, 0, angles.ry);
  const qFace = mulQuat(qx, qy);
  if (Math.abs(twistZRad) < 1e-5) {
    return normalizeQuat(qFace);
  }
  const qz = quatFromAxisAngle(0, 0, 1, twistZRad);
  return normalizeQuat(mulQuat(qz, qFace));
}

function clampBoardPct(val: number): number {
  return Math.max(7, Math.min(93, val));
}

/**
 * Simulates a genuine 3D rigid-body dice throw with:
 * - Hand impulse (click/auto center throw OR direct finger/mouse velocity in any direction)
 * - Irregular 3-axis angular velocity (wx, wy, wz)
 * - Gravity, elastic felt bounces, corner-impact torque coupling, and board-edge rebounds
 * - Air drag + felt sliding/rolling friction slowing naturally to rest
 * - Exact initial-frame back-solving so the natural physics end state lands cleanly on `diceValue`
 */
export function simulateDiceThrow(params: {
  origin: { x: number; y: number };
  landCoord: { x: number; y: number };
  diceValue: number;
  throwVector?: DiceThrowVector | null;
}): DiceThrowSimulation {
  const { origin, landCoord, diceValue, throwVector } = params;

  const dt = 1 / 180; // 180 Hz physics substeps for crisp bounce & wall collision detection
  const totalSec = 1.13 + Math.random() * 0.09; // 1130..1220 ms (always finishes before 1260ms UI phase)
  const steps = Math.round(totalSec / dt);
  const durationMs = totalSec * 1000;

  const isDirectionalFlick = Boolean(throwVector);

  // Starting position & velocity
  let px = throwVector ? Math.max(-8, Math.min(108, throwVector.startPct.x)) : 0;
  let py = throwVector ? Math.max(-8, Math.min(108, throwVector.startPct.y)) : 0;

  let vx = 0;
  let vy = 0;
  let z = 0.24 + Math.random() * 0.12;
  let vz = 4.3 + Math.random() * 1.2;
  let gravity = 28.0 + Math.random() * 3.0;

  let dirX = 1;
  let dirY = 0;
  let spinStrength = 1;

  if (throwVector) {
    const rawVx = throwVector.velocityPctPerSec.vx;
    const rawVy = throwVector.velocityPctPerSec.vy;
    const rawSpeed = Math.hypot(rawVx, rawVy);
    const power = Math.max(0.35, Math.min(1.85, throwVector.power));

    const isOutsideBoard = px < 8 || px > 92 || py < 8 || py > 92;

    if (rawSpeed < 16 && isOutsideBoard) {
      // Gently released outside board frame -> guide inward onto board naturally
      const toCenterX = 50 - px;
      const toCenterY = 50 - py;
      const cLen = Math.hypot(toCenterX, toCenterY) || 1;
      dirX = toCenterX / cLen;
      dirY = toCenterY / cLen;
      const gentleSpeed = 52 + Math.random() * 20;
      vx = dirX * gentleSpeed;
      vy = dirY * gentleSpeed;
      vz = 3.8 + Math.random() * 0.8;
      spinStrength = 0.9;
    } else if (rawSpeed < 16) {
      // Released gently right on the board -> short natural drop & tumble in place
      const angle = Math.random() * Math.PI * 2;
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
      const dropDrift = 14 + Math.random() * 16;
      vx = dirX * dropDrift;
      vy = dirY * dropDrift;
      z = 0.28 + Math.random() * 0.08;
      vz = 2.6 + Math.random() * 0.9;
      gravity = 26.0 + Math.random() * 2.5;
      spinStrength = 0.72;
    } else {
      // Active directional finger/mouse throw in any direction!
      dirX = rawVx / rawSpeed;
      dirY = rawVy / rawSpeed;
      const launchSpeed = Math.min(230, Math.max(36, rawSpeed * 0.68));
      vx = dirX * launchSpeed;
      vy = dirY * launchSpeed;
      z = 0.26 + Math.min(0.16, power * 0.09);
      vz = 3.4 + Math.min(2.2, power * 1.35) + Math.random() * 0.6;
      gravity = 27.5 + power * 3.0;
      spinStrength = 0.85 + Math.min(0.75, power * 0.45);
    }
  } else {
    // Default click / keyboard / AI roll from corner toward central landCoord
    const dx = landCoord.x - origin.x;
    const dy = landCoord.y - origin.y;
    const dist = Math.hypot(dx, dy) || 1;
    dirX = dx / dist;
    dirY = dy / dist;
    vx = 1.75 + Math.random() * 0.45;
    vy = (Math.random() - 0.5) * 0.34;
  }

  // Irregular 3-axis hand spin (rad/s) around X, Y, Z aligned with throw direction
  const mainTumble =
    (15.0 + Math.random() * 7.5) * spinStrength * (Math.random() < 0.9 ? 1 : -1);
  const sideTumble = (Math.random() - 0.5) * 14.0 * spinStrength;
  const yawSpin = (Math.random() - 0.5) * 16.0 * spinStrength;

  let wx = -dirY * mainTumble + dirX * sideTumble;
  let wy = dirX * mainTumble + dirY * sideTumble;
  let wz = yawSpin;

  let qSim: Quat = { x: 0, y: 0, z: 0, w: 1 };
  let bounceCount = 0;

  interface RawStep {
    t: number;
    x: number;
    y: number;
    z: number;
    qSim: Quat;
  }

  const raw: RawStep[] = [{ t: 0, x: px, y: py, z, qSim }];

  const minBound = 7;
  const maxBound = 93;

  for (let i = 1; i <= steps; i++) {
    const t = i * dt;
    const progress = i / steps;

    // 1. Air drag & gravity
    const airLinearDamp = Math.exp(-0.48 * dt);
    const airAngularDamp = Math.exp(-0.34 * dt);
    vx *= airLinearDamp;
    vy *= airLinearDamp;
    wx *= airAngularDamp;
    wy *= airAngularDamp;
    wz *= airAngularDamp;

    vz -= gravity * dt;
    z += vz * dt;
    px += vx * dt;
    py += vy * dt;

    // 2. For directional throws, rebound realistically off the board's raised inner edges
    if (isDirectionalFlick) {
      if (px < minBound && vx < 0) {
        px = minBound;
        const hitSpeed = Math.abs(vx);
        vx = hitSpeed * (0.56 + Math.random() * 0.12);
        vy *= 0.84;
        wy -= hitSpeed * 0.08;
        wz += (Math.random() - 0.5) * hitSpeed * 0.08;
      } else if (px > maxBound && vx > 0) {
        px = maxBound;
        const hitSpeed = Math.abs(vx);
        vx = -hitSpeed * (0.56 + Math.random() * 0.12);
        vy *= 0.84;
        wy += hitSpeed * 0.08;
        wz += (Math.random() - 0.5) * hitSpeed * 0.08;
      }

      if (py < minBound && vy < 0) {
        py = minBound;
        const hitSpeed = Math.abs(vy);
        vy = hitSpeed * (0.56 + Math.random() * 0.12);
        vx *= 0.84;
        wx += hitSpeed * 0.08;
        wz += (Math.random() - 0.5) * hitSpeed * 0.08;
      } else if (py > maxBound && vy > 0) {
        py = maxBound;
        const hitSpeed = Math.abs(vy);
        vy = -hitSpeed * (0.56 + Math.random() * 0.12);
        vx *= 0.84;
        wx -= hitSpeed * 0.08;
        wz += (Math.random() - 0.5) * hitSpeed * 0.08;
      }
    }

    // 3. Board felt collision & elastic bounces with corner-impact spin coupling
    if (z <= 0) {
      z = 0;

      if (vz < -0.45 && bounceCount < 3 && progress < 0.78) {
        const impact = -vz;
        const restitution = Math.max(
          0.24,
          0.52 - bounceCount * 0.09 + (Math.random() - 0.5) * 0.06
        );
        vz = impact * restitution;
        bounceCount += 1;

        if (isDirectionalFlick) {
          vx = vx * (0.72 + Math.random() * 0.1) + (Math.random() - 0.5) * impact * 3.5;
          vy = vy * (0.72 + Math.random() * 0.1) + (Math.random() - 0.5) * impact * 3.5;
        } else {
          vx *= 0.68 + Math.random() * 0.1;
          vy = vy * 0.68 + (Math.random() - 0.5) * impact * 0.13;
        }

        const spinRetention = 0.72 + Math.random() * 0.12;
        wx = wx * spinRetention + (Math.random() - 0.5) * impact * 2.5;
        wy = wy * spinRetention + (Math.random() - 0.5) * impact * 2.5;
        wz = wz * spinRetention + (Math.random() - 0.5) * impact * 2.2;
      } else {
        // Resting/rolling on felt: progressive sliding & rolling friction decelerates to rest
        vz = 0;

        const ramp = progress > 0.72 ? (progress - 0.72) / 0.28 : 0;
        const linCoeff = (isDirectionalFlick ? 4.4 : 5.6) + ramp * 10.5;
        const angCoeff = 4.8 + ramp * 9.0;
        const linFric = Math.exp(-linCoeff * dt);
        const angFric = Math.exp(-angCoeff * dt);

        vx *= linFric;
        vy *= linFric;
        wx *= angFric;
        wy *= angFric;
        wz *= angFric;

        const speed = Math.hypot(wx, wy, wz);
        if (speed > 0.4 && speed < 6.0 && progress < 0.9) {
          const edgeCatch = Math.sin(t * 26) * 0.38 * dt;
          wx += edgeCatch * (Math.random() - 0.5);
          wy += edgeCatch * (Math.random() - 0.5);
        }
      }
    }

    // Gentle final damping in the last ~6% so residual velocity cleanly reaches rest
    if (progress > 0.94) {
      const stopRate = Math.exp(-24 * dt);
      vx *= stopRate;
      vy *= stopRate;
      wx *= stopRate;
      wy *= stopRate;
      wz *= stopRate;
      z *= stopRate;
    }

    // 4. Integrate 3-axis quaternion orientation
    const omega = Math.hypot(wx, wy, wz);
    if (omega > 1e-4) {
      const dq = quatFromAxisAngle(wx / omega, wy / omega, wz / omega, omega * dt);
      qSim = normalizeQuat(mulQuat(dq, qSim));
    }

    raw.push({ t, x: px, y: py, z, qSim });
  }

  // Exact back-solve: choose a subtle natural resting Z twist (±11 deg) for the landed die
  const twistZ = (Math.random() - 0.5) * 0.38;
  const uprightQuat = getFaceQuaternion(diceValue, 0);
  const landedQuat = getFaceQuaternion(diceValue, twistZ);

  const qFinal = raw[raw.length - 1].qSim;
  const qOffset = mulQuat(invQuat(qFinal), landedQuat);

  let samples: DiceFrameSample[];
  let finalCoord: { x: number; y: number };

  if (isDirectionalFlick) {
    // Use true simulated world trajectory anywhere across the board
    samples = raw.map((step) => {
      const quat = normalizeQuat(mulQuat(step.qSim, qOffset));
      return {
        t: step.t,
        x: Math.max(-6, Math.min(106, step.x)),
        y: Math.max(-6, Math.min(106, step.y)),
        z: step.z,
        quat,
        matrix3d: quatToMatrix3d(quat),
      };
    });

    const lastRaw = raw[raw.length - 1];
    finalCoord = {
      x: clampBoardPct(lastRaw.x),
      y: clampBoardPct(lastRaw.y),
    };
  } else {
    // Classic throw: similarity transform mapping (0, 0) -> origin and (endU, endV) -> landCoord
    const dx = landCoord.x - origin.x;
    const dy = landCoord.y - origin.y;
    const endU = raw[raw.length - 1].x || 1;
    const endV = raw[raw.length - 1].y;
    const endLenSq = endU * endU + endV * endV || 1;
    const mapA = (dx * endU + dy * endV) / endLenSq;
    const mapB = (dy * endU - dx * endV) / endLenSq;

    samples = raw.map((step) => {
      const quat = normalizeQuat(mulQuat(step.qSim, qOffset));
      const x = clampBoardPct(origin.x + mapA * step.x - mapB * step.y);
      const y = clampBoardPct(origin.y + mapB * step.x + mapA * step.y);
      return {
        t: step.t,
        x,
        y,
        z: step.z,
        quat,
        matrix3d: quatToMatrix3d(quat),
      };
    });

    finalCoord = { x: landCoord.x, y: landCoord.y };
  }

  const lastIdx = samples.length - 1;
  samples[lastIdx] = {
    t: totalSec,
    x: finalCoord.x,
    y: finalCoord.y,
    z: 0,
    quat: landedQuat,
    matrix3d: quatToMatrix3d(landedQuat),
  };

  const sampleAt = (elapsedMs: number): DiceFrameSample => {
    if (elapsedMs <= 0) return samples[0];
    if (elapsedMs >= durationMs) return samples[lastIdx];

    const exactIdx = (elapsedMs / durationMs) * lastIdx;
    const i0 = Math.floor(exactIdx);
    const i1 = Math.min(lastIdx, i0 + 1);
    const alpha = exactIdx - i0;

    if (i0 === i1 || alpha < 1e-4) return samples[i0];

    const s0 = samples[i0];
    const s1 = samples[i1];
    const q = slerpQuat(s0.quat, s1.quat, alpha);
    return {
      t: s0.t + (s1.t - s0.t) * alpha,
      x: s0.x + (s1.x - s0.x) * alpha,
      y: s0.y + (s1.y - s0.y) * alpha,
      z: s0.z + (s1.z - s0.z) * alpha,
      quat: q,
      matrix3d: quatToMatrix3d(q),
    };
  };

  return {
    durationMs,
    finalCoord,
    landedQuat,
    uprightQuat,
    sampleAt,
  };
}

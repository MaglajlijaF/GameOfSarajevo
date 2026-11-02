import { Pix } from './pixel';
import { color, shade } from './palette';
import type { CharacterRecipe } from '../core/types';
import { PROPS } from './props';

/**
 * Procedural humanoid generator. A recipe (palette names + style ids) and a
 * pose table produce every animation frame, so all characters share one scale
 * (24x24 frames, ~22px tall people) and new designs are just new recipes.
 */
export const FRAME = 24;
export const ANIMS = {
  idle: [0, 1], run: [2, 3, 4, 5], jump: [6], fall: [7], attack: [8, 9], hurt: [10], defeat: [11, 12, 13],
} as const;
export const FRAME_COUNT = 14;

interface Pose {
  bob: number; lean: number;
  frontLeg: number; backLeg: number; frontLift: number; backLift: number;
  frontArm: number; backArm: number; // arm angle in degrees, 90 = straight down, 0 = forward
  eyes?: 'open' | 'closed' | 'x';
  prop?: 'held' | 'raised' | 'none';
}

const POSES: Pose[] = [
  { bob: 0, lean: 0, frontLeg: 1, backLeg: -1, frontLift: 0, backLift: 0, frontArm: 80, backArm: 100 },          // idle0
  { bob: 1, lean: 0, frontLeg: 1, backLeg: -1, frontLift: 0, backLift: 0, frontArm: 84, backArm: 96 },           // idle1
  { bob: 0, lean: 1, frontLeg: 3, backLeg: -3, frontLift: 0, backLift: 1, frontArm: 120, backArm: 50 },          // run0
  { bob: 1, lean: 1, frontLeg: 1, backLeg: -1, frontLift: 2, backLift: 0, frontArm: 95, backArm: 85 },           // run1
  { bob: 0, lean: 1, frontLeg: -3, backLeg: 3, frontLift: 1, backLift: 0, frontArm: 50, backArm: 120 },          // run2
  { bob: 1, lean: 1, frontLeg: -1, backLeg: 1, frontLift: 0, backLift: 2, frontArm: 85, backArm: 95 },           // run3
  { bob: -1, lean: 0, frontLeg: 2, backLeg: -2, frontLift: 3, backLift: 1, frontArm: -30, backArm: 200 },        // jump
  { bob: 0, lean: 0, frontLeg: 2, backLeg: -1, frontLift: 0, backLift: 2, frontArm: 20, backArm: 160 },          // fall
  { bob: 0, lean: -1, frontLeg: 2, backLeg: -2, frontLift: 0, backLift: 0, frontArm: -60, backArm: 120, prop: 'raised' }, // attack0 windup
  { bob: 1, lean: 2, frontLeg: 3, backLeg: -3, frontLift: 0, backLift: 0, frontArm: 10, backArm: 140 },          // attack1 strike
  { bob: 0, lean: -2, frontLeg: 0, backLeg: -2, frontLift: 0, backLift: 0, frontArm: 200, backArm: 220, eyes: 'closed' }, // hurt
  { bob: 3, lean: -1, frontLeg: 2, backLeg: -2, frontLift: 0, backLift: 0, frontArm: -80, backArm: 250, eyes: 'x' },     // defeat0
];

export function drawHumanoid(r: CharacterRecipe, pose: Pose): Pix {
  const p = new Pix(FRAME, FRAME);
  const skin = color(r.skin), skinD = shade(skin, -0.18);
  const hair = color(r.hair), hairD = shade(hair, -0.25);
  const shirt = color(r.shirt), shirtD = color(r.shirt2, shade(shirt, -0.3));
  const pants = color(r.pants), pantsD = shade(pants, -0.25);
  const shoes = color(r.shoes), acc = color(r.accessoryColor ?? 'red');
  const eye = color(r.eyes ?? 'outline');
  const cx = 11 + pose.lean;
  const top = 2 + pose.bob;
  const hipY = 15 + Math.max(0, pose.bob);

  // Legs (hip → foot)
  const leg = (dx: number, lift: number, c: string, sc: string) => {
    const hx = 11 + (dx > 0 ? 1 : 0);
    const fx = hx + dx;
    const fy = 21 - lift;
    p.line(hx, hipY, fx, fy, c, 2);
    p.rect(fx, fy + 1, 3, 1, sc);
    p.rect(fx, fy, 3, 1, sc);
  };
  leg(pose.backLeg, pose.backLift, pantsD, shade(shoes, -0.3));
  // Back arm
  const arm = (ang: number, c: string, hand: string) => {
    const sx = cx + 1, sy = top + 9;
    const rad = (ang * Math.PI) / 180;
    const ex = sx + Math.cos(rad) * 5, ey = sy + Math.sin(rad) * 5;
    p.line(sx, sy, ex, ey, c, 2);
    p.rect(Math.round(ex), Math.round(ey), 2, 2, hand);
    return [Math.round(ex), Math.round(ey)] as const;
  };
  arm(pose.backArm, shirtD, skinD);
  leg(pose.frontLeg, pose.frontLift, pants, shoes);

  // Torso
  const tTop = top + 8;
  p.rect(cx - 2, tTop, 6, hipY - tTop + 1, shirt);
  p.rect(cx - 2, tTop, 1, hipY - tTop + 1, shirtD);
  p.rect(cx - 2, hipY, 6, 1, pantsD); // belt
  if (r.accessory === 'apron') { p.rect(cx, tTop + 2, 4, hipY - tTop + 2, acc); p.rect(cx, tTop + 2, 4, 1, shade(acc, 0.25)); }
  if (r.accessory === 'vest') { p.rect(cx - 2, tTop, 2, hipY - tTop, acc); p.rect(cx + 2, tTop, 2, hipY - tTop, acc); }
  if (r.accessory === 'stripes') for (let y = tTop + 1; y < hipY; y += 2) p.rect(cx - 2, y, 6, 1, acc);
  if (r.accessory === 'bag') { p.line(cx - 2, tTop, cx + 3, hipY - 1, acc); p.rect(cx - 3, hipY - 2, 3, 3, acc); }

  // Head
  const hx = cx - 2, hy = top + 1;
  p.rect(hx, hy, 6, 6, skin);
  p.rect(hx, hy + 5, 6, 1, skinD);
  p.rect(cx, top + 7, 2, 1, skinD); // neck
  // Face (facing right)
  const ey = hy + 3;
  if (pose.eyes === 'closed') p.rect(hx + 4, ey, 2, 1, eye);
  else if (pose.eyes === 'x') { p.set(hx + 4, ey - 1, eye); p.set(hx + 5, ey, eye); p.set(hx + 4, ey + 1, eye); p.set(hx + 5, ey - 1, eye); p.set(hx + 4, ey + 1, eye); }
  else { p.set(hx + 4, ey, eye); p.set(hx + 4, ey - 1, eye); }
  p.set(hx + 5, ey + 1, skinD); // nose hint
  if (r.accessory === 'mustache' || r.hairStyle === 'bald') p.rect(hx + 3, ey + 2, 3, 1, hairD);
  if (r.accessory === 'glasses') { p.rect(hx + 3, ey - 1, 3, 2, '#1a1420'); p.set(hx + 4, ey - 1, '#9ad0f0'); }
  // Hair styles
  switch (r.hairStyle) {
    case 'short': p.rect(hx - 1, hy - 1, 7, 2, hair); p.rect(hx - 1, hy + 1, 2, 2, hair); break;
    case 'curly': p.rect(hx - 1, hy - 2, 8, 3, hair); p.rect(hx - 1, hy + 1, 2, 3, hair); for (let i = 0; i < 8; i += 2) p.set(hx - 1 + i, hy - 2, hairD); break;
    case 'long': p.rect(hx - 1, hy - 1, 7, 2, hair); p.rect(hx - 2, hy, 3, 8, hair); p.rect(hx - 2, hy + 7, 3, 1, hairD); break;
    case 'bob': p.rect(hx - 1, hy - 1, 7, 2, hair); p.rect(hx - 2, hy, 3, 6, hair); p.rect(hx + 5, hy, 1, 2, hair); break;
    case 'ponytail': p.rect(hx - 1, hy - 1, 7, 2, hair); p.rect(hx - 1, hy + 1, 2, 2, hair); p.rect(hx - 4, hy + 1, 3, 2, hair); p.rect(hx - 4, hy + 3, 2, 4, hairD); break;
    case 'bun': p.rect(hx - 1, hy - 1, 7, 2, hair); p.rect(hx - 1, hy + 1, 2, 3, hair); p.rect(hx - 2, hy - 3, 4, 3, hairD); break;
    case 'cap': p.rect(hx - 1, hy - 2, 7, 3, acc); p.rect(hx + 5, hy, 3, 1, shade(acc, -0.3)); p.rect(hx - 1, hy + 1, 2, 2, hair); break;
    case 'beanie': p.rect(hx - 1, hy - 3, 7, 4, acc); p.rect(hx - 1, hy, 7, 1, shade(acc, -0.3)); p.set(hx + 2, hy - 4, shade(acc, 0.3)); break;
    case 'hat': p.rect(hx - 2, hy - 1, 9, 1, acc); p.rect(hx, hy - 4, 5, 3, acc); p.rect(hx, hy - 2, 5, 1, shade(acc, -0.35)); break;
    case 'bald': p.rect(hx - 1, hy + 1, 1, 3, hair); p.set(hx + 1, hy, shade(skin, 0.25)); break;
  }
  if (r.accessory === 'scarf') { p.rect(cx - 2, tTop - 1, 6, 2, acc); p.rect(cx - 3, tTop + 1, 2, 3, shade(acc, -0.2)); }

  // Front arm and hand prop
  const [hxp, hyp] = arm(pose.frontArm, shade(shirt, 0.08), skin);
  if (r.accessory === 'tray' ) { p.rect(hxp - 1, hyp - 1, 6, 1, color('copper')); p.rect(hxp, hyp - 2, 4, 1, color('copperDark')); }
  if (r.accessory === 'cornbag') { p.rect(hxp, hyp, 4, 4, color('tan')); p.rect(hxp, hyp, 4, 1, color('khaki')); }
  if (r.accessory === 'parcel') { p.rect(hxp - 1, hyp - 2, 5, 4, color('tan')); p.rect(hxp + 1, hyp - 2, 1, 4, color('brown')); }
  const prop = r.prop ? PROPS[r.prop] : undefined;
  if (prop?.feet) p.stamp(prop.rows, cx + 1 - prop.ax, 24 - prop.rows.length);
  else if (prop) p.stamp(prop.rows, hxp - prop.ax + 1, hyp - prop.ay + 1);
  if (r.accessory === 'crate') { p.rect(cx + 2, tTop - 1, 7, 7, color('brown')); p.rect(cx + 2, tTop - 1, 7, 1, color('tan')); p.line(cx + 2, tTop, cx + 8, tTop + 5, color('brownDark')); }

  p.outline('#1a1420');
  return p;
}

function stars(p: Pix, y: number) {
  for (const [x, c] of [[6, '#f2d64b'], [12, '#fff0a0'], [18, '#f2d64b']] as const) {
    p.set(x, y, c); p.set(x - 1, y, c); p.set(x + 1, y, c); p.set(x, y - 1, c); p.set(x, y + 1, c);
  }
}

/** All 14 frames for a recipe: idle, run, jump/fall, attack, hurt, defeat. */
export function humanoidFrames(r: CharacterRecipe): Pix[] {
  const frames = POSES.map((pose) => drawHumanoid(r, pose));
  // defeat1: sitting dazed
  const sit = drawHumanoid(r, { ...POSES[11], bob: 5, frontLeg: 5, backLeg: 3, frontLift: 0, backLift: 0, frontArm: 140, backArm: 200, eyes: 'x' });
  stars(sit, 3);
  frames.push(sit);
  // defeat2: lying flat with cartoon stars (non-graphic knock-out)
  const lying = drawHumanoid(r, { ...POSES[0], eyes: 'x' }).rotatedCW().shifted(-1, 8);
  stars(lying, 12);
  frames.push(lying);
  return frames;
}

/** Bigger boss frames: the humanoid at 2x plus boss-specific details. 48x48 frames. */
export function bossFrames(r: CharacterRecipe, extra?: (p: Pix, frame: number) => void): Pix[] {
  return humanoidFrames(r).map((f, i) => {
    const big = f.scaled(2);
    extra?.(big, i);
    return big;
  });
}

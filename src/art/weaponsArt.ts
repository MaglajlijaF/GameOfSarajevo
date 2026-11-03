import { Pix } from './pixel';
import { shade, mix } from './palette';
import type { WeaponLook } from '../core/weapons';

/** 16x16 weapon icons, pointing right (grip on the left). Palette codes from palette.ts CODE. */
export const WEAPON_ICONS: Record<string, string[]> = {
  rucka: [
    '................', '................', '................', '..........kkkk..', '.........kggggk.',
    '........kgkkkkgk', '.kkkkkkkgk...kgk', 'kGGGGGGGgk...kgk', 'kGgggggGgk...kgk', '.kkkkkkkgk...kgk',
    '........kgkkkkgk', '.........kggggk.', '..........kkkk..', '................', '................', '................'],
  cevapi: [
    '................', '................', '................', '................', '................',
    '....kkk.kkk.kkk.', '...kmmmkmmmkmmmk', 'kkkkmMmkmMmkmMmkk', 'kGGGmmmkmmmkmmmgk', '...kMMMkMMMkMMMk.',
    '....kkk.kkk.kkk.', '................', '................', '................', '................', '................'],
  dzezva: [
    '................', '................', '................', '..........kkkk..', '.........kccccck',
    '.........kcCCCck', '.........kcwwwck', 'kkkkkkkkkcCCCCck', 'kBBBBBBBkcccccck', 'kkkkkkkkkcCCCCck',
    '.........kcccccck', '..........kCCCk.', '...........kkk..', '................', '................', '................'],
  fildzan: [
    '................', '................', '................', '................', '.......kkkkkkk..',
    '......kwwwwwwwk.', '......kuuuuuuuk.', '......kwwwwwwwkk', '.......kuwuwuk.k', '.......kwwwwwkk.',
    '........kkkkk...', '......kkkkkkkk..', '......kuuuuuuk..', '.......kkkkkk...', '................', '................'],
  kisobran: [
    '................', '................', '..........kkk...', '........kkrrrkk.', '.......krrwrrrrk',
    '......krrrrwrrrk', '......krkrkrkrkk', 'kkkkkkkkk.......', 'kBBBBBBBk.......', 'kkkkkkkkk.......',
    '................', '................', '................', '................', '................', '................'],
  tepsija: [
    '................', '................', '................', '................', '.........kkkkk..',
    '.......kkcccccck', '......kcCycyCyck', 'kkkkkkkcyCyCyCck', 'kBBBBBkcCyCyCyck', 'kkkkkkkcyCyCyCck',
    '.......kkcccccck', '.........kkkkk..', '................', '................', '................', '................'],
  golub: [
    '................', '................', '................', '..........kk....', '.........kggk...',
    '........kgkggko.', '...kk..kgggggkoo', '..kGGkkgggggk...', 'kkGgGGgggggk....', 'kBBkGGGGggk.....',
    'kkk.kkGGGk......', '.....kokok......', '................', '................', '................', '................'],
  zvono: [
    '................', '................', '................', '..........kk....', '.........kyyk...',
    '........kyyyyk..', '.......kyylyyk..', 'kkkkkkkkyyyyyk..', 'kBBBBBBkyyyyyk..', 'kkkkkkkyyyyyyyk.',
    '.......kkkkkkkk.', '..........kk....', '................', '................', '................', '................'],
  burek: [
    '................', '................', '................', '.........kkkkk..', '........ktttttk.',
    '.......kttTTTttk', '.......ktTkkTtTk', 'kkkkkkktTk.kTtTk', 'kBBBBBktTkkTttTk', 'kkkkkkktTTTttTk.',
    '.......kttttttk.', '........kkkkkk..', '................', '................', '................', '................'],
  lokum: [
    '................', '................', '................', '................', '..........kkkk..',
    '.........kpwppk.', '.........kppPpk.', 'kkkkkkkkkkpPppkk', 'kGGGGGGGGkppppkk', 'kkkkkkkkkkkkkkk.',
    '........kpppk...', '........kpPpk...', '.........kkk....', '................', '................', '................'],
  fenjer: [
    '................', '................', '...........kk...', '..........kGGk..', '.........kkkkkk.',
    '.........kylyyk.', '.........kyffyk.', 'kkkkkkkkkkfrrfk.', 'kBBBBBBBBkyffyk.', 'kkkkkkkkkkylyyk.',
    '.........kkkkkk.', '..........kGGk..', '................', '................', '................', '................'],
  sudzuk: [
    '................', '................', '................', '................', '.........kkkk...',
    '.......kkRRRRkk.', '......kRrRrRrRk.', 'kkkkkkRrRrRrRrRk', 'kGGGGkRRRRRRRRRk', 'kkkkkkkRrRrRrRk.',
    '.......kkRRRRkk.', '.........kkkk...', '................', '................', '................', '................'],
};

/** Mini 6x6 "charms" attached along the composite weapon for each merged part. */
const CHARM_SLOTS: [number, number][] = [[10, 2], [16, 3], [4, 3], [16, 15], [10, 16], [4, 15], [20, 9], [1, 9], [13, 0], [7, 18], [19, 0]];

export function composeWeapon(look: WeaponLook): Pix {
  const p = new Pix(24, 24);
  const base = new Pix(16, 16);
  base.stamp(WEAPON_ICONS[look.base] ?? WEAPON_ICONS.rucka);
  // Base weapon scaled up a bit by sitting centered in a 24x24 canvas.
  p.blit(base, 4, 4);
  // Attach a miniature of each merged part (downsampled icon) at a slot.
  look.attachments.forEach((a, i) => {
    const [sx, sy] = CHARM_SLOTS[i % CHARM_SLOTS.length];
    const icon = new Pix(16, 16);
    icon.stamp(WEAPON_ICONS[a.id] ?? WEAPON_ICONS.rucka);
    const mini = new Pix(6, 6);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      const c = icon.get(Math.min(15, Math.round(x * 2.2 + 2)), Math.min(15, Math.round(y * 2.2 + 2)));
      if (c && c !== '#1a1420') mini.set(x, y, c);
    }
    mini.outline('#1a1420');
    p.blit(mini, sx, sy);
    if (a.tier > 1) for (let t = 1; t < a.tier; t++) p.set(sx + 5 + t, sy, '#fff0a0');
  });
  // Glow outline in the colour of the latest part, intensifying with part count.
  if (look.attachments.length) {
    const glow = mix(look.glow, '#ffffff', 0.25);
    const outer = new Pix(24, 24);
    outer.blit(p);
    outer.outline(glow);
    if (look.attachments.length >= 3) outer.outline(shade(glow, -0.3));
    return outer;
  }
  return p;
}

/** Small projectile / effect sprites (string art). */
export const PROJECTILES: Record<string, string[]> = {
  cevapi: ['.........', 'kkk.kk.kk', 'GGmmmmmmk', 'kkk.kk.kk', '.........'],
  coffee: ['.kk.', 'kBBk', 'kBhk', '.kk.'],
  fildzan: ['.kkkkk.', 'kwwwwwk', 'kuuuuuk', 'kwwwwwk', '.kkkkk.'],
  umbrella: ['..kkk..', '.krwrk.', 'krrrrrk', 'kkkBkkk', '...B...', '...Bk..'],
  wave: ['..yy..', '.yllyy', 'yllllly', 'cccccc'],
  pigeon: ['...kk.', '..kggk', 'kkgggo', 'kGGgk.', '.kkk..'],
  burek: ['.kkkk.', 'kttTtk', 'kTkkTk', 'ktTTtk', '.kkkk.'],
  spark: ['.y.', 'yly', '.y.'],
  corn: ['.kk.', 'kyyk', 'kyyk', '.kk.'],
  pot: ['.kkkkkk.', 'kccccccck', 'kcCcCcCk', 'kccccccck', '.kCCCCk.', '..kkkk..'],
  bread: ['.kkk.', 'ktttk', 'kTTTk', '.kkk.'],
  // enemy & boss projectiles
  note: ['...kk', '...kn', '...k.', 'nnnk.', 'nnn..'],
  flowerpot: ['.eEe.', 'eeEee', 'kcccck', '.kcck.', '..kk..'],
  drop: ['..u..', '.uuu.', 'uuwuu', 'uuuuu', '.uuu.'],
  puck: ['.kkkk.', 'kGkkGk', '.kkkk.'],
  popcorn: ['.ww.', 'wwyw', 'wyww', '.ww.'],
  snowball: ['.ww.', 'wwwg', 'wwgg', '.gg.'],
  paper: ['w.....', 'www...', 'wgwww.', 'wwwwww', '.gg...'],
  ball: ['.kkkk.', 'kwkwwk', 'kwwkwk', 'kwkwwk', '.kkkk.'],
  whistle: ['.yy.', 'ylly', '.yy.'],
  oilcan: ['.kk.', 'kRRk', 'kRrk', 'kRRk', '.kk.'],
  bolt: ['..yl', '.yl.', 'ylyy', '..ly', '.ly.', 'ly..'],
  balloon: ['.uu.', 'uwuu', 'uuuu', '.uu.', '..k.'],
  pawn: ['.k.', 'kwk', '.k.', 'kwk', 'kkk'],
  petal: ['.pp', 'pPp', 'pp.'],
  paint: ['.vv.', 'vvvv', 'vpvv', '.vv.'],
  signal: ['lll', 'lyl', 'lll'],
  bee: ['.ww.', 'kykyk', 'kykyk', '.kk..'],
  apple: ['..E.', '.rr.', 'rrwr', 'rrrr', '.rr.'],
  honey: ['.yy.', 'yoyy', 'yyoy', '.yy.'],
  brick: ['RRRRRR', 'rrrrrr', 'RRRRRR'],
  javelin: ['GGGGGGGGGGw'],
  shotput: ['.GG.', 'GgGG', 'GGGG', '.GG.'],
  basketball: ['.oko.', 'ookoo', 'kkkkk', 'ookoo', '.oko.'],
  vinyl: ['.kkkk.', 'kkGGkk', 'kGrrGk', 'kGrrGk', 'kkGGkk', '.kkkk.'],
  suitcase: ['..kk..', 'kuuuuk', 'kuUUuk', 'kuuuuk', 'kkkkkk'],
  drone: ['G....G', 'kkkkkk', '.kGGk.', '..rr..'],
};

export function projectilePix(id: string): Pix {
  const rows = PROJECTILES[id] ?? PROJECTILES.spark;
  const w = Math.max(...rows.map((r) => r.length));
  const p = new Pix(w, rows.length);
  p.stamp(rows);
  return p;
}

/**
 * Enemy version of a projectile: the same sprite with a dark outline and a red
 * danger rim, 4px larger in each direction, so hostile shots read at a glance
 * and are clearly distinct from the player's own.
 */
export function enemyProjectilePix(id: string): Pix {
  const src = projectilePix(id);
  const p = new Pix(src.w + 4, src.h + 4);
  p.blit(src, 2, 2);
  p.outline('#1a1420');
  p.outline('#ff5a4a', true);
  return p;
}

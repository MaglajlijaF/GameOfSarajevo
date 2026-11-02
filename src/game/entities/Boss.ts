import Phaser from 'phaser';
import { Enemy, type EnemyScale } from './Enemy';
import type { BossAttack, BossDef, EnemyDef } from '../../core/types';
import type { World } from '../world';
import { audio } from '../../audio/audio';
import { hexToInt } from '../../art/palette';

/** Longest any single attack may run before the boss is forced back to walking. */
const ATTACK_TIMEOUT = 4;

/**
 * Boss: shares Enemy's damage pipeline but has its own phase-based attack
 * state machine. Phases and attack lists come from bosses.json.
 *
 * Timers (kept separate on purpose — sharing one timer froze the boss):
 *  - bt:    countdown for the current state (intro/walk/tele/recover)
 *  - actT:  time elapsed in the current attack (only ever increases)
 *  - stepT: countdown between repeated sub-steps of an attack
 */
export class Boss extends Enemy {
  bdef!: BossDef;
  phase = 0;
  bstate: 'intro' | 'walk' | 'tele' | 'act' | 'recover' = 'intro';
  attack: BossAttack = 'slam';
  /** Every attack started, for tests and debugging. */
  readonly history: BossAttack[] = [];
  private bt = 0;
  private actT = 0;
  private stepT = 0;
  private step = 0;
  private faceDir = -1;
  private shielded = false;
  private shieldFx: Phaser.GameObjects.Image | null = null;
  private landed = false;
  onPhaseChange?: (phase: number) => void;

  spawnBoss(def: BossDef, x: number, y: number, scale: EnemyScale): void {
    const fake: EnemyDef = { id: def.id, sprite: def.sprite, behavior: 'walker', hp: def.hp, damage: def.damage, speed: 0, xp: def.xp, params: {} };
    this.spawn(fake, x, y, scale);
    this.bdef = def;
    this.isBoss = true;
    this.body2.setSize(20, 38).setOffset(14, 10);
    this.setDepth(16);
    this.phase = 0;
    this.bstate = 'intro';
    this.bt = 1.6;
    this.history.length = 0;
  }

  override get vulnerable(): boolean { return this.alive && !this.dying && this.bstate !== 'intro' && !this.shielded; }
  get phaseDef() { return this.bdef.phases[this.phase]; }
  private get auraTint(): number { return hexToInt(this.bdef.color ?? '#ff7a2a'); }
  private get proj(): string { return `proj_${this.bdef.projectile}`; }

  override tick(dt: number, w: World): void {
    if (!this.alive || this.dying) return;
    const b = this.body2;
    const p = w.player;
    this.flashT = Math.max(0, this.flashT - dt);
    for (const [k, v] of this.hitTimers) { if (v - dt <= 0) this.hitTimers.delete(k); else this.hitTimers.set(k, v - dt); }
    const slow = this.slowT > 0 ? 0.5 + this.slowFactor * 0.5 : 1; // bosses resist slow
    this.slowT = Math.max(0, this.slowT - dt);
    const sdt = dt * slow * this.aggro;
    this.bt -= sdt;
    if (this.flashT > 0) this.setTintFill(0xffffff);
    else if (this.bstate === 'tele') this.setTint(Math.floor(this.bt * 12) % 2 ? 0xffb080 : 0xffffff);
    else if (this.burnT > 0) this.setTint(0xffc090);
    else this.clearTint();
    this.shieldFx?.setPosition(this.x, this.y);

    // Phase transitions
    const frac = this.hp / this.maxHp;
    let ph = 0;
    this.bdef.phases.forEach((d, i) => { if (frac <= d.hpBelow) ph = i; });
    if (ph !== this.phase) {
      this.phase = ph;
      this.endAttack(w);
      this.bstate = 'recover'; this.bt = 0.8;
      w.shake(0.01, 400);
      w.ring(this.x, this.y, 70, this.auraTint);
      audio.play('boss');
      this.onPhaseChange?.(ph);
    }

    const dx = p.x - this.x;
    if (this.bstate !== 'act') this.faceDir = Math.sign(dx) || this.faceDir;
    this.setFlipX(this.faceDir < 0);

    switch (this.bstate) {
      case 'intro':
      case 'recover':
        b.setVelocityX(0); this.anim('idle');
        if (this.bt <= 0) { this.bstate = 'walk'; this.bt = this.phaseDef.pause; }
        return;
      case 'walk': {
        // Follow the player; keep a little distance so attacks have room.
        const sp = this.phaseDef.speed * slow;
        b.setVelocityX(Math.abs(dx) > 36 ? this.faceDir * sp : 0);
        if (b.blocked.down && (b.blocked.left || b.blocked.right) && Math.abs(dx) > 36) b.setVelocityY(-320);
        this.anim(Math.abs(b.velocity.x) > 4 ? 'run' : 'idle');
        if (this.bt <= 0) {
          const list = this.phaseDef.attacks;
          const choices = list.filter((a) => a !== this.attack || list.length === 1);
          this.attack = Phaser.Utils.Array.GetRandom(choices);
          this.history.push(this.attack);
          this.bstate = 'tele';
          this.bt = this.attack === 'charge' || this.attack === 'zigzag' ? 0.6 : 0.5;
          b.setVelocityX(0);
        }
        return;
      }
      case 'tele':
        b.setVelocityX(0); this.anim('attack'); this.anims.pause();
        if (this.bt <= 0) { this.anims.resume(); this.beginAttack(w); }
        return;
      case 'act':
        this.actT += sdt;
        this.stepT -= sdt;
        this.runAttack(dt, w);
        if (this.bstate === 'act' && this.actT > ATTACK_TIMEOUT) this.finish(w);
        return;
    }
  }

  private beginAttack(w: World) {
    this.bstate = 'act';
    this.step = 0;
    this.stepT = 0;
    this.actT = 0;
    this.landed = false;
    const b = this.body2;
    const p = w.player;
    const ph = this.phase;
    switch (this.attack) {
      case 'slam': case 'shockwave': b.setVelocityY(-280); break;
      case 'leap': b.setVelocity(Phaser.Math.Clamp((p.x - this.x) / 0.9, -330, 330), -440); break;
      case 'charge': audio.play('dash'); break;
      case 'teleport':
        this.scene.tweens.add({ targets: this, alpha: 0, duration: 250 });
        break;
      case 'rain': {
        const { left, right } = w.arenaBounds();
        const n = 6 + ph * 4;
        for (let i = 0; i < n; i++) {
          const x = i % 3 === 0 ? Phaser.Math.Clamp(p.x + Phaser.Math.Between(-30, 30), left, right) : Phaser.Math.Between(left + 16, right - 16);
          this.scene.time.delayedCall(i * 140, () => {
            if (!this.alive) return;
            w.warnMarker(x, w.groundY() - 2, 650);
            this.scene.time.delayedCall(650, () => { if (this.alive) w.fireHostile({ texture: this.proj, x, y: -10, vx: 0, vy: 260, damage: Math.round(this.damage * 0.7), life: 4, motion: 'arc', gravity: 400, spin: 6 }); });
          });
        }
        break;
      }
      case 'summon': case 'shield': {
        const id = this.bdef.summon;
        if (id) {
          const { left, right } = w.arenaBounds();
          const n = 2 + ph;
          for (let i = 0; i < n; i++) w.spawnEnemy(id, i % 2 ? right - 30 - i * 10 : left + 30 + i * 10, 200);
        }
        if (this.attack === 'shield') {
          this.shielded = true;
          this.shieldFx = this.scene.add.image(this.x, this.y, 'fx_ring').setScale(2.2).setTint(this.auraTint).setAlpha(0.6).setDepth(17);
          this.scene.tweens.add({ targets: this.shieldFx, alpha: 0.25, duration: 300, yoyo: true, repeat: -1 });
        }
        audio.play('boss');
        break;
      }
      case 'trap': {
        const { left, right } = w.arenaBounds();
        const n = 3 + ph * 2;
        for (let i = 0; i < n; i++) {
          const x = i === 0 ? p.x : Phaser.Math.Between(left + 20, right - 20);
          w.warnMarker(x, w.groundY() - 2, 500);
          this.scene.time.delayedCall(500, () => { if (this.alive) w.trap(x, w.groundY() - 4, 5000, Math.round(this.damage * 0.5), this.auraTint); });
        }
        break;
      }
      case 'laser': {
        const beams = 1 + ph;
        for (let i = 0; i < beams; i++) {
          this.scene.time.delayedCall(i * 650, () => { if (this.alive) w.laser(w.player.y, 750, 380, Math.round(this.damage * 0.9), this.auraTint); });
        }
        break;
      }
      case 'meteor':
        w.fireHostile({ texture: this.proj, x: this.x, y: this.y - 30, vx: 0, vy: -150, damage: this.damage, life: 4.5, motion: 'homing', turn: 1.6, scale: 2.2, range: 46, pierce: 1 });
        audio.play('boss');
        break;
      default: break;
    }
  }

  private runAttack(dt: number, w: World) {
    const b = this.body2;
    const p = w.player;
    const ph = this.phase;
    const grounded = b.blocked.down;
    const { left, right } = w.arenaBounds();
    const atWall = b.blocked.left || b.blocked.right || b.touching.left || b.touching.right || this.x <= left + 12 || this.x >= right - 12;
    switch (this.attack) {
      case 'slam': case 'shockwave': case 'leap': {
        this.anim(b.velocity.y < 0 ? 'jump' : 'attack');
        if (this.actT > 0.2 && grounded) {
          this.impact(w, this.attack === 'shockwave' ? 2 : 1);
          this.finish(w);
        }
        return;
      }
      case 'teleport': {
        if (this.step === 0 && this.actT > 0.3) {
          // Reappear above the player and crash down.
          const x = Phaser.Math.Clamp(p.x, left + 20, right - 20);
          b.reset(x, 40);
          b.setVelocity(0, 200);
          this.setAlpha(1);
          w.warnMarker(x, w.groundY() - 2, 400);
          this.step = 1;
        }
        if (this.step === 1) { this.anim('fall'); if (grounded && this.actT > 0.45) { this.impact(w, 1); this.finish(w); } }
        return;
      }
      case 'charge': {
        this.anim('run');
        b.setVelocityX(this.faceDir * (230 + ph * 60));
        if (Math.random() < 0.4) w.puff(this.x - this.faceDir * 12, b.bottom - 2, 1, 0xd8cfbf);
        if ((atWall && this.actT > 0.2) || this.actT > 2.2) {
          w.shake(0.01, 200);
          audio.play('slam');
          this.finish(w, 0.9);
        }
        return;
      }
      case 'zigzag': {
        this.anim('run');
        if (this.stepT <= 0) {
          if (this.step >= 3 + ph) { this.finish(w, 0.7); return; }
          this.faceDir = Math.sign(p.x - this.x) || 1;
          this.setFlipX(this.faceDir < 0);
          b.setVelocity(this.faceDir * (360 + ph * 40), this.step % 2 ? -220 : 0);
          this.stepT = 0.45;
          this.step++;
          audio.play('dash');
        }
        if (atWall) b.setVelocityX(0);
        return;
      }
      case 'volley': case 'barrage': case 'spiral': case 'roll': {
        this.anim('attack');
        b.setVelocityX(0);
        if (this.stepT > 0) return;
        const shots = this.attack === 'volley' ? 3 + ph : this.attack === 'roll' ? 2 + ph : 2 + ph;
        if (this.step >= shots) { this.finish(w); return; }
        this.fireStep(w);
        this.step++;
        this.stepT = this.attack === 'volley' ? 0.3 : this.attack === 'roll' ? 0.55 : 0.5;
        return;
      }
      case 'pull': {
        this.anim('attack');
        b.setVelocityX(0);
        if (this.stepT <= 0) { w.ring(this.x, this.y, 90, this.auraTint); this.stepT = 0.4; }
        const dx = this.x - p.x;
        if (!p.dead && Math.abs(dx) < 260 && p.dashing <= 0) p.body2.velocity.x += Math.sign(dx) * (420 + ph * 120) * dt;
        if (Math.abs(dx) < 34 && Math.abs(p.y - this.y) < 40) p.hurt(Math.round(this.damage * 0.6), this.x);
        if (this.actT > 1.8) this.finish(w);
        return;
      }
      case 'shield':
        this.anim('idle'); b.setVelocityX(0);
        if (this.actT > 3.2) this.finish(w, 0.4);
        return;
      case 'rain': case 'trap': case 'laser': case 'meteor':
        this.anim('attack'); b.setVelocityX(0);
        if (this.actT > (this.attack === 'laser' ? 1 + ph * 0.65 : 1.2)) this.finish(w);
        return;
      case 'summon':
        this.anim('idle'); this.finish(w, this.phaseDef.pause + 0.5);
        return;
    }
  }

  private fireStep(w: World) {
    const p = w.player;
    const ph = this.phase;
    const dmg = Math.round(this.damage * 0.65);
    const ox = this.x + this.faceDir * 16, oy = this.y - 14;
    switch (this.attack) {
      case 'volley': {
        const t = 0.8;
        const tx = p.x + (this.step - 1) * 30;
        w.fireHostile({ texture: this.proj, x: ox, y: oy, vx: (tx - ox) / t, vy: (p.y - oy - 0.5 * 520 * t * t) / t, damage: dmg, life: 4, motion: 'arc', gravity: 520, spin: 8 });
        break;
      }
      case 'barrage': {
        const n = 5 + ph * 2;
        const a = Phaser.Math.Angle.Between(ox, oy, p.x, p.y);
        for (let i = 0; i < n; i++) {
          const ang = a - 0.5 + (i / (n - 1));
          w.fireHostile({ texture: this.proj, x: ox, y: oy, vx: Math.cos(ang) * 210, vy: Math.sin(ang) * 210, damage: dmg, life: 3, motion: 'straight' });
        }
        break;
      }
      case 'spiral': {
        const n = 10 + ph * 4;
        const off = this.step * 0.3;
        for (let i = 0; i < n; i++) {
          const ang = off + (i / n) * Math.PI * 2;
          w.fireHostile({ texture: this.proj, x: this.x, y: this.y - 10, vx: Math.cos(ang) * 150, vy: Math.sin(ang) * 150, damage: dmg, life: 3, motion: 'straight' });
        }
        break;
      }
      case 'roll':
        w.fireHostile({ texture: this.proj, x: ox, y: this.body2.bottom - 8, vx: this.faceDir * (190 + ph * 40), vy: -80, damage: dmg, life: 4, motion: 'roll', gravity: 700, bounces: 10, spin: 12 * this.faceDir, scale: 1.5 });
        break;
    }
    audio.play('shoot');
  }

  private impact(w: World, waves: number) {
    if (this.landed) return;
    this.landed = true;
    const b = this.body2;
    w.shake(0.012, 250);
    audio.play('slam');
    w.puff(this.x, b.bottom - 2, 10, 0xd8cfbf);
    for (let k = 0; k < waves; k++) {
      this.scene.time.delayedCall(k * 260, () => {
        if (!this.alive) return;
        for (const dir of [-1, 1]) w.groundWave(this.x + dir * 14, b.bottom - 6, dir, 170 + this.phase * 50 + k * 30, Math.round(this.damage * 0.8), true);
      });
    }
    const p = w.player;
    if (Math.abs(p.x - this.x) < 34 && Math.abs(p.y - this.y) < 40) p.hurt(this.damage, this.x);
  }

  private endAttack(_w: World) {
    this.shielded = false;
    this.shieldFx?.destroy();
    this.shieldFx = null;
    this.setAlpha(1);
    this.body2.setAllowGravity(true);
  }

  private finish(w: World, pause = this.phaseDef.pause) {
    this.endAttack(w);
    this.bstate = 'walk';
    this.bt = pause;
    this.body2.setVelocityX(0);
  }

  override hurt(amount: number, _kx: number, _ky: number): boolean {
    return super.hurt(amount, 0, 0); // bosses don't get knocked around
  }

  protected override startDying(): void {
    this.endAttack(null as unknown as World);
    super.startDying();
  }
}

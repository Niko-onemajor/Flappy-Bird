import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND, ROCKET as ROCKET_CFG } from '../config';

const ROCKET_W = ROCKET_CFG.WIDTH;
const ROCKET_H = ROCKET_CFG.HEIGHT;
const TRACK_DURATION = 120;  /* 追踪阶段：120帧 = 2秒 */

/* 预加载火箭图片（带错误检测） */
const ROCKET_IMG = (() => {
  const img = wx.createImage();
  img.onload = () => console.log('[Rocket] 图片加载成功');
  img.onerror = (e) => console.error('[Rocket] 图片加载失败!', e);
  img.src = 'images/rocket.png';
  return img;
})();

export default class Rocket extends Sprite {
  speed = 5;
  trailPhase = 0;
  angle = 0;
  targetX = 0;
  targetY = 0;
  state = 'tracking';    /* tracking | flying */
  trackTimer = 0;        /* 追踪剩余帧数 */
  _trackedX = 0;         /* 追踪到的玩家X */
  _trackedY = 0;         /* 追踪到的玩家Y */
  exhaust = [];          /* 尾气粒子数组 */

  constructor() {
    super('', ROCKET_W, ROCKET_H);
  }

  /* 简化版 init：不需要 pipe 参数，从右侧随机Y进入 */
  init(pipeSpeed) {
    this.visible = true;
    this.isActive = true;
    this.speed = pipeSpeed * 1.2;
    this.trailPhase = 0;
    this.exhaust = [];
    this.state = 'tracking';
    this.trackTimer = TRACK_DURATION;

    /* 从屏幕右侧进入，追踪阶段可见 */
    this.x = SCREEN_WIDTH + 30 + Math.random() * 50;
    const availableH = SCREEN_HEIGHT - GROUND.HEIGHT;
    this.y = 40 + Math.random() * (availableH - ROCKET_H - 40);

    /* 记录玩家初始位置 */
    const player = GameGlobal.databus.player;
    this._trackedX = player.x;
    this._trackedY = player.y;

    /* 播放引信点燃音效 */
    if (GameGlobal.sound) {
      GameGlobal.sound.playFuseBurn();
    }

    console.log(`[Rocket] 追踪阶段开始 x=${this.x.toFixed(1)} y=${this.y.toFixed(1)} trackTimer=${this.trackTimer}`);
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;

    if (this.state === 'tracking') {
      /* 追踪阶段：从右侧缓慢进入，持续追踪玩家位置 */
      this.x -= this.speed * 0.3;  /* 缓慢进入屏幕 */
      this.trackTimer--;
      this.trailPhase += 0.05;

      /* 持续更新追踪到的玩家位置 */
      const player = GameGlobal.databus.player;
      this._trackedX = player.x;
      this._trackedY = player.y;

      /* 追踪阶段：火箭头始终指向玩家 */
      this.angle = Math.atan2(this._trackedY - this.y, this._trackedX - this.x);

      if (this.trackTimer <= 0) {
        /* 追踪结束，锁定最后位置，全速发射 */
        this.state = 'flying';
        this.targetX = this._trackedX;
        this.targetY = this._trackedY;
        this.angle = Math.atan2(this.targetY - this.y, this.targetX - this.x);

        /* 播放火箭飞行音效 */
        if (GameGlobal.sound) {
          GameGlobal.sound.playRocketFly();
        }

        console.log(`[Rocket] 锁定发射! target=(${this.targetX.toFixed(1)},${this.targetY.toFixed(1)}) angle=${(this.angle * 180 / Math.PI).toFixed(1)}°`);
      }
      return;
    }

    /* 飞行阶段：直线飞向锁定位置 */
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.trailPhase += 0.15;

    /* 生成新尾气粒子（上限50个防止性能问题） */
    if (this.exhaust.length < 50 && (this.state === 'flying' || (this.state === 'tracking' && this.trackTimer < 60))) {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      /* 火箭尾部反方向生成粒子 */
      const backOffsetX = -Math.cos(this.angle) * (this.height / 2 + 2);
      const backOffsetY = -Math.sin(this.angle) * (this.height / 2 + 2);
      const particle = {
        x: cx + backOffsetX + (Math.random() - 0.5) * 4,
        y: cy + backOffsetY + (Math.random() - 0.5) * 4,
        size: 2 + Math.random() * 6,
        alpha: 0.7 + Math.random() * 0.3,
        life: 30 + Math.floor(Math.random() * 20),
        vx: -Math.cos(this.angle) * (1 + Math.random() * 2),
        vy: -Math.sin(this.angle) * (1 + Math.random() * 2),
      };
      this.exhaust.push(particle);
    }

    /* 更新已有粒子寿命 */
    for (let i = this.exhaust.length - 1; i >= 0; i--) {
      const p = this.exhaust[i];
      p.life--;
      p.x += p.vx;
      p.y += p.vy;
      p.alpha *= 0.92;
      if (p.life <= 0 || p.alpha < 0.05) {
        this.exhaust.splice(i, 1);
      }
    }
  }

  render(ctx) {
    if (!this.visible) return;

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    /* 绘制尾气粒子（世界坐标系） */
    ctx.save();
    for (const p of this.exhaust) {
      if (p.alpha < 0.05) continue;
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      gradient.addColorStop(0, `rgba(255, 255, 200, ${p.alpha * 0.8})`);
      gradient.addColorStop(0.3, `rgba(255, 160, 50, ${p.alpha * 0.6})`);
      gradient.addColorStop(0.7, `rgba(255, 80, 20, ${p.alpha * 0.4})`);
      gradient.addColorStop(1, `rgba(200, 30, 0, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    /* 火箭图片默认头朝上，需加 π/2 偏转使箭头指向飞行方向 */
    ctx.rotate(this.angle + Math.PI / 2);

    /* 火焰尾迹（火箭尾部 = 图片底部）- 动态渐变火焰 */
    const flameLen = 18 + Math.sin(this.trailPhase) * 6;
    const flameW = 6 + Math.sin(this.trailPhase * 2) * 2;
    const flameGrad = ctx.createLinearGradient(0, this.height / 2, 0, this.height / 2 + flameLen);
    flameGrad.addColorStop(0, 'rgba(255, 200, 50, 0.9)');
    flameGrad.addColorStop(0.4, 'rgba(255, 120, 20, 0.7)');
    flameGrad.addColorStop(0.7, 'rgba(255, 50, 10, 0.4)');
    flameGrad.addColorStop(1, 'rgba(200, 20, 0, 0)');
    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(0, this.height / 2 - 2);
    ctx.quadraticCurveTo(-flameW, this.height / 2 + flameLen * 0.5, 0, this.height / 2 + flameLen);
    ctx.quadraticCurveTo(flameW, this.height / 2 + flameLen * 0.5, 0, this.height / 2 - 2);
    ctx.fill();
    /* 内焰 */
    ctx.fillStyle = 'rgba(255, 255, 200, 0.6)';
    ctx.beginPath();
    ctx.moveTo(0, this.height / 2);
    ctx.quadraticCurveTo(-flameW * 0.3, this.height / 2 + flameLen * 0.4, 0, this.height / 2 + flameLen * 0.6);
    ctx.quadraticCurveTo(flameW * 0.3, this.height / 2 + flameLen * 0.4, 0, this.height / 2);
    ctx.fill();

    /* 火箭本体 */
    ctx.drawImage(ROCKET_IMG, -this.width / 2, -this.height / 2, this.width, this.height);

    ctx.restore();

    /* 追踪阶段：显示警告标识 */
    if (this.state === 'tracking') {
      const warnAlpha = 0.3 + 0.3 * Math.sin(this.trailPhase * 3);
      ctx.strokeStyle = `rgba(255, 60, 30, ${warnAlpha})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(cx, cy, this.width * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      /* 倒计时文字 */
      const sec = Math.ceil(this.trackTimer / 60);
      ctx.fillStyle = `rgba(255, 255, 255, ${warnAlpha + 0.2})`;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${sec}`, cx, cy - this.height / 2 - 8);
    }

    /* 碰撞箱可视化（黄色AABB） */
    if (GameGlobal.DEBUG_COLLISION) {
      const rx = this.x + 4;
      const ry = this.y + 2;
      const rw = this.width - 8;
      const rh = this.height - 4;
      ctx.strokeStyle = this.state === 'tracking' ? 'rgba(255, 165, 0, 0.8)' : 'rgba(255, 255, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, rw, rh);
      /* 方向指示线 */
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(this.angle) * 20, cy + Math.sin(this.angle) * 20);
      ctx.stroke();
    }
  }

  isCollideWithBird(bird) {
    if (!this.visible || !bird.visible || !bird.isActive) return false;

    const bx = bird.x + 4;
    const by = bird.y + 4;
    const bw = bird.width - 8;
    const bh = bird.height - 8;

    const rx = this.x + 4;
    const ry = this.y + 2;
    const rw = this.width - 8;
    const rh = this.height - 4;

    return bx + bw > rx && bx < rx + rw && by + bh > ry && by < ry + rh;
  }

  /* 火箭移除时清理音效 */
  cleanup() {
    this.exhaust = [];
    if (GameGlobal.sound) {
      GameGlobal.sound.stopRocketFly();
      GameGlobal.sound.stopFuseBurn();
    }
  }
}
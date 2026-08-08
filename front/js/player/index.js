import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { PLAYER, GROUND } from '../config';

const BIRD_WIDTH = PLAYER.WIDTH;
const BIRD_HEIGHT = PLAYER.HEIGHT;
const GRAVITY = PLAYER.GRAVITY;
const JUMP_VELOCITY = PLAYER.JUMP_VELOCITY;
const MAX_FALL_SPEED = PLAYER.MAX_FALL_SPEED;
const GROUND_Y_OFFSET = GROUND.HEIGHT;
const ROTATION_LERP = PLAYER.ROTATION_LERP;
const SHIELD_RADIUS = PLAYER.SHIELD_RADIUS;
const SHIELD_PULSE = PLAYER.SHIELD_PULSE;
const FLAP_INTERVAL = PLAYER.FLAP_INTERVAL;

/* 小鸟颜色选择 */
const BIRD_COLORS = ['redbird', 'bluebird', 'yellowbird'];
const BIRD_COLOR = BIRD_COLORS[Math.floor(Math.random() * BIRD_COLORS.length)];

/* 小鸟帧图片 */
const BIRD_FRAMES = [
  `images/${BIRD_COLOR}-downflap.png`,
  `images/${BIRD_COLOR}-midflap.png`,
  `images/${BIRD_COLOR}-upflap.png`,
];

/* 预加载所有小鸟帧图片，避免首次渲染空白 */
const birdFrameCache = BIRD_FRAMES.map((src) => {
  const img = wx.createImage();
  img.src = src;
  return img;
});

export default class Player extends Sprite {
  vy = 0;               /* 垂直速度 */
  targetRotation = 0;   /* 目标旋转角度 */
  currentRotation = 0;  /* 当前旋转角度（带惯性） */
  effectPhase = 0;      /* Buff动画相位 */
  flapIndex = 0;        /* 翅膀动画帧索引 */
  flapCounter = 0;      /* 翅膀动画计时器 */

  constructor() {
    super(BIRD_FRAMES[0], BIRD_WIDTH, BIRD_HEIGHT);
    this._loadFrames();
    this.init();
  }

  /* 加载所有帧图片（从预加载缓存） */
  _loadFrames() {
    this.birdFrames = birdFrameCache;
  }

  init() {
    this.x = SCREEN_WIDTH / 4;
    this.y = SCREEN_HEIGHT / 2;
    this.vy = 0;
    this.isActive = true;
    this.visible = true;
    this.targetRotation = 0;
    this.currentRotation = 0;
    this.effectPhase = 0;
    this.flapIndex = 0;
    this.flapCounter = 0;
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;

    /* 重力影响速度 */
    this.vy += GRAVITY;
    this.vy = Math.min(this.vy, MAX_FALL_SPEED);
    this.y += this.vy;

    /* 旋转角度 */
    this.targetRotation = Math.max(-20, Math.min(this.vy * 3.5, 45));
    this.currentRotation += (this.targetRotation - this.currentRotation) * ROTATION_LERP;

    /* Buff动画相位 */
    this.effectPhase += SHIELD_PULSE;

    /* 翅膀动画 */
    this.flapCounter++;
    if (this.flapCounter >= FLAP_INTERVAL) {
      this.flapCounter = 0;
      this.flapIndex = (this.flapIndex + 1) % 3;
    }

    /* 撞到天花板 */
    if (this.y <= 0) {
      this.y = 0;
      this.vy = 0.5;
    }

    /* 撞到地面 —— 护盾/扣命逻辑 */
    const groundY = SCREEN_HEIGHT - GROUND_Y_OFFSET - this.height;
    if (this.y >= groundY) {
      this.y = groundY;
      this.vy = 0;
      const db = GameGlobal.databus;
      if (db.invincibleTimer > 0) return;  /* 无敌中，忽略 */

      /* 护盾激活时：消耗护盾，重置位置，获得1秒无敌 */
      if (db.shieldActive) {
        db.shieldActive = false;
        db.shieldTimer = 0;
        db.invincibleTimer = 60;  /* 1秒无敌（60帧） */
        GameGlobal.sound.playShieldBreak();
        if (GameGlobal.DEBUG_LOG) console.log('[Player] 护盾抵挡地面碰撞，重置位置');
        this.y = SCREEN_HEIGHT / 3;
        this.vy = PLAYER.JUMP_VELOCITY * 0.5;
        return;
      }

      db.lives--;
      GameGlobal.sound.playHit();
      /* 振动反馈（根据设置） */
      if (GameGlobal.settings && GameGlobal.settings.vibrate && typeof wx.vibrateShort === 'function') {
        wx.vibrateShort({ type: 'light' });
      }
      /* 屏幕抖动（根据设置）——通过全局变量通知 main.js */
      if (GameGlobal.settings && GameGlobal.settings.screenShake) {
        GameGlobal._requestScreenShake = { timer: 8, intensity: 6 };
      }
      if (GameGlobal.DEBUG_LOG) console.log(`[Player] 撞地面! 剩余生命=${db.lives}`);
      if (db.lives <= 0) {
        this.destroy();
        db.gameOver();
        GameGlobal.sound.playDie();
      } else {
        db.invincibleTimer = PLAYER.INVINCIBLE_DURATION;
        /* 复活到屏幕中央偏上 */
        this.y = SCREEN_HEIGHT / 3;
        this.vy = PLAYER.JUMP_VELOCITY * 0.5;
      }
    }
  }

  render(ctx) {
    if (!this.visible) return;

    const db = GameGlobal.databus;

    /* 无敌闪烁效果：每6帧切换可见性 */
    if (db.invincibleTimer > 0 && Math.floor(db.invincibleTimer / 6) % 2 === 0) {
      return;  /* 闪烁帧：不渲染 */
    }

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    /* Buff特效 */
    if (db.shieldActive) {
      this._renderShield(ctx, cx, cy);
    }

    /* 角色本体 */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((this.currentRotation * Math.PI) / 180);

    /* 使用当前帧图片 */
    const frameImg = this.birdFrames[this.flapIndex];
    if (frameImg) {
      ctx.drawImage(frameImg, -this.width / 2, -this.height / 2, this.width, this.height);
    }

    ctx.restore();

    /* Buff图标（仅保留x2分数图标，移除小盾牌） */
    if (db.scoreMultiplier > 1) {
      this._renderMultiplierIcon(ctx, cx, cy);
    }

    /* 碰撞箱可视化（绿色AABB） */
    if (GameGlobal.DEBUG_COLLISION) {
      const hitShrink = 6;
      const hx = this.x + hitShrink;
      const hy = this.y + hitShrink;
      const hw = this.width - hitShrink * 2;
      const hh = this.height - hitShrink * 2;
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(hx, hy, hw, hh);
      /* 中心点 */
      ctx.fillStyle = 'rgba(0, 255, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* 护盾视觉特效 */
  _renderShield(ctx, cx, cy) {
    const pulse = 1 + Math.sin(this.effectPhase * 3) * 0.08;
    const r = SHIELD_RADIUS * pulse;

    ctx.save();
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 15;

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 4]);
    ctx.lineDashOffset = -this.effectPhase * 40;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  _renderMultiplierIcon(ctx, cx, cy) {
    ctx.save();
    ctx.fillStyle = '#FF5252';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText('x2', cx + 18, cy - 5);
    ctx.fillText('x2', cx + 18, cy - 5);
    ctx.restore();
  }

  destroy() {
    this.isActive = false;
    this.visible = false;
  }
}
import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const PROP_SIZE = 32;
const PROP_SPEED = 3;
const PROP_TYPES = ['shield', 'multiplier'];
const PROP_DURATION = 300;            /* 道具持续帧数（约5秒） */
const FLOAT_AMP = 4;                  /* 上下浮动幅度 */
const FLOAT_SPEED = 0.06;             /* 浮动速度 */

/* 道具外观配置 */
const PROP_STYLE = {
  shield: {
    color: '#FFD700',
    glow: '#FFA000',
    icon: '🛡',
    name: '护盾',
  },
  multiplier: {
    color: '#FF5252',
    glow: '#D32F2F',
    icon: 'x2',
    name: '双倍',
  },
};

export default class Prop extends Sprite {
  type = 'shield';
  collected = false;
  animPhase = 0;

  constructor() {
    super('', PROP_SIZE, PROP_SIZE);
  }

  init(type) {
    this.type = type || PROP_TYPES[Math.floor(Math.random() * PROP_TYPES.length)];
    this.visible = true;
    this.isActive = true;
    this.collected = false;
    this.animPhase = Math.random() * Math.PI * 2;
    this.x = SCREEN_WIDTH + Math.random() * 80;
    this.y = 60 + Math.random() * (SCREEN_HEIGHT - 170);
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;

    this.x -= PROP_SPEED;
    this.animPhase += FLOAT_SPEED;

    if (this.x + this.width < -10) {
      GameGlobal.databus.removeProp(this);
    }
  }

  render(ctx) {
    if (!this.visible || this.collected) return;

    const style = PROP_STYLE[this.type] || PROP_STYLE.shield;
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2 + Math.sin(this.animPhase) * FLOAT_AMP;
    const r = this.width / 2;
    const pulse = 1 + Math.sin(this.animPhase * 1.5) * 0.1;

    ctx.save();

    /* 外发光 */
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 12 + Math.sin(this.animPhase * 2) * 4;

    /* 外圈 */
    const outerR = r * pulse;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 4, 0, Math.PI * 2);
    ctx.fill();

    /* 主体圆形 */
    const mainGrad = ctx.createRadialGradient(cx - 3, cy - 3, r * 0.1, cx, cy, r * pulse);
    mainGrad.addColorStop(0, '#ffffff');
    mainGrad.addColorStop(0.4, style.color);
    mainGrad.addColorStop(1, style.glow);
    ctx.fillStyle = mainGrad;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
    ctx.fill();

    /* 边框 */
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * pulse, 0, Math.PI * 2);
    ctx.stroke();

    /* 图标 */
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.icon, cx, cy);

    /* 名称标签 */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 9px Arial';
    ctx.fillText(style.name, cx, cy + r + 10);

    ctx.restore();
  }

  collect() {
    if (this.collected) return;
    this.collected = true;
    this.visible = false;

    const db = GameGlobal.databus;
    switch (this.type) {
      case 'shield':
        db.shieldActive = true;
        db.shieldTimer = PROP_DURATION;
        break;
      case 'multiplier':
        db.scoreMultiplier = 2;
        db.multiplierTimer = PROP_DURATION;
        break;
    }
  }

  static getDuration() {
    return PROP_DURATION;
  }
}
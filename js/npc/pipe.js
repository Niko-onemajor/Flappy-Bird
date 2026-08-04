import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const PIPE_WIDTH = 52;
const PIPE_IMAGES = ['images/pipe-green.png', 'images/pipe-red.png'];
const GROUND_OFFSET = 112;      /* 地面高度 */
const PIPE_MIN_LENGTH = 60;     /* 单管最短长度 */
const BIRD_CLEARANCE = 50;      /* 小鸟通过所需最小空间 */
const MOVE_RANGE = 40;          /* 移动管振荡范围 */
const HITBOX_SHRINK = 6;        /* 碰撞框内缩（像素） */

/* 障碍物类型 */
const PIPE_TYPE = {
  NORMAL: 0,     /* 上下双管 */
  TOP_ONLY: 1,   /* 只有上管 */
  BOTTOM_ONLY: 2,/* 只有下管 */
  MOVING: 3,     /* 上下双管 + 上下移动 */
};

export default class Pipe extends Sprite {
  scored = false;
  gap = 140;
  speed = 3;
  pipeType = PIPE_TYPE.NORMAL;
  baseGapY = 0;
  movePhase = 0;

  constructor() {
    super('', PIPE_WIDTH, 0);
    this.pipeImg = wx.createImage();
    this.pipeImg.src = PIPE_IMAGES[Math.floor(Math.random() * PIPE_IMAGES.length)];
  }

  init(gap = 140, speed = 3) {
    this.visible = true;
    this.isActive = true;
    this.scored = false;
    this.gap = gap;
    this.speed = speed;
    this.x = SCREEN_WIDTH;
    this.movePhase = Math.random() * Math.PI * 2;

    const rand = Math.random();
    if (rand < 0.35) {
      this.pipeType = PIPE_TYPE.NORMAL;
    } else if (rand < 0.55) {
      this.pipeType = PIPE_TYPE.TOP_ONLY;
    } else if (rand < 0.75) {
      this.pipeType = PIPE_TYPE.BOTTOM_ONLY;
    } else {
      this.pipeType = PIPE_TYPE.MOVING;
    }

    this._calcGapPosition();
  }

  _calcGapPosition() {
    const availableH = SCREEN_HEIGHT - GROUND_OFFSET;

    switch (this.pipeType) {
      case PIPE_TYPE.TOP_ONLY: {
        const maxTop = availableH - BIRD_CLEARANCE;
        this.gapY = PIPE_MIN_LENGTH + Math.random() * (maxTop - PIPE_MIN_LENGTH);
        break;
      }
      case PIPE_TYPE.BOTTOM_ONLY: {
        const minBottom = BIRD_CLEARANCE;
        this.gapY = minBottom + Math.random() * (availableH - PIPE_MIN_LENGTH - minBottom);
        break;
      }
      case PIPE_TYPE.MOVING: {
        const minY = PIPE_MIN_LENGTH;
        const maxY = availableH - this.gap - PIPE_MIN_LENGTH;
        if (maxY <= minY) {
          this.gapY = availableH / 2 - this.gap / 2;
        } else {
          this.gapY = minY + Math.random() * (maxY - minY);
        }
        this.baseGapY = this.gapY;
        break;
      }
      default: {
        const minY = PIPE_MIN_LENGTH;
        const maxY = availableH - this.gap - PIPE_MIN_LENGTH;
        if (maxY <= minY) {
          this.gapY = availableH / 2 - this.gap / 2;
        } else {
          this.gapY = minY + Math.random() * (maxY - minY);
        }
        break;
      }
    }
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;

    this.x -= this.speed;

    if (this.pipeType === PIPE_TYPE.MOVING) {
      this.movePhase += 0.03;
      const offset = Math.sin(this.movePhase) * MOVE_RANGE;
      this.gapY = this.baseGapY + offset;
      const availableH = SCREEN_HEIGHT - GROUND_OFFSET;
      this.gapY = Math.max(PIPE_MIN_LENGTH, Math.min(this.gapY, availableH - this.gap - PIPE_MIN_LENGTH));
    }

    if (this.x + this.width < -20) {
      GameGlobal.databus.removePipe(this);
    }
  }

  render(ctx) {
    if (!this.visible) return;

    const availableH = SCREEN_HEIGHT - GROUND_OFFSET;

    const hasTop = this.pipeType === PIPE_TYPE.NORMAL || this.pipeType === PIPE_TYPE.TOP_ONLY || this.pipeType === PIPE_TYPE.MOVING;
    const hasBottom = this.pipeType === PIPE_TYPE.NORMAL || this.pipeType === PIPE_TYPE.BOTTOM_ONLY || this.pipeType === PIPE_TYPE.MOVING;

    if (hasTop) {
      /* 上管：翻转绘制 */
      const topH = this.gapY;
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.gapY);
      ctx.scale(1, -1);
      ctx.drawImage(this.pipeImg, -this.width / 2, 0, this.width, topH);
      ctx.restore();
    }

    if (hasBottom) {
      /* 下管：正常绘制 */
      const bottomY = this.gapY + (hasTop ? this.gap : 0);
      const bottomH = availableH - bottomY;
      if (bottomH > 0) {
        ctx.drawImage(this.pipeImg, this.x, bottomY, this.width, bottomH);
      }
    }
  }

  isCollideWithBird(bird) {
    if (!this.visible || !bird.visible || !bird.isActive) return false;

    const bx = bird.x + HITBOX_SHRINK;
    const by = bird.y + HITBOX_SHRINK;
    const bw = bird.width - HITBOX_SHRINK * 2;
    const bh = bird.height - HITBOX_SHRINK * 2;

    const px = this.x + 2;
    const pw = this.width - 4;

    const availableH = SCREEN_HEIGHT - GROUND_OFFSET;
    const hasTop = this.pipeType === PIPE_TYPE.NORMAL || this.pipeType === PIPE_TYPE.TOP_ONLY || this.pipeType === PIPE_TYPE.MOVING;
    const hasBottom = this.pipeType === PIPE_TYPE.NORMAL || this.pipeType === PIPE_TYPE.BOTTOM_ONLY || this.pipeType === PIPE_TYPE.MOVING;

    if (bx + bw <= px || bx >= px + pw) return false;

    if (hasTop && by < this.gapY) return true;

    if (hasBottom) {
      const bottomY = this.gapY + (hasTop ? this.gap : 0);
      if (by + bh > bottomY && bottomY < availableH) return true;
    }

    return false;
  }
}
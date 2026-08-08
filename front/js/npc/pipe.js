import Sprite from '../base/sprite';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { PIPE, GROUND } from '../config';

const PIPE_WIDTH = PIPE.WIDTH;
const GROUND_OFFSET = GROUND.HEIGHT;
const PIPE_MIN_LENGTH = PIPE.MIN_LENGTH;
const BIRD_CLEARANCE = PIPE.CLEARANCE;
const MOVE_RANGE = PIPE.MOVE_RANGE;
const HITBOX_SHRINK = PIPE.HITBOX_SHRINK;

/* 水管图片尺寸：52×320，顶部24px为管帽，其余为管身 */
const PIPE_IMG_H = 320;
const PIPE_CAP_H = 24;     /* 管帽在源图中的高度（固定不拉伸） */
const PIPE_BODY_H = PIPE_IMG_H - PIPE_CAP_H;  /* 管身高度（可拉伸） */

/* 预加载水管图片：绿色固定管、红色移动管 */
const PIPE_GREEN_IMG = (() => { const img = wx.createImage(); img.src = 'images/pipe-green.png'; return img; })();
const PIPE_RED_IMG = (() => { const img = wx.createImage(); img.src = 'images/pipe-red.png'; return img; })();

/* 障碍物类型 */
const PIPE_TYPE = {
  NORMAL: 0,     /* 上下双管 */
  TOP_ONLY: 1,   /* 只有上管 */
  BOTTOM_ONLY: 2,/* 只有下管 */
  MOVING: 3,     /* 上下双管 + 上下移动 */
};

export default class Pipe extends Sprite {
  scored = false;
  gap = 130;
  speed = 3;
  pipeType = PIPE_TYPE.NORMAL;
  baseGapY = 0;
  movePhase = 0;
  hasTop = true;      /* 是否包含上管（init时计算） */
  hasBottom = true;   /* 是否包含下管（init时计算） */

  constructor() {
    super('', PIPE_WIDTH, 0);
    this.pipeImg = PIPE_GREEN_IMG;
  }

  init(gap = 130, speed = 3) {
    this.visible = true;
    this.isActive = true;
    this.scored = false;
    this.gap = gap;
    this.speed = speed;
    this.x = SCREEN_WIDTH;
    this.movePhase = Math.random() * Math.PI * 2;

    const rand = Math.random();
    if (rand < 0.45) {
      this.pipeType = PIPE_TYPE.NORMAL;
    } else if (rand < 0.65) {
      this.pipeType = PIPE_TYPE.TOP_ONLY;
    } else if (rand < 0.85) {
      this.pipeType = PIPE_TYPE.BOTTOM_ONLY;
    } else {
      this.pipeType = PIPE_TYPE.MOVING;  /* 仅15%，降低移动管干扰 */
    }

    /* 移动管用红色，固定管用绿色，便于玩家区分 */
    this.pipeImg = this.pipeType === PIPE_TYPE.MOVING ? PIPE_RED_IMG : PIPE_GREEN_IMG;

    /* 缓存 hasTop/hasBottom 避免每帧重复计算 */
    this.hasTop = this.pipeType === PIPE_TYPE.NORMAL || this.pipeType === PIPE_TYPE.TOP_ONLY || this.pipeType === PIPE_TYPE.MOVING;
    this.hasBottom = this.pipeType === PIPE_TYPE.NORMAL || this.pipeType === PIPE_TYPE.BOTTOM_ONLY || this.pipeType === PIPE_TYPE.MOVING;

    this._calcGapPosition();
  }

  _calcGapPosition() {
    const availableH = SCREEN_HEIGHT - GROUND_OFFSET;

    switch (this.pipeType) {
      case PIPE_TYPE.TOP_ONLY: {
        /* 只有上管：下方留出足够通过空间 */
        const maxTop = availableH - BIRD_CLEARANCE;
        this.gapY = PIPE_MIN_LENGTH + Math.random() * Math.max(0, maxTop - PIPE_MIN_LENGTH);
        break;
      }
      case PIPE_TYPE.BOTTOM_ONLY: {
        /* 只有下管：上方留出足够通过空间 */
        const minBottom = BIRD_CLEARANCE;
        const maxBottom = availableH - PIPE_MIN_LENGTH;
        this.gapY = minBottom + Math.random() * Math.max(0, maxBottom - minBottom);
        break;
      }
      default: {
        /* 双管（NORMAL / MOVING）：gapY 逻辑相同 */
        const minGapY = PIPE_MIN_LENGTH;
        const maxGapY = availableH - this.gap - PIPE_MIN_LENGTH;
        if (maxGapY <= minGapY) {
          /* 可用空间不足时，缩小gap确保通过 */
          const actualGap = Math.max(BIRD_CLEARANCE, availableH - PIPE_MIN_LENGTH * 2);
          this.gap = actualGap;
          this.gapY = PIPE_MIN_LENGTH;
        } else {
          this.gapY = minGapY + Math.random() * (maxGapY - minGapY);
        }
        if (this.pipeType === PIPE_TYPE.MOVING) {
          this.baseGapY = this.gapY;
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
      /* 移动范围限制，确保始终有通过空间 */
      this.gapY = Math.max(PIPE_MIN_LENGTH, Math.min(this.gapY, availableH - this.gap - PIPE_MIN_LENGTH));
    }

    if (this.x + this.width < -20) {
      GameGlobal.databus.removePipe(this);
    }
  }

  render(ctx) {
    if (!this.visible) return;

    const availableH = SCREEN_HEIGHT - GROUND_OFFSET;

    if (this.hasTop) {
      /* 上管：翻转绘制，管帽固定大小不拉伸 */
      const topH = this.gapY;
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.gapY);
      ctx.scale(1, -1);
      /* 管帽（固定大小）：源图顶部24px，位于翻转后底部（靠近间隙入口） */
      const capDestH = Math.min(PIPE_CAP_H, topH);
      ctx.drawImage(this.pipeImg, 0, 0, this.width, PIPE_CAP_H, -this.width / 2, 0, this.width, capDestH);
      /* 管身（拉伸）：源图24px以下部分，填充剩余高度 */
      const bodyDestH = topH - capDestH;
      if (bodyDestH > 0) {
        ctx.drawImage(this.pipeImg, 0, PIPE_CAP_H, this.width, PIPE_BODY_H, -this.width / 2, capDestH, this.width, bodyDestH);
      }
      ctx.restore();
    }

    if (this.hasBottom) {
      /* 下管：正常绘制，管帽固定大小不拉伸 */
      const bottomY = this.gapY + (this.hasTop ? this.gap : 0);
      const bottomH = availableH - bottomY;
      if (bottomH > 0) {
        /* 管帽（固定大小）：源图顶部24px，位于管道入口处（顶部） */
        const capDestH = Math.min(PIPE_CAP_H, bottomH);
        ctx.drawImage(this.pipeImg, 0, 0, this.width, PIPE_CAP_H, this.x, bottomY, this.width, capDestH);
        /* 管身（拉伸）：源图24px以下部分，填充剩余高度 */
        const bodyDestH = bottomH - capDestH;
        if (bodyDestH > 0) {
          ctx.drawImage(this.pipeImg, 0, PIPE_CAP_H, this.width, PIPE_BODY_H, this.x, bottomY + capDestH, this.width, bodyDestH);
        }
      }
    }

    /* 碰撞箱可视化（红色矩形） */
    if (GameGlobal.DEBUG_COLLISION) {
      const px = this.x + 2;
      const pw = this.width - 4;
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
      ctx.lineWidth = 2;
      if (this.hasTop) {
        ctx.strokeRect(px, 0, pw, this.gapY);
      }
      if (this.hasBottom) {
        const bottomY = this.gapY + (this.hasTop ? this.gap : 0);
        const bottomH = availableH - bottomY;
        if (bottomH > 0) {
          ctx.strokeRect(px, bottomY, pw, bottomH);
        }
      }
      /* 间隙区域标记（绿色虚线） */
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(px, this.gapY, pw, this.hasTop && this.hasBottom ? this.gap : 0);
      ctx.setLineDash([]);
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

    if (bx + bw <= px || bx >= px + pw) return false;

    if (this.hasTop && by < this.gapY) return true;

    if (this.hasBottom) {
      const bottomY = this.gapY + (this.hasTop ? this.gap : 0);
      if (by + bh > bottomY && bottomY < availableH) return true;
    }

    return false;
  }
}
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND } from '../config';

const BG_IMAGES = ['images/background-day.png', 'images/background-night.png'];
const BASE_IMG_SRC = 'images/base.png';
const BG_SCROLL_SPEED = 0.8;  /* 背景视差滚动速度（远慢于地面） */
const BG_IMG_W = 288;         /* 背景图片原始宽度 */
const BG_IMG_H = 512;         /* 背景图片原始高度 */

/* 预加载背景和地面图片 */
const bgCache = BG_IMAGES.map((src) => {
  const img = wx.createImage();
  img.src = src;
  return img;
});
const baseCache = (() => {
  const img = wx.createImage();
  img.src = BASE_IMG_SRC;
  return img;
})();

/**
 * 程序化背景：天空图（视差滚动） + 滚动地面
 * 每次游戏随机选择白天/夜晚背景
 */
export default class BackGround {
  constructor() {
    this.bgImg = bgCache[Math.floor(Math.random() * bgCache.length)];
    this.baseImg = baseCache;
    this.baseX = 0;
    this.bgOffsetX = 0;

    /* 背景缩放：高度填满地面以上区域 */
    const skyH = SCREEN_HEIGHT - GROUND.HEIGHT;
    this.bgScale = skyH / BG_IMG_H;
    this.bgDrawW = BG_IMG_W * this.bgScale;
    this.bgDrawH = skyH;
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;

    /* 地面滚动（快） */
    this.baseX = (this.baseX + GROUND.SPEED) % GROUND.IMG_WIDTH;

    /* 背景视差滚动（慢），营造远景深度感 */
    this.bgOffsetX = (this.bgOffsetX + BG_SCROLL_SPEED) % this.bgDrawW;
  }

  render(ctx) {
    this._drawBg(ctx);
    this._drawBase(ctx);
  }

  /* 绘制天空背景（水平视差滚动） */
  _drawBg(ctx) {
    const w = this.bgDrawW;
    const h = this.bgDrawH;

    /* 绘制两段背景实现无缝视差滚动 */
    ctx.drawImage(this.bgImg, -this.bgOffsetX, 0, w, h);
    ctx.drawImage(this.bgImg, w - this.bgOffsetX, 0, w, h);
    /* 补充第三段防止极端情况缺口 */
    ctx.drawImage(this.bgImg, w * 2 - this.bgOffsetX, 0, w, h);
  }

  /* 绘制滚动地面 */
  _drawBase(ctx) {
    const baseY = SCREEN_HEIGHT - GROUND.HEIGHT;

    /* 绘制三段地面实现无缝滚动 */
    ctx.drawImage(this.baseImg, -this.baseX, baseY, GROUND.IMG_WIDTH, GROUND.HEIGHT);
    ctx.drawImage(this.baseImg, GROUND.IMG_WIDTH - this.baseX, baseY, GROUND.IMG_WIDTH, GROUND.HEIGHT);
    ctx.drawImage(this.baseImg, GROUND.IMG_WIDTH * 2 - this.baseX, baseY, GROUND.IMG_WIDTH, GROUND.HEIGHT);
  }
}
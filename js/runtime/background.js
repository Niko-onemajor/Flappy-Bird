import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND } from '../config';

const BG_IMAGES = ['images/background-day.png', 'images/background-night.png'];
const BASE_IMG_SRC = 'images/base.png';

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
 * 程序化背景：天空图 + 滚动地面
 * 每次游戏随机选择白天/夜晚背景
 */
export default class BackGround {
  constructor() {
    this.bgImg = bgCache[Math.floor(Math.random() * bgCache.length)];
    this.baseImg = baseCache;
    this.baseX = 0;

    /* 背景缩放比例 */
    this.bgScale = SCREEN_HEIGHT / 512;  /* 原始512高 */
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;

    /* 地面滚动 */
    this.baseX = (this.baseX + GROUND.SPEED) % GROUND.IMG_WIDTH;  /* base图片宽336 */
  }

  render(ctx) {
    this._drawBg(ctx);
    this._drawBase(ctx);
  }

  /* 绘制天空背景 */
  _drawBg(ctx) {
    const bgH = 512 * this.bgScale;
    /* 背景拉伸填满天空区域 */
    ctx.drawImage(this.bgImg, 0, 0, SCREEN_WIDTH, bgH);
    /* 下方用纯色填充 */
    if (bgH < SCREEN_HEIGHT) {
      ctx.fillStyle = '#71c5cf';
      ctx.fillRect(0, bgH, SCREEN_WIDTH, SCREEN_HEIGHT - bgH);
    }
  }

  /* 绘制滚动地面 */
  _drawBase(ctx) {
    const baseY = SCREEN_HEIGHT - GROUND.HEIGHT;

    /* 绘制三段地面实现无缝滚动 */
    ctx.drawImage(this.baseImg, -this.baseX, baseY, GROUND.IMG_WIDTH, GROUND.HEIGHT);
    ctx.drawImage(this.baseImg, GROUND.IMG_WIDTH - this.baseX, baseY, GROUND.IMG_WIDTH, GROUND.HEIGHT);
    /* 补充第三段防止缺口 */
    ctx.drawImage(this.baseImg, GROUND.IMG_WIDTH * 2 - this.baseX, baseY, GROUND.IMG_WIDTH, GROUND.HEIGHT);
  }
}
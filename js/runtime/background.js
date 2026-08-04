import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const BG_IMAGES = ['images/background-day.png', 'images/background-night.png'];
const BASE_IMG_SRC = 'images/base.png';
const BASE_HEIGHT = 112;  /* 地面图片高度 */
const BASE_SPEED = 3;     /* 地面滚动速度 */

/**
 * 程序化背景：天空图 + 滚动地面
 * 每次游戏随机选择白天/夜晚背景
 */
export default class BackGround {
  constructor() {
    this.bgImg = wx.createImage();
    this.bgImg.src = BG_IMAGES[Math.floor(Math.random() * BG_IMAGES.length)];

    this.baseImg = wx.createImage();
    this.baseImg.src = BASE_IMG_SRC;

    this.baseX = 0;

    /* 背景缩放比例 */
    this.bgScale = SCREEN_HEIGHT / 512;  /* 原始512高 */
  }

  update() {
    if (GameGlobal.databus.isGameOver) return;

    /* 地面滚动 */
    this.baseX = (this.baseX + BASE_SPEED) % 336;  /* base图片宽336 */
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
    const baseY = SCREEN_HEIGHT - BASE_HEIGHT;

    /* 绘制两段地面实现无缝滚动 */
    ctx.drawImage(this.baseImg, -this.baseX, baseY, 336, BASE_HEIGHT);
    ctx.drawImage(this.baseImg, 336 - this.baseX, baseY, 336, BASE_HEIGHT);
    /* 补充第三段防止缺口 */
    ctx.drawImage(this.baseImg, 672 - this.baseX, baseY, 336, BASE_HEIGHT);
  }
}
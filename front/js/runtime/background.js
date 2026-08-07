import { SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_W_REAL, SCREEN_H_REAL, GAME_SCALE, GAME_OFFSET_Y } from '../render';
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
 * 全屏渲染：背景填满整个 Canvas，游戏元素在设计分辨率内缩放
 */
export default class BackGround {
  constructor() {
    this.bgImg = bgCache[Math.floor(Math.random() * bgCache.length)];
    this.baseImg = baseCache;
    this.baseX = 0;
    this.bgOffsetX = 0;

    /* 背景缩放：高度填满地面以上区域（设计分辨率） */
    const skyH = SCREEN_HEIGHT - GROUND.HEIGHT;
    this.bgScale = skyH / BG_IMG_H;
    this.bgDrawW = BG_IMG_W * this.bgScale;
    this.bgDrawH = skyH;

    /* 预创建天空渐变（全屏尺寸不变，可缓存） */
    this._skyGradient = null;
  }

  update() {
    if (GameGlobal.isGameOverServer || (GameGlobal.databus && GameGlobal.databus.isGameOver)) return;

    /* 地面滚动（快） */
    this.baseX = (this.baseX + GROUND.SPEED) % GROUND.IMG_WIDTH;

    /* 背景视差滚动（慢），营造远景深度感 */
    this.bgOffsetX = (this.bgOffsetX + BG_SCROLL_SPEED) % this.bgDrawW;
  }

  render(ctx) {
    this._drawBg(ctx);
    this._drawBase(ctx);
  }

  /**
   * 全屏渲染背景（无缩放变换）
   * 用于填满整个 Canvas 边界区域，确保无黑边
   */
  renderFullScreen(ctx) {
    const screenW = SCREEN_W_REAL;
    const screenH = SCREEN_H_REAL;

    /* 计算游戏地面在屏幕上的位置 */
    const gameGroundY = (SCREEN_HEIGHT - GROUND.HEIGHT) * GAME_SCALE + GAME_OFFSET_Y;

    /* 计算地面位置 */
    const groundH = GROUND.HEIGHT * GAME_SCALE;
    const groundY = Math.min(gameGroundY, screenH - groundH);

    /* 1. 地面以下区域先用泥土色填充（防止浮点精度缝隙透出蓝色） */
    if (groundY < screenH) {
      ctx.fillStyle = '#DED895';
      ctx.fillRect(0, groundY, screenW, screenH - groundY);
    }

    /* 2. 天空渐变 - 仅填充地面以上区域（使用缓存渐变，避免每帧创建） */
    if (groundY > 0) {
      if (!this._skyGradient) {
        this._skyGradient = ctx.createLinearGradient(0, 0, 0, screenH);
        this._skyGradient.addColorStop(0, '#4DC9F6');
        this._skyGradient.addColorStop(1, '#87CEEB');
      }
      ctx.fillStyle = this._skyGradient;
      ctx.fillRect(0, 0, screenW, groundY);
    }

    /* 3. 天空背景图片平铺 - 在地面以上区域 */
    if (gameGroundY > 0) {
      const bgScale = gameGroundY / BG_IMG_H;
      const bgTileW = BG_IMG_W * bgScale;
      const tilesNeeded = Math.ceil(screenW / bgTileW) + 2;
      for (let i = 0; i < tilesNeeded; i++) {
        ctx.drawImage(this.bgImg, i * bgTileW - this.bgOffsetX * bgScale, 0, bgTileW, gameGroundY);
      }
    }

    /* 4. 地面平铺 - 覆盖泥土色区域 */
    const groundTileW = GROUND.IMG_WIDTH * GAME_SCALE;
    const groundTilesNeeded = Math.ceil(screenW / groundTileW) + 2;
    for (let i = 0; i < groundTilesNeeded; i++) {
      ctx.drawImage(this.baseImg, i * groundTileW - this.baseX * GAME_SCALE, groundY, groundTileW, groundH);
    }
  }

  /* 绘制天空背景（水平视差滚动，动态平铺适配任意屏幕宽度） */
  _drawBg(ctx) {
    const w = this.bgDrawW;
    const h = this.bgDrawH;

    /* 动态计算所需平铺块数：屏幕宽度 / 单块宽度，+2 覆盖滚动偏移 */
    const tilesNeeded = Math.ceil(SCREEN_WIDTH / w) + 2;
    for (let i = 0; i < tilesNeeded; i++) {
      ctx.drawImage(this.bgImg, i * w - this.bgOffsetX, 0, w, h);
    }
  }

  /* 绘制滚动地面 */
  _drawBase(ctx) {
    const baseY = SCREEN_HEIGHT - GROUND.HEIGHT;
    const w = GROUND.IMG_WIDTH;
    const h = GROUND.HEIGHT;

    /* 动态计算所需平铺块数 */
    const tilesNeeded = Math.ceil(SCREEN_WIDTH / w) + 2;
    for (let i = 0; i < tilesNeeded; i++) {
      ctx.drawImage(this.baseImg, i * w - this.baseX, baseY, w, h);
    }
  }
}
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

    /* 缓存游戏地面在屏幕坐标系中的位置（仅与常量相关，只需计算一次） */
    this._gameGroundY = (SCREEN_HEIGHT - GROUND.HEIGHT) * GAME_SCALE + GAME_OFFSET_Y;

    /* 预计算全屏渲染用常量（避免每帧重复计算） */
    this._groundH = GROUND.HEIGHT * GAME_SCALE;
    this._groundTileW = GROUND.IMG_WIDTH * GAME_SCALE;
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

    /* 使用缓存的常量值 */
    const gameGroundY = this._gameGroundY;
    const groundH = this._groundH;
    const groundTileW = this._groundTileW;
    const groundY = Math.min(gameGroundY, screenH - groundH);

    /* 0. 兜底：先填充整个画布为天空蓝色，确保任何时候都不会黑屏 */
    ctx.fillStyle = '#4DC9F6';
    ctx.fillRect(0, 0, screenW, screenH);

    /* 1. 地面以下区域先用泥土色填充（防止浮点精度缝隙透出蓝色） */
    if (groundY + groundH < screenH) {
      ctx.fillStyle = '#8B5E3C';
      ctx.fillRect(0, groundY + groundH, screenW, screenH - groundY - groundH);
    }

    /* 2. 天空背景渐变 */
    if (!this._skyGradient) {
      this._skyGradient = ctx.createLinearGradient(0, 0, 0, gameGroundY);
      this._skyGradient.addColorStop(0, '#4DC9F6');
      this._skyGradient.addColorStop(1, '#87CEEB');
    }
    ctx.fillStyle = this._skyGradient;
    ctx.fillRect(0, 0, screenW, groundY);

    /* 3. 天空背景图片平铺（直接绘制，避免离屏 Canvas 创建开销） */
    if (gameGroundY > 0 && this._isBgReady()) {
      const bgScale = gameGroundY / BG_IMG_H;
      const bgTileW = BG_IMG_W * bgScale;
      const modOffset = (this.bgOffsetX * bgScale) % bgTileW;
      const tilesNeeded = Math.ceil(screenW / bgTileW) + 2;
      for (let i = 0; i < tilesNeeded; i++) {
        ctx.drawImage(this.bgImg, i * bgTileW - modOffset, 0, bgTileW, gameGroundY);
      }
    }

    /* 4. 地面平铺（直接绘制，避免离屏 Canvas 创建开销） */
    if (this._isGroundReady()) {
      const modOffset = (this.baseX * GAME_SCALE) % groundTileW;
      const tilesNeeded = Math.ceil(screenW / groundTileW) + 2;
      for (let i = 0; i < tilesNeeded; i++) {
        ctx.drawImage(this.baseImg, i * groundTileW - modOffset, groundY, groundTileW, groundH);
      }
    }
  }

  /** 检查背景图片是否已加载完成 */
  _isBgReady() {
    return this.bgImg && this.bgImg.width > 0 && this.bgImg.height > 0;
  }

  /** 检查地面图片是否已加载完成 */
  _isGroundReady() {
    return this.baseImg && this.baseImg.width > 0 && this.baseImg.height > 0;
  }

  /* 绘制天空背景（水平视差滚动，动态平铺适配任意屏幕宽度） */
  _drawBg(ctx) {
    const w = this.bgDrawW;
    const h = this.bgDrawH;

    /* 使用离屏缓存加速 */
    if (!this._bgTileCache) {
      this._buildBgTileCache();
    }
    if (this._bgTileCache) {
      const modOffset = this.bgOffsetX % w;
      ctx.drawImage(this._bgTileCache, modOffset, 0, w, h, 0, 0, w, h);
    } else {
      /* 回退：直接平铺 */
      const tilesNeeded = Math.ceil(SCREEN_WIDTH / w) + 2;
      for (let i = 0; i < tilesNeeded; i++) {
        ctx.drawImage(this.bgImg, i * w - this.bgOffsetX, 0, w, h);
      }
    }
  }

  /** 构建背景平铺离屏缓存 */
  _buildBgTileCache() {
    const w = this.bgDrawW;
    const h = this.bgDrawH;
    try {
      const cache = wx.createCanvas();
      const tilesNeeded = Math.ceil(SCREEN_WIDTH / w) + 2;
      cache.width = tilesNeeded * w;
      cache.height = h;
      const cctx = cache.getContext('2d');
      for (let i = 0; i < tilesNeeded; i++) {
        cctx.drawImage(this.bgImg, i * w, 0, w, h);
      }
      this._bgTileCache = cache;
    } catch (e) {
      this._bgTileCache = null;
    }
  }

  /** 构建地面平铺离屏缓存 */
  _buildGroundTileCache() {
    const baseY = SCREEN_HEIGHT - GROUND.HEIGHT;
    const w = GROUND.IMG_WIDTH;
    const h = GROUND.HEIGHT;
    try {
      const cache = wx.createCanvas();
      const tilesNeeded = Math.ceil(SCREEN_WIDTH / w) + 2;
      cache.width = tilesNeeded * w;
      cache.height = h;
      const cctx = cache.getContext('2d');
      for (let i = 0; i < tilesNeeded; i++) {
        cctx.drawImage(this.baseImg, i * w, 0, w, h);
      }
      this._groundTileCache = cache;
    } catch (e) {
      this._groundTileCache = null;
    }
  }

  /* 绘制滚动地面 */
  _drawBase(ctx) {
    const baseY = SCREEN_HEIGHT - GROUND.HEIGHT;
    const w = GROUND.IMG_WIDTH;
    const h = GROUND.HEIGHT;

    /* 使用离屏缓存加速 */
    if (!this._groundTileCache) {
      this._buildGroundTileCache();
    }
    if (this._groundTileCache) {
      const modOffset = this.baseX % w;
      ctx.drawImage(this._groundTileCache, modOffset, 0, w, h, 0, baseY, w, h);
    } else {
      /* 回退：直接平铺 */
      const tilesNeeded = Math.ceil(SCREEN_WIDTH / w) + 2;
      for (let i = 0; i < tilesNeeded; i++) {
        ctx.drawImage(this.baseImg, i * w - this.baseX, baseY, w, h);
      }
    }
  }
}
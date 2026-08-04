import Emitter from '../libs/tinyemitter';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

const GROUND_OFFSET = 112;  /* 地面高度 */

export default class GameInfo extends Emitter {
  constructor() {
    super();

    /* 主页"开始游戏"按钮 */
    this.homeBtnArea = {
      startX: SCREEN_WIDTH / 2 - 60,
      startY: SCREEN_HEIGHT / 2 + 20,
      endX: SCREEN_WIDTH / 2 + 60,
      endY: SCREEN_HEIGHT / 2 + 70,
    };

    /* 游戏结束按钮 */
    this.btnArea = {
      startX: SCREEN_WIDTH / 2 - 80,
      startY: SCREEN_HEIGHT / 2 + 30,
      endX: SCREEN_WIDTH / 2 + 80,
      endY: SCREEN_HEIGHT / 2 + 70,
    };
    this.menuBtnArea = {
      startX: SCREEN_WIDTH / 2 - 80,
      startY: SCREEN_HEIGHT / 2 + 80,
      endX: SCREEN_WIDTH / 2 + 80,
      endY: SCREEN_HEIGHT / 2 + 120,
    };

    /* 加载素材图片 */
    this.messageImg = wx.createImage();
    this.messageImg.src = 'images/message.png';
    this.gameoverImg = wx.createImage();
    this.gameoverImg.src = 'images/gameover.png';

    /* 加载数字图片 0-9 */
    this.numImgs = [];
    for (let i = 0; i < 10; i++) {
      const img = wx.createImage();
      img.src = `images/${i}.png`;
      this.numImgs.push(img);
    }

    this._touchHandler = this.touchEventHandler.bind(this);
    wx.onTouchStart(this._touchHandler);
  }

  /* ========== 主页渲染 ========== */
  renderHome(ctx) {
    /* 标题 "Flappy Bird" 使用message图片 */
    const msgW = 184;
    const msgH = 267;
    const msgScale = 0.7;
    ctx.drawImage(
      this.messageImg,
      SCREEN_WIDTH / 2 - (msgW * msgScale) / 2,
      SCREEN_HEIGHT / 2 - 140,
      msgW * msgScale,
      msgH * msgScale
    );

    /* 开始按钮 */
    const btn = this.homeBtnArea;
    ctx.fillStyle = '#e86100';
    ctx.strokeStyle = '#733800';
    ctx.lineWidth = 3;
    const rx = 10;
    this._roundRect(ctx, btn.startX, btn.startY, btn.endX - btn.startX, btn.endY - btn.startY, rx);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('开始游戏', SCREEN_WIDTH / 2, btn.startY + 32);

    /* 最高分 */
    const best = this._getBestScore();
    if (best > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.font = 'bold 14px Arial';
      ctx.strokeText(`最高分: ${best}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 90);
      ctx.fillText(`最高分: ${best}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 90);
    }
  }

  /* ========== 游戏中渲染 ========== */
  render(ctx) {
    this.renderHUD(ctx);

    if (GameGlobal.databus.isGameOver) {
      this.renderGameOver(ctx);
    }
  }

  /* HUD */
  renderHUD(ctx) {
    const db = GameGlobal.databus;
    /* 使用数字图片显示分数 */
    this._drawScore(ctx, db.score, SCREEN_WIDTH / 2, 40);

    /* 道具状态栏 */
    this.renderPropBar(ctx, db);
  }

  /* 用数字图片绘制分数 */
  _drawScore(ctx, score, cx, cy) {
    const digits = String(score).split('');
    const numW = 24;
    const numH = 36;
    const totalW = digits.length * numW;
    const startX = cx - totalW / 2;

    for (let i = 0; i < digits.length; i++) {
      const d = parseInt(digits[i]);
      if (this.numImgs[d]) {
        ctx.drawImage(this.numImgs[d], startX + i * numW, cy - numH / 2, numW, numH);
      }
    }
  }

  /* 道具状态栏 */
  renderPropBar(ctx, db) {
    const barY = SCREEN_HEIGHT - 15;
    const barX = SCREEN_WIDTH / 2 - 60;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    if (db.shieldActive) {
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`护盾 ${Math.ceil(db.shieldTimer / 60)}s`, barX, barY);
    }

    if (db.scoreMultiplier > 1) {
      ctx.fillStyle = '#FF5252';
      ctx.fillText(`x2 ${Math.ceil(db.multiplierTimer / 60)}s`, barX + 80, barY);
    }
  }

  /* 游戏结束 */
  renderGameOver(ctx) {
    /* 半透明遮罩 */
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const score = GameGlobal.databus.score;

    /* gameover 图片 */
    const goW = 192;
    const goH = 42;
    ctx.drawImage(this.gameoverImg, SCREEN_WIDTH / 2 - goW / 2, SCREEN_HEIGHT / 2 - 90, goW, goH);

    /* 分数 */
    this._drawScore(ctx, score, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 30);

    /* 最高分 */
    const best = this._getBestScore();
    if (score >= best && score > 0) {
      this._saveBestScore(score);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('新纪录!', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 5);
    } else if (best > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`最高分: ${best}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 5);
    }

    /* 重新开始按钮 */
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(this.btnArea.startX, this.btnArea.startY, 160, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('重新开始', SCREEN_WIDTH / 2, this.btnArea.startY + 28);

    /* 返回主页按钮 */
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(this.menuBtnArea.startX, this.menuBtnArea.startY, 160, 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('返回主页', SCREEN_WIDTH / 2, this.menuBtnArea.startY + 28);
  }

  /* ========== 触摸事件 ========== */
  touchEventHandler(event) {
    const { clientX, clientY } = event.touches[0];

    /* 主页：点击开始按钮 */
    if (GameGlobal.screenState === 'home') {
      if (
        clientX >= this.homeBtnArea.startX &&
        clientX <= this.homeBtnArea.endX &&
        clientY >= this.homeBtnArea.startY &&
        clientY <= this.homeBtnArea.endY
      ) {
        this.emit('start');
      }
      return;
    }

    /* 游戏结束：点击按钮 */
    if (!GameGlobal.databus.isGameOver) return;

    if (
      clientX >= this.btnArea.startX &&
      clientX <= this.btnArea.endX &&
      clientY >= this.btnArea.startY &&
      clientY <= this.btnArea.endY
    ) {
      this.emit('restart');
      return;
    }

    if (
      clientX >= this.menuBtnArea.startX &&
      clientX <= this.menuBtnArea.endX &&
      clientY >= this.menuBtnArea.startY &&
      clientY <= this.menuBtnArea.endY
    ) {
      this.emit('backToHome');
    }
  }

  /* ========== 辅助方法 ========== */
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  _getBestScore() {
    try {
      const val = wx.getStorageSync('flappy_best');
      return val !== '' ? val : 0;
    } catch (e) {
      return 0;
    }
  }

  _saveBestScore(score) {
    try {
      wx.setStorageSync('flappy_best', score);
    } catch (e) {
      /* 忽略 */
    }
  }
}
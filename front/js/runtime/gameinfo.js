import Emitter from '../libs/tinyemitter';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND } from '../config';

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

    /* 排行榜按钮 */
    this.leaderboardBtnArea = {
      startX: SCREEN_WIDTH / 2 - 60,
      startY: SCREEN_HEIGHT / 2 + 80,
      endX: SCREEN_WIDTH / 2 + 60,
      endY: SCREEN_HEIGHT / 2 + 120,
    };

    /* 排行榜返回按钮 */
    this.backBtnArea = {
      startX: 20,
      startY: 20,
      endX: 80,
      endY: 55,
    };

    /* 排行榜数据 */
    this._leaderboardData = null;

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
    ctx.textBaseline = 'middle';
    ctx.fillText('开始游戏', SCREEN_WIDTH / 2, (btn.startY + btn.endY) / 2);

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

    /* 排行榜按钮 */
    const lbBtn = this.leaderboardBtnArea;
    ctx.fillStyle = '#2196F3';
    ctx.strokeStyle = '#0D47A1';
    ctx.lineWidth = 3;
    const lbRx = 10;
    this._roundRect(ctx, lbBtn.startX, lbBtn.startY, lbBtn.endX - lbBtn.startX, lbBtn.endY - lbBtn.startY, lbRx);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('排行榜', SCREEN_WIDTH / 2, (lbBtn.startY + lbBtn.endY) / 2);
  }

  /* ========== 排行榜渲染 ========== */
  renderLeaderboard(ctx) {
    /* 半透明背景 */
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    /* 标题 */
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('排行榜', SCREEN_WIDTH / 2, 50);

    /* 返回按钮 */
    const backBtn = this.backBtnArea;
    ctx.fillStyle = '#555555';
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    this._roundRect(ctx, backBtn.startX, backBtn.startY, backBtn.endX - backBtn.startX, backBtn.endY - backBtn.startY, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('← 返回', (backBtn.startX + backBtn.endX) / 2, (backBtn.startY + backBtn.endY) / 2);

    const data = this._leaderboardData;
    if (!data || data.length === 0) {
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '16px Arial';
      ctx.fillText('暂无数据', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
      return;
    }

    /* 表头 */
    const tableTop = 90;
    const rowH = 36;
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('排名', 50, tableTop);
    ctx.fillText('玩家', 120, tableTop);
    ctx.fillText('分数', 240, tableTop);
    ctx.fillText('时间', 320, tableTop);

    /* 分割线 */
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, tableTop + 10);
    ctx.lineTo(SCREEN_WIDTH - 20, tableTop + 10);
    ctx.stroke();

    /* 排行数据 */
    const medals = ['🥇', '🥈', '🥉'];
    const maxShow = Math.min(data.length, 10);

    for (let i = 0; i < maxShow; i++) {
      const row = data[i];
      const y = tableTop + 30 + i * rowH;

      /* 交替行背景 */
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(20, y - 10, SCREEN_WIDTH - 40, rowH - 4);
      }

      ctx.font = '14px Arial';
      ctx.textAlign = 'left';

      /* 排名 */
      const rank = i < 3 ? medals[i] : `${i + 1}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(rank, 50, y);

      /* 玩家名 */
      const name = row.playerName.length > 8 ? row.playerName.substring(0, 8) + '..' : row.playerName;
      ctx.fillText(name, 100, y);

      /* 分数 */
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(String(row.score), 240, y);

      /* 时间 */
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '11px Arial';
      const d = new Date(row.createdAt);
      const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      ctx.fillText(timeStr, 300, y);
    }
  }

  /* ========== 游戏中渲染（旧版兼容） ========== */
  render(ctx) {
    this.renderHUD(ctx);

    if (GameGlobal.databus && GameGlobal.databus.isGameOver) {
      this.renderGameOver(ctx);
    }
  }

  /* ========== 新手引导（准备状态） ========== */
  renderReady(ctx) {
    /* 半透明遮罩 */
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    /* 提示文字 */
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cx = SCREEN_WIDTH / 2;
    const cy = SCREEN_HEIGHT / 2 - 30;

    ctx.strokeText('点击屏幕让小鸟飞起来', cx, cy - 20);
    ctx.fillText('点击屏幕让小鸟飞起来', cx, cy - 20);

    ctx.font = '14px Arial';
    ctx.strokeText('躲避水管，飞得越远分数越高！', cx, cy + 15);
    ctx.fillText('躲避水管，飞得越远分数越高！', cx, cy + 15);

    /* 闪烁的"点击开始" */
    const alpha = 0.5 + 0.5 * Math.sin(Date.now() / 500);
    ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
    ctx.font = 'bold 16px Arial';
    ctx.fillText('👆 点击任意位置开始 👆', cx, cy + 55);
  }

  /* ========== 前后端分离版渲染 ========== */
  renderServer(ctx, gameState) {
    /* 使用数字图片显示分数 */
    this._drawScore(ctx, gameState.score, SCREEN_WIDTH / 2, 40);

    /* 道具状态栏 */
    this.renderPropBarServer(ctx, gameState);

    /* 游戏结束 */
    if (gameState.isGameOver) {
      this.renderGameOverServer(ctx, gameState);
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

  /* 服务端道具状态栏 - 放大且更明显 */
  renderPropBarServer(ctx, gameState) {
    const barY = SCREEN_HEIGHT - 40;
    const barX = SCREEN_WIDTH / 2 - 120;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (gameState.shieldActive) {
      /* 黄色背景高亮 */
      ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
      ctx.strokeStyle = '#FFA000';
      ctx.lineWidth = 2;
      const bx = barX;
      const bw = 100;
      const bh = 28;
      ctx.beginPath();
      this._roundRect(ctx, bx, barY - bh / 2, bw, bh, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.fillText(`🛡 护盾 ${Math.ceil(gameState.shieldTimer / 60)}s`, bx + bw / 2, barY);
    }

    if (gameState.scoreMultiplier > 1) {
      /* 红色背景高亮 */
      ctx.fillStyle = 'rgba(255, 82, 82, 0.8)';
      ctx.strokeStyle = '#D32F2F';
      ctx.lineWidth = 2;
      const bx = barX + 140;
      const bw = 100;
      const bh = 28;
      ctx.beginPath();
      this._roundRect(ctx, bx, barY - bh / 2, bw, bh, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`x2 ${Math.ceil(gameState.multiplierTimer / 60)}s`, bx + bw / 2, barY);
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('重新开始', SCREEN_WIDTH / 2, (this.btnArea.startY + this.btnArea.endY) / 2);

    /* 返回主页按钮 */
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(this.menuBtnArea.startX, this.menuBtnArea.startY, 160, 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('返回主页', SCREEN_WIDTH / 2, (this.menuBtnArea.startY + this.menuBtnArea.endY) / 2);
  }

  /* 服务端版游戏结束 */
  renderGameOverServer(ctx, gameState) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const score = gameState.score;

    const goW = 192;
    const goH = 42;
    ctx.drawImage(this.gameoverImg, SCREEN_WIDTH / 2 - goW / 2, SCREEN_HEIGHT / 2 - 90, goW, goH);

    this._drawScore(ctx, score, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 30);

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

    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(this.btnArea.startX, this.btnArea.startY, 160, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('重新开始', SCREEN_WIDTH / 2, (this.btnArea.startY + this.btnArea.endY) / 2);

    ctx.fillStyle = '#2196F3';
    ctx.fillRect(this.menuBtnArea.startX, this.menuBtnArea.startY, 160, 40);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('返回主页', SCREEN_WIDTH / 2, (this.menuBtnArea.startY + this.menuBtnArea.endY) / 2);
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
        return;
      }
      if (
        clientX >= this.leaderboardBtnArea.startX &&
        clientX <= this.leaderboardBtnArea.endX &&
        clientY >= this.leaderboardBtnArea.startY &&
        clientY <= this.leaderboardBtnArea.endY
      ) {
        this.emit('showLeaderboard');
        return;
      }
      return;
    }

    /* 排行榜：点击返回按钮 */
    if (GameGlobal.screenState === 'leaderboard') {
      if (
        clientX >= this.backBtnArea.startX &&
        clientX <= this.backBtnArea.endX &&
        clientY >= this.backBtnArea.startY &&
        clientY <= this.backBtnArea.endY
      ) {
        this.emit('backToHome');
      }
      return;
    }

    /* 游戏中 / 准备中：点击屏幕任意位置 = 跳跃 */
    if (GameGlobal.screenState === 'playing' || GameGlobal.screenState === 'ready') {
      /* 使用后端API时，游戏结束状态通过 GameGlobal.isGameOverServer 传递 */
      if (GameGlobal.isGameOverServer) {
        /* 游戏结束，检查按钮点击 */
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
        return;
      }
      this.emit('flap');
      return;
    }

    /* 游戏结束：点击按钮 */
    if (!GameGlobal.databus || !GameGlobal.databus.isGameOver) return;

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
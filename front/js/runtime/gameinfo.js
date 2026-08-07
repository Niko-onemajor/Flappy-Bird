import Emitter from '../libs/tinyemitter';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { GROUND, PROP, PLAYER } from '../config';

/* 将屏幕触摸坐标直接返回（没有缩放变换，直接使用屏幕坐标） */
function toGameCoord(clientX, clientY) {
  return { x: clientX, y: clientY };
}

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
    this._leaderboardScrollY = 0;    /* 排行榜滚动偏移 */
    this._leaderboardMaxScroll = 0;  /* 排行榜最大滚动量 */
    this._touchStartY = null;        /* 触摸起始Y坐标 */
    this._scrollStartY = 0;          /* 触摸起始时的滚动位置 */
    this._countdownValue = 0;        /* 倒计时秒数 */

    /* 暂停按钮（左上角） */
    this.pauseBtnArea = {
      startX: 10,
      startY: 8,
      endX: 50,
      endY: 42,
    };

    /* 暂停面板按钮 */
    this.resumeBtnArea = {
      startX: SCREEN_WIDTH / 2 - 80,
      startY: SCREEN_HEIGHT / 2 - 10,
      endX: SCREEN_WIDTH / 2 + 80,
      endY: SCREEN_HEIGHT / 2 + 30,
    };
    this.quitBtnArea = {
      startX: SCREEN_WIDTH / 2 - 80,
      startY: SCREEN_HEIGHT / 2 + 40,
      endX: SCREEN_WIDTH / 2 + 80,
      endY: SCREEN_HEIGHT / 2 + 80,
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
    this._touchMoveHandler = this.touchMoveHandler.bind(this);
    wx.onTouchMove(this._touchMoveHandler);
    this._touchEndHandler = this.touchEndHandler.bind(this);
    wx.onTouchEnd(this._touchEndHandler);

    /* 预加载心形图片 */
    this.heartImg = wx.createImage();
    this.heartImg.src = 'images/heart_full.png';
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
    const tableTop = 80;
    const rowH = 36;
    const headerH = 40;
    const listTop = tableTop + headerH;
    const listBottom = SCREEN_HEIGHT - 20;

    /* 半透明背景 */
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    /* 标题 */
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('排行榜', SCREEN_WIDTH / 2, 40);

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

    /* 表头（固定） */
    ctx.font = 'bold 14px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.textAlign = 'left';
    ctx.fillText('排名', 50, tableTop + 12);
    ctx.fillText('玩家', 120, tableTop + 12);
    ctx.fillText('分数', 240, tableTop + 12);
    ctx.fillText('时间', 320, tableTop + 12);

    /* 分割线 */
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, tableTop + headerH - 10);
    ctx.lineTo(SCREEN_WIDTH - 20, tableTop + headerH - 10);
    ctx.stroke();

    /* 计算最大滚动量 */
    const listHeight = listBottom - listTop;
    this._leaderboardMaxScroll = Math.max(0, data.length * rowH - listHeight);

    /* 裁剪滚动区域 */
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listTop, SCREEN_WIDTH, listHeight);
    ctx.clip();

    /* 排行数据 */
    const medals = ['🥇', '🥈', '🥉'];
    const scrollY = -this._leaderboardScrollY;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const y = listTop + scrollY + i * rowH;

      /* 跳过可视区域外的行 */
      if (y + rowH < listTop || y > listBottom) continue;

      /* 交替行背景 */
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fillRect(20, y, SCREEN_WIDTH - 40, rowH - 4);
      }

      ctx.font = '14px Arial';
      ctx.textAlign = 'left';

      /* 排名 */
      const rank = i < 3 ? medals[i] : `${i + 1}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(rank, 50, y + 12);

      /* 玩家名 */
      const name = row.playerName.length > 8 ? row.playerName.substring(0, 8) + '..' : row.playerName;
      ctx.fillText(name, 100, y + 12);

      /* 分数 */
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 14px Arial';
      ctx.fillText(String(row.score), 240, y + 12);

      /* 时间 */
      ctx.fillStyle = '#aaaaaa';
      ctx.font = '11px Arial';
      const d = new Date(row.createdAt);
      const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      ctx.fillText(timeStr, 300, y + 12);
    }

    ctx.restore();

    /* 滚动条指示器 */
    if (this._leaderboardMaxScroll > 0) {
      const barH = listHeight * (listHeight / (data.length * rowH));
      const barY = listTop + (this._leaderboardScrollY / this._leaderboardMaxScroll) * (listHeight - barH);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(SCREEN_WIDTH - 6, barY, 4, Math.max(barH, 20));
    }

    /* 底部提示 */
    if (this._leaderboardMaxScroll > 0 && this._leaderboardScrollY < this._leaderboardMaxScroll - 2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('↑ 上下滑动查看更多 ↑', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 6);
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

  /* ========== 本地版渲染 ========== */
  renderLocal(ctx, databus) {
    /* 使用数字图片显示分数 */
    this._drawScore(ctx, databus.score, SCREEN_WIDTH / 2, 40);

    /* 道具状态栏 */
    this.renderPropBar(ctx, databus);

    /* 暂停按钮（游戏进行中且未结束时显示） */
    if (!databus.isGameOver && GameGlobal.screenState === 'playing') {
      this._renderPauseBtn(ctx);
      this._renderHearts(ctx, databus);
    }

    /* 游戏结束 */
    if (databus.isGameOver) {
      this.renderGameOver(ctx);
    }
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

  /* 道具状态栏 - 显示在地面下方空白区域，避免遮挡玩家视角 */
  renderPropBar(ctx, db) {
    const barW = 140;
    const barH = 10;
    const barX = SCREEN_WIDTH / 2 - barW / 2;
    const barY = SCREEN_HEIGHT - 30;  /* 地面下方，距底端30px */

    if (db.shieldActive) {
      const pct = db.shieldTimer / PROP.DURATION;
      /* 背景 */
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this._roundRect(ctx, barX, barY, barW, barH, 5);
      ctx.fill();
      /* 进度 */
      ctx.fillStyle = '#FFD700';
      this._roundRect(ctx, barX, barY, barW * pct, barH, 5);
      ctx.fill();
      /* 文字 */
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`护盾 ${Math.ceil(db.shieldTimer / 60)}s`, SCREEN_WIDTH / 2, barY - 4);
    }

    if (db.scoreMultiplier > 1) {
      const yOff = db.shieldActive ? -22 : 0;
      const pct = db.multiplierTimer / PROP.MULTIPLIER_DURATION;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      this._roundRect(ctx, barX, barY + yOff, barW, barH, 5);
      ctx.fill();
      ctx.fillStyle = '#FF5252';
      this._roundRect(ctx, barX, barY + yOff, barW * pct, barH, 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Arial';
      ctx.fillText(`x2 ${Math.ceil(db.multiplierTimer / 60)}s`, SCREEN_WIDTH / 2, barY + yOff - 4);
    }

    /* 护盾冷却中 */
    if (db.shieldCooldown > 0) {
      const yOff = (db.shieldActive ? -22 : 0) + (db.scoreMultiplier > 1 ? -22 : 0);
      const pct = db.shieldCooldown / 180;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this._roundRect(ctx, barX, barY + yOff, barW, barH, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(150, 150, 150, 0.6)';
      this._roundRect(ctx, barX, barY + yOff, barW * pct, barH, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '10px Arial';
      ctx.fillText(`护盾冷却 ${Math.ceil(db.shieldCooldown / 60)}s`, SCREEN_WIDTH / 2, barY + yOff - 4);
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

  /* ========== 暂停按钮 ========== */
  _renderPauseBtn(ctx) {
    const btn = this.pauseBtnArea;
    const w = btn.endX - btn.startX;
    const h = btn.endY - btn.startY;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    this._roundRect(ctx, btn.startX, btn.startY, w, h, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸', (btn.startX + btn.endX) / 2, (btn.startY + btn.endY) / 2);
  }

  /* ========== 生命值显示 ========== */
  _renderHearts(ctx, db) {
    const heartSize = 18;
    const heartGap = 4;
    const heartY = (this.pauseBtnArea.startY + this.pauseBtnArea.endY) / 2 - heartSize / 2;
    const heartStartX = this.pauseBtnArea.endX + 10;

    for (let i = 0; i < PLAYER.LIVES; i++) {
      const hx = heartStartX + i * (heartSize + heartGap);
      if (i < db.lives) {
        /* 有生命：绘制实心心形 */
        if (this.heartImg) {
          ctx.drawImage(this.heartImg, hx, heartY, heartSize, heartSize);
        }
      } else {
        /* 已失去：绘制空心灰色心形 */
        ctx.globalAlpha = 0.3;
        if (this.heartImg) {
          ctx.drawImage(this.heartImg, hx, heartY, heartSize, heartSize);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  /* ========== 暂停面板 ========== */
  renderPauseOverlay(ctx) {
    /* 半透明遮罩 */
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    /* 标题 */
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏暂停', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 60);

    /* 继续按钮 */
    const resBtn = this.resumeBtnArea;
    ctx.fillStyle = '#4CAF50';
    ctx.strokeStyle = '#2E7D32';
    ctx.lineWidth = 3;
    this._roundRect(ctx, resBtn.startX, resBtn.startY, resBtn.endX - resBtn.startX, resBtn.endY - resBtn.startY, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('继续游戏', (resBtn.startX + resBtn.endX) / 2, (resBtn.startY + resBtn.endY) / 2);

    /* 结束按钮 */
    const quitBtn = this.quitBtnArea;
    ctx.fillStyle = '#f44336';
    ctx.strokeStyle = '#B71C1C';
    this._roundRect(ctx, quitBtn.startX, quitBtn.startY, quitBtn.endX - quitBtn.startX, quitBtn.endY - quitBtn.startY, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText('结束游戏', (quitBtn.startX + quitBtn.endX) / 2, (quitBtn.startY + quitBtn.endY) / 2);
  }

  /* ========== 倒计时 ========== */
  renderCountdown(ctx) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const num = this._countdownValue;
    /* 使用帧计数器替代 Date.now()，避免真机系统调用开销 */
    const phase = (GameGlobal.databus.frame % 120) / 120;
    const scale = 1 + Math.sin(phase * Math.PI * 2) * 0.12;
    const fontSize = Math.floor(72 * scale);

    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(String(num), SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
    ctx.fillText(String(num), SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
  }

  /* ========== 触摸事件 ========== */
  touchEventHandler(event) {
    if (!event.touches || event.touches.length === 0) return;
    const { clientX, clientY } = event.touches[0];
    /* 转换到游戏世界坐标 */
    const game = toGameCoord(clientX, clientY);
    console.log('[Touch] screenState:', GameGlobal.screenState, 'screen:', clientX, clientY, 'game:', game.x.toFixed(1), game.y.toFixed(1));

    /* 主页：点击开始按钮 */
    if (GameGlobal.screenState === 'home') {
      console.log('[Touch] 主页触摸:', game.x, game.y,
        '开始按钮:', this.homeBtnArea.startX, this.homeBtnArea.startY,
        '排行按钮:', this.leaderboardBtnArea.startX, this.leaderboardBtnArea.startY);
      if (
        game.x >= this.homeBtnArea.startX &&
        game.x <= this.homeBtnArea.endX &&
        game.y >= this.homeBtnArea.startY &&
        game.y <= this.homeBtnArea.endY
      ) {
        console.log('[Touch] → 点击开始游戏');
        this.emit('start');
        return;
      }
      if (
        game.x >= this.leaderboardBtnArea.startX &&
        game.x <= this.leaderboardBtnArea.endX &&
        game.y >= this.leaderboardBtnArea.startY &&
        game.y <= this.leaderboardBtnArea.endY
      ) {
        console.log('[Touch] → 点击排行榜');
        this.emit('showLeaderboard');
        return;
      }
      return;
    }

    /* 排行榜：记录起始触摸位置用于滚动 */
    if (GameGlobal.screenState === 'leaderboard') {
      this._touchStartY = game.y;
      this._scrollStartY = this._leaderboardScrollY;
      console.log('[Leaderboard] touchStart y=', game.y, 'scrollStart=', this._scrollStartY);
      if (
        game.x >= this.backBtnArea.startX &&
        game.x <= this.backBtnArea.endX &&
        game.y >= this.backBtnArea.startY &&
        game.y <= this.backBtnArea.endY
      ) {
        this.emit('backToHome');
      }
      return;
    }

    /* 游戏中 / 准备中：点击屏幕任意位置 = 跳跃 */
    if (GameGlobal.screenState === 'playing' || GameGlobal.screenState === 'ready') {
      /* 检查暂停按钮 */
      if (GameGlobal.screenState === 'playing') {
        if (
          game.x >= this.pauseBtnArea.startX &&
          game.x <= this.pauseBtnArea.endX &&
          game.y >= this.pauseBtnArea.startY &&
          game.y <= this.pauseBtnArea.endY
        ) {
          this.emit('pause');
          return;
        }
      }

      /* 本地或服务端游戏结束状态 */
      const isOver = GameGlobal.isGameOverServer
        || (GameGlobal.databus && GameGlobal.databus.isGameOver);
      if (isOver) {
        /* 游戏结束，检查按钮点击 */
        if (
          game.x >= this.btnArea.startX &&
          game.x <= this.btnArea.endX &&
          game.y >= this.btnArea.startY &&
          game.y <= this.btnArea.endY
        ) {
          this.emit('restart');
          return;
        }
        if (
          game.x >= this.menuBtnArea.startX &&
          game.x <= this.menuBtnArea.endX &&
          game.y >= this.menuBtnArea.startY &&
          game.y <= this.menuBtnArea.endY
        ) {
          this.emit('backToHome');
        }
        return;
      }
      this.emit('flap');
      return;
    }

    /* 暂停状态：点击继续或结束 */
    if (GameGlobal.screenState === 'paused') {
      if (
        game.x >= this.resumeBtnArea.startX &&
        game.x <= this.resumeBtnArea.endX &&
        game.y >= this.resumeBtnArea.startY &&
        game.y <= this.resumeBtnArea.endY
      ) {
        this.emit('resume');
        return;
      }
      if (
        game.x >= this.quitBtnArea.startX &&
        game.x <= this.quitBtnArea.endX &&
        game.y >= this.quitBtnArea.startY &&
        game.y <= this.quitBtnArea.endY
      ) {
        this.emit('quitToHome');
      }
      return;
    }

    /* 倒计时中：忽略点击 */
    if (GameGlobal.screenState === 'countdown') return;

    /* 游戏结束：点击按钮 */
    if (!GameGlobal.databus || !GameGlobal.databus.isGameOver) return;

    if (
      game.x >= this.btnArea.startX &&
      game.x <= this.btnArea.endX &&
      game.y >= this.btnArea.startY &&
      game.y <= this.btnArea.endY
    ) {
      this.emit('restart');
      return;
    }

    if (
      game.x >= this.menuBtnArea.startX &&
      game.x <= this.menuBtnArea.endX &&
      game.y >= this.menuBtnArea.startY &&
      game.y <= this.menuBtnArea.endY
    ) {
      this.emit('backToHome');
    }
  }

  /* ========== 触摸滑动（排行榜滚动） ========== */
  touchMoveHandler(event) {
    if (GameGlobal.screenState !== 'leaderboard') return;
    if (!event.touches || event.touches.length === 0) return;
    if (this._leaderboardMaxScroll <= 0) return;
    if (this._touchStartY == null) return;

    const { clientY } = event.touches[0];
    /* 滚动位移和屏幕物理像素成正比，保持滚动手感一致 */
    const game = toGameCoord(0, clientY);
    const delta = this._touchStartY - game.y;
    this._leaderboardScrollY = this._scrollStartY + delta;
    this._leaderboardScrollY = Math.max(0, Math.min(this._leaderboardScrollY, this._leaderboardMaxScroll));

    if (GameGlobal.DEBUG_COLLISION) {
      console.log('[Leaderboard] touchMove clientY=', clientY, 'delta=', delta.toFixed(1), 'scrollY=', this._leaderboardScrollY.toFixed(1));
    }
  }

  /* 触摸结束，清除状态 */
  touchEndHandler() {
    this._touchStartY = null;
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
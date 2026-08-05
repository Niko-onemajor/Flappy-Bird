import './render';
import { SCREEN_WIDTH } from './render';
import { startGame, gameTick, gameFlap, submitScore, getTopScores } from './api';
import BackGround from './runtime/background';
import GameInfo from './runtime/gameinfo';
import Sound from './sound';

const ctx = canvas.getContext('2d');

GameGlobal.sound = new Sound();

const SCREEN_STATE = {
  HOME: 'home',
  READY: 'ready',
  PLAYING: 'playing',
  LEADERBOARD: 'leaderboard',
};

/* 全局屏幕状态 */
GameGlobal.screenState = SCREEN_STATE.HOME;

/**
 * 前后端分离版主循环
 * 前端仅负责渲染，游戏逻辑全部由后端 API 处理
 */
export default class Main {
  aniId = 0;
  bg = new BackGround();
  gameInfo = new GameInfo();
  screenState = SCREEN_STATE.HOME;
  sessionId = null;
  gameState = null;

  /* 水管/道具图片缓存 */
  pipeGreenImg = null;
  pipeRedImg = null;

  constructor() {
    this._loadImages();
    this._pickBirdColor();
    this.gameInfo.on('start', this.startGame.bind(this));
    this.gameInfo.on('restart', this.restartGame.bind(this));
    this.gameInfo.on('backToHome', this.goToHome.bind(this));
    this.gameInfo.on('flap', this.flap.bind(this));
    this.gameInfo.on('showLeaderboard', this.showLeaderboard.bind(this));
    this.loop();
  }

  _pickBirdColor() {
    const BIRD_COLORS = ['redbird', 'bluebird', 'yellowbird'];
    this._birdColor = BIRD_COLORS[Math.floor(Math.random() * BIRD_COLORS.length)];
  }

  _loadImages() {
    this.pipeGreenImg = wx.createImage();
    this.pipeGreenImg.src = 'images/pipe-green.png';
    this.pipeRedImg = wx.createImage();
    this.pipeRedImg.src = 'images/pipe-red.png';
  }

  /* 返回主页 */
  goToHome() {
    this.screenState = SCREEN_STATE.HOME;
    GameGlobal.screenState = SCREEN_STATE.HOME;
    GameGlobal.isGameOverServer = false;
    this.gameState = null;
    this.sessionId = null;
    this._scoreSubmitted = false;
    GameGlobal.sound.stopAll();
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }

  /* 开始游戏（调用后端 API） */
  async startGame() {
    try {
      const state = await startGame(SCREEN_WIDTH, canvas.height);
      this.sessionId = state.sessionId;
      this.gameState = state;
      this._scoreSubmitted = false;
      this._playedDieSound = false;
      GameGlobal.isGameOverServer = false;
      this.screenState = SCREEN_STATE.READY;
      GameGlobal.screenState = SCREEN_STATE.READY;
      GameGlobal.sound.playBgm();
      cancelAnimationFrame(this.aniId);
      this.aniId = requestAnimationFrame(this.loop.bind(this));
    } catch (err) {
      console.error('[Main] 启动游戏失败:', err);
    }
  }

  /* 重新开始 */
  async restartGame() {
    await this.startGame();
  }

  /* 小鸟跳跃（调用后端 API） */
  async flap() {
    if (!this.sessionId || !this.gameState || this.gameState.isGameOver) return;

    /* 准备状态：第一次点击开始游戏 */
    if (this.screenState === SCREEN_STATE.READY) {
      this.screenState = SCREEN_STATE.PLAYING;
      GameGlobal.screenState = SCREEN_STATE.PLAYING;
      return;
    }

    try {
      this.gameState = await gameFlap(this.sessionId);
      GameGlobal.sound.playWing();
    } catch (err) {
      console.error('[Main] 跳跃请求失败:', err);
    }
  }

  /* 推进帧（调用后端 API） */
  async tick() {
    if (!this.sessionId || !this.gameState) return;
    if (this.gameState.isGameOver) return;
    try {
      const prevScore = this.gameState.score;
      this.gameState = await gameTick(this.sessionId);
      /* 同步游戏结束状态到全局 */
      GameGlobal.isGameOverServer = this.gameState.isGameOver;
      /* 得分时播放音效 */
      if (this.gameState.score > prevScore) {
        GameGlobal.sound.playPoint();
      }
      /* 游戏结束时播放音效 */
      if (this.gameState.isGameOver && !this._playedDieSound) {
        this._playedDieSound = true;
        GameGlobal.sound.playHit();
        GameGlobal.sound.playDie();
      }
    } catch (err) {
      console.error('[Main] Tick 请求失败:', err);
    }
  }

  /* 显示排行榜 */
  async showLeaderboard() {
    this.screenState = SCREEN_STATE.LEADERBOARD;
    GameGlobal.screenState = SCREEN_STATE.LEADERBOARD;
    try {
      const data = await getTopScores(10);
      this.gameInfo._leaderboardData = data;
    } catch (err) {
      console.error('[Main] 获取排行榜失败:', err);
    }
    cancelAnimationFrame(this.aniId);
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }

  /* 提交分数 */
  async submitScoreToServer() {
    if (!this.gameState || this.gameState.score <= 0) return;
    try {
      await submitScore('Player', this.gameState.score);
    } catch (err) {
      console.error('[Main] 提交分数失败:', err);
    }
  }

  /* 渲染 */
  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this.screenState === SCREEN_STATE.HOME) {
      this.bg.render(ctx);
      this.gameInfo.renderHome(ctx);
    } else if (this.screenState === SCREEN_STATE.LEADERBOARD) {
      this.bg.render(ctx);
      this.gameInfo.renderLeaderboard(ctx);
    } else if (this.screenState === SCREEN_STATE.READY) {
      this.bg.render(ctx);
      if (this.gameState) {
        if (this.gameState.pipes) {
          this.gameState.pipes.forEach((p) => this._renderPipe(ctx, p));
        }
        if (this.gameState.props) {
          this.gameState.props.forEach((p) => this._renderProp(ctx, p));
        }
        if (this.gameState.player) {
          this._renderPlayer(ctx);
        }
      }
      this.gameInfo.renderReady(ctx);
    } else {
      this.bg.render(ctx);
      if (this.gameState) {
        /* 渲染水管 */
        if (this.gameState.pipes) {
          this.gameState.pipes.forEach((p) => this._renderPipe(ctx, p));
        }
        /* 渲染道具 */
        if (this.gameState.props) {
          this.gameState.props.forEach((p) => this._renderProp(ctx, p));
        }
        /* 渲染小鸟 */
        if (this.gameState.player) {
          this._renderPlayer(ctx);
        }
        /* 渲染 HUD */
        this.gameInfo.renderServer(ctx, this.gameState);
      }
    }
  }

  /* 绘制水管 */
  _renderPipe(ctx, pipe) {
    const PIPE_WIDTH = 52;
    const GROUND_HEIGHT = 90;
    const availableH = canvas.height - GROUND_HEIGHT;
    const img = pipe.isMoving ? this.pipeRedImg : this.pipeGreenImg;

    const hasTop = pipe.type === 0 || pipe.type === 1 || pipe.type === 3;
    const hasBottom = pipe.type === 0 || pipe.type === 2 || pipe.type === 3;

    if (hasTop) {
      ctx.save();
      ctx.translate(pipe.x + PIPE_WIDTH / 2, pipe.gapY);
      ctx.scale(1, -1);
      ctx.drawImage(img, -PIPE_WIDTH / 2, 0, PIPE_WIDTH, pipe.gapY);
      ctx.restore();
    }

    if (hasBottom) {
      const bottomY = pipe.gapY + (hasTop ? pipe.gap : 0);
      const bottomH = availableH - bottomY;
      if (bottomH > 0) {
        ctx.drawImage(img, pipe.x, bottomY, PIPE_WIDTH, bottomH);
      }
    }
  }

  /* 绘制道具 */
  _renderProp(ctx, prop) {
    const PROP_SIZE = 32;
    const FLOAT_AMP = 4;
    const cx = prop.x + PROP_SIZE / 2;
    const cy = prop.y + PROP_SIZE / 2 + Math.sin(prop.animPhase || 0) * FLOAT_AMP;
    const r = PROP_SIZE / 2;

    const style = prop.type === 'multiplier'
      ? { color: '#FF5252', glow: '#D32F2F', icon: 'x2', name: '双倍' }
      : { color: '#FFD700', glow: '#FFA000', icon: '\uD83D\uDEE1', name: '护盾' };

    ctx.save();
    ctx.shadowColor = style.glow;
    ctx.shadowBlur = 12;

    /* 外圈 */
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fill();

    /* 主体 */
    const grad = ctx.createRadialGradient(cx - 3, cy - 3, r * 0.1, cx, cy, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, style.color);
    grad.addColorStop(1, style.glow);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    /* 边框 */
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    /* 图标 */
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(style.icon, cx, cy);

    ctx.restore();
  }

  /* 绘制小鸟 */
  _renderPlayer(ctx) {
    const p = this.gameState.player;
    if (!p.visible || !p.isActive) return;

    const PLAYER_WIDTH = 34;
    const PLAYER_HEIGHT = 24;
    const SHIELD_RADIUS = 28;

    const cx = p.x + PLAYER_WIDTH / 2;
    const cy = p.y + PLAYER_HEIGHT / 2;

    /* 护盾特效 */
    if (this.gameState.shieldActive) {
      ctx.save();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, SHIELD_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    /* 小鸟本体 */
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((p.rotation * Math.PI) / 180);

    const frames = ['downflap', 'midflap', 'upflap'];
    if (!this._birdFrames) {
      this._birdFrames = {};
    }
    if (!this._birdFrames[this._birdColor]) {
      this._birdFrames[this._birdColor] = frames.map((f) => {
        const img = wx.createImage();
        img.src = `images/${this._birdColor}-${f}.png`;
        return img;
      });
    }

    const frameImg = this._birdFrames[this._birdColor][p.flapIndex || 0];
    if (frameImg) {
      ctx.drawImage(frameImg, -PLAYER_WIDTH / 2, -PLAYER_HEIGHT / 2, PLAYER_WIDTH, PLAYER_HEIGHT);
    }

    ctx.restore();

    /* Buff 图标 */
    if (this.gameState.shieldActive) {
      ctx.save();
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText('\uD83D\uDEE1', cx + 18, cy - 18);
      ctx.fillText('\uD83D\uDEE1', cx + 18, cy - 18);
      ctx.restore();
    }
    if (this.gameState.scoreMultiplier > 1) {
      ctx.save();
      ctx.fillStyle = '#FF5252';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText('x2', cx + 18, cy - 5);
      ctx.fillText('x2', cx + 18, cy - 5);
      ctx.restore();
    }
  }

  /* 主循环 */
  loop() {
    if (this.screenState === SCREEN_STATE.PLAYING) {
      this.tick();
      /* 游戏结束时提交分数 */
      if (this.gameState && this.gameState.isGameOver && !this._scoreSubmitted) {
        this._scoreSubmitted = true;
        this.submitScoreToServer();
      }
    }

    this.render();
    this.aniId = requestAnimationFrame(this.loop.bind(this));
  }
}
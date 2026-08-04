import Emitter from '../libs/tinyemitter';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';

export default class GameInfo extends Emitter {
  constructor() {
    super();
    this.btnArea = {
      startX: SCREEN_WIDTH / 2 - 60,
      startY: SCREEN_HEIGHT / 2 + 20,
      endX: SCREEN_WIDTH / 2 + 60,
      endY: SCREEN_HEIGHT / 2 + 60,
    };

    wx.onTouchStart(this.touchEventHandler.bind(this));
  }

  render(ctx) {
    this.renderScore(ctx, GameGlobal.databus.score);

    if (GameGlobal.databus.isGameOver) {
      this.renderGameOver(ctx, GameGlobal.databus.score);
    }
  }

  renderScore(ctx, score) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.strokeText(`分数: ${score}`, SCREEN_WIDTH / 2, 40);
    ctx.fillText(`分数: ${score}`, SCREEN_WIDTH / 2, 40);
  }

  renderGameOver(ctx, score) {
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.strokeText('游戏结束', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 30);
    ctx.fillText('游戏结束', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 30);

    ctx.font = 'bold 20px Arial';
    ctx.strokeText(`最终得分: ${score}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 10);
    ctx.fillText(`最终得分: ${score}`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 10);

    // 重新开始按钮
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(this.btnArea.startX, this.btnArea.startY, 120, 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Arial';
    ctx.fillText('重新开始', SCREEN_WIDTH / 2, this.btnArea.startY + 28);
  }

  touchEventHandler(event) {
    const { clientX, clientY } = event.touches[0];
    if (GameGlobal.databus.isGameOver) {
      if (
        clientX >= this.btnArea.startX &&
        clientX <= this.btnArea.endX &&
        clientY >= this.btnArea.startY &&
        clientY <= this.btnArea.endY
      ) {
        this.emit('restart');
      }
    }
  }
}
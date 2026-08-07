import Emitter from '../libs/tinyemitter';

/**
 * 游戏基础精灵类
 * 所有游戏实体的基类，提供位置、渲染、碰撞检测等基础能力
 */
export default class Sprite extends Emitter {
  visible = true;   /* 是否可见 */
  isActive = true;  /* 是否可碰撞 */

  constructor(imgSrc = '', width = 0, height = 0, x = 0, y = 0) {
    super();
    
    this.img = wx.createImage();
    this.img.src = imgSrc;

    this.width = width;
    this.height = height;

    this.x = x;
    this.y = y;

    this.visible = true;
  }

  /**
   * 将精灵绘制在canvas上
   */
  render(ctx) {
    if (!this.visible) return;

    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
  }
}
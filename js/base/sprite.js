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

  /**
   * 碰撞检测：目标精灵的中心点在本精灵矩形内即视为碰撞
   * @param{Sprite} sp: Sprite的实例
   */
  isCollideWith(sp) {
    const spX = sp.x + sp.width / 2;
    const spY = sp.y + sp.height / 2;

    /* 不可见则不检测 */
    if (!this.visible || !sp.visible) return false;
    /* 不可碰撞则不检测 */
    if (!this.isActive || !sp.isActive) return false;

    return !!(
      spX >= this.x &&
      spX <= this.x + this.width &&
      spY >= this.y &&
      spY <= this.y + this.height
    );
  }
}
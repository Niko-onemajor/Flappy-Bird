import Sprite from './sprite';

/**
 * 帧动画基类（Player 继承此类实现自定义动画）
 */
export default class Animation extends Sprite {
  constructor(imgSrc, width, height) {
    super(imgSrc, width, height);
  }
}

/**
 * 音效管理器
 * 使用原始Flappy Bird音效素材
 */
export default class Sound {
  constructor() {
    /* 背景音乐（循环播放） */
    this.bgm = wx.createInnerAudioContext();
    this.bgm.src = 'audio/bgm.mp3';
    this.bgm.loop = true;
    this.bgm.volume = 0.25;

    /* 翅膀拍打音效 */
    this.wing = this._createAudio('audio/wing.wav', 0.4);

    /* 得分音效 */
    this.point = this._createAudio('audio/point.wav', 0.5);

    /* 碰撞音效 */
    this.hit = this._createAudio('audio/hit.wav', 0.6);

    /* 死亡音效 */
    this.die = this._createAudio('audio/die.wav', 0.5);

    /* 俯冲音效 */
    this.swoosh = this._createAudio('audio/swoosh.wav', 0.4);
  }

  _createAudio(src, volume) {
    const audio = wx.createInnerAudioContext();
    audio.src = src;
    audio.volume = volume;
    return audio;
  }

  playBgm() {
    this.bgm.stop();
    this.bgm.play();
  }

  stopBgm() {
    this.bgm.stop();
  }

  playWing() {
    this.wing.stop();
    this.wing.play();
  }

  playPoint() {
    this.point.stop();
    this.point.play();
  }

  playHit() {
    this.hit.stop();
    this.hit.play();
  }

  playDie() {
    this.die.stop();
    this.die.play();
  }

  playSwoosh() {
    this.swoosh.stop();
    this.swoosh.play();
  }

  /* 停止所有音效 */
  stopAll() {
    this.stopBgm();
    this.wing.stop();
    this.point.stop();
    this.hit.stop();
    this.die.stop();
    this.swoosh.stop();
  }
}
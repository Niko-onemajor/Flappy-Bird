/**
 * 音效管理器
 * 音量平衡：背景音乐 < 音效反馈，避免互相压盖
 */
import { AUDIO_VOLUME } from './config';

export default class Sound {
  constructor() {
    /* 背景音乐（循环播放，音量最低） */
    this.bgm = wx.createInnerAudioContext();
    this.bgm.src = 'audio/bgm.mp3';
    this.bgm.loop = true;
    this.bgm.volume = AUDIO_VOLUME.bgm;

    /* 翅膀拍打音效 */
    this.wing = this._createAudio('audio/wing.wav', AUDIO_VOLUME.wing);

    /* 得分音效 */
    this.point = this._createAudio('audio/point.wav', AUDIO_VOLUME.point);

    /* 碰撞音效 */
    this.hit = this._createAudio('audio/hit.wav', AUDIO_VOLUME.hit);

    /* 死亡音效 */
    this.die = this._createAudio('audio/die.wav', AUDIO_VOLUME.die);

    /* 俯冲音效 */
    this.swoosh = this._createAudio('audio/swoosh.wav', AUDIO_VOLUME.swoosh);
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

  pauseBgm() {
    this.bgm.pause();
  }

  resumeBgm() {
    this.bgm.play();
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
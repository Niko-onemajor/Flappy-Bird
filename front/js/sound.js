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

    /* 护盾破裂音效 */
    this.shieldBreak = this._createAudio('audio/shield_break.mp3', AUDIO_VOLUME.shieldBreak);

    /* 护盾拾取音效 */
    this.shieldPickup = this._createAudio('audio/shield_pickup.mp3', AUDIO_VOLUME.shieldPickup);

    /* 双倍分数拾取音效 */
    this.scoreX2 = this._createAudio('audio/score_x2.wav', AUDIO_VOLUME.scoreX2);

    /* 火箭引信点燃音效（只播开头2秒引信声） */
    this.fuseBurn = this._createAudio('audio/fuse_burn.mp3', AUDIO_VOLUME.fuseBurn);

    /* 火箭飞行音效 */
    this.rocketFly = this._createAudio('audio/rocket_fly.mp3', AUDIO_VOLUME.rocketFly);
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

  playShieldBreak() {
    this.shieldBreak.stop();
    this.shieldBreak.play();
  }

  playShieldPickup() {
    this.shieldPickup.stop();
    this.shieldPickup.play();
  }

  playScoreX2() {
    this.scoreX2.stop();
    this.scoreX2.play();
  }

  /* 火箭引信点燃：设置播放位置为0，2秒后自动停止 */
  playFuseBurn() {
    this.fuseBurn.stop();
    this.fuseBurn.seek(0);
    this.fuseBurn.play();
    /* 2秒后停止，只取引信部分 */
    setTimeout(() => {
      try { this.fuseBurn.stop(); } catch (e) { /* ignore */ }
    }, 2000);
  }

  /* 火箭飞行音效 */
  playRocketFly() {
    this.rocketFly.stop();
    this.rocketFly.play();
  }

  stopRocketFly() {
    this.rocketFly.stop();
  }

  /* 停止所有音效 */
  stopAll() {
    this.stopBgm();
    this.wing.stop();
    this.point.stop();
    this.hit.stop();
    this.die.stop();
    this.swoosh.stop();
    this.shieldBreak.stop();
    this.shieldPickup.stop();
    this.scoreX2.stop();
    this.fuseBurn.stop();
    this.rocketFly.stop();
  }
}
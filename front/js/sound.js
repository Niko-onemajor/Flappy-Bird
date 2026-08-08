/**
 * 音效管理器
 * 音量平衡：背景音乐 < 音效反馈，避免互相压盖
 * 延迟创建音频上下文，减少启动卡顿
 * 支持分通道音量控制：总音量、BGM、音效独立调节
 */
import { AUDIO_VOLUME } from './config';

/* 音频配置表 */
const AUDIO_CONFIG = {
  bgm: { src: 'audio/bgm.mp3', volume: AUDIO_VOLUME.bgm, loop: true },
  wing: { src: 'audio/wing.mp3', volume: AUDIO_VOLUME.wing },
  point: { src: 'audio/point.mp3', volume: AUDIO_VOLUME.point },
  hit: { src: 'audio/hit.mp3', volume: AUDIO_VOLUME.hit },
  die: { src: 'audio/die.mp3', volume: AUDIO_VOLUME.die },
  swoosh: { src: 'audio/swoosh.mp3', volume: AUDIO_VOLUME.swoosh },
  shieldBreak: { src: 'audio/shield_break.mp3', volume: AUDIO_VOLUME.shieldBreak },
  shieldPickup: { src: 'audio/shield_pickup.mp3', volume: AUDIO_VOLUME.shieldPickup },
  scoreX2: { src: 'audio/score_x2.mp3', volume: AUDIO_VOLUME.scoreX2 },
  fuseBurn: { src: 'audio/fuse_burn.mp3', volume: AUDIO_VOLUME.fuseBurn },
  rocketFly: { src: 'audio/rocket_fly.mp3', volume: AUDIO_VOLUME.rocketFly },
};

/** 判断音频键属于 BGM 还是音效 */
function _isBgmKey(key) {
  return key === 'bgm';
}

export default class Sound {
  constructor() {
    this._cache = {};
    this._fuseBurnPlaying = false;
    this._rocketFlyPlaying = false;
    /* 音量通道：0.0 ~ 1.0 */
    this.masterVolume = 1.0;
    this.bgmVolume = 1.0;
    this.sfxVolume = 1.0;
  }

  /* 延迟创建并缓存音频上下文 */
  _getAudio(key) {
    if (!this._cache[key]) {
      const cfg = AUDIO_CONFIG[key];
      if (!cfg) return null;
      const audio = wx.createInnerAudioContext();
      audio.src = cfg.src;
      audio.volume = this._calcVolume(key, cfg.volume);
      if (cfg.loop) audio.loop = true;
      this._cache[key] = audio;
    }
    return this._cache[key];
  }

  /** 计算最终音量 = 基础音量 × 总音量 × 通道音量 */
  _calcVolume(key, baseVolume) {
    const channelVolume = _isBgmKey(key) ? this.bgmVolume : this.sfxVolume;
    return baseVolume * this.masterVolume * channelVolume;
  }

  /** 更新所有已创建音频的音量 */
  _updateAllVolumes() {
    Object.keys(this._cache).forEach((key) => {
      const audio = this._cache[key];
      if (!audio) return;
      const cfg = AUDIO_CONFIG[key];
      if (cfg) {
        audio.volume = this._calcVolume(key, cfg.volume);
      }
    });
  }

  /**
   * 设置音量通道
   * @param {'master'|'bgm'|'sfx'} type - 通道类型
   * @param {number} value - 音量值 0.0 ~ 1.0
   */
  setVolume(type, value) {
    switch (type) {
      case 'master': this.masterVolume = value; break;
      case 'bgm': this.bgmVolume = value; break;
      case 'sfx': this.sfxVolume = value; break;
    }
    this._updateAllVolumes();
  }

  playBgm() {
    const bgm = this._getAudio('bgm');
    bgm.stop();
    bgm.play();
  }

  stopBgm() {
    const bgm = this._cache.bgm;
    if (bgm) bgm.stop();
  }

  pauseBgm() {
    const bgm = this._cache.bgm;
    if (bgm) bgm.pause();
  }

  resumeBgm() {
    const bgm = this._cache.bgm;
    if (bgm) bgm.play();
  }

  playWing() {
    const a = this._getAudio('wing');
    a.stop();
    a.play();
  }

  playPoint() {
    const a = this._getAudio('point');
    a.stop();
    a.play();
  }

  playHit() {
    const a = this._getAudio('hit');
    a.stop();
    a.play();
  }

  playDie() {
    const a = this._getAudio('die');
    a.stop();
    a.play();
  }

  playSwoosh() {
    const a = this._getAudio('swoosh');
    a.stop();
    a.play();
  }

  playShieldBreak() {
    const a = this._getAudio('shieldBreak');
    a.stop();
    a.play();
  }

  playShieldPickup() {
    const a = this._getAudio('shieldPickup');
    a.stop();
    a.play();
  }

  playScoreX2() {
    const a = this._getAudio('scoreX2');
    a.stop();
    a.play();
  }

  /* 火箭引信点燃：只播一次，不重叠 */
  playFuseBurn() {
    if (this._fuseBurnPlaying) return;
    this._fuseBurnPlaying = true;
    const a = this._getAudio('fuseBurn');
    a.seek(0);
    a.onEnded(() => {
      this._fuseBurnPlaying = false;
    });
    a.play();
  }

  /* 火箭飞行音效：只播一次，不重叠 */
  playRocketFly() {
    if (this._rocketFlyPlaying) return;
    this._rocketFlyPlaying = true;
    const a = this._getAudio('rocketFly');
    a.seek(0);
    a.onEnded(() => {
      this._rocketFlyPlaying = false;
    });
    a.play();
  }

  stopRocketFly() {
    const a = this._cache.rocketFly;
    if (a) a.stop();
    this._rocketFlyPlaying = false;
  }

  stopFuseBurn() {
    const a = this._cache.fuseBurn;
    if (a) a.stop();
    this._fuseBurnPlaying = false;
  }

  /* 停止所有音效 */
  stopAll() {
    this.stopBgm();
    Object.keys(this._cache).forEach((key) => {
      const a = this._cache[key];
      if (a && a.stop) {
        try { a.stop(); } catch (e) { /* ignore */ }
      }
    });
    this._fuseBurnPlaying = false;
    this._rocketFlyPlaying = false;
  }
}
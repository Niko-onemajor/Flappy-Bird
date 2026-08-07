/**
 * 音效管理器
 * 音量平衡：背景音乐 < 音效反馈，避免互相压盖
 * 延迟创建音频上下文，减少启动卡顿
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

export default class Sound {
  constructor() {
    this._cache = {};
    this._fuseBurnPlaying = false;
    this._rocketFlyPlaying = false;
  }

  /* 延迟创建并缓存音频上下文 */
  _getAudio(key) {
    if (!this._cache[key]) {
      const cfg = AUDIO_CONFIG[key];
      if (!cfg) return null;
      const audio = wx.createInnerAudioContext();
      audio.src = cfg.src;
      audio.volume = cfg.volume;
      if (cfg.loop) audio.loop = true;
      this._cache[key] = audio;
    }
    return this._cache[key];
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
    a.play();
    /* 2秒后停止，只取引信部分 */
    setTimeout(() => {
      try {
        a.stop();
        this._fuseBurnPlaying = false;
      } catch (e) { /* ignore */ }
    }, 2000);
  }

  /* 火箭飞行音效：只播一次，不重叠 */
  playRocketFly() {
    if (this._rocketFlyPlaying) return;
    this._rocketFlyPlaying = true;
    const a = this._getAudio('rocketFly');
    a.seek(0);
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
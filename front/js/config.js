/* 游戏配置文件 - 集中管理所有可调参数 */

/* ========== 音效音量 ========== */
export const AUDIO_VOLUME = {
  bgm: 0.12,
  wing: 0.25,
  point: 0.3,
  hit: 0.35,
  die: 0.3,
  swoosh: 0.25,
};

/* ========== 地面配置 ========== */
export const GROUND = {
  HEIGHT: 90,        /* 地面高度（从112调低） */
  SPEED: 3,          /* 地面滚动速度 */
  IMG_WIDTH: 336,    /* 地面图片宽度 */
};

/* ========== 水管配置 ========== */
export const PIPE = {
  WIDTH: 52,
  MIN_LENGTH: 40,
  CLEARANCE: 55,
  MOVE_RANGE: 30,
  MIN_SPACING: 220,   /* 两对水管之间最小像素距离 */
  HITBOX_SHRINK: 6,
};

/* ========== 难度参数 ========== */
export const DIFFICULTY = {
  INTERVAL_BASE: 100,
  INTERVAL_MIN: 60,
  SPEED_BASE: 3,
  SPEED_MAX: 6.5,
  GAP_BASE: 130,
  GAP_MIN: 85,
  STEP: 5,            /* 每N分提升一次难度 */
  SPEED_INCREMENT: 0.35,
  GAP_DECREMENT: 5,
  INTERVAL_DECREMENT: 4,
  PROP_INTERVAL_DECREMENT: 6,
};

/* ========== 道具配置 ========== */
export const PROP = {
  SIZE: 32,
  SPEED: 3,
  DURATION: 300,
  FLOAT_AMP: 4,
  FLOAT_SPEED: 0.06,
  SAFE_MARGIN: 24,
  INTERVAL_BASE: 180,
  INTERVAL_MIN: 120,
  INTERVAL_RANDOM: 40,
};

/* ========== 玩家配置 ========== */
export const PLAYER = {
  WIDTH: 34,
  HEIGHT: 24,
  GRAVITY: 0.18,
  JUMP_VELOCITY: -3.8,
  MAX_FALL_SPEED: 5,
  ROTATION_LERP: 0.08,
  SHIELD_RADIUS: 28,
  SHIELD_PULSE: 0.05,
  FLAP_INTERVAL: 8,
};
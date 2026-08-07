const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();

/* Canvas 物理尺寸 = 实际屏幕像素 */
canvas.width = windowInfo.screenWidth;
canvas.height = windowInfo.screenHeight;

/* 设计分辨率（横屏：宽 > 高） */
const DESIGN_W = 932;
const DESIGN_H = 430;

/* 实际屏幕尺寸（供背景全屏渲染使用） */
export const SCREEN_W_REAL = windowInfo.screenWidth;
export const SCREEN_H_REAL = windowInfo.screenHeight;

/* 游戏逻辑使用设计分辨率坐标 */
export const SCREEN_WIDTH = DESIGN_W;
export const SCREEN_HEIGHT = DESIGN_H;

/* 统一缩放系数（等比缩放，保持宽高比） */
const GAME_SCALE = Math.min(SCREEN_W_REAL / DESIGN_W, SCREEN_H_REAL / DESIGN_H);
const GAME_OFFSET_X = (SCREEN_W_REAL - DESIGN_W * GAME_SCALE) / 2;
const GAME_OFFSET_Y = (SCREEN_H_REAL - DESIGN_H * GAME_SCALE) / 2;

export { GAME_SCALE, GAME_OFFSET_X, GAME_OFFSET_Y };
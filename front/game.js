import Main from './js/main';

/* 记录启动开始时间（import 完成后尽快执行） */
const _startTime = Date.now();

/**
 * 获取微信用户昵称（封装为 Promise，可重复调用）
 * @returns {Promise<string|null>} 昵称或 null
 */
function fetchWxNickName() {
  return new Promise((resolve) => {
    wx.getUserInfo({
      withCredentials: false,
      success: (res) => {
        const name = res.userInfo.nickName;
        GameGlobal.nickName = name;
        console.log('[Game] 获取用户昵称成功:', name);
        resolve(name);
      },
      fail: (err) => {
        console.warn('[Game] 获取用户昵称失败:', err);
        resolve(null);
      },
    });
  });
}

/* 立即尝试获取（游戏启动时尽早获取） */
fetchWxNickName();

/* 挂载到 GameGlobal，供其他模块在需要时重试 */
GameGlobal.fetchWxNickName = fetchWxNickName;

/* 开启高性能模式：iOS 设备获得更好的渲染性能 */
if (typeof wx.setPreferredFramesPerSecond === 'function') {
  wx.setPreferredFramesPerSecond(60);
}

const main = new Main();

/* Main 构造完成后上报最早可操作游戏画面时间点 */
if (main && main.loop) {
  const elapsed = Date.now() - _startTime;
  console.log(`[Perf] 游戏启动完成，耗时 ${elapsed}ms`);
  /* 上报到微信性能监控 */
  if (typeof wx.reportPerformance === 'function') {
    wx.reportPerformance(1001, elapsed);
  }
  /* 上报自定义启动阶段数据 */
  if (typeof wx.reportEvent === 'function') {
    wx.reportEvent('game_startup', { duration: elapsed });
  }
}

/* 音频资源由 sound.js 按需延迟创建 InnerAudioContext，无需提前预加载 */
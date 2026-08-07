import Main from './js/main';

/* 记录启动开始时间（import 完成后尽快执行） */
const _startTime = Date.now();

/* 开启调试模式，真机调试时可在 vConsole 中查看日志 */
if (typeof wx.setEnableDebug === 'function') {
  wx.setEnableDebug({ enableDebug: true });
}

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

/* 利用 CPU 空闲期预加载音频资源，提升网络利用率 */
if (typeof wx.createInnerAudioContext === 'function') {
  /* 延迟到主循环启动后预加载，不阻塞主线程 */
  setTimeout(() => {
    const audioFiles = [
      'audio/bgm.mp3', 'audio/wing.mp3', 'audio/point.mp3',
      'audio/hit.mp3', 'audio/die.mp3', 'audio/swoosh.mp3',
      'audio/shield_break.mp3', 'audio/shield_pickup.mp3',
      'audio/score_x2.mp3', 'audio/fuse_burn.mp3', 'audio/rocket_fly.mp3',
    ];
    audioFiles.forEach((src) => {
      const ctx = wx.createInnerAudioContext();
      ctx.src = src;
      ctx.volume = 0;
      /* 预加载后立即释放，音效管理器会在使用时重新创建 */
      setTimeout(() => {
        try { ctx.destroy(); } catch (e) { /* ignore */ }
      }, 100);
    });
    console.log(`[Perf] 预加载 ${audioFiles.length} 个音频资源完成`);
  }, 500);
}
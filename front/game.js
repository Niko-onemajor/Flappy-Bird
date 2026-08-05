import Main from './js/main';

/* 开启调试模式，真机调试时可在 vConsole 中查看日志 */
if (typeof wx.setEnableDebug === 'function') {
  wx.setEnableDebug({ enableDebug: true });
}

new Main();

/* API 基础配置
 * ─────────────────────────────────────────────
 * 模拟器调试：使用 localhost（默认）
 * 真机调试：  改为电脑的局域网 IP，如 http://192.168.1.100:5205
 *            手机和电脑必须在同一 WiFi 下
 *            查看电脑 IP：命令行输入 ipconfig，找 IPv4 地址
 * ───────────────────────────────────────────── */
const DEV_IP = 'localhost';  // 真机调试时改为你的电脑IP
const API_PORT = 5205;
const API_BASE = `http://${DEV_IP}:${API_PORT}`;

/**
 * 封装 wx.request 为 Promise
 */
function request(method, path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE + path,
      method,
      header: { 'Content-Type': 'application/json' },
      data,
      success(res) {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(res.data);
        }
      },
      fail(err) {
        console.error('[API] 请求失败:', path, err);
        reject(err);
      },
    });
  });
}

/* 游戏 API */
export function startGame(screenWidth, screenHeight) {
  return request('POST', '/api/game/start', { screenWidth, screenHeight });
}

export function gameTick(sessionId) {
  return request('POST', `/api/game/${sessionId}/tick`);
}

export function gameFlap(sessionId) {
  return request('POST', `/api/game/${sessionId}/flap`);
}

export function getGameState(sessionId) {
  return request('GET', `/api/game/${sessionId}/state`);
}

/* 排行榜 API */
export function submitScore(playerName, score) {
  return request('POST', '/api/score', { playerName, score });
}

export function getTopScores(limit = 10) {
  return request('GET', `/api/score?limit=${limit}`);
}
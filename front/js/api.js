/* API 基础配置
 * ─────────────────────────────────────────────
 * 模拟器调试：DEV_IP = 'localhost'（默认）
 * 真机调试：  DEV_IP = 你的电脑局域网 IP（如 192.168.1.100）
 *
 * 前提条件：
 *   1. 手机和电脑连接同一 WiFi
 *   2. 后端已启动（VS Code 终端 dotnet run）
 *   3. Windows 防火墙允许 5205 端口（如被拦截，以管理员运行：
 *      netsh advfirewall firewall add rule name="FlappyBird" dir=in action=allow protocol=TCP localport=5205）
 *
 * 查看电脑 IP：PowerShell 输入 ipconfig → 找 "无线局域网适配器 WLAN" 下的 IPv4 地址
 * ───────────────────────────────────────────── */
const DEV_IP = '192.168.1.11';  // 真机调试用电脑IP，模拟器调试改回 localhost
const API_PORT = 5205;
const API_BASE = `http://${DEV_IP}:${API_PORT}`;

console.log(`[API] 后端地址: ${API_BASE}`);
console.log('[API] 如需真机调试，请修改 api.js 第 8 行 DEV_IP 为电脑 IP');

/**
 * 封装 wx.request 为 Promise
 */
function request(method, path, data) {
  const url = API_BASE + path;
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      header: { 'Content-Type': 'application/json' },
      data,
      timeout: 5000,  /* 5秒超时 */
      success(res) {
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          console.error(`[API] ${method} ${url} → HTTP ${res.statusCode}:`, res.data);
          reject(res.data);
        }
      },
      fail(err) {
        console.error(`[API] ${method} ${url} 失败:`, JSON.stringify(err));
        console.error('[API] 可能原因: 1)后端未启动 2)DEV_IP 未改为电脑IP 3)防火墙拦截 4)不在同一WiFi');
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
@echo off
echo ================================================
echo   Flappy Bird API 测试套件 - Newman 运行脚本
echo ================================================
echo.
echo 使用前请确保:
echo   1. 后端服务已启动 (dotnet run)
echo   2. 已安装 newman (npm install -g newman)
echo.

set BASE_URL=http://localhost:5000

echo 基础 URL: %BASE_URL%
echo.
echo 开始运行测试...

newman run "%~dp0FlappyBird_API_Tests.postman_collection.json" ^
  --env-var "baseUrl=%BASE_URL%" ^
  --reporters cli ^
  --delay-request 10 ^
  --timeout-request 5000

echo.
echo ================================================
echo   测试完成
echo ================================================
pause
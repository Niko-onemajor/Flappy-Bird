\# AGENTS.md



\## 🎯 项目概述

这是一个 Flappy Bird 风格的微信小游戏项目。

\- 前端：微信小程序（JavaScript + Canvas）

\- 后端：C# + ASP.NET Core Web API (.NET 8)

\- 数据库：PostgreSQL + Entity Framework Core



\## 🛠️ 常用命令

\### 后端

| 命令 | 说明 |

| :--- | :--- |

| dotnet run | 启动后端 API 服务 |

| dotnet build | 编译项目 |

| dotnet add package <包名> | 添加 NuGet 包 |

| dotnet ef migrations add <迁移名> | 创建数据库迁移 |

| dotnet ef database update | 应用迁移到数据库 |



\### Git

| 命令 | 说明 |

| :--- | :--- |

| git add . | 暂存所有更改 |

| git commit -m "描述" | 提交更改 |

| git push origin main | 推送到远程仓库 |



\## 📁 项目结构

/

├── front/ # 微信小程序前端

│ ├── pages/

│ ├── app.js

│ └── project.config.json

├── back/ # C# 后端

│ ├── Controllers/

│ ├── Models/

│ ├── Data/

│ ├── Services/

│ ├── Program.cs

│ └── appsettings.json

└── AGENTS.md





\## 🧩 技术栈约束

\- 后端语言：仅限 C# (.NET 8)

\- 数据库操作：Entity Framework Core + PostgreSQL

\- API 风格：RESTful API，返回 JSON

\- 前端交互：仅提供 API 接口，不写前端代码



\## 📐 编码规范

\### C# 命名规则

\- 类名：PascalCase

\- 方法名：PascalCase

\- 变量/参数：camelCase

\- 常量：UPPER\_SNAKE\_CASE



\### 代码格式

\- UTF-8 编码

\- 缩进 4 个空格

\- if、for、foreach 后加空格

\- 方法之间空一行



\## 🚫 禁止操作

\- 禁止硬编码 JWT 密钥、数据库密码

\- 禁止 API 返回 openid、session\_key

\- 禁止提交 \*.db、\*.log 文件

\- 禁止直接修改表结构，必须用 EF Core 迁移



\## 🗄️ 数据库连接字符串

```json

{

&#x20; "ConnectionStrings": {

&#x20;   "DefaultConnection": "Host=localhost;Port=5432;Database=flappy\_db;Username=postgres;Password=你的密码"

&#x20; }

}



| NuGet 包名 | 用途 |

| :--- | :--- |

| Npgsql.EntityFrameworkCore.PostgreSQL | PostgreSQL 数据库驱动 |

| Microsoft.EntityFrameworkCore.Tools | EF Core 迁移命令行工具 |

| Microsoft.AspNetCore.Authentication.JwtBearer | JWT 身份验证支持 |

| Senparc.Weixin.WxOpen | 微信小程序登录、数据解密 |


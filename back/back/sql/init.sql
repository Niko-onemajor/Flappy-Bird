-- ============================================================
-- Flappy Bird 数据库初始化脚本（PostgreSQL）
-- 使用方法：在 psql 或 pgAdmin 中执行此文件
-- ============================================================

-- 1. 创建数据库（如果还不存在，需要用超级用户执行）
-- CREATE DATABASE flappy_db;

-- 2. 连接到 flappy_db 数据库后执行以下命令

-- 创建 high_scores 表
CREATE TABLE IF NOT EXISTS high_scores (
    id          SERIAL PRIMARY KEY,
    player_name VARCHAR(50)  NOT NULL DEFAULT 'Anonymous',
    score       INTEGER      NOT NULL DEFAULT 0,
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引加速排行榜查询
CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores (score DESC);

-- 插入一些测试数据
INSERT INTO high_scores (player_name, score) VALUES
    ('Player1', 15),
    ('Player2', 8),
    ('Player3', 22);
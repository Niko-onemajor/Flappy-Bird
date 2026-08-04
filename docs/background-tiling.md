# 背景动态平铺渲染说明

## 问题背景

原始 Flappy Bird 背景图尺寸为 **288x512**（竖屏设计），在横屏模式下缩放后单块宽度不足，需水平平铺多块才能覆盖整个屏幕。

## 核心计算

```
平铺块数 = Math.ceil(SCREEN_WIDTH / 单块宽度) + 2
```

### 参数说明

| 参数 | 含义 | 示例值 |
|------|------|--------|
| `BG_IMG_W` | 背景图原始宽度 | 288px |
| `BG_IMG_H` | 背景图原始高度 | 512px |
| `skyH` | 天空区域高度 | `SCREEN_HEIGHT - GROUND.HEIGHT`（约 285px） |
| `bgScale` | 缩放比例 | `skyH / BG_IMG_H`（约 0.557） |
| `bgDrawW` | 单块绘制宽度 | `BG_IMG_W x bgScale`（约 160px） |

### 示例计算

以横屏分辨率 **812x375** 为例：

```
bgDrawW = 288 x (285 / 512) = 160px
平铺块数 = Math.ceil(812 / 160) + 2 = 6 + 2 = 8
```

### 为什么 +2

- **+1**：覆盖视差滚动偏移 `bgOffsetX`（最大偏移一块宽度）
- **+1**：安全余量，防止极端边界出现缝隙

## 视差滚动原理

```
地面滚动速度：3px/帧（快，近景）
背景滚动速度：0.8px/帧（慢，远景）
```

滚动偏移 `bgOffsetX` 在 `[0, bgDrawW)` 范围内循环：

```
bgOffsetX = (bgOffsetX + 0.8) % bgDrawW
```

每帧将背景图从 `-bgOffsetX` 位置开始平铺，视觉上产生远景慢速移动的深度感。

## 代码实现

```js
_drawBg(ctx) {
    const w = this.bgDrawW;
    const h = this.bgDrawH;
    const tilesNeeded = Math.ceil(SCREEN_WIDTH / w) + 2;
    for (let i = 0; i < tilesNeeded; i++) {
        ctx.drawImage(this.bgImg, i * w - this.bgOffsetX, 0, w, h);
    }
}
```

## 修复前的问题

修复前硬编码 3 块平铺，横屏下 `160x3 = 480px < 812px`，右侧约 332px 区域无背景渲染。
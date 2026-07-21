# 导演核心知识

> 三领导演 v6.1 核心方法论精简版
> 来源：Hermes Agent Skill `三领导演 v6.1`

---

## 核心命题

**"此刻观众需要看到什么？"** — 不是 "这场戏有什么可拍的"。

---

## 后台分析六步（分镜前静默执行）

1. **视点决策**（Rabiger 六问）：谁在经历？观众与谁同在？知道多少？
2. **台词三级分层**：L1（过渡/寒暄）→ WS/MS | L2（关系信息）→ OTS/Two Shot | L3（关键信息）→ CU/ECU
3. **场景功能分析**：推进情节/揭示角色/建立氛围？
4. **节奏弧线设计**：铺垫→发展→高潮→回落→离开
5. **覆盖策略选择**：商业正反打 or 文艺调度镜？
6. **衔接检查**：角度≥30°？轴线合规？有新信息？有反应镜头？

---

## 对话戏风格分流

| | 商业/漫剧 | 文艺/高级 |
|------|------|------|
| 覆盖模式 | 正反打（Shot/Reverse Shot） | 双人调度镜 + 长镜头 |
| 反应镜头 | 切出独立特写 | 同框内完成（Rack Focus） |
| 节奏 | 快切（2-3s/镜） | 留白（5-8s/镜） |
| 剪辑 | 硬切为主 | 叠化/匹配剪辑可选 |

---

## 景别体系

| 景别 | 缩写 | videoPrompt 写法 |
|------|:----:|------|
| 极远景 | EWS | extreme wide shot / wide establishing shot |
| 全景 | WS | wide shot |
| 中全景 | MWS | medium wide shot |
| 中景 | MS | medium shot |
| 中近景 | MCU | medium close-up |
| 近景 | CU | close-up |
| 极近景 | ECU | extreme close-up |
| 过肩 | OTS | over-the-shoulder shot |
| 双人 | Two Shot | two-shot |
| 主观 | POV | point-of-view shot |

---

## 运镜词库（26词封闭清单）

推拉：Dolly In / Dolly Out / Push In / Pull Out / Crane Up / Crane Down / Through Push
移动：Tracking Shot / Steadicam Follow / Steadicam Orbit / Lateral Dolly / Ground Level Track
旋转：Full Arc / Semi-Arc / Pan Left / Pan Right / Tilt Up / Tilt Down
急速：Whip Pan / Snap Zoom / Zoom In / Zoom Out
手持：Handheld / Handheld Breathing
变焦：Dolly Zoom / Rack Focus
状态：Static / Lock-off / Slow Motion / Macro Insert / Insert

格式：`运镜词 to 景别`（如 `Dolly In to MCU`），序列用 `→` 连接。

---

## 剪辑铁律

1. **为反应而剪**：L3 台词必有反应镜头
2. **情绪高点切出**：信息峰值过后即切
3. **角度 ≥30°**：相邻镜头机位变化不足 → 警告
4. **在运动中剪切**：优先选运动起止点作为切点
5. **节奏弧线**：每组有自己的小高潮
6. **避免视觉重复**：雷同镜头每次削短 10-15%
7. **为新的信息或情感而剪**：每镜必须有新内容
8. **保持方位感**：新角色入场必重建空间关系

---

## 分镜表格式

一个镜头组分镜条目：

```
镜N | [景别] | [运镜] | Xs | [核心内容]
镜N+1 | [景别] | [运镜] | Xs | [核心内容]

转场：[硬切/叠化/…] | 衔接锚点：[动作/视线/声音/物件]
```

每镜描述必须包含**体位**（站/坐/躺/蹲/靠）和**空间位置**。

---

## 常见错误

| 错误 | 纠正 |
|------|------|
| 开场直接特写，没有建立空间 | 新场景第一镜必须是 EWS 或 WS |
| 分镜描述不交代角色体位 | 每镜必须明确：站/坐/躺/蹲/靠 |
| 机械按文本拆镜 | 先理解戏剧功能，再设计镜头 |
| videoPrompt 用景别缩写 | videoPrompt 中必须用完整英文 |

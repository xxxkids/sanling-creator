# 三领漫剧 (Sanling Creator)

> AI 影视生产工具 — 从小说到短剧的全流程自动化
> Powered by 三领导演 v6.1

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/xxxkids/sanling-creator)](https://github.com/xxxkids/sanling-creator)

**[中文]** | [English](README_EN.md)

---

## 📖 简介

三领漫剧是一个开源的 AI 漫剧/短剧生产工具。从小说/剧本导入，到角色设定、场景规划、分镜生成、AI 视频制作、语音合成，全流程自动化。

**核心能力：**

- 🎬 **三领导演 v6.1** — 专业导演方法论驱动的自动分镜：视点分析、台词三级分层、节奏弧线、26 词运镜词库、Emily2040 Director Formula
- 🖼️ **AI 生图** — 整合 Nano Banana Pro、GPT Image 2、Midjourney 等多平台，支持批量生成、参考图、分级质量
- 🎥 **视频生成** — 分批追踪、回滚、自检，支持 Seedance 2.0、可灵等多平台
- 🗣️ **语音合成** — 多角色 TTS，10 种预设音色，情感控制
- 📝 **Skill 体系** — 提示词外化为可编辑文件，用户可自由调优

---

## 🚀 快速开始

### 前置条件

- Node.js 18+
- npm/pnpm

### 安装

```bash
git clone https://github.com/xxxkids/sanling-creator.git
cd sanling-creator
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build:mac
```

构建产物在 `release/build/mac-arm64/`。

---

## 🏗️ 架构

```
sanling-creator/
├── src/
│   ├── lib/
│   │   ├── storyboard/         # 分镜系统（解析器 + 生成器）
│   │   └── script/             # 剧本处理
│   ├── stores/
│   │   ├── video-gen-store.ts  # 视频生成状态管理
│   │   ├── voice-store.ts      # 语音合成管理
│   │   ├── director-store.ts   # 三领导演状态
│   │   ├── director-shot-store.ts
│   │   └── director-presets.ts
│   ├── components/             # React 组件
│   └── app/                    # 应用入口
├── data/
│   └── skills/                 # Skill 提示词文件（可编辑）
└── build/                      # 构建输出
```

---

## ⚖️ 许可与商业使用

### 社区版（AGPL-3.0）

三领漫剧基于 **GNU Affero General Public License v3.0** 开源。这意味着：

- ✅ 个人使用、学习、研究完全免费
- ✅ 修改和使用代码（包括商业环境中的内部使用）
- ⚠️ 如果你修改了代码并将其部署为网络服务，**必须**公开修改后的源代码
- ⚠️ 如果分发修改版本，**必须**继续使用 AGPL-3.0

### 商业许可

对于需要将三领漫剧嵌入商业产品而不受 AGPL 限制的场景，我们提供**商业许可**：

| 场景 | 社区版 (AGPL) | 商业许可 |
|:---|:---:|:---:|
| 个人创作者使用 | ✅ 免费 | — |
| 工作室内部使用（≤5人） | ✅ 免费 | — |
| 工作室内部使用（>5人） | ✅ 免费 | 可选 |
| 嵌入商业 SaaS 产品 | ❌ 需公开源码 | ✅ |
| 闭源分发定制版本 | ❌ AGPL 不允许 | ✅ |
| SLA / 技术支持 | ❌ | ✅ |

商业许可请联系：**[联系邮箱/微信]**

### 上游说明

三领漫剧 fork 自 [moyin-creator](https://github.com/MemeCalculate/moyin-creator) v0.2.3（AGPL-3.0），在此深表感谢。

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交改动 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

请确保代码通过 TypeScript 类型检查：
```bash
npm run lint
```

---

## 📄 相关项目

- [moyin-creator](https://github.com/MemeCalculate/moyin-creator) — 上游项目，moyin 漫剧创作工具
- [三领导演 v6.1](https://github.com/xxxkids/sanling-creator) — 内置的专业导演 Agent

---

## 📊 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=xxxkids/sanling-creator&type=Date)](https://star-history.com/#xxxkids/sanling-creator&Date)

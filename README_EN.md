# Sanling Creator

> AI-powered drama production tool — from novel to short film, fully automated
> Powered by Sanling Director v6.1

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL_3.0-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/xxxkids/sanling-creator)](https://github.com/xxxkids/sanling-creator)

[中文](README.md) | **[English]**

---

## 📖 About

Sanling Creator is an open-source AI drama/animation production tool. From novel/script import to character design, scene planning, storyboarding, AI video generation, and voice synthesis — the entire pipeline is automated.

**Core Capabilities:**

- 🎬 **Sanling Director v6.1** — Professional director methodology for automatic storyboarding: viewpoint analysis, dialogue tiering, rhythm arcs, 26-shot camera vocabulary, Emily2040 Director Formula
- 🖼️ **AI Image Generation** — Integration with Nano Banana Pro, GPT Image 2, Midjourney and more, supporting batch generation, reference images, tiered quality
- 🎥 **Video Generation** — Batch tracking, rollback, self-verification, supporting Seedance 2.0, Kling and more
- 🗣️ **Voice Synthesis** — Multi-character TTS, 10 preset voices, emotion control
- 📝 **Skill System** — Externalized prompts as editable markdown files, customizable by users

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm/pnpm

### Install

```bash
git clone https://github.com/xxxkids/sanling-creator.git
cd sanling-creator
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build:mac
```

Build output: `release/build/mac-arm64/`.

---

## ⚖️ License

Sanling Creator is open source under the **GNU Affero General Public License v3.0** (AGPL-3.0).

For commercial use cases that require avoiding AGPL restrictions, a **Commercial License** is available. See [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) for details.

This project is a fork of [moyin-creator](https://github.com/MemeCalculate/moyin-creator) v0.2.3 (AGPL-3.0).

---

## 🤝 Contributing

Issues and Pull Requests are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Run TypeScript type check:
```bash
npm run lint
```

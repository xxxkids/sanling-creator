// 分镜草图生成器 — 9格排版故事板
// 将分镜组转换为 N×N 网格草图提示词

import type { ParsedScene, ParsedShot } from "./storyboard-parser";

// ==================== Types ====================

export interface StoryboardCell {
  row: number;
  col: number;
  label: string;           // "镜1"
  shotSize: string;        // EWS/WS/CU/...
  cameraMovement: string;
  duration: number;
  description: string;     // 英文视觉描述
}

export interface StoryboardGrid {
  id: string;              // "S-01"
  label: string;           // "分镜草图01·场景1-2前·镜1-9"
  rows: number;
  cols: number;
  cells: StoryboardCell[];
  /** 用于 AI 生图的聚合提示词 */
  imagePrompt: string;
  /** 中文提示词 */
  imagePromptZh: string;
  /** 覆盖的场景 */
  sceneRange: string;
  /** 覆盖的镜头 */
  shotRange: string;
}

export interface GridLayout {
  rows: number;
  cols: number;
}

// ==================== 布局计算 ====================

/** 根据镜头数计算最优网格布局 */
export function calculateGridLayout(shotCount: number): GridLayout {
  if (shotCount <= 1) return { rows: 1, cols: 1 };
  if (shotCount <= 2) return { rows: 1, cols: 2 };
  if (shotCount <= 4) return { rows: 2, cols: 2 };
  if (shotCount <= 6) return { rows: 2, cols: 3 };
  if (shotCount <= 9) return { rows: 3, cols: 3 };
  // 超过9个，用 3×4 或 4×3
  if (shotCount <= 12) return { rows: 3, cols: 4 };
  return { rows: 4, cols: 4 };
}

// ==================== 生成器 ====================

/**
 * 从解析后的分镜数据生成故事板网格
 */
export function buildStoryboardGrids(
  scenes: ParsedScene[],
  maxCellsPerGrid: number = 9
): StoryboardGrid[] {
  const allShots: { scene: ParsedScene; shot: ParsedShot }[] = [];
  for (const scene of scenes) {
    for (const shot of scene.shots) {
      allShots.push({ scene, shot });
    }
  }

  const grids: StoryboardGrid[] = [];
  for (let i = 0; i < allShots.length; i += maxCellsPerGrid) {
    const group = allShots.slice(i, i + maxCellsPerGrid);
    const layout = calculateGridLayout(group.length);

    const firstScene = group[0].scene;
    const lastScene = group[group.length - 1].scene;
    const firstShot = group[0].shot;
    const lastShot = group[group.length - 1].shot;

    const cells: StoryboardCell[] = group.map(({ scene, shot }, idx) => {
      const row = Math.floor(idx / layout.cols);
      const col = idx % layout.cols;
      return {
        row,
        col,
        label: `镜${shot.shotNumber}`,
        shotSize: shot.shotSize,
        cameraMovement: shot.cameraMovement,
        duration: shot.duration,
        description: buildCellDescription(scene, shot),
      };
    });

    const gridIndex = String(grids.length + 1).padStart(2, "0");
    const sceneRange =
      firstScene.sceneNumber === lastScene.sceneNumber
        ? `场景${firstScene.sceneNumber}`
        : `场景${firstScene.sceneNumber}-${lastScene.sceneNumber}`;
    const shotRange = `镜${firstShot.shotNumber}-${lastShot.shotNumber}`;

    grids.push({
      id: `S-${gridIndex}`,
      label: `分镜草图${gridIndex}·${sceneRange}·${shotRange}`,
      rows: layout.rows,
      cols: layout.cols,
      cells,
      imagePrompt: buildGridPrompt(cells, layout),
      imagePromptZh: buildGridPromptZh(cells, layout),
      sceneRange,
      shotRange,
    });
  }

  return grids;
}

// ==================== 提示词构建 ====================

/**
 * 构建单个格子的英文描述（精简版，50词内）
 */
function buildCellDescription(scene: ParsedScene, shot: ParsedShot): string {
  const parts: string[] = [];
  parts.push(`${shot.shotSize} shot`);
  if (shot.cameraMovement !== "Static") {
    parts.push(shot.cameraMovement);
  }
  // 从描述中提取关键视觉元素
  const desc = shot.description.substring(0, 60);
  parts.push(desc);
  parts.push(`${scene.sceneName}`);
  return parts.join(", ");
}

/**
 * 构建网格图的英文提示词
 * 参考 LibTV 的 9格排版提示词格式
 */
function buildGridPrompt(cells: StoryboardCell[], layout: GridLayout): string {
  const lines: string[] = [];
  lines.push(`${layout.cols}x${layout.rows} grid storyboard, uniform cell borders, dark background`);
  lines.push("");

  for (const cell of cells) {
    const pos = `[${cell.row + 1},${cell.col + 1}]`;
    lines.push(`${pos} ${cell.label}: ${cell.shotSize}, ${cell.cameraMovement}, ${cell.description}`);
  }

  lines.push("");
  lines.push("cinematic storyboard, clean grid lines, professional film previsualization");

  return lines.join("\n");
}

/**
 * 构建网格图的中文提示词
 */
function buildGridPromptZh(cells: StoryboardCell[], layout: GridLayout): string {
  const lines: string[] = [];
  lines.push(`${layout.cols}×${layout.rows} 分镜草图网格，统一格线，深色背景`);
  lines.push("");

  for (const cell of cells) {
    const pos = `[${cell.row + 1},${cell.col + 1}]`;
    lines.push(`${pos} ${cell.label}: ${cell.description}`);
  }

  lines.push("");
  lines.push("电影分镜草图，专业影视预演，清晰网格线");

  return lines.join("\n");
}

// ==================== 格式化输出 ====================

/**
 * 生成 Markdown 格式的分镜草图报告
 */
export function formatStoryboardReport(grids: StoryboardGrid[]): string {
  const lines: string[] = [];
  lines.push("# 分镜草图规划");
  lines.push("");

  for (const grid of grids) {
    lines.push(`## ${grid.label}`);
    lines.push(`- 覆盖: ${grid.sceneRange} | ${grid.shotRange}`);
    lines.push(`- 布局: ${grid.rows}×${grid.cols} (${grid.cells.length}格)`);
    lines.push("");
    lines.push("| 位置 | 镜号 | 景别 | 运镜 | 时长 |");
    lines.push("|------|------|------|------|------|");
    for (const cell of grid.cells) {
      lines.push(
        `| [${cell.row + 1},${cell.col + 1}] | ${cell.label} | ${cell.shotSize} | ${cell.cameraMovement} | ${cell.duration}s |`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

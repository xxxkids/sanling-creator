// 三领导演 v6.1 分镜表解析器
// 将三领导演输出的分镜表格式解析为 APP 内部数据结构

import type { ShotSizeType, DurationType, CameraMovementType, EmotionTag } from '@/stores/director-presets';

// ==================== 解析结果的类型 ====================

export interface ParsedScene {
  sceneNumber: number;
  sceneName: string;
  duration: number;        // 秒
  emotion: string;
  viewpoint: string;       // 本场视点
  function: string;        // 本场功能
  shots: ParsedShot[];
  transition: string;      // 转场方式
  transitionAnchor: string; // 衔接锚点
}

export interface ParsedShot {
  shotNumber: number;
  shotSize: string;        // 景别缩写 (EWS/WS/MWS/MS/MCU/CU/ECU/OTS/Two Shot/POV)
  cameraMovement: string;  // 运镜 (Static/Dolly In/Handheld...)
  duration: number;        // 秒
  description: string;     // 核心内容描述
  rawText: string;         // 原始文本行
}

export interface StoryboardParseResult {
  title: string;           // 剧集名称（如果能解析到）
  scenes: ParsedScene[];
  totalShots: number;
  totalDuration: number;   // 总秒数
  errors: string[];
}

// ==================== 景别映射 ====================

const SHOT_SIZE_MAP: Record<string, ShotSizeType> = {
  'EWS': 'ws',      // 极远景 → ws (APP 用 ws 代表远景)
  'WS': 'ws',       // 全景
  'MWS': 'ms',      // 中全景 → ms
  'MS': 'ms',       // 中景
  'MCU': 'mcu',     // 中近景
  'CU': 'cu',       // 近景
  'ECU': 'ecu',     // 极近景/特写
  'OTS': 'pov',     // 过肩 → pov (APP没有OTS，归入主观类)
  'Two Shot': 'ms', // 双人 → ms
  'POV': 'pov',     // 主观
};

// ==================== 运镜映射 ====================

// 三领导演 v6.1 的26词运镜体系
const CAMERA_MOVEMENT_ALIASES: Record<string, string> = {
  'Static': 'Static',
  'Lock-off': 'Static',
  'Dolly In': 'Dolly In',
  'Dolly Out': 'Dolly Out',
  'Push In': 'Dolly In',
  'Pull Out': 'Dolly Out',
  'Crane Up': 'Crane Up',
  'Crane Down': 'Crane Down',
  'Through Push': 'Dolly In',
  'Tracking Shot': 'Tracking',
  'Steadicam Follow': 'Tracking',
  'Steadicam Orbit': 'Tracking',
  'Lateral Dolly': 'Tracking',
  'Ground Level Track': 'Tracking',
  'Full Arc': 'Tracking',
  'Semi-Arc': 'Tracking',
  'Pan Left': 'Pan Left',
  'Pan Right': 'Pan Right',
  'Tilt Up': 'Tilt Up',
  'Tilt Down': 'Tilt Down',
  'Whip Pan': 'Whip Pan',
  'Snap Zoom': 'Zoom In',
  'Zoom In': 'Zoom In',
  'Zoom Out': 'Zoom Out',
  'Handheld': 'Handheld',
  'Handheld Breathing': 'Handheld',
  'Dolly Zoom': 'Dolly In',
  'Rack Focus': 'Static',
  'Slow Motion': 'Static',
  'Macro Insert': 'Static',
  'Insert': 'Static',
};

// ==================== 解析函数 ====================

/**
 * 解析三领导演 v6.1 分镜表文本
 */
export function parseStoryboard(text: string): StoryboardParseResult {
  const errors: string[] = [];
  const scenes: ParsedScene[] = [];

  // 按场分割（匹配 ═══...═══ 分隔符）
  const sceneBlocks = splitScenes(text);

  for (const block of sceneBlocks) {
    try {
      const scene = parseSceneBlock(block);
      if (scene) {
        scenes.push(scene);
      }
    } catch (e) {
      errors.push(`解析场景失败: ${(e as Error).message}`);
    }
  }

  let totalShots = 0;
  let totalDuration = 0;
  for (const s of scenes) {
    totalShots += s.shots.length;
    totalDuration += s.duration;
  }

  return {
    title: extractTitle(text),
    scenes,
    totalShots,
    totalDuration,
    errors,
  };
}

/**
 * 按 ═══ 分隔符拆分为场景块
 */
function splitScenes(text: string): string[] {
  const blocks: string[] = [];
  const lines = text.split('\n');
  let currentBlock: string[] = [];
  let inScene = false;

  for (const line of lines) {
    // 检测场景分隔符
    if (/^═{10,}/.test(line.trim())) {
      if (inScene && currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      inScene = true;
      continue;
    }
    if (inScene) {
      currentBlock.push(line);
    }
  }

  // 最后一个场景
  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks;
}

/**
 * 解析单个场景块
 */
function parseSceneBlock(block: string): ParsedScene | null {
  const lines = block.split('\n');

  // 第一行是场景头: 第N场：[场景名] | 时长：Xs | 情绪：[关键词]
  const headerLine = lines[0]?.trim() || '';
  const headerMatch = headerLine.match(
    /第(\d+)场[：:]\s*(.+?)\s*\|\s*时长[：:]\s*(\d+)s?\s*\|\s*情绪[：:]\s*(.+)/
  );

  if (!headerMatch) {
    return null;
  }

  const sceneNumber = parseInt(headerMatch[1]);
  const sceneName = headerMatch[2].trim();
  const duration = parseInt(headerMatch[3]);
  const emotion = headerMatch[4].trim();

  // 解析元数据行
  let viewpoint = '';
  let func = '';
  let transition = '';
  let transitionAnchor = '';
  const shots: ParsedShot[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 视点
    if (line.startsWith('本场视点：') || line.startsWith('本场视点:')) {
      viewpoint = line.replace(/^本场视点[：:]\s*/, '');
      continue;
    }

    // 功能
    if (line.startsWith('本场功能：') || line.startsWith('本场功能:')) {
      func = line.replace(/^本场功能[：:]\s*/, '');
      continue;
    }

    // 转场
    if (line.startsWith('转场：') || line.startsWith('转场:')) {
      const tMatch = line.match(/转场[：:]\s*(.+?)\s*\|\s*衔接锚点[：:]\s*(.+)/);
      if (tMatch) {
        transition = tMatch[1].trim();
        transitionAnchor = tMatch[2].trim();
      } else {
        transition = line.replace(/^转场[：:]\s*/, '');
      }
      continue;
    }

    // 镜头行: 镜N | 景别 | 运镜 | Xs | 描述
    const shotMatch = line.match(
      /镜(\d+)\s*\|\s*(\S+)\s*\|\s*(\S+(?:\s+\S+)*?)\s*\|\s*(\d+(?:\.\d+)?)s?\s*\|\s*(.+)/
    );
    if (shotMatch) {
      const shotNumber = parseInt(shotMatch[1]);
      const rawShotSize = shotMatch[2].trim();
      const rawCameraMovement = shotMatch[3].trim();
      const shotDuration = parseFloat(shotMatch[4]);
      const description = shotMatch[5].trim();

      // 映射景别（处理 "ECU→CU" 复合形式，取第一个）
      const cleanShotSize = rawShotSize.split(/[→>]/)[0].trim();
      const shotSize = SHOT_SIZE_MAP[cleanShotSize] || 'ms';

      // 映射运镜（处理复合运镜如 "Dolly In to MCU"）
      const cameraMovement = mapCameraMovement(rawCameraMovement);

      shots.push({
        shotNumber,
        shotSize,
        cameraMovement,
        duration: shotDuration,
        description,
        rawText: line,
      });
      continue;
    }

    // 续行（镜头描述可能跨行）
    if (shots.length > 0 && !line.startsWith('◆') && !line.startsWith('镜')) {
      const lastShot = shots[shots.length - 1];
      lastShot.description += ' ' + line;
      lastShot.rawText += '\n' + line;
    }
  }

  return {
    sceneNumber,
    sceneName,
    duration,
    emotion,
    viewpoint,
    function: func,
    shots,
    transition,
    transitionAnchor,
  };
}

/**
 * 映射运镜词（处理复合运镜）
 */
function mapCameraMovement(raw: string): string {
  // 处理 "Dolly In to MCU" 这种复合形式
  const parts = raw.split(/\s+(?:to|→)\s+/i);
  const mainMove = parts[0].trim();

  return CAMERA_MOVEMENT_ALIASES[mainMove] || raw;
}

/**
 * 尝试提取标题
 */
function extractTitle(text: string): string {
  const match = text.match(/《(.+?)》/);
  return match ? match[1] : '';
}

// ==================== 辅助函数 ====================

/**
 * 将解析结果中的景别缩写映射到 APP 的预设ID
 */
export function getShotSizePresetId(shotSize: string): ShotSizeType {
  return (SHOT_SIZE_MAP[shotSize] || 'ms') as ShotSizeType;
}

/**
 * 解析情绪标签
 */
export function extractEmotionTags(emotion: string): EmotionTag[] {
  const tags: EmotionTag[] = [];
  const knownTags = [
    '平静', '焦虑', '紧张', '愤怒', '悲伤', '喜悦',
    '压抑', '恐惧', '兴奋', '疲惫', '暗涌', '荒诞',
    '沉默', '得意', '爽感', '轻快', '冷峻', '温暖',
  ];

  for (const tag of knownTags) {
    if (emotion.includes(tag)) {
      tags.push(tag as EmotionTag);
    }
  }

  return tags.length > 0 ? tags : ['平静' as EmotionTag];
}

/**
 * 根据镜头持续时间推荐时长预设
 */
export function getRecommendedDuration(seconds: number): DurationType {
  const presets = [4, 5, 6, 7, 8, 9, 10, 11, 12];
  return presets.reduce((prev, curr) =>
    Math.abs(curr - seconds) < Math.abs(prev - seconds) ? curr : prev
  );
}

/**
 * 检查解析结果是否有效
 */
export function validateParseResult(result: StoryboardParseResult): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (result.scenes.length === 0) {
    issues.push('未解析到任何场景');
  }

  for (const scene of result.scenes) {
    if (scene.shots.length === 0) {
      issues.push(`第${scene.sceneNumber}场没有镜头`);
    }

    // 检查每个镜头
    for (const shot of scene.shots) {
      if (!SHOT_SIZE_MAP[shot.shotSize]) {
        issues.push(`第${scene.sceneNumber}场镜${shot.shotNumber}: 未知景别 "${shot.shotSize}"`);
      }
      if (shot.duration <= 0 || shot.duration > 60) {
        issues.push(`第${scene.sceneNumber}场镜${shot.shotNumber}: 时长异常 ${shot.duration}s`);
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

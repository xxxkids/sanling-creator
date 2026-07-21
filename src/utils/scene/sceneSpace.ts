/**
 * SceneSpace — 场景空间定义
 *
 * 描述一个场景的物理布局：空间结构、固定元素、角色站位、机位约束。
 * 用于保证同一个场景的多镜头之间的空间一致性。
 *
 * 借鉴 DramaClaw Director World 的设计思路，但不依赖 3D 渲染。
 * 本质是一个 JSON Schema，轻量、可校验、可扩展。
 *
 * 用法：
 *   const space = new SceneSpace({ name: '纸坊后院', ... })
 *   space.validate()
 *   space.getDefaultPosition('陈恪')
 *   space.getCameraConstraint()
 */

// ==================== Types ====================

export interface Point {
  x: number  // 0-100，百分比坐标
  y: number  // 0-100，百分比坐标
}

/** 场景中的关键区域/固定结构 */
export interface Zone {
  id: string
  name: string           // 如 "门"、"窗"、"书桌"、"柜台"
  type: 'entrance' | 'window' | 'furniture' | 'structural' | 'prop'
  position: Point        // 在场景中的位置（俯视百分比）
  size?: { width: number; depth: number }  // 区域大小
  description?: string   // 视觉描述
}

/** 光源定义 */
export interface LightSource {
  id: string
  name: string           // 如 "窗光"、"吊灯"、"烛台"
  type: 'natural' | 'artificial' | 'practical'
  direction: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  color: string          // 色温描述
  intensity: 'low' | 'medium' | 'high'
  description?: string
}

/** 角色默认站位 */
export interface CharacterPosition {
  characterId: string    // 角色标识
  name: string           // 角色名
  defaultPosition: Point // 默认位置
  defaultOrientation: 'facing_left' | 'facing_right' | 'facing_camera' | 'facing_away' | 'profile'
  notes?: string         // 特殊站位说明
}

/** 机位约束 */
export interface CameraConstraint {
  /** 180 度轴线（AB两点定义一条线） */
  axisLine: { a: Point; b: Point }
  /** 轴线上允许的机位角度 */
  allowedSides: ('side_a' | 'side_b' | 'both')[]
  /** 常用焦段 */
  defaultFocal: string
  /** 备注 */
  notes?: string
}

/** 场景空间完整定义 */
export interface SceneSpaceConfig {
  id: string
  name: string
  description: string

  /** 空间结构 */
  layout: {
    type: 'indoor' | 'outdoor' | 'abstract'
    dimensions?: string   // 如 "约 30 平米"、"开阔庭院"
    keyZones: Zone[]
  }

  /** 固定元素（不可移动的物体） */
  fixedElements: Zone[]

  /** 角色站位 */
  characterPositions: CharacterPosition[]

  /** 光照方案 */
  lighting: LightSource[]

  /** 机位约束 */
  cameraConstraints: CameraConstraint[]

  /** 关联的项目/场景 ID */
  projectId?: string
  sceneId?: string

  /** 元数据 */
  createdAt: number
  updatedAt: number
}

// ==================== Default Scene Templates ====================

const SCENE_TEMPLATES: Record<string, Partial<SceneSpaceConfig>> = {
  /** 室内客厅/正厅 */
  living_room: {
    layout: {
      type: 'indoor',
      keyZones: [
        { id: 'door_main', name: '大门', type: 'entrance', position: { x: 10, y: 50 } },
        { id: 'window_left', name: '窗', type: 'window', position: { x: 30, y: 10 } },
        { id: 'table_center', name: '桌子', type: 'furniture', position: { x: 50, y: 50 } },
      ],
    },
    fixedElements: [
      { id: 'wall_back', name: '后墙', type: 'structural', position: { x: 50, y: 0 }, size: { width: 100, depth: 5 } },
    ],
    cameraConstraints: [
      {
        axisLine: { a: { x: 10, y: 50 }, b: { x: 90, y: 50 } },
        allowedSides: ['side_a', 'side_b'],
        defaultFocal: '35mm',
      },
    ],
  },

  /** 室外庭院/院落 */
  courtyard: {
    layout: {
      type: 'outdoor',
      keyZones: [
        { id: 'gate', name: '院门', type: 'entrance', position: { x: 50, y: 90 } },
        { id: 'wall_left', name: '左墙', type: 'structural', position: { x: 0, y: 50 } },
        { id: 'well_center', name: '水井', type: 'prop', position: { x: 40, y: 60 } },
      ],
    },
    cameraConstraints: [
      {
        axisLine: { a: { x: 0, y: 50 }, b: { x: 100, y: 50 } },
        allowedSides: ['side_a', 'side_b'],
        defaultFocal: '24mm',
      },
    ],
  },

  /** 街头/城市场景 */
  street: {
    layout: {
      type: 'outdoor',
      keyZones: [
        { id: 'building_left', name: '左侧建筑', type: 'structural', position: { x: 0, y: 50 } },
        { id: 'building_right', name: '右侧建筑', type: 'structural', position: { x: 100, y: 50 } },
      ],
    },
    cameraConstraints: [
      {
        axisLine: { a: { x: 0, y: 50 }, b: { x: 100, y: 50 } },
        allowedSides: ['side_a'],
        defaultFocal: '50mm',
      },
    ],
  },
}

// ==================== SceneSpace Class ====================

export class SceneSpace {
  private config: SceneSpaceConfig

  constructor(config: SceneSpaceConfig) {
    this.config = config
  }

  get id() { return this.config.id }
  get name() { return this.config.name }
  get description() { return this.config.description }
  get layout() { return this.config.layout }
  get fixedElements() { return this.config.fixedElements }
  get characterPositions() { return this.config.characterPositions }
  get lighting() { return this.config.lighting }
  get cameraConstraints() { return this.config.cameraConstraints }
  get toJSON() { return this.config }

  /**
   * 校验场景空间定义是否合法
   */
  validate(): string[] {
    const errors: string[] = []

    if (!this.config.id) errors.push('缺少 id')
    if (!this.config.name) errors.push('缺少 name')

    // 区域位置校验
    for (const zone of this.config.layout.keyZones) {
      if (zone.position.x < 0 || zone.position.x > 100) {
        errors.push(`区域 "${zone.name}" 的 x 坐标 ${zone.position.x} 超出范围 (0-100)`)
      }
      if (zone.position.y < 0 || zone.position.y > 100) {
        errors.push(`区域 "${zone.name}" 的 y 坐标 ${zone.position.y} 超出范围 (0-100)`)
      }
    }

    // 角色站位校验
    const seenChars = new Set<string>()
    for (const pos of this.config.characterPositions) {
      if (seenChars.has(pos.characterId)) {
        errors.push(`角色 "${pos.name}" 有多个站位定义`)
      }
      seenChars.add(pos.characterId)
      if (pos.defaultPosition.x < 0 || pos.defaultPosition.x > 100) {
        errors.push(`角色 "${pos.name}" 的 x 坐标超出范围`)
      }
    }

    return errors
  }

  /**
   * 获取角色的默认站位
   */
  getCharacterPosition(characterId: string): CharacterPosition | undefined {
    return this.config.characterPositions.find(p => p.characterId === characterId)
  }

  /**
   * 获取所有角色在场景中的布局描述（供分镜提示词使用）
   */
  getLayoutDescription(): string {
    const parts: string[] = []

    if (this.config.layout.type === 'indoor') {
      parts.push('室内场景')
    } else if (this.config.layout.type === 'outdoor') {
      parts.push('室外场景')
    }

    if (this.config.layout.dimensions) {
      parts.push(this.config.layout.dimensions)
    }

    // 固定元素
    const elements = this.config.fixedElements
      .map(e => `${e.name}（位置: ${e.position.x}%, ${e.position.y}%）`)
    if (elements.length > 0) {
      parts.push('固定元素：' + elements.join('、'))
    }

    // 角色站位
    const chars = this.config.characterPositions
      .map(p => `${p.name}（默认站位: ${p.defaultPosition.x}%, ${p.defaultPosition.y}%）`)
    if (chars.length > 0) {
      parts.push('角色站位：' + chars.join('、'))
    }

    // 光源
    const lights = this.config.lighting
      .map(l => `${l.name}（${l.direction}，${l.color}）`)
    if (lights.length > 0) {
      parts.push('光源：' + lights.join('、'))
    }

    return parts.join('。')
  }

  /**
   * 保存到 localStorage
   */
  save(): void {
    const key = `sanling:scene_space:${this.config.id}`
    try {
      localStorage.setItem(key, JSON.stringify(this.config))
    } catch (e) {
      console.warn('[SceneSpace] save failed:', e)
    }
  }

  /**
   * 从 localStorage 加载
   */
  static load(id: string): SceneSpace | null {
    const key = `sanling:scene_space:${id}`
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      return new SceneSpace(JSON.parse(raw))
    } catch {
      return null
    }
  }

  /**
   * 获取场景模板
   */
  static getTemplate(type: string): Partial<SceneSpaceConfig> | undefined {
    return SCENE_TEMPLATES[type]
  }

  /**
   * 获取所有可用模板
   */
  static getTemplates(): { id: string; name: string; description: string }[] {
    return [
      { id: 'living_room', name: '客厅/正厅', description: '室内场景，中心桌子+门窗' },
      { id: 'courtyard', name: '庭院/院落', description: '室外场景，院墙+水井' },
      { id: 'street', name: '街头/城市', description: '室外场景，两侧建筑' },
    ]
  }
}

// ==================== Helpers ====================

/**
 * 生成默认的场景空间配置
 * 基于现有的 Scene 数据初始化
 */
export function createDefaultSceneSpace(
  id: string,
  name: string,
  location?: string,
): SceneSpaceConfig {
  // 根据地名推断场景类型
  const type: 'indoor' | 'outdoor' | 'abstract' =
    !location ? 'abstract' :
    /院|庭|园|野|街|路|桥|山|湖|海|田/.test(location) ? 'outdoor' :
    /房|屋|厅|室|店|馆|楼|殿|宫/.test(location) ? 'indoor' :
    'abstract'

  return {
    id,
    name,
    description: location || '',
    layout: {
      type,
      keyZones: [],
    },
    fixedElements: [],
    characterPositions: [],
    lighting: [
      {
        id: 'main_light',
        name: '主光源',
        type: type === 'indoor' ? 'artificial' : 'natural',
        direction: type === 'indoor' ? 'top' : 'top-left',
        color: type === 'indoor' ? '暖白光' : '自然日光',
        intensity: 'medium',
      },
    ],
    cameraConstraints: [
      {
        axisLine: { a: { x: 0, y: 50 }, b: { x: 100, y: 50 } },
        allowedSides: ['side_a', 'side_b'],
        defaultFocal: '35mm',
      },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

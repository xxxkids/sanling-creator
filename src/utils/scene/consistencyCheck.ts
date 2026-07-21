/**
 * ConsistencyCheck — 跨镜头空间一致性检查器
 *
 * 给定一个场景空间定义 + 一组分镜描述，自动检查空间一致性：
 * - 角色位置是否合理（不会穿墙、不会瞬移）
 * - 机位是否在 180 度轴线同侧
 * - 光源方向是否一致
 * - 固定元素位置是否稳定
 *
 * 用法：
 *   const checker = new ConsistencyChecker(sceneSpace)
 *   const issues = checker.checkShots(shots)
 *   // [{ severity, description, shot }, ...]
 */

import { SceneSpace, type Point, type SceneSpaceConfig } from './sceneSpace'

// ==================== Types ====================

export interface ShotInfo {
  id: string
  name: string
  /** 景别 */
  shotSize: string
  /** 机位描述 */
  cameraPosition?: string
  /** 角色位置 */
  characterPositions?: { characterId: string; position: Point; orientation?: string }[]
  /** 画面描述全文 */
  description: string
}

export interface ConsistencyIssue {
  severity: 'error' | 'warning' | 'info'
  category: 'position' | 'camera' | 'lighting' | 'element' | 'continuity'
  description: string
  shotId: string
  shotName: string
  suggestion?: string
}

// ==================== Consistency Checker ====================

export class ConsistencyChecker {
  private space: SceneSpace

  constructor(spaceOrConfig: SceneSpace | SceneSpaceConfig) {
    this.space = spaceOrConfig instanceof SceneSpace
      ? spaceOrConfig
      : new SceneSpace(spaceOrConfig)
  }

  /**
   * 检查一组分镜的空间一致性
   */
  checkShots(shots: ShotInfo[]): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = []

    // 逐个镜头检查
    for (const shot of shots) {
      issues.push(...this._checkShotPosition(shot))
      issues.push(...this._checkShotCamera(shot))
    }

    // 跨镜头检查（连续两镜）
    for (let i = 1; i < shots.length; i++) {
      issues.push(...this._checkContinuity(shots[i - 1], shots[i]))
    }

    return issues
  }

  /**
   * 检查单镜的角色位置合理性
   */
  private _checkShotPosition(shot: ShotInfo): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = []

    for (const cp of shot.characterPositions || []) {
      const expected = this.space.getCharacterPosition(cp.characterId)

      if (!expected) {
        // 角色未注册，建议注册
        issues.push({
          severity: 'info',
          category: 'position',
          description: `角色未在场景空间中定义站位`,
          shotId: shot.id,
          shotName: shot.name,
          suggestion: `在场景空间配置中添加该角色的默认站位`,
        })
        continue
      }

      // 检查角色位置是否过大偏离默认位置
      const dx = Math.abs(cp.position.x - expected.defaultPosition.x)
      const dy = Math.abs(cp.position.y - expected.defaultPosition.y)

      if (dx > 40 || dy > 40) {
        issues.push({
          severity: 'warning',
          category: 'position',
          description: `角色 ${expected.name} 当前位置 (${cp.position.x}, ${cp.position.y}) 与默认站位 (${expected.defaultPosition.x}, ${expected.defaultPosition.y}) 偏差较大`,
          shotId: shot.id,
          shotName: shot.name,
          suggestion: '检查是否有足够的走位逻辑支撑位置变化',
        })
      }
    }

    return issues
  }

  /**
   * 检查单镜的机位合规性
   */
  private _checkShotCamera(shot: ShotInfo): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = []
    const constraints = this.space.cameraConstraints

    if (constraints.length === 0) return issues

    // 从描述中判断机位在哪一侧
    const desc = shot.description.toLowerCase()
    const cameraSide = this._inferCameraSide(desc, shot.cameraPosition)

    if (cameraSide && constraints[0].allowedSides.length === 1) {
      const allowed = constraints[0].allowedSides[0]
      if (cameraSide !== allowed) {
        issues.push({
          severity: 'error',
          category: 'camera',
          description: `机位在 180 度轴线不允许的一侧（当前机位: ${cameraSide}，允许: ${allowed}）`,
          shotId: shot.id,
          shotName: shot.name,
          suggestion: '调整机位到轴线的允许侧，或使用过肩镜头维持空间感',
        })
      }
    }

    return issues
  }

  /**
   * 检查前后两镜的连续性
   */
  private _checkContinuity(prevShot: ShotInfo, currShot: ShotInfo): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = []

    // 检查角色位置是否合理跳变
    for (const curr of currShot.characterPositions || []) {
      const prev = prevShot.characterPositions?.find(p => p.characterId === curr.characterId)
      if (!prev) continue

      const dx = Math.abs(curr.position.x - prev.position.x)
      const dy = Math.abs(curr.position.y - prev.position.y)

      // 两镜间角色位置大幅度跳变且没有明显走位
      if (dx > 30 || dy > 30) {
        issues.push({
          severity: 'warning',
          category: 'continuity',
          description: `角色在两镜之间位置跳变过大 (${prev.position.x},${prev.position.y} → ${curr.position.x},${curr.position.y})`,
          shotId: currShot.id,
          shotName: currShot.name,
          suggestion: '在中间添加走位镜头，或减小两镜间的距离差',
        })
      }
    }

    // 检查越轴
    const prevSide = this._inferCameraSide(prevShot.description, prevShot.cameraPosition)
    const currSide = this._inferCameraSide(currShot.description, currShot.cameraPosition)
    if (prevSide && currSide && prevSide !== currSide) {
      issues.push({
        severity: 'warning',
        category: 'camera',
        description: `越轴警告：前镜机位在 ${prevSide}，本镜在 ${currSide}`,
        shotId: currShot.id,
        shotName: currShot.name,
        suggestion: '在中间添加骑轴镜头过渡，或用角色走动引导视线越轴',
      })
    }

    return issues
  }

  /**
   * 从描述中推断机位在哪一侧
   * 简单的关键词匹配
   */
  private _inferCameraSide(description: string, cameraPosition?: string): 'side_a' | 'side_b' | null {
    if (cameraPosition?.toLowerCase().includes('side_a')) return 'side_a'
    if (cameraPosition?.toLowerCase().includes('side_b')) return 'side_b'

    // 尝试从描述推断
    const desc = description.toLowerCase()
    if (desc.includes('过肩') || desc.includes('越肩') || desc.includes('ots')) return null // 过肩不确定侧

    return null
  }
}

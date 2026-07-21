/**
 * Skills API — Renderer-safe IPC wrapper
 *
 * 渲染进程通过 window.ipcRenderer.invoke 调用主进程的 skills 操作
 * 避免在渲染进程中直接引入 Node.js 模块（fs/path/electron）
 */

import type { SkillMeta } from './skills'

// ==================== IPC Invokers ====================

export async function scanSkillsIPC(): Promise<SkillMeta[]> {
  try {
    return await window.ipcRenderer.invoke('skills:scan')
  } catch {
    console.warn('[SkillsAPI] scanSkills failed (IPC not available)')
    return []
  }
}

export async function loadSkillIPC(id: string): Promise<string | null> {
  try {
    return await window.ipcRenderer.invoke('skills:load', id)
  } catch {
    console.warn('[SkillsAPI] loadSkill failed (IPC not available)')
    return null
  }
}

export async function saveSkillIPC(id: string, content: string): Promise<boolean> {
  try {
    return await window.ipcRenderer.invoke('skills:save', id, content)
  } catch {
    console.warn('[SkillsAPI] saveSkill failed (IPC not available)')
    return false
  }
}

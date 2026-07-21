/**
 * Skills System
 *
 * 统一 Skill 文件管理：扫描、加载、热重载
 * 所有 Skill 文件存放在 data/skills/ 目录下，用户可在设置中编辑
 *
 * 用法：
 *   const skills = scanSkills()
 *   const content = loadSkill('director_brain')
 *   watchSkills(() => { console.log('refresh') })
 */

import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

export interface SkillMeta {
  /** 唯一标识符，基于文件名（不含扩展名） */
  id: string
  /** 文件名（含扩展名） */
  filename: string
  /** 相对于 data/skills/ 的路径 */
  relativePath: string
  /** 磁盘绝对路径 */
  absolutePath: string
  /** 文件最后修改时间 */
  updatedAt: number
  /** 第一行 # 标题（如有） */
  title: string
  /** 所属分类（一级子目录名，如 "director_rules"、"story_skills"） */
  category: string
}

/**
 * 获取 Skill 目录的根路径
 */
export function getSkillsRoot(): string {
  // Electron 环境：app.getAppPath() / data/skills
  // 开发环境：process.cwd() / data/skills
  try {
    const base = app?.getAppPath?.() ?? process.cwd()
    return path.join(base, 'data', 'skills')
  } catch {
    return path.join(process.cwd(), 'data', 'skills')
  }
}

/**
 * 从文件名推断标题
 * 读取文件第一行 # 标题，如没有则用文件名
 */
function inferTitle(filePath: string, filename: string): string {
  try {
    const firstLine = fs.readFileSync(filePath, 'utf-8').split('\n')[0]
    const match = firstLine?.match(/^#\s+(.+)/)
    if (match) return match[1].trim()
  } catch { /* 静默 */ }
  // 文件名转可读标题
  return filename
    .replace(/\.md$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * 扫描 data/skills/ 下所有 .md 文件
 * 返回排序后的 Skill 元数据列表
 */
export function scanSkills(): SkillMeta[] {
  const root = getSkillsRoot()
  const results: SkillMeta[] = []

  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true })
    return results
  }

  function walk(dir: string, category: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // 递归子目录，用子目录名作为 category
        walk(fullPath, entry.name)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        const relativePath = path.relative(root, fullPath)
        const stat = fs.statSync(fullPath)
        results.push({
          id: relativePath.replace(/\.md$/i, '').replace(/\//g, ':'),
          filename: entry.name,
          relativePath,
          absolutePath: fullPath,
          updatedAt: stat.mtimeMs,
          title: inferTitle(fullPath, entry.name),
          category,
        })
      }
    }
  }

  walk(root, '')
  results.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  return results
}

/**
 * 加载指定 Skill 的完整内容
 * @param id Skill 标识符（如 "director_brain" 或 "director_rules:shot_grammar"）
 * @returns Markdown 文本内容
 */
export function loadSkill(id: string): string | null {
  const root = getSkillsRoot()
  // 支持两种 ID 格式：
  // 1. "director_brain" → 根目录下的文件
  // 2. "director_rules:shot_grammar" → 子目录下的文件
  const filePath = id.includes(':')
    ? path.join(root, ...id.split(':') as [string, string]) + '.md'
    : path.join(root, id + '.md')

  try {
    if (!fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

/**
 * 保存（覆盖）指定 Skill 的内容
 * @param id Skill 标识符
 * @param content Markdown 内容
 */
export function saveSkill(id: string, content: string): boolean {
  const root = getSkillsRoot()
  const filePath = id.includes(':')
    ? path.join(root, ...id.split(':') as [string, string]) + '.md'
    : path.join(root, id + '.md')

  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch {
    return false
  }
}

/**
 * 删除指定 Skill 文件
 * @param id Skill 标识符
 */
export function deleteSkill(id: string): boolean {
  const root = getSkillsRoot()
  const filePath = id.includes(':')
    ? path.join(root, ...id.split(':') as [string, string]) + '.md'
    : path.join(root, id + '.md')

  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    }
    return false
  } catch {
    return false
  }
}

/**
 * 文件监听器
 * 当 data/skills/ 下有文件变化时触发回调
 * 返回一个取消监听的函数
 */
export function watchSkills(callback: () => void): () => void {
  const root = getSkillsRoot()
  if (!fs.existsSync(root)) {
    fs.mkdirSync(root, { recursive: true })
    return () => {}
  }

  try {
    const watcher = fs.watch(root, { recursive: true }, (eventType, filename) => {
      if (filename && typeof filename === 'string' && filename.endsWith('.md')) {
        callback()
      }
    })
    return () => watcher.close()
  } catch {
    // macOS 上某些监听器可能失败，静默返回
    return () => {}
  }
}

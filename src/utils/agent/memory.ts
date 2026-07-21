/**
 * Memory System — 持久化 Agent 记忆
 *
 * 三层记忆体系（参考 Toonflow，不依赖外部队列/数据库）：
 *
 * 1. ShortTerm（短期）— 最近 N 条消息，完整保留
 * 2. Summary（摘要）— 每 M 条消息自动压缩摘要
 * 3. RAG（检索）— 关键词索引 + LLM 相关性排序
 *
 * 存储：localStorage / Electron fileStorage
 *
 * 用法：
 *   const mem = new Memory('director', 'project_123')
 *   await mem.add('user', '你好')
 *   const ctx = await mem.get('查询关键词')
 */

// ==================== Simple UUID ====================

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// ==================== Types ====================

export interface MemoryEntry {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createTime: number
  agentType: string
  isolationKey: string
  /** 是否已被归入摘要 */
  summarized?: boolean
}

export interface MemorySummary {
  id: string
  content: string
  keywords: string[]
  createTime: number
  agentType: string
  isolationKey: string
  /** 包含的消息 ID 范围 */
  messageRange: { from: number; to: number }
}

export interface MemoryContext {
  shortTerm: MemoryEntry[]
  summaries: MemorySummary[]
  rag: MemoryEntry[]
}

export interface MemoryConfig {
  /** 每累积多少条消息触发一次摘要 */
  messagesPerSummary: number
  /** 摘要最大字符数 */
  summaryMaxLength: number
  /** 返回的短期消息条数 */
  shortTermLimit: number
  /** 返回的摘要条数 */
  summaryLimit: number
  /** 关键词检索返回的消息条数 */
  ragLimit: number
}

const DEFAULTS: MemoryConfig = {
  messagesPerSummary: 5,
  summaryMaxLength: 500,
  shortTermLimit: 10,
  summaryLimit: 5,
  ragLimit: 3,
}

// ==================== Storage ====================

const STORAGE_PREFIX = 'sanling:memory:'

function getStorageKey(agentType: string, isolationKey: string): string {
  return `${STORAGE_PREFIX}${agentType}:${isolationKey}`
}

function loadData<T>(agentType: string, isolationKey: string): T[] {
  try {
    const key = getStorageKey(agentType, isolationKey)
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveData<T>(agentType: string, isolationKey: string, data: T[]) {
  try {
    const key = getStorageKey(agentType, isolationKey)
    localStorage.setItem(key, JSON.stringify(data))
  } catch (e) {
    console.warn('[Memory] save failed:', e)
  }
}

// ==================== Simple NLP Helpers ====================

/**
 * 简单中文/英文分词和关键词提取
 * 不需要外部依赖，用正则 + 停用词过滤
 */
const STOP_WORDS = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一',
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着',
  '没有', '看', '好', '自', '这', '他', '她', '它', '们', '那', '些',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'us',
  'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its',
  'they', 'them', 'their', 'what', 'which', 'who', 'whom', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'just', 'because', 'as', 'until', 'while',
  'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'and', 'but',
  'or', 'if', 'while',
])

function extractKeywords(text: string, maxCount: number = 10): string[] {
  const cleaned = text
    .replace(/[^\w\s\u4e00-\u9fff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

  // 提取中文词（单字过滤）和英文词（2+ chars）
  const tokens: string[] = []
  for (const token of cleaned.split(' ')) {
    const t = token.trim()
    if (!t || t.length < 2) continue
    if (STOP_WORDS.has(t)) continue
    tokens.push(t)
  }

  // 词频统计
  const freq = new Map<string, number>()
  for (const t of tokens) {
    freq.set(t, (freq.get(t) || 0) + 1)
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(([word]) => word)
}

/**
 * 计算两个关键词集合的 Jaccard 相似度
 * 用于判断检索相关性
 */
function keywordSimilarity(query: string[], doc: string[]): number {
  const qSet = new Set(query)
  const dSet = new Set(doc)
  let intersection = 0
  for (const k of qSet) {
    if (dSet.has(k)) intersection++
  }
  const union = new Set([...qSet, ...dSet]).size
  return union === 0 ? 0 : intersection / union
}

// ==================== Main Memory Class ====================

export class Memory {
  private agentType: string
  private isolationKey: string
  private config: MemoryConfig

  constructor(
    agentType: string,
    isolationKey: string,
    config?: Partial<MemoryConfig>,
  ) {
    this.agentType = agentType
    this.isolationKey = isolationKey
    this.config = { ...DEFAULTS, ...config }
  }

  /**
   * 添加一条消息到短期记忆
   */
  async add(
    role: 'user' | 'assistant' | 'system',
    content: string,
  ): Promise<void> {
    const entries = this._loadEntries()
    const entry: MemoryEntry = {
      id: generateId(),
      role,
      content,
      createTime: Date.now(),
      agentType: this.agentType,
      isolationKey: this.isolationKey,
      summarized: false,
    }
    entries.push(entry)
    this._saveEntries(entries)

    // 检查是否需要触发摘要
    const unsummarized = entries.filter(e => !e.summarized)
    if (unsummarized.length >= this.config.messagesPerSummary) {
      await this._generateSummary(unsummarized)
    }
  }

  /**
   * 获取记忆上下文（供 Agent prompt 使用）
   */
  async get(query: string): Promise<MemoryContext> {
    const entries = this._loadEntries()
    const summaries = this._loadSummaries()
    const queryKeywords = extractKeywords(query)

    // 短期：最近 N 条未摘要的消息
    const shortTerm = entries
      .filter(e => !e.summarized)
      .slice(-this.config.shortTermLimit)

    // 摘要：最新的 M 条
    const recentSummaries = summaries.slice(-this.config.summaryLimit)

    // RAG：关键词检索消息
    const scored = entries
      .filter(e => e.summarized) // 仅搜索已摘要的历史消息
      .map(e => ({
        entry: e,
        score: query.length > 0
          ? keywordSimilarity(queryKeywords, extractKeywords(e.content))
          : 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.ragLimit)
      .filter(item => item.score > 0.05)

    return {
      shortTerm,
      summaries: recentSummaries,
      rag: scored.map(s => s.entry),
    }
  }

  /**
   * 清空记忆
   */
  clear(): void {
    const key = getStorageKey(this.agentType, this.isolationKey)
    localStorage.removeItem(key)
    localStorage.removeItem(key + ':summaries')
  }

  /**
   * 获取所有指定类型的记忆隔离区
   */
  static getIsolationKeys(agentType: string): string[] {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(`${STORAGE_PREFIX}${agentType}:`)) {
        keys.push(key.slice(`${STORAGE_PREFIX}${agentType}:`.length))
      }
    }
    return keys
  }

  // ==================== Private ====================

  private _loadEntries(): MemoryEntry[] {
    return loadData<MemoryEntry>(this.agentType, this.isolationKey)
  }

  private _saveEntries(entries: MemoryEntry[]) {
    saveData(this.agentType, this.isolationKey, entries)
  }

  private _loadSummaries(): MemorySummary[] {
    return loadData<MemorySummary>(this.agentType, this.isolationKey + ':summaries')
  }

  private _saveSummaries(summaries: MemorySummary[]) {
    saveData(this.agentType, this.isolationKey + ':summaries', summaries)
  }

  /**
   * 将一批消息压缩为摘要
   * 实际使用中这里可以调 LLM，但目前用关键词提取 + 截断作为轻量方案
   */
  private async _generateSummary(entries: MemoryEntry[]): Promise<void> {
    const contentText = entries.map(e => `[${e.role}] ${e.content}`).join('\n')
    const keywords = extractKeywords(contentText, 20)

    const summary: MemorySummary = {
      id: generateId(),
      content: contentText.slice(0, this.config.summaryMaxLength),
      keywords,
      createTime: Date.now(),
      agentType: this.agentType,
      isolationKey: this.isolationKey,
      messageRange: {
        from: entries[0].createTime,
        to: entries[entries.length - 1].createTime,
      },
    }

    // 标记这些消息为已摘要
    const allEntries = this._loadEntries()
    const entryIds = new Set(entries.map(e => e.id))
    for (const entry of allEntries) {
      if (entryIds.has(entry.id)) {
        entry.summarized = true
      }
    }
    this._saveEntries(allEntries)

    // 保存摘要
    const summaries = this._loadSummaries()
    summaries.push(summary)
    this._saveSummaries(summaries)
  }

  /**
   * 提供给 Agent 的 tools，允许 Agent 在对话中读写记忆
   */
  getTools() {
    return {
      searchMemory: async ({ query }: { query: string }) => {
        const ctx = await this.get(query)
        return {
          shortTerm: ctx.shortTerm.map(e => `${e.role}: ${e.content}`).join('\n'),
          summaries: ctx.summaries.map(s => s.content).join('\n---\n'),
          relevantHistory: ctx.rag.map(e => `${e.role}: ${e.content}`).join('\n'),
        }
      },
      clearMemory: async () => {
        this.clear()
        return '记忆已清空'
      },
    }
  }
}

// ==================== Memory Stats ====================

export interface MemoryStats {
  agentType: string
  isolationKey: string
  messageCount: number
  summaryCount: number
  summarizedRatio: number
  totalSize: number
}

/**
 * 获取所有记忆的统计信息
 */
export function getAllMemoryStats(): MemoryStats[] {
  const allAgents = new Set<string>()

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      const rest = key.slice(STORAGE_PREFIX.length)
      const agentType = rest.split(':')[0]
      if (agentType) allAgents.add(agentType)
    }
  }

  const stats: MemoryStats[] = []

  for (const agentType of allAgents) {
    const keys = Memory.getIsolationKeys(agentType)
    for (const isolationKey of keys) {
      const entries = loadData<MemoryEntry>(agentType, isolationKey)
      const summaries = loadData<MemorySummary>(agentType, isolationKey + ':summaries')
      const totalSize = new Blob([JSON.stringify(entries), JSON.stringify(summaries)]).size

      stats.push({
        agentType,
        isolationKey: isolationKey.length > 20
          ? isolationKey.slice(0, 20) + '...'
          : isolationKey,
        messageCount: entries.length,
        summaryCount: summaries.length,
        summarizedRatio: entries.length > 0
          ? entries.filter(e => e.summarized).length / entries.length
          : 0,
        totalSize,
      })
    }
  }

  return stats
}

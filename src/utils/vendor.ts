/**
 * Vendor System — 可编程供应商系统
 *
 * 允许用户在 APP 内编写 TypeScript 代码定义自定义供应商，
 * 使用 esbuild 实时编译，无需改源码、无需重启。
 *
 * 供应商定义暴露三个核心方法：text(), image(), video()
 * 系统调用时自动根据功能路由到对应方法。
 *
 * 用法：
 *   const vendor = new VendorEngine(configCode)
 *   await vendor.initialize()
 *   const result = await vendor.call('text', { model, messages })
 */

import * as esbuild from 'esbuild'

// ==================== Types ====================

export interface VendorModel {
  id: string
  name: string
  type: 'text' | 'image' | 'video' | 'audio'
  /** 模型能力标签 */
  capabilities: string[]
  /** 支持的输入模式（视频/图片生成用） */
  modes?: string[]
  /** 上下文长度（文本模型） */
  contextLimit?: number
  /** 输入价格（每M token/每张图） */
  inputPrice?: number
  /** 输出价格 */
  outputPrice?: number
}

export interface VendorConfig {
  id: string
  name: string
  description?: string
  /** 供应商基 URL */
  baseUrl?: string
  /** 用户定义的模型列表 */
  models: VendorModel[]
  /** TypeScript 源码（用户写的可执行逻辑） */
  sourceCode: string
  /** 是否启用 */
  enabled: boolean
}

export interface VendorCallParams {
  model: string
  messages?: { role: string; content: string | any[] }[]
  prompt?: string
  image?: string
  video?: string
  options?: Record<string, any>
  abortSignal?: AbortSignal
}

export interface VendorCallResult {
  text?: string
  image?: string
  video?: string
  audio?: string
  usage?: { inputTokens?: number; outputTokens?: number }
  duration?: number
  error?: string
}

/** 编译后的供应商沙箱接口 */
export interface CompiledVendor {
  name: string
  models: VendorModel[]
  text(params: VendorCallParams): Promise<VendorCallResult>
  image(params: VendorCallParams): Promise<VendorCallResult>
  video(params: VendorCallParams): Promise<VendorCallResult>
  audio?(params: VendorCallParams): Promise<VendorCallResult>
}

// ==================== 默认模板 ====================

export const DEFAULT_VENDOR_TEMPLATE = `/**
 * 自定义供应商
 *
 * 暴露三个方法：text(), image(), video()，分别处理文本/图片/视频请求。
 * 每个方法接收 { model, messages, prompt, image, video, options, abortSignal }
 * 返回 { text, image, video, usage }。
 *
 * options 包含用户设置的额外参数（如分辨率、风格等）。
 */

const API_KEY = options?.apiKey || process.env.VENDOR_API_KEY || ''
const BASE_URL = options?.baseUrl || 'https://api.example.com/v1'

export async function text({ model, messages, options, abortSignal }: {
  model: string
  messages?: { role: string; content: string }[]
  options?: Record<string, any>
  abortSignal?: AbortSignal
}) {
  const response = await fetch(\`\${BASE_URL}/chat/completions\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${API_KEY}\`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options?.maxTokens || 4096,
    }),
    signal: abortSignal,
  })
  const data = await response.json()
  return {
    text: data.choices?.[0]?.message?.content || '',
    usage: { inputTokens: data.usage?.prompt_tokens, outputTokens: data.usage?.completion_tokens },
  }
}

export async function image({ model, prompt, options, abortSignal }: {
  model: string
  prompt?: string
  options?: Record<string, any>
  abortSignal?: AbortSignal
}) {
  const response = await fetch(\`\${BASE_URL}/images/generations\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${API_KEY}\`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: options?.n || 1,
      size: options?.size || '1024x1024',
    }),
    signal: abortSignal,
  })
  const data = await response.json()
  return { image: data.data?.[0]?.url || '' }
}

export async function video({ model, prompt, image, options, abortSignal }: {
  model: string
  prompt?: string
  image?: string
  options?: Record<string, any>
  abortSignal?: AbortSignal
}) {
  // 默认为 OpenAI 兼容格式，用户按需修改
  return { error: 'video generation not implemented in this vendor' }
}
`

// ==================== Core Engine ====================

/**
 * 供应商沙箱执行器
 * 编译 TypeScript 源码，加载到一个隔离的作用域中执行
 */
export class VendorEngine {
  private config: VendorConfig
  private compiled: CompiledVendor | null = null
  private _initialized = false

  constructor(config: VendorConfig) {
    this.config = config
  }

  get isInitialized() { return this._initialized }
  get models() { return this.config.models }
  get name() { return this.config.name }

  /**
   * 编译并初始化供应商
   */
  async initialize(): Promise<void> {
    if (!this.config.sourceCode?.trim()) {
      throw new Error(`供应商 ${this.config.name} 未提供源码`)
    }

    try {
      // 使用 esbuild 实时编译 TypeScript → JavaScript
      const result = await esbuild.transform(this.config.sourceCode, {
        loader: 'ts',
        format: 'cjs',
        target: 'es2020',
      })
      const jsCode = result.code

      // 在沙箱中执行
      // 使用 Function 构造函数创建作用域（不是 eval，但 Electron 环境下可接受）
      const sandbox = new (Function as any)(
        'exports',
        'fetch',
        'console',
        'process',
        jsCode + '\nreturn exports'
      )

      const exports: Record<string, Function> = {}
      const ctx = sandbox(exports, fetch, console, process)

      // 验证接口
      const vendor: CompiledVendor = {
        name: this.config.name,
        models: this.config.models,
        text: ctx.text || ctx.default?.text || (async () => ({ error: 'text() not implemented' })),
        image: ctx.image || ctx.default?.image || (async () => ({ error: 'image() not implemented' })),
        video: ctx.video || ctx.default?.video || (async () => ({ error: 'video() not implemented' })),
        audio: ctx.audio || ctx.default?.audio,
      }

      this.compiled = vendor
      this._initialized = true
    } catch (err) {
      this._initialized = false
      throw new Error(`供应商 ${this.config.name} 编译失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  /**
   * 调用供应商
   */
  async call(type: 'text' | 'image' | 'video' | 'audio', params: VendorCallParams): Promise<VendorCallResult> {
    if (!this._initialized || !this.compiled) {
      throw new Error(`供应商 ${this.config.name} 未初始化`)
    }

    const start = performance.now()

    try {
      let result: VendorCallResult

      switch (type) {
        case 'text':
          result = await this.compiled.text(params)
          break
        case 'image':
          result = await this.compiled.image(params)
          break
        case 'video':
          result = await this.compiled.video(params)
          break
        case 'audio':
          result = this.compiled.audio
            ? await this.compiled.audio(params)
            : { error: 'audio() not implemented' }
          break
        default:
          result = { error: `unsupported call type: ${type}` }
      }

      result.duration = performance.now() - start
      return result
    } catch (err) {
      return {
        error: `供应商 ${this.config.name} 调用失败: ${err instanceof Error ? err.message : String(err)}`,
        duration: performance.now() - start,
      }
    }
  }

  /**
   * 获取编译后的源码（调试用）
   */
  getCompiledCode(): string | null {
    if (!this.config.sourceCode) return null
    try {
      // 同步编译保底方案
      const jsCode = esbuild.transformSync(this.config.sourceCode, {
        loader: 'ts',
        format: 'cjs',
        target: 'es2020',
      }).code
      return jsCode
    } catch {
      return null
    }
  }
}

// ==================== Registry ====================

/**
 * 全局供应商注册中心
 * 管理所有已注册的可编程供应商
 */
class VendorRegistry {
  private vendors: Map<string, VendorEngine> = new Map()

  /**
   * 注册一个供应商
   */
  register(config: VendorConfig): VendorEngine {
    if (this.vendors.has(config.id)) {
      throw new Error(`供应商 ${config.id} 已存在`)
    }
    const engine = new VendorEngine(config)
    this.vendors.set(config.id, engine)
    return engine
  }

  /**
   * 获取供应商
   */
  get(id: string): VendorEngine | undefined {
    return this.vendors.get(id)
  }

  /**
   * 获取所有供应商
   */
  getAll(): VendorEngine[] {
    return Array.from(this.vendors.values())
  }

  /**
   * 获取所有已初始化的供应商
   */
  getActive(): VendorEngine[] {
    return this.getAll().filter(v => v.isInitialized)
  }

  /**
   * 删除供应商
   */
  unregister(id: string): boolean {
    return this.vendors.delete(id)
  }

  /**
   * 初始化所有已注册的供应商
   */
  async initializeAll(): Promise<{ success: string[]; failed: { id: string; error: string }[] }> {
    const result: { success: string[]; failed: { id: string; error: string }[] } = {
      success: [],
      failed: [],
    }

    for (const [id, engine] of this.vendors) {
      try {
        await engine.initialize()
        result.success.push(id)
      } catch (err) {
        result.failed.push({ id, error: err instanceof Error ? err.message : String(err) })
      }
    }

    return result
  }
}

/** 全局单例 */
export const vendorRegistry = new VendorRegistry()

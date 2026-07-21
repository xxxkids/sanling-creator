/**
 * VendorConfigPanel
 *
 * 设置面板中的「供应商配置」板块
 * - 编辑 TypeScript 供应商定义
 * - 查看编译后的模型列表
 * - 测试调用供应商 API
 * - 保存到 localStorage
 */

import { useState, useEffect, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Code,
  Save,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  VendorEngine,
  VendorConfig,
  VendorCallResult,
  DEFAULT_VENDOR_TEMPLATE,
  vendorRegistry,
  type VendorModel,
} from '@/utils/vendor'

const STORAGE_KEY = 'sanling:vendor-configs'

function loadConfigs(): VendorConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveConfigs(configs: VendorConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
}

export function VendorConfigPanel() {
  const [configs, setConfigs] = useState<VendorConfig[]>(loadConfigs)
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [code, setCode] = useState('')
  const [editedCode, setEditedCode] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [isCompiling, setIsCompiling] = useState(false)
  const [compileError, setCompileError] = useState<string | null>(null)
  const [compiledEngines, setCompiledEngines] = useState<Map<number, VendorEngine>>(new Map())
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const selected = configs[selectedIndex]

  // 选中变化时加载代码
  useEffect(() => {
    if (selected) {
      setCode(selected.sourceCode)
      setEditedCode(selected.sourceCode)
      setIsDirty(false)
      setCompileError(null)
      setTestResult(null)
    }
  }, [selectedIndex, configs])

  // 添加新供应商
  const handleAdd = () => {
    const newConfig: VendorConfig = {
      id: `vendor_${Date.now()}`,
      name: '新供应商',
      description: '自定义供应商',
      models: [
        { id: 'default', name: 'Default', type: 'text', capabilities: ['text'] },
      ],
      sourceCode: DEFAULT_VENDOR_TEMPLATE,
      enabled: true,
    }
    const updated = [...configs, newConfig]
    setConfigs(updated)
    setSelectedIndex(updated.length - 1)
    saveConfigs(updated)
    toast.success('已添加新供应商')
  }

  // 删除供应商
  const handleDelete = () => {
    if (!selected) return
    if (!window.confirm(`确认删除供应商「${selected.name}」？`)) return
    const updated = configs.filter((_, i) => i !== selectedIndex)
    setConfigs(updated)
    setSelectedIndex(Math.min(selectedIndex, updated.length - 1))
    saveConfigs(updated)
    vendorRegistry.unregister(selected.id)
    toast.success('已删除')
  }

  // 保存代码
  const handleSave = () => {
    if (!selected) return
    const updated = [...configs]
    updated[selectedIndex] = { ...selected, sourceCode: editedCode }
    setConfigs(updated)
    setCode(editedCode)
    setIsDirty(false)
    saveConfigs(updated)
    // 重新注册
    compileVendor(updated[selectedIndex])
    toast.success('已保存')
  }

  // 编译并注册
  const compileVendor = useCallback(async (config: VendorConfig) => {
    setIsCompiling(true)
    setCompileError(null)

    try {
      const engine = new VendorEngine(config)
      await engine.initialize()

      // 注册到全局注册中心
      vendorRegistry.register(config)

      setCompiledEngines(prev => {
        const next = new Map(prev)
        next.set(configs.indexOf(config), engine)
        return next
      })
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsCompiling(false)
    }
  }, [configs])

  // 测试调用
  const handleTest = async () => {
    if (!selected) return
    setTestResult(null)
    setIsTesting(true)

    try {
      // 先编译
      const engine = new VendorEngine(selected)
      await engine.initialize()

      const result = await engine.call('text', {
        model: selected.models[0]?.id || 'default',
        messages: [{ role: 'user', content: 'Hello, say "ok" and nothing else.' }],
      })

      if (result.error) {
        setTestResult(`❌ ${result.error}`)
      } else {
        setTestResult(`✅ 响应: ${result.text?.slice(0, 200)}\n⏱ ${result.duration?.toFixed(0)}ms`)
      }
    } catch (err) {
      setTestResult(`❌ ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsTesting(false)
    }
  }

  // 更新供应商元数据
  const handleUpdateMeta = (field: keyof VendorConfig, value: any) => {
    if (!selected) return
    const updated = [...configs]
    updated[selectedIndex] = { ...selected, [field]: value }
    setConfigs(updated)
    saveConfigs(updated)
  }

  return (
    <div className="flex h-full">
      {/* 左侧：供应商列表 */}
      <div className="w-64 border-r border-border flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-border">
          <Button variant="outline" size="sm" className="w-full" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            新增供应商
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {configs.map((cfg, i) => (
              <button
                key={cfg.id}
                onClick={() => setSelectedIndex(i)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                  i === selectedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-muted'
                }`}
              >
                <Code className="h-4 w-4 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{cfg.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {cfg.models.length} 个模型 · {cfg.enabled ? '启用' : '禁用'}
                  </div>
                </div>
              </button>
            ))}
            {configs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                暂无自定义供应商
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 右侧：编辑区 */}
      <div className="flex-1 flex flex-col">
        {selected ? (
          <>
            {/* 工具栏 */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <Input
                  value={selected.name}
                  onChange={e => handleUpdateMeta('name', e.target.value)}
                  className="h-8 w-40 text-sm font-medium bg-transparent border-0 focus:border focus:border-input"
                />
                <Input
                  value={selected.description || ''}
                  onChange={e => handleUpdateMeta('description', e.target.value)}
                  className="h-8 w-56 text-xs text-muted-foreground bg-transparent border-0 focus:border focus:border-input"
                  placeholder="描述"
                />
              </div>
              <div className="flex items-center gap-2">
                {compileError && (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    编译错误
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTest}
                  disabled={isTesting || isCompiling}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  测试
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!isDirty}
                >
                  <Save className="h-4 w-4 mr-1" />
                  保存
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 主编辑区：代码编辑器 + 信息面板 */}
            <div className="flex-1 flex">
              {/* 代码编辑器 */}
              <ScrollArea className="flex-1 border-r border-border">
                <textarea
                  value={editedCode}
                  onChange={e => {
                    setEditedCode(e.target.value)
                    setIsDirty(e.target.value !== code)
                    setCompileError(null)
                  }}
                  className="w-full h-full p-4 font-mono text-sm bg-transparent resize-none focus:outline-none"
                  spellCheck={false}
                  placeholder="// 在此编写 TypeScript 供应商代码..."
                />
              </ScrollArea>

              {/* 右侧信息面板 */}
              <div className="w-72 flex-shrink-0 flex flex-col">
                {/* 模型列表 */}
                <div className="p-3 border-b border-border">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">模型列表</h4>
                  <div className="space-y-2">
                    {selected.models.map((model, mi) => (
                      <div key={model.id} className="text-xs p-2 bg-muted rounded">
                        <div className="font-medium">{model.name}</div>
                        <div className="text-muted-foreground">{model.type} · {model.capabilities.join(', ')}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 状态信息 */}
                <div className="p-3 border-b border-border">
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">状态</h4>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      {isCompiling ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : compileError ? (
                        <AlertCircle className="h-3 w-3 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                      )}
                      <span>{compileError ? '编译失败' : isCompiling ? '编译中...' : '就绪'}</span>
                    </div>
                    {compileError && (
                      <div className="mt-2 p-2 bg-destructive/10 text-destructive rounded text-xs whitespace-pre-wrap">
                        {compileError}
                      </div>
                    )}
                  </div>
                </div>

                {/* 测试结果 */}
                {testResult && (
                  <div className="p-3 flex-1">
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">测试结果</h4>
                    <div className="text-xs whitespace-pre-wrap font-mono bg-muted p-2 rounded">
                      {testResult}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Code className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">自定义供应商</p>
              <p className="text-xs mt-1">
                编写 TypeScript 代码定义自己的 AI 供应商
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                开始创建
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * SkillsPanel
 *
 * 设置面板中的「提示词管理」板块
 * - 浏览所有 Skill 文件
 * - 查看/编辑 Markdown 内容
 * - 实时保存
 *
 * 通过 IPC 调用主进程的 Skills 操作（fs/path/electron 仅在主进程可用）
 */

import { useState, useEffect, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BookOpen, FileText, Save, RotateCcw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { scanSkillsIPC, loadSkillIPC, saveSkillIPC } from '@/utils/skills-api'
import type { SkillMeta } from '@/utils/skills'

export function SkillsPanel() {
  const [skills, setSkills] = useState<SkillMeta[]>([])
  const [selectedSkill, setSelectedSkill] = useState<SkillMeta | null>(null)
  const [content, setContent] = useState<string>('')
  const [originalContent, setOriginalContent] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(true)

  // 刷新 Skill 列表（异步 IPC）
  const refreshSkills = useCallback(async () => {
    try {
      setIsLoading(true)
      const list = await scanSkillsIPC()
      setSkills(list)
    } catch (err) {
      console.error('[SkillsPanel] refresh failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 初始化
  useEffect(() => {
    refreshSkills()
  }, [refreshSkills])

  // 选中一个 Skill
  const handleSelect = async (skill: SkillMeta) => {
    if (isDirty) {
      const confirm = window.confirm('有未保存的修改，确定切换吗？')
      if (!confirm) return
    }
    setIsDirty(false)
    setSelectedSkill(skill)
    try {
      const text = await loadSkillIPC(skill.id)
      setContent(text ?? '')
      setOriginalContent(text ?? '')
    } catch {
      setContent('# 加载失败')
      setOriginalContent('# 加载失败')
    }
  }

  // 保存
  const handleSave = async () => {
    if (!selectedSkill) return
    try {
      const ok = await saveSkillIPC(selectedSkill.id, content)
      if (ok) {
        setOriginalContent(content)
        setIsDirty(false)
        toast.success('已保存')
      } else {
        toast.error('保存失败')
      }
    } catch {
      toast.error('保存失败（IPC 错误）')
    }
  }

  // 内容变更
  const handleContentChange = (val: string) => {
    setContent(val)
    setIsDirty(val !== originalContent)
  }

  // 过滤后的分类列表
  const categories = Array.from(new Set(skills.map(s => s.category || '未分类')))
  const filteredSkills = skills.filter(s => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false
    if (searchQuery && !s.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex h-full">
      {/* 左侧列表 */}
      <div className="w-64 border-r border-border flex flex-col">
        <div className="p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索提示词..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9 text-xs"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-2 py-0.5 text-xs rounded ${categoryFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
            >
              全部
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-0.5 text-xs rounded ${categoryFilter === cat ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
              >
                {cat || '未分类'}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={refreshSkills} disabled={isLoading}>
            <RotateCcw className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-0.5 px-2 pb-3">
            {filteredSkills.map(skill => (
              <button
                key={skill.id}
                onClick={() => handleSelect(skill)}
                className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                  selectedSkill?.id === skill.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate">{skill.title}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 pl-5">
                  {skill.relativePath}
                </div>
              </button>
            ))}
            {!isLoading && filteredSkills.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-8">
                {searchQuery ? '没有匹配的结果' : '暂无提示词文件'}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 右侧编辑器 */}
      <div className="flex-1 flex flex-col">
        {selectedSkill ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{selectedSkill.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {selectedSkill.category || '未分类'}
                </Badge>
                {isDirty && (
                  <Badge variant="secondary" className="text-[10px] bg-orange-100 text-orange-600">
                    未保存
                  </Badge>
                )}
              </div>
              <Button size="sm" onClick={handleSave} disabled={!isDirty}>
                <Save className="h-3 w-3 mr-1" />
                保存
              </Button>
            </div>
            <div className="flex-1 p-0">
              <textarea
                value={content}
                onChange={e => handleContentChange(e.target.value)}
                className="w-full h-full bg-transparent border-0 p-4 text-sm font-mono resize-none focus:outline-none"
                spellCheck={false}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            <div className="text-center space-y-2">
              <BookOpen className="h-12 w-12 mx-auto opacity-20" />
              <p>选择一个提示词文件查看或编辑</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
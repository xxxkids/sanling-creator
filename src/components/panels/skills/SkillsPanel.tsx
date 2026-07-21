/**
 * SkillsPanel
 *
 * 设置面板中的「提示词管理」板块
 * - 浏览所有 Skill 文件
 * - 查看/编辑 Markdown 内容
 * - 实时保存，自动热重载
 */

import { useState, useEffect, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BookOpen, FileText, Save, RotateCcw, Search } from 'lucide-react'
import { scanSkills, loadSkill, saveSkill, watchSkills, type SkillMeta } from '@/utils/skills'
import { toast } from 'sonner'

export function SkillsPanel() {
  const [skills, setSkills] = useState<SkillMeta[]>([])
  const [selectedSkill, setSelectedSkill] = useState<SkillMeta | null>(null)
  const [content, setContent] = useState<string>('')
  const [originalContent, setOriginalContent] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // 刷新 Skill 列表
  const refreshSkills = useCallback(() => {
    const list = scanSkills()
    setSkills(list)
  }, [])

  // 初始化 + 文件监听
  useEffect(() => {
    refreshSkills()
    const unwatch = watchSkills(() => {
      refreshSkills()
      // 如果当前选中的文件被外部修改，重新加载
      if (selectedSkill) {
        const fresh = loadSkill(selectedSkill.id)
        if (fresh !== null && fresh !== originalContent) {
          setContent(fresh)
          setOriginalContent(fresh)
        }
      }
    })
    return unwatch
  }, [refreshSkills, selectedSkill, originalContent])

  // 选中一个 Skill
  const handleSelect = (skill: SkillMeta) => {
    if (isDirty) {
      const confirmed = window.confirm('当前编辑内容未保存，是否放弃？')
      if (!confirmed) return
    }
    const text = loadSkill(skill.id)
    if (text !== null) {
      setSelectedSkill(skill)
      setContent(text)
      setOriginalContent(text)
      setIsDirty(false)
    } else {
      toast.error('无法加载文件')
    }
  }

  // 保存
  const handleSave = () => {
    if (!selectedSkill) return
    const ok = saveSkill(selectedSkill.id, content)
    if (ok) {
      setOriginalContent(content)
      setIsDirty(false)
      toast.success(`已保存: ${selectedSkill.title}`)
    } else {
      toast.error('保存失败')
    }
  }

  // 重置到原始内容
  const handleReset = () => {
    setContent(originalContent)
    setIsDirty(false)
  }

  // 分类
  const categories = ['all', ...new Set(skills.map(s => s.category).filter(Boolean))] as string[]

  // 过滤
  const filtered = skills.filter(s => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="flex h-full">
      {/* 左侧：Skill 列表 */}
      <div className="w-72 border-r border-border flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-border space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索提示词..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-xs px-2 py-1 rounded ${
                  categoryFilter === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {cat === 'all' ? '全部' : cat === 'director_rules' ? '导演规则' : cat}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filtered.map(skill => (
              <button
                key={skill.id}
                onClick={() => handleSelect(skill)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors ${
                  selectedSkill?.id === skill.id
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                }`}
              >
                <FileText className="h-4 w-4 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{skill.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {skill.relativePath}
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                {searchQuery ? '没有匹配的提示词文件' : '暂无提示词文件'}
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            共 {skills.length} 个提示词文件
          </p>
        </div>
      </div>

      {/* 右侧：编辑区 */}
      <div className="flex-1 flex flex-col">
        {selectedSkill ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{selectedSkill.title}</span>
                {isDirty && (
                  <span className="text-xs text-amber-500 font-medium">● 已修改</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={!isDirty}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  重置
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!isDirty}
                >
                  <Save className="h-4 w-4 mr-1" />
                  保存
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <textarea
                value={content}
                onChange={e => {
                  setContent(e.target.value)
                  setIsDirty(e.target.value !== originalContent)
                }}
                className="w-full h-full p-4 font-mono text-sm bg-transparent resize-none focus:outline-none"
                spellCheck={false}
              />
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">选择左侧提示词文件查看和编辑</p>
              <p className="text-xs mt-1">
                修改后点击保存，系统自动热重载
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

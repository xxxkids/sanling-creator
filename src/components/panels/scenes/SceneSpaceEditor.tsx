/**
 * SceneSpaceEditor — 场景空间配置 UI
 *
 * 嵌入在场景详情面板中，管理该场景的空间布局。
 * 不单独开设置Tab，而是在用户编辑场景的地方就地编辑。
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Grid3x3,
  Lightbulb,
  Camera,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  SceneSpace,
  createDefaultSceneSpace,
  type SceneSpaceConfig,
  type Zone,
  type CharacterPosition,
  type LightSource,
  type CameraConstraint,
  type Point,
} from '@/utils/scene/sceneSpace'
import { useSceneStore, type Scene } from '@/stores/scene-store'

interface SceneSpaceEditorProps {
  scene: Scene | null
}

export function SceneSpaceEditor({ scene }: SceneSpaceEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [space, setSpace] = useState<SceneSpace | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const { updateScene } = useSceneStore()

  // 加载/初始化场景空间
  useEffect(() => {
    if (!scene) {
      setSpace(null)
      return
    }

    const existing = SceneSpace.load(scene.id)
    if (existing) {
      setSpace(existing)
    } else {
      // 首次：从场景信息创建默认
      const config = createDefaultSceneSpace(scene.id, scene.name, scene.location)
      const newSpace = new SceneSpace(config)
      newSpace.save()
      setSpace(newSpace)
    }
  }, [scene?.id])

  if (!scene || !space) return null

  // 保存
  const handleSave = () => {
    const validation = space.validate()
    if (validation.length > 0) {
      setErrors(validation)
      toast.error(`空间配置有 ${validation.length} 个问题`)
      return
    }
    setErrors([])
    space.save()
    toast.success('场景空间已保存')
  }

  // 添加区域
  const handleAddZone = () => {
    const config = space.toJSON
    config.layout.keyZones.push({
      id: `zone_${Date.now()}`,
      name: '新区域',
      type: 'furniture',
      position: { x: 50, y: 50 },
    })
    config.updatedAt = Date.now()
    const updated = new SceneSpace(config)
    updated.save()
    setSpace(updated)
  }

  // 更新区域
  const handleZoneChange = (index: number, field: keyof Zone, value: any) => {
    const config = space.toJSON
    if (field === 'position') {
      config.layout.keyZones[index].position = value as Point
    } else {
      (config.layout.keyZones[index] as any)[field] = value
    }
    config.updatedAt = Date.now()
    const updated = new SceneSpace(config)
    updated.save()
    setSpace(updated)
  }

  // 删除区域
  const handleDeleteZone = (index: number) => {
    const config = space.toJSON
    config.layout.keyZones.splice(index, 1)
    config.updatedAt = Date.now()
    const updated = new SceneSpace(config)
    updated.save()
    setSpace(updated)
  }

  // 添加角色站位
  const handleAddPosition = () => {
    const config = space.toJSON
    config.characterPositions.push({
      characterId: `char_${Date.now()}`,
      name: '新角色',
      defaultPosition: { x: 50, y: 50 },
      defaultOrientation: 'facing_camera',
    })
    config.updatedAt = Date.now()
    const updated = new SceneSpace(config)
    updated.save()
    setSpace(updated)
  }

  // 生成布局描述文本（用于分镜）
  const handleCopyLayout = () => {
    const desc = space.getLayoutDescription()
    navigator.clipboard.writeText(desc)
    toast.success('布局描述已复制')
  }

  return (
    <div className="mt-4 border border-border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          <Grid3x3 className="h-4 w-4" />
          场景空间
        </div>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4">
          {/* 空间类型 */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">空间类型</Label>
              <select
                value={space.layout.type}
                onChange={e => {
                  const config = space.toJSON
                  config.layout.type = e.target.value as any
                  config.updatedAt = Date.now()
                  const updated = new SceneSpace(config)
                  updated.save()
                  setSpace(updated)
                }}
                className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm"
              >
                <option value="indoor">室内</option>
                <option value="outdoor">室外</option>
                <option value="abstract">抽象</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">尺寸描述</Label>
              <Input
                value={space.layout.dimensions || ''}
                onChange={e => {
                  const config = space.toJSON
                  config.layout.dimensions = e.target.value
                  config.updatedAt = Date.now()
                  setSpace(new SceneSpace(config))
                }}
                placeholder="如：约30平米"
                className="h-9"
              />
            </div>
          </div>

          {/* 区域列表 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground">
                关键区域（{space.layout.keyZones.length}）
              </Label>
              <Button variant="ghost" size="sm" onClick={handleAddZone}>
                <Plus className="h-3 w-3 mr-1" /> 添加
              </Button>
            </div>
            <div className="space-y-2">
              {space.layout.keyZones.map((zone, i) => (
                <div key={zone.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                  <Input
                    value={zone.name}
                    onChange={e => handleZoneChange(i, 'name', e.target.value)}
                    className="h-8 w-24 text-xs"
                  />
                  <select
                    value={zone.type}
                    onChange={e => handleZoneChange(i, 'type', e.target.value)}
                    className="h-8 px-2 text-xs rounded border border-input bg-transparent"
                  >
                    <option value="entrance">入口</option>
                    <option value="window">窗</option>
                    <option value="furniture">家具</option>
                    <option value="structural">结构</option>
                    <option value="prop">道具</option>
                  </select>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    ({zone.position.x}%, {zone.position.y}%)
                  </span>
                  <Input
                    type="number"
                    value={zone.position.x}
                    onChange={e => handleZoneChange(i, 'position', { ...zone.position, x: Number(e.target.value) })}
                    className="h-8 w-16 text-xs"
                    min={0}
                    max={100}
                    placeholder="X"
                  />
                  <Input
                    type="number"
                    value={zone.position.y}
                    onChange={e => handleZoneChange(i, 'position', { ...zone.position, y: Number(e.target.value) })}
                    className="h-8 w-16 text-xs"
                    min={0}
                    max={100}
                    placeholder="Y"
                  />
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteZone(i)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* 角色站位 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" /> 角色站位
              </Label>
              <Button variant="ghost" size="sm" onClick={handleAddPosition}>
                <Plus className="h-3 w-3 mr-1" /> 添加
              </Button>
            </div>
            <div className="space-y-2">
              {space.characterPositions.map((pos, i) => (
                <div key={pos.characterId} className="flex items-center gap-2 p-2 bg-muted rounded">
                  <Input
                    value={pos.name}
                    onChange={e => {
                      const config = space.toJSON
                      config.characterPositions[i].name = e.target.value
                      config.updatedAt = Date.now()
                      setSpace(new SceneSpace(config))
                    }}
                    className="h-8 w-20 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">
                    ({pos.defaultPosition.x}%, {pos.defaultPosition.y}%)
                  </span>
                  <select
                    value={pos.defaultOrientation}
                    onChange={e => {
                      const config = space.toJSON
                      config.characterPositions[i].defaultOrientation = e.target.value as any
                      config.updatedAt = Date.now()
                      setSpace(new SceneSpace(config))
                    }}
                    className="h-8 px-2 text-xs rounded border border-input bg-transparent"
                  >
                    <option value="facing_camera">面向镜头</option>
                    <option value="facing_left">面左</option>
                    <option value="facing_right">面右</option>
                    <option value="facing_away">背对</option>
                    <option value="profile">侧脸</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* 错误信息 */}
          {errors.length > 0 && (
            <div className="p-2 bg-destructive/10 rounded text-xs text-destructive">
              {errors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>
              保存空间配置
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopyLayout}>
              复制布局描述
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// 语音板块 — 角色配音管理 + 批量 TTS 生成

import { useState } from "react";
import { useScriptStore } from "@/stores/script-store";
import { useVoiceStore, DEFAULT_VOICE_PRESETS, type VoicePreset } from "@/stores/voice-store";
import { useCharacterLibraryStore } from "@/stores/character-library-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Mic,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Volume2,
  Users,
} from "lucide-react";

// ==================== Component ====================

export function VoiceView() {
  const activeProjectId = useScriptStore((s) => s.activeProjectId);
  const characters = useCharacterLibraryStore((s) => s.characters);
  const voiceStore = useVoiceStore();

  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);

  if (!activeProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        请先打开一个项目
      </div>
    );
  }

  voiceStore.ensureProject(activeProjectId);
  const project = voiceStore.projects[activeProjectId];
  const dialogues = project?.dialogues ?? [];
  const profiles = project?.profiles ?? [];

  const completedCount = dialogues.filter((d) => d.status === "completed").length;
  const pendingCount = dialogues.filter((d) => d.status === "idle").length;
  const generatingCount = dialogues.filter((d) => d.status === "generating").length;

  const handleAssignVoice = (characterId: string, characterName: string, preset: VoicePreset) => {
    voiceStore.setVoiceProfile(activeProjectId, {
      id: `vp_${characterId}`,
      characterId,
      characterName,
      voiceId: preset.id,
      voiceName: preset.name,
      speed: 1.0,
      pitch: 0,
      volume: 80,
    });
  };

  const getProfile = (characterId: string) => profiles.find((p) => p.characterId === characterId);

  return (
    <div className="flex flex-col h-full">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Mic className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold">语音配音</h2>
          <div className="flex items-center gap-2 ml-4">
            <Badge variant="outline" className="text-xs">{dialogues.length} 条对白</Badge>
            {completedCount > 0 && (
              <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />{completedCount}
              </Badge>
            )}
            {pendingCount > 0 && (
              <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-600">
                {pendingCount} 待生成
              </Badge>
            )}
          </div>
        </div>
        <Button size="sm" disabled={pendingCount === 0 || generatingCount > 0}
          onClick={() => voiceStore.markAllPending(activeProjectId)}>
          <Play className="h-4 w-4 mr-1.5" />
          全部生成 ({pendingCount})
        </Button>
      </div>

      {dialogues.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Mic className="h-12 w-12 opacity-20" />
          <p className="text-sm">还没有对白数据</p>
          <p className="text-xs">在「导演」板块完成分镜后，对白会自动提取到这里</p>
        </div>
      ) : (
        <div className="flex-1 flex">
          {/* 左：角色音色设置 */}
          <div className="w-64 border-r border-border p-3">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />角色音色
            </h3>
            <ScrollArea className="h-full">
              {characters.slice(0, 12).map((char) => {
                const profile = getProfile(char.id);
                return (
                  <Card key={char.id}
                    className={cn(
                      "p-2 mb-2 cursor-pointer transition-all text-xs",
                      selectedCharId === char.id && "ring-2 ring-primary"
                    )}
                    onClick={() => setSelectedCharId(char.id)}>
                    <div className="font-medium">{char.name}</div>
                    {profile ? (
                      <div className="flex items-center gap-1 mt-1 text-muted-foreground">
                        <Volume2 className="h-3 w-3" />
                        <span>{profile.voiceName}</span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground mt-1">未设定音色</div>
                    )}
                  </Card>
                );
              })}
            </ScrollArea>
          </div>

          {/* 右：对白列表 + 音色选择 */}
          <div className="flex-1 flex flex-col">
            {selectedCharId && (
              <div className="p-3 border-b border-border">
                <h4 className="text-xs font-semibold mb-2">选择音色</h4>
                <div className="grid grid-cols-3 gap-1.5">
                  {DEFAULT_VOICE_PRESETS.map((preset) => {
                    const char = characters.find((c) => c.id === selectedCharId);
                    const isActive = getProfile(selectedCharId)?.voiceId === preset.id;
                    return (
                      <button key={preset.id}
                        className={cn(
                          "text-left p-1.5 rounded text-[10px] border transition-all",
                          isActive ? "border-primary bg-primary/10" : "border-border hover:border-muted-foreground"
                        )}
                        onClick={() => handleAssignVoice(selectedCharId, char?.name ?? "", preset)}>
                        <div className="font-medium">{preset.name}</div>
                        <div className="text-muted-foreground">{preset.style}·{preset.gender === "male" ? "男" : "女"}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 对白列表 */}
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-1.5">
                {dialogues.map((d) => {
                  const profile = getProfile(d.characterId);
                  return (
                    <div key={d.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded text-xs border border-border",
                        d.status === "completed" && "border-green-300",
                        d.status === "failed" && "border-red-300"
                      )}>
                      <StatusBadge status={d.status} />
                      <span className="font-medium w-12 flex-shrink-0">{d.characterName}</span>
                      <span className="text-muted-foreground w-20 flex-shrink-0 truncate">{d.sceneName}</span>
                      <span className="flex-1 truncate">{d.text}</span>
                      {profile && (
                        <Badge variant="secondary" className="text-[9px] flex-shrink-0">
                          {profile.voiceName}
                        </Badge>
                      )}
                      {d.status === "completed" && (
                        <button className="p-0.5 hover:bg-muted rounded flex-shrink-0">
                          <Play className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "idle": return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    case "generating": return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    case "completed": return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    case "failed": return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    default: return null;
  }
}

// 内联 Clock icon 避免额外导入
function Clock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

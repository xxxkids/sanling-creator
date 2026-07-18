// 视频板块 — Agent 驱动的分镜草图生成 + 分批视频生成
// 参考 LibTV Agent 模式：分镜表 → 草图 → 分批生成 → 确认/回滚

import { useState, useCallback } from "react";
import { useScriptStore } from "@/stores/script-store";
import { useDirectorStore } from "@/stores/director-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  Play,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Film,
  Grid3X3,
  Loader2,
} from "lucide-react";

// ==================== Types ====================

type ClipStatus = "idle" | "generating_storyboard" | "generating_video" | "completed" | "failed";

interface VideoClip {
  id: string;
  label: string;
  sceneName: string;
  shotRange: string;
  duration: number;
  status: ClipStatus;
  storyboardUrl?: string;
  videoUrl?: string;
  error?: string;
  characterRefs: string[];
  sceneRefId?: string;
  propRefs: string[];
}

interface BatchProgress {
  current: number;
  total: number;
  message: string;
}

// ==================== Component ====================

export function VideoView() {
  const activeProjectId = useScriptStore((s) => s.activeProjectId);
  const projectData = useDirectorStore((s) => {
    if (!activeProjectId) return null;
    return s.getProjectData(activeProjectId);
  });
  const splitScenes = projectData?.splitScenes ?? [];

  const [clips, setClips] = useState<VideoClip[]>([]);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const handleGenerateStoryboards = useCallback(() => {
    if (splitScenes.length === 0) return;
    const groups: VideoClip[] = [];
    for (let i = 0; i < splitScenes.length; i += 9) {
      const groupScenes = splitScenes.slice(i, i + 9);
      const first = groupScenes[0];
      const last = groupScenes[groupScenes.length - 1];
      const totalDuration = groupScenes.reduce((sum, s) => sum + ((s as any).duration ?? 5), 0);
      groups.push({
        id: `clip_${String(groups.length + 1).padStart(2, "0")}`,
        label: `V${String(groups.length + 1).padStart(2, "0")}·${first?.sceneName ?? "?"}·${first?.id ?? "?"}-${last?.id ?? "?"}·${totalDuration}s`,
        sceneName: first?.sceneName ?? "未知场景",
        shotRange: `${first?.id ?? "?"}-${last?.id ?? "?"}`,
        duration: totalDuration,
        status: "generating_storyboard",
        characterRefs: (first as any)?.characterIds ?? [],
        sceneRefId: (first as any)?.sceneAnchorId,
        propRefs: [],
      });
    }
    setClips(groups);
    simulateStoryboardGeneration(groups, setClips);
  }, [splitScenes]);

  const handleGenerateVideos = useCallback(() => {
    const pendingClips = clips.filter((c) => c.status === "completed");
    if (pendingClips.length === 0) return;
    setBatchProgress({ current: 0, total: pendingClips.length, message: "开始生成视频..." });
    simulateVideoGeneration(pendingClips, setClips, setBatchProgress);
  }, [clips]);

  const handleRollback = useCallback((clipId: string) => {
    setClips((prev) =>
      prev.map((c) =>
        c.id === clipId
          ? { ...c, status: "idle" as ClipStatus, videoUrl: undefined, error: undefined }
          : c
      )
    );
  }, []);

  if (!activeProjectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        请先打开一个项目
      </div>
    );
  }

  const completedCount = clips.filter((c) => c.status === "completed").length;
  const failedCount = clips.filter((c) => c.status === "failed").length;
  const generatingCount = clips.filter((c) =>
    ["generating_storyboard", "generating_video"].includes(c.status)
  ).length;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Film className="h-5 w-5 text-primary" />
          <h2 className="text-sm font-semibold">视频生成</h2>
          {clips.length > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <Badge variant="outline" className="text-xs">{clips.length} 组</Badge>
              {completedCount > 0 && (
                <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />{completedCount}
                </Badge>
              )}
              {failedCount > 0 && (
                <Badge variant="outline" className="text-xs text-red-600 border-red-600">
                  <XCircle className="h-3 w-3 mr-1" />{failedCount}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleGenerateStoryboards}
            disabled={splitScenes.length === 0 || generatingCount > 0}>
            <Grid3X3 className="h-4 w-4 mr-1.5" />生成分镜草图
          </Button>
          <Button size="sm" onClick={handleGenerateVideos}
            disabled={completedCount === 0 || generatingCount > 0}>
            <Play className="h-4 w-4 mr-1.5" />生成视频 ({completedCount})
          </Button>
        </div>
      </div>

      {batchProgress && (
        <div className="px-4 py-2 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{batchProgress.message}</span>
            <span className="ml-auto">{batchProgress.current}/{batchProgress.total}</span>
          </div>
          <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500"
              style={{ width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {clips.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Film className="h-12 w-12 opacity-20" />
          <p className="text-sm">还没有视频分组</p>
          <p className="text-xs">先在「导演」板块完成分镜，然后点击「生成分镜草图」自动分组</p>
        </div>
      )}

      <ScrollArea className="flex-1 p-4">
        <div className="grid grid-cols-2 gap-3">
          {clips.map((clip) => (
            <Card key={clip.id}
              className={cn(
                "p-3 cursor-pointer transition-all hover:ring-1 hover:ring-primary/50",
                selectedClipId === clip.id && "ring-2 ring-primary",
                clip.status === "failed" && "border-red-300"
              )}
              onClick={() => setSelectedClipId(clip.id)}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <StatusIcon status={clip.status} />
                  <span className="text-xs font-medium">{clip.label}</span>
                </div>
                {clip.status === "completed" && (
                  <button className="p-0.5 hover:bg-muted rounded"
                    onClick={(e) => { e.stopPropagation(); handleRollback(clip.id); }}
                    title="回滚">
                    <RotateCcw className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>{clip.sceneName}</span><span>·</span>
                <span>{clip.shotRange}</span><span>·</span>
                <span>{clip.duration}s</span>
              </div>
              {clip.characterRefs.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">角色:</span>
                  {clip.characterRefs.slice(0, 3).map((id) => (
                    <Badge key={id} variant="secondary" className="text-[9px] px-1 py-0">{id}</Badge>
                  ))}
                  {clip.characterRefs.length > 3 && (
                    <span className="text-[9px] text-muted-foreground">+{clip.characterRefs.length - 3}</span>
                  )}
                </div>
              )}
              {clip.error && (
                <div className="mt-2 flex items-start gap-1 text-[10px] text-red-600">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  <span>{clip.error}</span>
                </div>
              )}
              {selectedClipId === clip.id && clip.status === "completed" && (
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]">
                    <Play className="h-3 w-3 mr-1" />预览
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px]"
                    onClick={() => handleRollback(clip.id)}>
                    <RotateCcw className="h-3 w-3 mr-1" />重新生成
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function StatusIcon({ status }: { status: ClipStatus }) {
  switch (status) {
    case "idle": return <Clock className="h-4 w-4 text-muted-foreground" />;
    case "generating_storyboard":
    case "generating_video": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
  }
}

async function simulateStoryboardGeneration(
  clips: VideoClip[],
  setClips: (updater: (prev: VideoClip[]) => VideoClip[]) => void
) {
  for (let i = 0; i < clips.length; i++) {
    await new Promise((r) => setTimeout(r, 400));
    setClips((prev) =>
      prev.map((c, j) => (j === i ? { ...c, status: "completed" as ClipStatus } : c))
    );
  }
}

async function simulateVideoGeneration(
  clips: VideoClip[],
  setClips: (updater: (prev: VideoClip[]) => VideoClip[]) => void,
  setProgress: (p: BatchProgress | null) => void
) {
  for (let i = 0; i < clips.length; i++) {
    await new Promise((r) => setTimeout(r, 600));
    setClips((prev) =>
      prev.map((c) =>
        c.id === clips[i].id ? { ...c, status: "completed" as ClipStatus } : c
      )
    );
    setProgress({ current: i + 1, total: clips.length, message: `生成 ${clips[i].label}` });
  }
  setProgress(null);
}

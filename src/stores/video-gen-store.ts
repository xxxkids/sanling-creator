// 视频生成状态管理 Store
// 追踪分批生成、回滚历史、资产引用自检

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ==================== Types ====================

export type ClipGenStatus = "idle" | "queued" | "generating_storyboard" | "generating_video" | "completed" | "failed" | "deprecated";

export interface ClipRecord {
  id: string;
  label: string;
  sceneName: string;
  shotRange: string;
  duration: number;
  status: ClipGenStatus;
  version: number;
  previousVersionId?: string;
  storyboardUrl?: string;
  videoUrl?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  // 资产引用（用于自检）
  characterRefs: string[];
  sceneRefId?: string;
  propRefs: string[];
  // 自检结果
  lastCheckResult?: CheckResult;
}

export interface CheckResult {
  passed: boolean;
  checks: CheckItem[];
  checkedAt: number;
}

export interface CheckItem {
  name: string;
  passed: boolean;
  detail: string;
}

export interface BatchState {
  batchId: string;
  clipIds: string[];
  currentIndex: number;
  totalCount: number;
  status: "pending" | "running" | "completed" | "failed";
  startedAt?: number;
  completedAt?: number;
}

export interface VideoGenState {
  // 按项目隔离
  projects: Record<string, {
    clips: ClipRecord[];
    batch: BatchState | null;
  }>;
}

export interface VideoGenActions {
  ensureProject: (projectId: string) => void;
  addClips: (projectId: string, clips: Omit<ClipRecord, "version" | "createdAt" | "updatedAt">[]) => void;
  updateClipStatus: (projectId: string, clipId: string, status: ClipGenStatus, error?: string) => void;
  updateClipResult: (projectId: string, clipId: string, updates: Partial<Pick<ClipRecord, "storyboardUrl" | "videoUrl">>) => void;
  rollbackClip: (projectId: string, clipId: string) => string; // 返回新版本ID
  getProjectClips: (projectId: string) => ClipRecord[];
  getActiveClips: (projectId: string) => ClipRecord[]; // 非 deprecated
  startBatch: (projectId: string, clipIds: string[]) => void;
  updateBatchProgress: (projectId: string, index: number) => void;
  completeBatch: (projectId: string) => void;
  runSelfCheck: (projectId: string, clipId: string) => CheckResult;
  clearProject: (projectId: string) => void;
}

type VideoGenStore = VideoGenState & VideoGenActions;

// ==================== Store ====================

export const useVideoGenStore = create<VideoGenStore>()(
  persist(
    (set, get) => ({
      projects: {},

      ensureProject: (projectId) => {
        if (!get().projects[projectId]) {
          set((s) => ({
            projects: { ...s.projects, [projectId]: { clips: [], batch: null } },
          }));
        }
      },

      addClips: (projectId, clips) => {
        get().ensureProject(projectId);
        const now = Date.now();
        const records: ClipRecord[] = clips.map((c) => ({
          ...c,
          version: 1,
          createdAt: now,
          updatedAt: now,
        }));
        set((s) => ({
          projects: {
            ...s.projects,
            [projectId]: {
              ...s.projects[projectId],
              clips: [...(s.projects[projectId]?.clips ?? []), ...records],
            },
          },
        }));
      },

      updateClipStatus: (projectId, clipId, status, error) => {
        set((s) => {
          const project = s.projects[projectId];
          if (!project) return s;
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...project,
                clips: project.clips.map((c) =>
                  c.id === clipId ? { ...c, status, error, updatedAt: Date.now() } : c
                ),
              },
            },
          };
        });
      },

      updateClipResult: (projectId, clipId, updates) => {
        set((s) => {
          const project = s.projects[projectId];
          if (!project) return s;
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...project,
                clips: project.clips.map((c) =>
                  c.id === clipId ? { ...c, ...updates, updatedAt: Date.now() } : c
                ),
              },
            },
          };
        });
      },

      rollbackClip: (projectId, clipId) => {
        const project = get().projects[projectId];
        const clip = project?.clips.find((c) => c.id === clipId);
        if (!clip) return clipId;

        const newVersion = clip.version + 1;
        const newId = `${clipId}_v${newVersion}`;
        const now = Date.now();

        set((s) => ({
          projects: {
            ...s.projects,
            [projectId]: {
              ...s.projects[projectId],
              clips: [
                // 旧版标记为 deprecated
                ...s.projects[projectId].clips.map((c) =>
                  c.id === clipId ? { ...c, status: "deprecated" as ClipGenStatus, updatedAt: now } : c
                ),
                // 新版
                {
                  ...clip,
                  id: newId,
                  status: "idle" as ClipGenStatus,
                  version: newVersion,
                  previousVersionId: clipId,
                  videoUrl: undefined,
                  storyboardUrl: undefined,
                  error: undefined,
                  createdAt: now,
                  updatedAt: now,
                },
              ],
            },
          },
        }));

        return newId;
      },

      getProjectClips: (projectId) => {
        return get().projects[projectId]?.clips ?? [];
      },

      getActiveClips: (projectId) => {
        return (get().projects[projectId]?.clips ?? []).filter(
          (c) => c.status !== "deprecated"
        );
      },

      startBatch: (projectId, clipIds) => {
        const batchId = `batch_${Date.now()}`;
        set((s) => ({
          projects: {
            ...s.projects,
            [projectId]: {
              ...s.projects[projectId],
              batch: {
                batchId,
                clipIds,
                currentIndex: 0,
                totalCount: clipIds.length,
                status: "running",
                startedAt: Date.now(),
              },
              clips: s.projects[projectId].clips.map((c) =>
                clipIds.includes(c.id) ? { ...c, status: "generating_video" as ClipGenStatus } : c
              ),
            },
          },
        }));
      },

      updateBatchProgress: (projectId, index) => {
        set((s) => {
          const project = s.projects[projectId];
          if (!project?.batch) return s;
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...project,
                batch: { ...project.batch, currentIndex: index },
              },
            },
          };
        });
      },

      completeBatch: (projectId) => {
        set((s) => {
          const project = s.projects[projectId];
          if (!project?.batch) return s;
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...project,
                batch: { ...project.batch, status: "completed", completedAt: Date.now() },
              },
            },
          };
        });
      },

      runSelfCheck: (projectId, clipId) => {
        const project = get().projects[projectId];
        const clip = project?.clips.find((c) => c.id === clipId);
        const checks: CheckItem[] = [];

        // 检查1: 角色引用
        const hasChars = (clip?.characterRefs?.length ?? 0) > 0;
        checks.push({
          name: "角色引用",
          passed: hasChars,
          detail: hasChars ? `引用 ${clip!.characterRefs.length} 个角色` : "未引用任何角色节点",
        });

        // 检查2: 场景引用
        const hasScene = Boolean(clip?.sceneRefId);
        checks.push({
          name: "场景引用",
          passed: hasScene,
          detail: hasScene ? `引用场景 ${clip!.sceneRefId}` : "未引用场景节点",
        });

        // 检查3: 视频 URL 有效
        const hasVideo = Boolean(clip?.videoUrl);
        checks.push({
          name: "视频生成",
          passed: hasVideo,
          detail: hasVideo ? "视频已生成" : "视频未生成",
        });

        // 检查4: 无错误
        const noError = !clip?.error;
        checks.push({
          name: "无错误",
          passed: noError,
          detail: noError ? "正常" : clip!.error!,
        });

        const passed = checks.every((c) => c.passed);
        const result: CheckResult = { passed, checks, checkedAt: Date.now() };

        // 保存自检结果
        set((s) => {
          const p = s.projects[projectId];
          if (!p) return s;
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...p,
                clips: p.clips.map((c) =>
                  c.id === clipId ? { ...c, lastCheckResult: result } : c
                ),
              },
            },
          };
        });

        return result;
      },

      clearProject: (projectId) => {
        set((s) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [projectId]: _, ...rest } = s.projects;
          return { projects: rest };
        });
      },
    }),
    {
      name: "sanling-video-gen-store",
      version: 1,
    }
  )
);

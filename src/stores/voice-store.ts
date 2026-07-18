// 语音配音 Store — 角色音色管理 + 对白生成 + 批量 TTS
// 支持火山引擎 TTS API，角色音色全剧复用保证一致性

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ==================== Types ====================

export interface VoiceProfile {
  id: string;
  characterId: string;       // 关联角色库
  characterName: string;
  voiceId: string;           // TTS 音色 ID
  voiceName: string;         // 音色名称（如"青年男声·疲惫"）
  speed: number;             // 语速 0.5-2.0
  pitch: number;             // 音调 -20 ~ +20
  volume: number;            // 音量 0-100
}

export type DialogueStatus = "idle" | "generating" | "completed" | "failed";

export interface DialogueLine {
  id: string;
  shotId: string;            // 关联镜头
  sceneName: string;
  characterId: string;
  characterName: string;
  text: string;              // 对白文本
  status: DialogueStatus;
  audioUrl?: string;
  duration?: number;
  error?: string;
}

export interface VoiceProject {
  profiles: VoiceProfile[];
  dialogues: DialogueLine[];
  // 预设音色库（从火山引擎拉取）
  availableVoices: VoicePreset[];
}

export interface VoicePreset {
  id: string;
  name: string;
  gender: "male" | "female";
  age: "child" | "young" | "middle" | "old";
  style: string;             // "沉稳", "活泼", "疲惫", "威严"...
  demoUrl?: string;
}

// ==================== 默认音色库 ====================

export const DEFAULT_VOICE_PRESETS: VoicePreset[] = [
  { id: "volc_male_young_01", name: "青年男声·清朗", gender: "male", age: "young", style: "清朗" },
  { id: "volc_male_young_02", name: "青年男声·疲惫", gender: "male", age: "young", style: "疲惫" },
  { id: "volc_male_mid_01", name: "中年男声·沉稳", gender: "male", age: "middle", style: "沉稳" },
  { id: "volc_male_mid_02", name: "中年男声·粗犷", gender: "male", age: "middle", style: "粗犷" },
  { id: "volc_male_old_01", name: "老年男声·沧桑", gender: "male", age: "old", style: "沧桑" },
  { id: "volc_female_young_01", name: "青年女声·甜美", gender: "female", age: "young", style: "甜美" },
  { id: "volc_female_young_02", name: "青年女声·干练", gender: "female", age: "young", style: "干练" },
  { id: "volc_female_mid_01", name: "中年女声·温柔", gender: "female", age: "middle", style: "温柔" },
  { id: "volc_female_old_01", name: "老年女声·慈祥", gender: "female", age: "old", style: "慈祥" },
  { id: "volc_child_01", name: "童声·男孩", gender: "male", age: "child", style: "活泼" },
];

// ==================== Store ====================

interface VoiceStoreState {
  projects: Record<string, VoiceProject>;
}

interface VoiceStoreActions {
  ensureProject: (projectId: string) => void;

  // 角色音色
  setVoiceProfile: (projectId: string, profile: VoiceProfile) => void;
  getVoiceProfile: (projectId: string, characterId: string) => VoiceProfile | undefined;
  removeVoiceProfile: (projectId: string, characterId: string) => void;

  // 对白管理
  importDialogues: (projectId: string, dialogues: Omit<DialogueLine, "status">[]) => void;
  updateDialogueStatus: (projectId: string, dialogueId: string, status: DialogueStatus, audioUrl?: string, error?: string) => void;
  getDialoguesForShot: (projectId: string, shotId: string) => DialogueLine[];
  getDialoguesForCharacter: (projectId: string, characterId: string) => DialogueLine[];

  // 批量生成
  getPendingDialogues: (projectId: string) => DialogueLine[];
  markAllPending: (projectId: string) => void;

  clearProject: (projectId: string) => void;
}

type VoiceStore = VoiceStoreState & VoiceStoreActions;

// ==================== Implementation ====================

export const useVoiceStore = create<VoiceStore>()(
  persist(
    (set, get) => ({
      projects: {},

      ensureProject: (projectId) => {
        if (!get().projects[projectId]) {
          set((s) => ({
            projects: {
              ...s.projects,
              [projectId]: {
                profiles: [],
                dialogues: [],
                availableVoices: [...DEFAULT_VOICE_PRESETS],
              },
            },
          }));
        }
      },

      setVoiceProfile: (projectId, profile) => {
        get().ensureProject(projectId);
        set((s) => {
          const project = s.projects[projectId];
          const idx = project.profiles.findIndex((p) => p.characterId === profile.characterId);
          const profiles =
            idx >= 0
              ? project.profiles.map((p, i) => (i === idx ? profile : p))
              : [...project.profiles, profile];
          return {
            projects: { ...s.projects, [projectId]: { ...project, profiles } },
          };
        });
      },

      getVoiceProfile: (projectId, characterId) => {
        return get().projects[projectId]?.profiles.find((p) => p.characterId === characterId);
      },

      removeVoiceProfile: (projectId, characterId) => {
        set((s) => {
          const project = s.projects[projectId];
          if (!project) return s;
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...project,
                profiles: project.profiles.filter((p) => p.characterId !== characterId),
              },
            },
          };
        });
      },

      importDialogues: (projectId, dialogues) => {
        get().ensureProject(projectId);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const now = Date.now();
        const records: DialogueLine[] = dialogues.map((d) => ({
          ...d,
          status: "idle" as DialogueStatus,
        }));
        set((s) => ({
          projects: {
            ...s.projects,
            [projectId]: {
              ...s.projects[projectId],
              dialogues: [...s.projects[projectId].dialogues, ...records],
            },
          },
        }));
      },

      updateDialogueStatus: (projectId, dialogueId, status, audioUrl, error) => {
        set((s) => {
          const project = s.projects[projectId];
          if (!project) return s;
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...project,
                dialogues: project.dialogues.map((d) =>
                  d.id === dialogueId ? { ...d, status, audioUrl, error } : d
                ),
              },
            },
          };
        });
      },

      getDialoguesForShot: (projectId, shotId) => {
        return (get().projects[projectId]?.dialogues ?? []).filter((d) => d.shotId === shotId);
      },

      getDialoguesForCharacter: (projectId, characterId) => {
        return (get().projects[projectId]?.dialogues ?? []).filter(
          (d) => d.characterId === characterId
        );
      },

      getPendingDialogues: (projectId) => {
        return (get().projects[projectId]?.dialogues ?? []).filter(
          (d) => d.status === "idle" || d.status === "failed"
        );
      },

      markAllPending: (projectId) => {
        set((s) => {
          const project = s.projects[projectId];
          if (!project) return s;
          return {
            projects: {
              ...s.projects,
              [projectId]: {
                ...project,
                dialogues: project.dialogues.map((d) =>
                  d.status === "idle" ? { ...d, status: "generating" } : d
                ),
              },
            },
          };
        });
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
      name: "sanling-voice-store",
      version: 1,
    }
  )
);

// ==================== TTS API 封装 ====================

/**
 * 火山引擎 TTS 请求
 * 实际 API 接入时替换此函数
 */
export async function synthesizeSpeech(
  text: string,
  voiceId: string,
  options: Record<string, unknown> = {}
): Promise<string> {
  // TODO: 接入火山引擎 TTS API
  // POST https://openspeech.bytedance.com/api/v1/tts
  // Headers: Authorization: Bearer;${apiKey}
  // Body: { app: { appid }, user: { uid }, audio: { voice_type, encoding },
  //         request: { text, speed_ratio, pitch_ratio, volume_ratio } }
  //
  // 返回 base64 音频 → 转 Blob URL

  void options; // TODO: use for speed/pitch/volume when API wired
  await new Promise((r) => setTimeout(r, 300)); // simulate
  return `voice://${voiceId}/${encodeURIComponent(text.substring(0, 20))}`;
}

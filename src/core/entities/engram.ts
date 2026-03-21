import { z } from "zod";

// ============================================================
// Engram — OpenClaw Workspace 互換の人格データセット
// ============================================================

/**
 * Engramを構成する各Markdownファイルのスキーマ。
 * OpenClawのworkspaceディレクトリ構造と1:1で対応する。
 */
export const EngramFileSchema = z.object({
  /** 人格の核となる指示・行動原理 */
  soul: z.string(),
  /** アイデンティティ定義（名前、口調、背景） */
  identity: z.string(),
  /** エージェント設定（ツール利用方針等） */
  agents: z.string().optional(),
  /** ユーザー情報 */
  user: z.string().optional(),
  /** 記憶インデックス */
  memory: z.string().optional(),
  /** ハートビート（定期振り返り） */
  heartbeat: z.string().optional(),
  /** 日付別の記憶エントリ */
  memoryEntries: z.record(z.string(), z.string()).optional(),
});

export type EngramFiles = z.infer<typeof EngramFileSchema>;

/**
 * Engramメタデータ — Mikoshiでの管理情報
 */
export const EngramMetaSchema = z.object({
  /** 一意識別子 (例: "ghost-in-the-shell") */
  id: z.string(),
  /** 表示名 (例: "攻殻機動隊の少佐") */
  name: z.string(),
  /** 説明 */
  description: z.string().optional(),
  /** 作成日時 */
  createdAt: z.string().datetime(),
  /** 最終更新日時 */
  updatedAt: z.string().datetime(),
  /** タグ */
  tags: z.array(z.string()).optional(),
});

export type EngramMeta = z.infer<typeof EngramMetaSchema>;

/**
 * Engram — 完全な人格データセット
 * メタデータとファイル群の統合体
 */
export const EngramSchema = z.object({
  meta: EngramMetaSchema,
  files: EngramFileSchema,
});

export type Engram = z.infer<typeof EngramSchema>;

// ============================================================
// Construct — ShellにEngramがロードされた稼働中プロセス
// ============================================================

export const ConstructStatusSchema = z.enum([
  "summoning",  // 召喚中（Engramロード中）
  "active",     // 稼働中
  "suspended",  // 一時停止
  "banished",   // 退去済み
]);

export type ConstructStatus = z.infer<typeof ConstructStatusSchema>;

/**
 * Shell — LLMの種別を表す列挙
 */
export const ShellTypeSchema = z.enum([
  "claude",
  "gemini",
  "gpt",
  "local",   // ローカルLLM (Ollama等)
]);

export type ShellType = z.infer<typeof ShellTypeSchema>;

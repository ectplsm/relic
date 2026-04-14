import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

export const PersonaFileSchema = z.object({
  fileType: z.enum(["SOUL", "IDENTITY", "ENGRAM_JSON"]),
  filename: z.string(),
});

export const MemorySummarySchema = z.object({
  hasMemory: z.boolean(),
  hasUserFile: z.boolean().optional(),
  hasMemoryIndex: z.boolean().optional(),
  memoryEntryCount: z.number().optional(),
  latestMemoryDate: z.string().nullable().optional(),
  memoryUpdatedAt: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Engram list / detail
// ---------------------------------------------------------------------------

export const MikoshiEngramSchema = z.object({
  id: z.string(),
  sourceEngramId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]),
  tags: z.array(z.string()),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  personaFiles: z.array(PersonaFileSchema),
  memory: MemorySummarySchema.optional(),
});

export type MikoshiEngram = z.infer<typeof MikoshiEngramSchema>;

// ---------------------------------------------------------------------------
// Engram detail (with persona content)
// ---------------------------------------------------------------------------

export const PersonaFileWithContentSchema = z.object({
  fileType: z.enum(["SOUL", "IDENTITY", "ENGRAM_JSON"]),
  filename: z.string(),
  content: z.string(),
});

export const MikoshiEngramDetailSchema = z.object({
  id: z.string(),
  sourceEngramId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]),
  tags: z.array(z.string()),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  personaFiles: z.array(PersonaFileWithContentSchema),
  memory: MemorySummarySchema.optional(),
});

export type MikoshiEngramDetail = z.infer<typeof MikoshiEngramDetailSchema>;

// ---------------------------------------------------------------------------
// Create engram
// ---------------------------------------------------------------------------

export const CreateEngramInputSchema = z.object({
  name: z.string(),
  sourceEngramId: z.string(),
  description: z.string().optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
  tags: z.array(z.string()).optional(),
  soul: z.string(),
  identity: z.string(),
});

export type CreateEngramInput = z.infer<typeof CreateEngramInputSchema>;

export const CreateEngramResponseSchema = z.object({
  id: z.string(),
  sourceEngramId: z.string(),
  name: z.string(),
  visibility: z.string(),
  url: z.string(),
});

export type CreateEngramResponse = z.infer<typeof CreateEngramResponseSchema>;

// ---------------------------------------------------------------------------
// Update persona
// ---------------------------------------------------------------------------

export const UpdatePersonaInputSchema = z.object({
  soul: z.string(),
  identity: z.string(),
  expectedRemotePersonaHash: z.string(),
});

export type UpdatePersonaInput = z.infer<typeof UpdatePersonaInputSchema>;

export const UpdatePersonaResponseSchema = z.object({
  engramId: z.string(),
  persona: z.object({
    hash: z.string(),
    updatedAt: z.string(),
  }),
});

export type UpdatePersonaResponse = z.infer<typeof UpdatePersonaResponseSchema>;

// ---------------------------------------------------------------------------
// Sync status
// ---------------------------------------------------------------------------

export const PersonaSyncTokenSchema = z.object({
  hash: z.string(),
  updatedAt: z.string(),
});

export const PersonaSyncStatusSchema = z.object({
  exists: z.boolean(),
  token: PersonaSyncTokenSchema.nullable(),
  files: z.object({
    hasSoul: z.boolean(),
    hasIdentity: z.boolean(),
  }),
});

export const MemorySyncTokenSchema = z.object({
  memoryContentHash: z.string(),
  bundleHash: z.string(),
  version: z.number(),
  updatedAt: z.string(),
});

export const MemorySyncSummarySchema = z.object({
  hasUserFile: z.boolean(),
  hasMemoryIndex: z.boolean(),
  memoryEntryCount: z.number(),
  latestMemoryDate: z.string().nullable(),
});

export const MemorySyncStatusSchema = z.object({
  exists: z.boolean(),
  token: MemorySyncTokenSchema.nullable(),
  summary: MemorySyncSummarySchema.nullable(),
});

export const SyncStatusResponseSchema = z.object({
  engramId: z.string(),
  persona: PersonaSyncStatusSchema,
  memory: MemorySyncStatusSchema,
});

export type SyncStatusResponse = z.infer<typeof SyncStatusResponseSchema>;

// ---------------------------------------------------------------------------
// Memory upload
// ---------------------------------------------------------------------------

export const ScryptParamsSchema = z.object({
  N: z.number(),
  r: z.number(),
  p: z.number(),
  dkLen: z.number(),
});

export const MemoryManifestSchema = z.object({
  payloadKind: z.literal("memory"),
  bundleVersion: z.number(),
  hasUserFile: z.boolean(),
  hasMemoryIndex: z.boolean(),
  memoryEntryCount: z.number(),
  latestMemoryDate: z.string().nullable(),
});

export const UploadMemoryInputSchema = z.object({
  ciphertext: z.string(),
  cipherAlgorithm: z.literal("AES-256-GCM"),
  cipherNonce: z.string(),
  wrappedBundleKey: z.string(),
  wrapAlgorithm: z.literal("AES-256-GCM"),
  kdfAlgorithm: z.literal("scrypt"),
  kdfSalt: z.string(),
  kdfParams: ScryptParamsSchema,
  manifest: MemoryManifestSchema,
  expectedRemoteMemoryContentHash: z.string().nullable(),
  memoryContentHash: z.string(),
  bundleHash: z.string(),
});

export type UploadMemoryInput = z.infer<typeof UploadMemoryInputSchema>;

export const UploadMemoryResponseSchema = z.object({
  engramId: z.string(),
  version: z.number(),
  memoryContentHash: z.string(),
  bundleHash: z.string(),
  updatedAt: z.string(),
});

export type UploadMemoryResponse = z.infer<typeof UploadMemoryResponseSchema>;

// ---------------------------------------------------------------------------
// Memory download
// ---------------------------------------------------------------------------

export const DownloadMemoryResponseSchema = z.discriminatedUnion("hasMemory", [
  z.object({
    engramId: z.string(),
    hasMemory: z.literal(true),
    version: z.number(),
    ciphertext: z.string(),
    cipherAlgorithm: z.literal("AES-256-GCM"),
    cipherNonce: z.string(),
    wrappedBundleKey: z.string(),
    wrapAlgorithm: z.literal("AES-256-GCM"),
    kdfAlgorithm: z.literal("scrypt"),
    kdfSalt: z.string(),
    kdfParams: ScryptParamsSchema,
    manifest: MemoryManifestSchema,
    memoryContentHash: z.string(),
    bundleHash: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  z.object({
    engramId: z.string(),
    hasMemory: z.literal(false),
  }),
]);

export type DownloadMemoryResponse = z.infer<typeof DownloadMemoryResponseSchema>;

// ---------------------------------------------------------------------------
// Avatar upload / delete
// ---------------------------------------------------------------------------

/** クライアントが許可する avatar MIME タイプ */
export const AVATAR_SUPPORTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** クライアント側事前バリデーションの最大バイト数 (Mikoshi 側と一致) */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const UploadEngramAvatarResponseSchema = z.object({
  avatarUrl: z.string(),
});

export type UploadEngramAvatarResponse = z.infer<
  typeof UploadEngramAvatarResponseSchema
>;

export const DeleteEngramAvatarResponseSchema = z.object({
  avatarUrl: z.null(),
});

export type DeleteEngramAvatarResponse = z.infer<
  typeof DeleteEngramAvatarResponseSchema
>;

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class MikoshiApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string | undefined,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "MikoshiApiError";
  }

  get isUnauthorized(): boolean { return this.status === 401; }
  get isForbidden(): boolean { return this.status === 403; }
  get isNotFound(): boolean { return this.status === 404; }
  get isConflict(): boolean { return this.status === 409; }
  get isRateLimited(): boolean { return this.status === 429; }
}

// ---------------------------------------------------------------------------
// Port interface
// ---------------------------------------------------------------------------

export interface MikoshiClient {
  /** 認証ユーザーの全Engram一覧 */
  getEngrams(): Promise<MikoshiEngram[]>;

  /** sourceEngramId でリモートEngramを検索 (一覧から絞り込み) */
  getEngramBySourceId(sourceEngramId: string): Promise<MikoshiEngram | null>;

  /** Engram 詳細取得 (persona content 込み) */
  getEngram(engramId: string): Promise<MikoshiEngramDetail>;

  /** 新しいEngramをクラウドに作成 */
  createEngram(input: CreateEngramInput): Promise<CreateEngramResponse>;

  /** Engram の sync 比較トークンを取得 */
  getSyncStatus(engramId: string): Promise<SyncStatusResponse>;

  /** Persona ファイルを上書き (optimistic concurrency) */
  updatePersona(engramId: string, input: UpdatePersonaInput): Promise<UpdatePersonaResponse>;

  /** 暗号化メモリバンドルをアップロード */
  uploadMemory(engramId: string, input: UploadMemoryInput): Promise<UploadMemoryResponse>;

  /** 暗号化メモリバンドルをダウンロード */
  downloadMemory(engramId: string): Promise<DownloadMemoryResponse>;

  /** Avatar 画像をアップロード (multipart/form-data) */
  uploadEngramAvatar(
    engramId: string,
    data: Buffer,
    mimeType: string,
  ): Promise<UploadEngramAvatarResponse>;

  /** Avatar 画像を削除 */
  deleteEngramAvatar(engramId: string): Promise<DeleteEngramAvatarResponse>;
}

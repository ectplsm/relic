import {
  MikoshiApiError,
  MikoshiEngramSchema,
  MikoshiEngramDetailSchema,
  CreateEngramResponseSchema,
  SyncStatusResponseSchema,
  UpdatePersonaResponseSchema,
  UploadMemoryResponseSchema,
  DownloadMemoryResponseSchema,
  UploadEngramAvatarResponseSchema,
  DeleteEngramAvatarResponseSchema,
  type MikoshiClient,
  type MikoshiEngram,
  type MikoshiEngramDetail,
  type CreateEngramInput,
  type CreateEngramResponse,
  type SyncStatusResponse,
  type UpdatePersonaInput,
  type UpdatePersonaResponse,
  type UploadMemoryInput,
  type UploadMemoryResponse,
  type DownloadMemoryResponse,
  type UploadEngramAvatarResponse,
  type DeleteEngramAvatarResponse,
} from "../../core/ports/mikoshi.js";
import { z } from "zod";

/**
 * MikoshiApiClient — Mikoshi REST API v1 の adapter 実装
 *
 * Node.js 組み込みの fetch を使い、外部依存なしで通信する。
 * 認証は Bearer トークン (API キー)。
 */
export class MikoshiApiClient implements MikoshiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    // 末尾スラッシュを統一して除去
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  async getEngrams(): Promise<MikoshiEngram[]> {
    const data = await this.request("GET", "/api/v1/engrams");
    return z.array(MikoshiEngramSchema).parse(data);
  }

  async getEngramBySourceId(sourceEngramId: string): Promise<MikoshiEngram | null> {
    const engrams = await this.getEngrams();
    return engrams.find((e) => e.sourceEngramId === sourceEngramId) ?? null;
  }

  async getEngram(engramId: string): Promise<MikoshiEngramDetail> {
    const data = await this.request("GET", `/api/v1/engrams/${enc(engramId)}`);
    return MikoshiEngramDetailSchema.parse(data);
  }

  async createEngram(input: CreateEngramInput): Promise<CreateEngramResponse> {
    const data = await this.request("POST", "/api/v1/engrams", input);
    return CreateEngramResponseSchema.parse(data);
  }

  async getSyncStatus(engramId: string): Promise<SyncStatusResponse> {
    const data = await this.request("GET", `/api/v1/engrams/${enc(engramId)}/sync-status`);
    return SyncStatusResponseSchema.parse(data);
  }

  async updatePersona(
    engramId: string,
    input: UpdatePersonaInput,
  ): Promise<UpdatePersonaResponse> {
    const data = await this.request("PUT", `/api/v1/engrams/${enc(engramId)}/persona`, input);
    return UpdatePersonaResponseSchema.parse(data);
  }

  async uploadMemory(
    engramId: string,
    input: UploadMemoryInput,
  ): Promise<UploadMemoryResponse> {
    const data = await this.request("PUT", `/api/v1/engrams/${enc(engramId)}/memory`, input);
    return UploadMemoryResponseSchema.parse(data);
  }

  async downloadMemory(engramId: string): Promise<DownloadMemoryResponse> {
    const data = await this.request("GET", `/api/v1/engrams/${enc(engramId)}/memory`);
    return DownloadMemoryResponseSchema.parse(data);
  }

  async uploadEngramAvatar(
    engramId: string,
    data: Buffer,
    mimeType: string,
  ): Promise<UploadEngramAvatarResponse> {
    const form = new FormData();
    // Blob は Uint8Array を受け付ける (Node 18+ 標準)
    const blob = new Blob([new Uint8Array(data)], { type: mimeType });
    form.append("file", blob, filenameForMimeType(mimeType));

    const raw = await this.request(
      "PUT",
      `/api/v1/engrams/${enc(engramId)}/avatar`,
      form,
    );
    return UploadEngramAvatarResponseSchema.parse(raw);
  }

  async deleteEngramAvatar(engramId: string): Promise<DeleteEngramAvatarResponse> {
    const raw = await this.request(
      "DELETE",
      `/api/v1/engrams/${enc(engramId)}/avatar`,
    );
    return DeleteEngramAvatarResponseSchema.parse(raw);
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };

    const init: RequestInit = { method, headers };

    if (body !== undefined) {
      if (body instanceof FormData) {
        // multipart boundary は fetch に自動で決めさせる
        init.body = body;
      } else {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }
    }

    const res = await fetch(url, init);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let parsed: Record<string, unknown> | undefined;
      try { parsed = JSON.parse(text); } catch { /* ignore */ }

      const message = (parsed?.error as string) ?? `HTTP ${res.status}`;
      const code = (parsed?.code as string) ?? undefined;

      throw new MikoshiApiError(res.status, code, message, parsed);
    }

    return res.json();
  }
}

/** URL-safe path segment encoding */
function enc(segment: string): string {
  return encodeURIComponent(segment);
}

/**
 * multipart/form-data 送信時のダミーファイル名。
 * Mikoshi 側は MIME と内容で判定するので拡張子さえ合っていればよい。
 */
function filenameForMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg": return "avatar.jpg";
    case "image/png": return "avatar.png";
    case "image/webp": return "avatar.webp";
    default: return "avatar";
  }
}

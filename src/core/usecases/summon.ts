import type { EngramRepository } from "../ports/engram-repository.js";
import { composeEngram } from "../../shared/engram-composer.js";

export interface SummonResult {
  /** Engram ID */
  engramId: string;
  /** Engram表示名 */
  engramName: string;
  /** Shell注入用に結合されたプロンプトテキスト */
  prompt: string;
}

/**
 * Summon — EngramをMikoshiから召喚し、Shell注入用テキストを生成する
 *
 * これがRELICの中核オペレーション。
 * Engramの取得 → Markdown結合 → 注入可能なプロンプト生成 を行う。
 *
 * inboxへの書き込みはバックグラウンドhookが自動で行う。
 * CLIはEngramの注入に特化する。
 */
export class Summon {
  constructor(private readonly repository: EngramRepository) {}

  async execute(engramId: string, options?: { memoryWindowSize?: number }): Promise<SummonResult> {
    const engram = await this.repository.get(engramId);

    if (!engram) {
      throw new EngramNotFoundError(engramId);
    }

    const prompt = composeEngram(engram.files, {
      meta: engram.meta,
      memoryWindowSize: options?.memoryWindowSize,
    });

    return {
      engramId: engram.meta.id,
      engramName: engram.meta.name,
      prompt,
    };
  }
}

export class EngramNotFoundError extends Error {
  constructor(id: string) {
    super(`Engram "${id}" not found in Mikoshi`);
    this.name = "EngramNotFoundError";
  }
}

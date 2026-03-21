import type { EngramMeta } from "../entities/engram.js";
import type { EngramRepository } from "../ports/engram-repository.js";

/**
 * ListEngrams — Mikoshiに安置された全Engramの一覧を取得する
 */
export class ListEngrams {
  constructor(private readonly repository: EngramRepository) {}

  async execute(): Promise<EngramMeta[]> {
    return this.repository.list();
  }
}

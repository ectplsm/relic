import type { Engram, EngramMeta } from "../entities/engram.js";

/**
 * EngramRepository — Engram永続化層の抽象ポート
 *
 * Mikoshi (リモートAPI) やローカルファイルシステムなど、
 * 具象実装はadapters層で提供される。
 */
export interface EngramRepository {
  /** 全Engramのメタデータ一覧を取得 */
  list(): Promise<EngramMeta[]>;

  /** IDで完全なEngramを取得 */
  get(id: string): Promise<Engram | null>;

  /** Engramを保存（作成 or 更新） */
  save(engram: Engram): Promise<void>;

  /** Engramを削除 */
  delete(id: string): Promise<void>;

  /** アーカイブファイル (archive.md, archive.cursor) を別Engramへコピー */
  copyArchiveFiles(fromId: string, toId: string): Promise<boolean>;
}

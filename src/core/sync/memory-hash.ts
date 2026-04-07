import { createHash } from "node:crypto";
import { normalizeText } from "./normalize.js";
import type { EngramFiles } from "../entities/engram.js";

const HEADER = "mikoshi.memory.v1";

/**
 * Memory ファイルエントリ
 * path はソート用の相対パス ("USER.md", "MEMORY.md", "memory/2026-04-03.md" など)
 */
export interface MemoryFileEntry {
  path: string;
  content: string;
}

/**
 * Memory content hash canonicalization — mikoshi-sync.md 準拠
 *
 * 正規化ルール:
 *  - UTF-8 BOM 除去
 *  - 改行を \n に統一
 *  - 末尾 \n は除去しない（persona と異な���）
 *
 * Canonical payload:
 *  header \n ( path \n byteLen \n content \n )*
 *  ファイルはパス昇順でソート
 *
 * 出力: "sha256:<64 lowercase hex>"
 * 対象ファイルが0件なら null
 */
export function computeMemoryContentHash(
  files: MemoryFileEntry[],
): string | null {
  if (files.length === 0) return null;

  // パス昇順ソート
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  const parts: string[] = [HEADER];
  for (const file of sorted) {
    const norm = normalizeText(file.content);
    const byteLen = Buffer.byteLength(norm, "utf-8");
    parts.push(file.path, String(byteLen), norm);
  }

  const payload = parts.join("\n");
  const hex = createHash("sha256").update(payload, "utf-8").digest("hex");
  return `sha256:${hex}`;
}

/**
 * EngramFiles から memory 系ファイルを MemoryFileEntry[] に変換。
 * 対象: USER.md, MEMORY.md, memory/*.md
 */
export function collectMemoryFiles(files: EngramFiles): MemoryFileEntry[] {
  const entries: MemoryFileEntry[] = [];
  if (files.user) entries.push({ path: "USER.md", content: files.user });
  if (files.memory) entries.push({ path: "MEMORY.md", content: files.memory });
  if (files.memoryEntries) {
    for (const [date, content] of Object.entries(files.memoryEntries)) {
      entries.push({ path: `memory/${date}.md`, content });
    }
  }
  return entries;
}

/**
 * MemoryFileEntry[] を { "USER.md": "...", "memory/2026-04-03.md": "..." } に変換。
 * 暗号化バンドルの入力用。
 */
export function memoryFilesToRecord(entries: MemoryFileEntry[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const e of entries) {
    record[e.path] = e.content;
  }
  return record;
}

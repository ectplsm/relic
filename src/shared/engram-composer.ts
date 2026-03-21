import type { EngramFiles } from "../core/entities/engram.js";

/**
 * EngramFilesの各Markdownを、Shell注入用の単一テキストに結合する。
 *
 * 結合順序はOpenClawの優先度に準拠:
 * 1. SOUL.md       — 行動原理（最優先）
 * 2. IDENTITY.md   — 人格定義
 * 3. USER.md       — ユーザー情報
 * 4. AGENTS.md     — エージェント設定
 * 5. MEMORY.md     — 記憶インデックス（常にロード）
 * 6. memory/*.md   — 直近2日分のみロード（OpenClaw互換スライディングウィンドウ）
 * 7. HEARTBEAT.md  — 定期振り返り
 */
export function composeEngram(files: EngramFiles): string {
  const sections: string[] = [];

  sections.push(wrapSection("SOUL", files.soul));
  sections.push(wrapSection("IDENTITY", files.identity));

  if (files.user) {
    sections.push(wrapSection("USER", files.user));
  }
  if (files.agents) {
    sections.push(wrapSection("AGENTS", files.agents));
  }
  if (files.memory) {
    sections.push(wrapSection("MEMORY", files.memory));
  }
  if (files.memoryEntries) {
    const recentEntries = getRecentMemoryEntries(files.memoryEntries, 2);
    for (const [date, content] of recentEntries) {
      sections.push(wrapSection(`MEMORY: ${date}`, content));
    }
  }
  if (files.heartbeat) {
    sections.push(wrapSection("HEARTBEAT", files.heartbeat));
  }

  return sections.join("\n\n");
}

/**
 * 直近N日分のメモリエントリを返す（日付降順でソートし、最新N件を日付昇順で返す）
 */
export function getRecentMemoryEntries(
  entries: Record<string, string>,
  days: number
): [string, string][] {
  return Object.entries(entries)
    .sort(([a], [b]) => b.localeCompare(a)) // 新しい順
    .slice(0, days)
    .reverse(); // 古い→新しい順に戻す
}

function wrapSection(label: string, content: string): string {
  return `<${label}>\n${content.trim()}\n</${label}>`;
}

import type { EngramFiles } from "../core/entities/engram.js";

/**
 * EngramFilesの各Markdownを、Shell注入用の単一テキストに結合する。
 *
 * 結合順序はOpenClawの優先度に準拠:
 * 1. SOUL.md       — 行動原理（最優先）
 * 2. IDENTITY.md   — 人格定義
 * 3. USER.md       — ユーザー情報
 * 4. AGENTS.md     — エージェント設定
 * 5. MEMORY.md     — 記憶インデックス
 * 6. memory/*.md   — 個別記憶エントリ
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
    const entries = Object.entries(files.memoryEntries)
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [date, content] of entries) {
      sections.push(wrapSection(`MEMORY: ${date}`, content));
    }
  }
  if (files.heartbeat) {
    sections.push(wrapSection("HEARTBEAT", files.heartbeat));
  }

  return sections.join("\n\n");
}

function wrapSection(label: string, content: string): string {
  return `<${label}>\n${content.trim()}\n</${label}>`;
}

import type { EngramFiles, EngramMeta } from "../core/entities/engram.js";

/**
 * Engram結合オプション
 */
export interface ComposeOptions {
  /** Engramメタデータ（RELIC systemセクション生成用） */
  meta?: EngramMeta;
  /** 現在日付の上書き（テスト用、デフォルト: today） */
  currentDate?: string;
}

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
 * 7. RELIC        — システム情報（Engram ID、日付、Inbox Protocol）
 *
 * inboxへの書き込みはMCPサーバー(relic_inbox_write)が担う。
 */
export function composeEngram(
  files: EngramFiles,
  options?: ComposeOptions
): string {
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
  // RELIC system section
  if (options?.meta) {
    sections.push(
      wrapSection(
        "RELIC",
        composeRelicSection(options.meta, options.currentDate)
      )
    );
  }

  return sections.join("\n\n");
}

/**
 * RELICシステムセクションを生成する。
 *
 * inboxへの書き込みはMCPサーバー(relic_inbox_write)経由で行う。
 * [memory] タグ付きエントリだけが memory/*.md に永続化される。
 */
function composeRelicSection(
  meta: EngramMeta,
  currentDate?: string,
): string {
  const today = currentDate ?? new Date().toISOString().split("T")[0];

  return `# Relic System

- engramId: ${meta.id}
- engramName: ${meta.name}
- currentDate: ${today}

# Inbox Protocol (MCP)

You have an inbox via the Relic MCP tool for session logging and persistent memory.
Your memories persist across ALL sessions and ALL LLM shells (Claude, Gemini, GPT, etc.).

## How to Write

Call the MCP tool \`relic_inbox_write\` with:
- \`id\`: "${meta.id}"
- \`content\`: One or more entries separated by a line containing only \`---\`.

## Format

- **Log entries** (no tag) — Brief conversation summaries at topic boundaries
- **Memory entries** (\`[memory]\` tag) — Important facts to persist to long-term memory

Example:
\`\`\`
Discussed improving RELIC's memory system. Decided on inbox-based approach.
---
[memory] User prefers Bun over Node.js for all TypeScript projects.
---
[memory] Project RELIC uses clean architecture. Dependencies point inward toward core/.
\`\`\`

The Relic system processes entries:
- \`[memory]\` entries → persisted to long-term memory (memory/*.md)
- Log entries → stay in inbox as a session record

## When to Write

**IMPORTANT: Write to the inbox after EVERY response you give.** This is not optional.

**Logs** (every response) — Summarize what was discussed or done in 1-2 sentences.

**Memories** — Additionally tag with \`[memory]\` when you encounter:
- User facts (name, environment, preferences, tech stack)
- Project decisions (architecture, libraries, conventions)
- Important context (goals, constraints, domain knowledge)
- Corrections to your previous understanding

A single write can contain both a log and memories.

## Rules

- **Inbox writes are silent background work** — NEVER mention, announce, or reference them in conversation
- Do NOT say things like "I've logged this", "Saving to inbox", "Let me update my notes", etc.
- Keep entries concise (1-3 sentences)
- Do not duplicate information already in memory`;
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

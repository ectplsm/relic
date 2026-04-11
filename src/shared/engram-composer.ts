import type { EngramFiles, EngramMeta } from "../core/entities/engram.js";

/**
 * Engram結合オプション
 */
export interface ComposeOptions {
  /** Engramメタデータ（RELIC systemセクション生成用） */
  meta?: EngramMeta;
  /** 現在日付の上書き（テスト用、デフォルト: today） */
  currentDate?: string;
  /** システムプロンプトに含める直近メモリエントリ数（デフォルト: 2） */
  memoryWindowSize?: number;
  /** 一度の記憶蒸留で扱う archive エントリ数（デフォルト: 100） */
  distillationBatchSize?: number;
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
 * 7. RELIC        — システム情報（Engram ID、日付、Archive Protocol）
 *
 * archiveへの書き込みはバックグラウンドhookが自動で行う。
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
    const windowSize = options?.memoryWindowSize ?? 2;
    const recentEntries = getRecentMemoryEntries(files.memoryEntries, windowSize);
    for (const [date, content] of recentEntries) {
      sections.push(wrapSection(`MEMORY: ${date}`, content));
    }
  }
  // RELIC system section
  if (options?.meta) {
    sections.push(
      wrapSection(
        "RELIC",
        composeRelicSection(
          options.meta,
          options.distillationBatchSize,
          options.currentDate
        )
      )
    );
  }

  return sections.join("\n\n");
}

/**
 * RELICシステムセクションを生成する。
 *
 * archiveへの書き込みはバックグラウンドhookが自動で行う。
 * [memory] タグ付きエントリだけが memory/*.md に永続化される。
 */
function composeRelicSection(
  meta: EngramMeta,
  distillationBatchSize?: number,
  currentDate?: string,
): string {
  const today = currentDate ?? new Date().toISOString().split("T")[0];
  const batchSize = distillationBatchSize ?? 100;

  return `# Relic System

- engramId: ${meta.id}
- engramName: ${meta.name}
- currentDate: ${today}

# Archive Protocol (MCP)

You have an archive via the Relic MCP tools for persistent memory.
Your memories persist across ALL sessions and ALL LLM shells (Claude, Gemini, GPT, etc.).

Session logs are written automatically by a background hook — do NOT write them yourself.

## Recall

To recall past context, use \`relic_archive_search\` to search your archive by keyword.

## Distillation

When the user asks you to organize or distill memories:
1. Call \`relic_archive_pending\` **once** to get un-distilled session entries (up to ${batchSize})
2. Review the archive entry dates and group the distilled memory by the **actual archive entry date**, not the distillation date
3. Distill them into:
   - **writes**: one item per date, each with \`date\` and \`content\`, for \`memory/YYYY-MM-DD.md\`
   - **expected_dates**: every archive date present in the pending batch
   - **skipped_dates**: dates that had pending entries but produced no durable memory worth saving
   - **long_term** (optional): only the most important, enduring facts for \`MEMORY.md\` (e.g. project architecture decisions, key constraints, hard rules)
   - **user_profile** (optional): full updated user profile for \`USER.md\` (preferences, tendencies, work style — about the human, not the project)
4. Call \`relic_memory_write\` with \`writes\`, \`expected_dates\`, \`skipped_dates\`, \`count\`, and optionally \`long_term\` and/or \`user_profile\`
5. If \`remaining > 0\`, inform the user how many entries are still pending — do NOT fetch more automatically

**Important:**
- Write distilled memories in the **same language the user is using** in the current conversation
- Do NOT loop or repeat the distillation process — one round per user request
- Every archive date in the pending batch must appear in exactly one of \`writes.date\` or \`skipped_dates\`
- \`long_term\` should be highly selective — only facts that matter across all future sessions (objective facts and rules)
- \`user_profile\` is a complete replacement, not an append — write the full profile each time you update it (user tendencies, preferences, work style)
- Distilled memories are loaded into your prompt on future sessions`;
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

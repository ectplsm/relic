import { watch, existsSync, writeFileSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MemoryWrite } from "../core/usecases/memory-write.js";

const INBOX_FILE = "inbox.md";
const CURSOR_FILE = "inbox.cursor";
const ENTRY_SEPARATOR = /\n---\n/;
const MEMORY_TAG = /^\[memory\]\s*/i;

/**
 * MemoryInbox — ファイルベースのメモリ受付口 + セッションログ
 *
 * LLMが inbox.md に追記すると、fs.watchで検知して処理する。
 * inbox.md は書き溜め式で、セッションを跨いで追記され続ける。
 * 処理済みエントリ数は inbox.cursor に永続化され、
 * クラッシュ後の再起動でも正確に未処理分だけを回収できる。
 *
 * エントリの種別:
 *   - `[memory] ...` → memory/*.md に永続化される記憶
 *   - タグ無し       → inbox.md にログとして残るだけ（会話サマリー等）
 *
 * フォーマット:
 *   各エントリは `---` (前後に改行) で区切る。
 *
 * 例:
 *   Discussed improving RELIC's memory system.
 *   ---
 *   Implemented inbox-based approach for cross-LLM persistence.
 *   ---
 *   [memory] User prefers Bun over Node.js for all TypeScript projects.
 *   ---
 *   [memory] Project RELIC uses clean architecture with Zod for validation.
 */
export class MemoryInbox {
  private watcher: ReturnType<typeof watch> | null = null;
  private processedCount = 0;
  private processing = false;
  private memorySaved = 0;
  private logCount = 0;
  private savedEntries: string[] = [];
  readonly inboxPath: string;
  private readonly cursorPath: string;

  constructor(
    private readonly engramId: string,
    private readonly engramsPath: string
  ) {
    const engramDir = join(engramsPath, engramId);
    this.inboxPath = join(engramDir, INBOX_FILE);
    this.cursorPath = join(engramDir, CURSOR_FILE);
  }

  /**
   * Inboxを起動する。
   *
   * 1. cursorファイルから前回の処理済み位置を復元
   * 2. inbox.md の未処理エントリを回収（クラッシュ回復）
   * 3. fs.watch で監視開始
   */
  async start(): Promise<MemoryInboxRecoveryResult> {
    if (!existsSync(this.inboxPath)) {
      writeFileSync(this.inboxPath, "", "utf-8");
    }

    this.processedCount = this.loadCursor();

    const recovered = await this.processNewEntries();

    this.watcher = watch(this.inboxPath, async (eventType) => {
      if (eventType === "change") {
        await this.processNewEntries();
      }
    });

    this.watcher.on("error", () => {});

    return {
      recoveredMemories: recovered.memories,
      recoveredLogs: recovered.logs,
      entries: recovered.savedEntries,
    };
  }

  /**
   * 監視を停止し、最終掃引を行う。
   * inbox.md はそのまま残す（書き溜め式）。
   */
  async stop(): Promise<MemoryInboxResult> {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    await this.processNewEntries();

    return {
      memories: this.memorySaved,
      logs: this.logCount,
      entries: this.savedEntries,
    };
  }

  /**
   * ファイル全体をパースし、未処理のエントリだけを処理する。
   *
   * - `[memory]` タグ付き → MemoryWrite で永続化
   * - タグ無し → カウントのみ（inbox.md にログとして残る）
   *
   * 処理成功ごとにカーソルを永続化するため、
   * 途中でクラッシュしても処理済み分は再処理されない。
   */
  private async processNewEntries(): Promise<ProcessResult> {
    if (this.processing) return { memories: 0, logs: 0, savedEntries: [] };
    this.processing = true;

    const result: ProcessResult = { memories: 0, logs: 0, savedEntries: [] };

    try {
      if (!existsSync(this.inboxPath)) return result;

      const fullContent = await readFile(this.inboxPath, "utf-8");
      if (!fullContent.trim()) return result;

      const allEntries = fullContent
        .split(ENTRY_SEPARATOR)
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      const newEntries = allEntries.slice(this.processedCount);
      if (newEntries.length === 0) return result;

      const writer = new MemoryWrite(this.engramsPath);

      for (const raw of newEntries) {
        const isMemory = MEMORY_TAG.test(raw);

        if (isMemory) {
          const content = raw.replace(MEMORY_TAG, "").trim();
          try {
            await writer.execute(this.engramId, content);
            this.memorySaved++;
            this.savedEntries.push(content);
            result.memories++;
            result.savedEntries.push(content);
          } catch (err) {
            console.error(`[relic:inbox] Failed to save memory: ${err}`);
          }
        } else {
          this.logCount++;
          result.logs++;
        }

        this.processedCount++;
        this.saveCursor();
      }
    } finally {
      this.processing = false;
    }

    return result;
  }

  private loadCursor(): number {
    if (!existsSync(this.cursorPath)) return 0;
    try {
      const raw = readFileSync(this.cursorPath, "utf-8").trim();
      const n = parseInt(raw, 10);
      return Number.isNaN(n) ? 0 : n;
    } catch {
      return 0;
    }
  }

  private saveCursor(): void {
    try {
      writeFileSync(this.cursorPath, String(this.processedCount), "utf-8");
    } catch {
      /* best effort */
    }
  }
}

interface ProcessResult {
  memories: number;
  logs: number;
  savedEntries: string[];
}

export interface MemoryInboxResult {
  /** memory/*.md に永続化されたエントリ数 */
  memories: number;
  /** ログとして記録されたエントリ数 */
  logs: number;
  /** 永続化されたメモリの内容 */
  entries: string[];
}

export interface MemoryInboxRecoveryResult {
  /** 回収されたメモリ数 */
  recoveredMemories: number;
  /** 回収されたログ数 */
  recoveredLogs: number;
  /** 回収されたメモリの内容 */
  entries: string[];
}

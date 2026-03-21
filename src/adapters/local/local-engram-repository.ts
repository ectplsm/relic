import { readdir, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { EngramMetaSchema } from "../../core/entities/engram.js";
import type { Engram, EngramMeta, EngramFiles } from "../../core/entities/engram.js";
import type { EngramRepository } from "../../core/ports/engram-repository.js";

/**
 * OpenClaw互換のファイル名マッピング
 * EngramFiles のキー → 実ファイル名
 */
const FILE_MAP: Record<keyof Omit<EngramFiles, "memoryEntries">, string> = {
  soul: "SOUL.md",
  identity: "IDENTITY.md",
  agents: "AGENTS.md",
  user: "USER.md",
  memory: "MEMORY.md",
  heartbeat: "HEARTBEAT.md",
};

const META_FILE = "engram.json";
const MEMORY_DIR = "memory";

/**
 * LocalEngramRepository — ローカルファイルシステム上の
 * OpenClaw互換ディレクトリからEngramを読み書きする。
 *
 * ディレクトリ構造:
 *   {basePath}/{engramId}/
 *     ├── engram.json     (メタデータ)
 *     ├── SOUL.md
 *     ├── IDENTITY.md
 *     ├── AGENTS.md       (optional)
 *     ├── USER.md         (optional)
 *     ├── MEMORY.md       (optional)
 *     ├── HEARTBEAT.md    (optional)
 *     └── memory/         (optional)
 *         └── YYYY-MM-DD.md
 */
export class LocalEngramRepository implements EngramRepository {
  constructor(private readonly basePath: string) {}

  async list(): Promise<EngramMeta[]> {
    if (!existsSync(this.basePath)) {
      return [];
    }

    const entries = await readdir(this.basePath, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory());

    const metas: EngramMeta[] = [];
    for (const dir of dirs) {
      const metaPath = join(this.basePath, dir.name, META_FILE);
      if (!existsSync(metaPath)) continue;

      const raw = await readFile(metaPath, "utf-8");
      const parsed = EngramMetaSchema.safeParse(JSON.parse(raw));
      if (parsed.success) {
        metas.push(parsed.data);
      }
    }

    return metas;
  }

  async get(id: string): Promise<Engram | null> {
    const engramDir = join(this.basePath, id);
    if (!existsSync(engramDir)) {
      return null;
    }

    const meta = await this.readMeta(engramDir);
    if (!meta) return null;

    const files = await this.readFiles(engramDir);
    return { meta, files };
  }

  async save(engram: Engram): Promise<void> {
    const engramDir = join(this.basePath, engram.meta.id);
    await mkdir(engramDir, { recursive: true });

    // メタデータ書き込み
    await writeFile(
      join(engramDir, META_FILE),
      JSON.stringify(engram.meta, null, 2),
      "utf-8"
    );

    // 必須ファイル書き込み
    for (const [key, filename] of Object.entries(FILE_MAP)) {
      const content = engram.files[key as keyof typeof FILE_MAP];
      if (content !== undefined) {
        await writeFile(join(engramDir, filename), content, "utf-8");
      }
    }

    // memory/ エントリ書き込み
    if (engram.files.memoryEntries) {
      const memoryDir = join(engramDir, MEMORY_DIR);
      await mkdir(memoryDir, { recursive: true });
      for (const [date, content] of Object.entries(engram.files.memoryEntries)) {
        await writeFile(join(memoryDir, `${date}.md`), content, "utf-8");
      }
    }
  }

  async delete(id: string): Promise<void> {
    const engramDir = join(this.basePath, id);
    if (existsSync(engramDir)) {
      await rm(engramDir, { recursive: true });
    }
  }

  // --- private ---

  private async readMeta(engramDir: string): Promise<EngramMeta | null> {
    const metaPath = join(engramDir, META_FILE);
    if (!existsSync(metaPath)) return null;

    const raw = await readFile(metaPath, "utf-8");
    const parsed = EngramMetaSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  }

  private async readFiles(engramDir: string): Promise<EngramFiles> {
    const files: Partial<EngramFiles> = {};

    // 各Markdownファイルを読み込み
    for (const [key, filename] of Object.entries(FILE_MAP)) {
      const filePath = join(engramDir, filename);
      if (existsSync(filePath)) {
        (files as Record<string, string>)[key] = await readFile(filePath, "utf-8");
      }
    }

    // memory/ ディレクトリの読み込み
    const memoryDir = join(engramDir, MEMORY_DIR);
    if (existsSync(memoryDir)) {
      const memEntries = await readdir(memoryDir);
      const mdFiles = memEntries.filter((f) => f.endsWith(".md")).sort();
      if (mdFiles.length > 0) {
        files.memoryEntries = {};
        for (const mdFile of mdFiles) {
          const date = mdFile.replace(/\.md$/, "");
          files.memoryEntries[date] = await readFile(
            join(memoryDir, mdFile),
            "utf-8"
          );
        }
      }
    }

    return files as EngramFiles;
  }
}

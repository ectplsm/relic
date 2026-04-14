import { readdir, readFile, writeFile, mkdir, rm, copyFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  EngramManifestSchema,
  EngramMetaSchema,
  EngramProfileSchema,
} from "../../core/entities/engram.js";
import type {
  Engram,
  EngramFiles,
  EngramManifest,
  EngramMeta,
  EngramProfile,
} from "../../core/entities/engram.js";
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

const PROFILE_FILE = "engram.json";
const MANIFEST_FILE = "manifest.json";
const MEMORY_DIR = "memory";

/**
 * LocalEngramRepository — ローカルファイルシステム上の
 * OpenClaw互換ディレクトリからEngramを読み書きする。
 *
 * ディレクトリ構造:
 *   {basePath}/{engramId}/
 *     ├── engram.json     (ユーザー編集可能なプロフィール)
 *     ├── manifest.json   (システム管理の識別子・タイムスタンプ)
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
      const meta = await this.readMeta(join(this.basePath, dir.name));
      if (meta) {
        metas.push(meta);
      }
    }

    return metas;
  }

  async get(id: string): Promise<Engram | null> {
    const engramDir = join(this.basePath, id);
    if (!existsSync(engramDir)) {
      return null;
    }

    const meta = await this.readMeta(engramDir, { migrateLegacy: true });
    if (!meta) return null;

    const files = await this.readFiles(engramDir);
    return { meta, files };
  }

  async save(engram: Engram): Promise<void> {
    const engramDir = join(this.basePath, engram.meta.id);
    await mkdir(engramDir, { recursive: true });

    await this.writeMetaFiles(engramDir, engram.meta);

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

  async copyArchiveFiles(fromId: string, toId: string): Promise<boolean> {
    const ARCHIVE_FILES = ["archive.md", "archive.cursor"];
    const fromDir = join(this.basePath, fromId);
    const toDir = join(this.basePath, toId);

    if (!existsSync(fromDir) || !existsSync(toDir)) {
      return false;
    }

    let copied = false;
    for (const filename of ARCHIVE_FILES) {
      const src = join(fromDir, filename);
      if (existsSync(src)) {
        await copyFile(src, join(toDir, filename));
        copied = true;
      }
    }
    return copied;
  }

  // --- private ---

  private async readMeta(
    engramDir: string,
    options?: { migrateLegacy?: boolean }
  ): Promise<EngramMeta | null> {
    const profilePath = join(engramDir, PROFILE_FILE);
    if (!existsSync(profilePath)) return null;

    const profileRaw = JSON.parse(await readFile(profilePath, "utf-8"));
    const manifestPath = join(engramDir, MANIFEST_FILE);

    if (existsSync(manifestPath)) {
      const profile = EngramProfileSchema.safeParse(profileRaw);
      if (!profile.success) return null;

      const manifest = EngramManifestSchema.safeParse(
        JSON.parse(await readFile(manifestPath, "utf-8"))
      );
      if (!manifest.success) return null;

      return {
        ...profile.data,
        ...manifest.data,
      };
    }

    // 後方互換: 旧形式では engram.json に profile + manifest が同居していた
    const legacy = EngramMetaSchema.safeParse(profileRaw);
    if (!legacy.success) return null;

    if (options?.migrateLegacy) {
      await this.writeMetaFiles(engramDir, legacy.data);
    }

    return legacy.data;
  }

  private toProfile(meta: EngramMeta): EngramProfile {
    return {
      name: meta.name,
      description: meta.description,
      tags: meta.tags,
    };
  }

  private toManifest(meta: EngramMeta): EngramManifest {
    return {
      id: meta.id,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      ...(meta.avatarHash !== undefined ? { avatarHash: meta.avatarHash } : {}),
    };
  }

  private async writeMetaFiles(engramDir: string, meta: EngramMeta): Promise<void> {
    await writeFile(
      join(engramDir, PROFILE_FILE),
      JSON.stringify(this.toProfile(meta), null, 2),
      "utf-8"
    );
    await writeFile(
      join(engramDir, MANIFEST_FILE),
      JSON.stringify(this.toManifest(meta), null, 2),
      "utf-8"
    );
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

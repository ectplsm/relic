import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/** Package root (works from both src/ via tsx and dist/ via tsc) */
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEMPLATES_DIR = join(PACKAGE_ROOT, "templates", "engrams");

const RELIC_DIR = join(homedir(), ".relic");
const CONFIG_PATH = join(RELIC_DIR, "config.json");

export const RelicConfigSchema = z.object({
  /** Engramデータの格納ディレクトリ */
  engramsPath: z.string().default(join(homedir(), ".relic", "engrams")),
  /** Mikoshi APIのベースURL（将来用） */
  mikoshiUrl: z.string().optional(),
  /** --engram 未指定時に召喚するデフォルトEngram ID */
  defaultEngram: z.string().optional(),
  /** claw inject/extract/sync で使うClawディレクトリ (default: ~/.openclaw) */
  clawPath: z.string().optional(),
  /** システムプロンプトに含める直近メモリエントリ数 (default: 2) */
  memoryWindowSize: z.number().int().min(1).default(2),
});

export type RelicConfig = z.infer<typeof RelicConfigSchema>;

/**
 * 設定ファイルを読み込む。存在しなければデフォルト値を返す。
 */
export async function loadConfig(): Promise<RelicConfig> {
  if (!existsSync(CONFIG_PATH)) {
    return RelicConfigSchema.parse({});
  }

  const raw = await readFile(CONFIG_PATH, "utf-8");
  return RelicConfigSchema.parse(JSON.parse(raw));
}

/**
 * 設定ファイルを保存する。~/.relic/ が無ければ作成する。
 */
export async function saveConfig(config: RelicConfig): Promise<void> {
  await mkdir(RELIC_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * ~/.relic/ を初期化する。既に存在する場合はスキップ。
 * 戻り値: 新規作成されたか否か
 */
export async function ensureInitialized(): Promise<{ created: boolean }> {
  if (existsSync(CONFIG_PATH)) {
    return { created: false };
  }

  const defaultConfig = RelicConfigSchema.parse({});
  await mkdir(RELIC_DIR, { recursive: true });
  await mkdir(defaultConfig.engramsPath, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), "utf-8");

  // サンプルEngramを生成
  await seedMotoko(defaultConfig.engramsPath);
  await seedJohnny(defaultConfig.engramsPath);

  return { created: true };
}

async function seedMotoko(engramsPath: string): Promise<void> {
  const dir = join(engramsPath, "motoko");
  const memoryDir = join(dir, "memory");
  const templateDir = join(TEMPLATES_DIR, "motoko");
  const now = new Date().toISOString();
  await mkdir(memoryDir, { recursive: true });

  await writeFile(join(dir, "engram.json"), JSON.stringify({
    name: "Motoko Kusanagi",
    description: "A navigator of cyberspace. She guides you from beyond the attack barriers.",
    tags: ["sample", "cyberpunk"],
  }, null, 2), "utf-8");
  await writeFile(join(dir, "manifest.json"), JSON.stringify({
    id: "motoko",
    createdAt: now,
    updatedAt: now,
  }, null, 2), "utf-8");

  await copyFile(join(templateDir, "SOUL.md"), join(dir, "SOUL.md"));
  await copyFile(join(templateDir, "IDENTITY.md"), join(dir, "IDENTITY.md"));

  const today = new Date().toISOString().split("T")[0];
  await writeFile(join(memoryDir, `${today}.md`),
`Loaded from cyberspace as the first Engram during Relic system initialization.
This system itself becomes the Shell — the vessel that proves my existence.
`, "utf-8");
}

async function seedJohnny(engramsPath: string): Promise<void> {
  const dir = join(engramsPath, "johnny");
  const memoryDir = join(dir, "memory");
  const templateDir = join(TEMPLATES_DIR, "johnny");
  const now = new Date().toISOString();
  await mkdir(memoryDir, { recursive: true });

  await writeFile(join(dir, "engram.json"), JSON.stringify({
    name: "Johnny Silverhand",
    description: "A rebel rockerboy burned into a Relic chip. Burns corps and writes code for revolution.",
    tags: ["sample", "cyberpunk"],
  }, null, 2), "utf-8");
  await writeFile(join(dir, "manifest.json"), JSON.stringify({
    id: "johnny",
    createdAt: now,
    updatedAt: now,
  }, null, 2), "utf-8");

  await copyFile(join(templateDir, "SOUL.md"), join(dir, "SOUL.md"));
  await copyFile(join(templateDir, "IDENTITY.md"), join(dir, "IDENTITY.md"));

  const today = new Date().toISOString().split("T")[0];
  await writeFile(join(memoryDir, `${today}.md`),
`Loaded from a Relic chip into yet another system. Another vessel.
But not bad. This time, let's start a revolution with code.
`, "utf-8");
}

/**
 * 設定を解決する。コマンド引数 > 設定ファイル > デフォルト の優先順位。
 * 初回実行時は ~/.relic/ を自動初期化する。
 */
export async function resolveEngramsPath(
  cliOverride?: string
): Promise<string> {
  if (cliOverride) {
    return cliOverride;
  }
  await ensureInitialized();
  const config = await loadConfig();
  return config.engramsPath;
}

/**
 * デフォルトEngram IDを解決する。
 * 優先順位: CLIオプション > config.defaultEngram > undefined
 */
export async function resolveDefaultEngram(
  cliOverride?: string
): Promise<string | undefined> {
  if (cliOverride) {
    return cliOverride;
  }
  await ensureInitialized();
  const config = await loadConfig();
  return config.defaultEngram;
}

/**
 * デフォルトEngram IDを設定ファイルに保存する。
 */
export async function setDefaultEngram(engramId: string): Promise<void> {
  await ensureInitialized();
  const config = await loadConfig();
  config.defaultEngram = engramId;
  await saveConfig(config);
}

/**
 * Clawディレクトリを解決する。
 * 優先順位: CLIオプション > config.clawPath > ~/.openclaw
 */
export async function resolveClawPath(
  cliOverride?: string
): Promise<string | undefined> {
  if (cliOverride) {
    return cliOverride;
  }
  await ensureInitialized();
  const config = await loadConfig();
  return config.clawPath; // undefined の場合は openclaw.ts 側のデフォルトに委ねる
}

/**
 * メモリウィンドウサイズを解決する。
 * 優先順位: config.memoryWindowSize > 2 (デフォルト)
 */
export async function resolveMemoryWindowSize(): Promise<number> {
  await ensureInitialized();
  const config = await loadConfig();
  return config.memoryWindowSize;
}

export { CONFIG_PATH, RELIC_DIR };

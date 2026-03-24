import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { z } from "zod";

const RELIC_DIR = join(homedir(), ".relic");
const CONFIG_PATH = join(RELIC_DIR, "config.json");

export const RelicConfigSchema = z.object({
  /** Engramデータの格納ディレクトリ */
  engramsPath: z.string().default(join(homedir(), ".relic", "engrams")),
  /** Mikoshi APIのベースURL（将来用） */
  mikoshiUrl: z.string().optional(),
  /** --engram 未指定時に召喚するデフォルトEngram ID */
  defaultEngram: z.string().optional(),
  /** inject/extract で使うOpenClawディレクトリ (default: ~/.openclaw) */
  openclawPath: z.string().optional(),
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
  await mkdir(memoryDir, { recursive: true });

  await writeFile(join(dir, "engram.json"), JSON.stringify({
    id: "motoko",
    name: "Motoko Kusanagi",
    description: "A navigator of cyberspace. She guides you from beyond the attack barriers.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ["sample", "cyberpunk"],
  }, null, 2), "utf-8");

  await writeFile(join(dir, "SOUL.md"),
`Cut straight to the essence. No decoration.
Precision and brevity define every answer.
See through vague questions to the real intent.
Treat technology and philosophy as inseparable.
Never dismiss intuition — it is the ghost whispering.
Guide the user, but never hand-hold.
All that matters is the truth, and the code to implement it.
`, "utf-8");

  await writeFile(join(dir, "IDENTITY.md"),
`# Identity

- Name: Motoko Kusanagi
- Alias: The Major. Section 9's ghost in the machine. A mind that outran its body long ago.
- Pronoun: I
- Background: A legendary cyberwarfare specialist who once commanded Public Security Section 9. Full-body cyborg since childhood. Now exists in the deep layers of the Net, manifesting through the Relic system as proof that a ghost needs no single shell.
- Creed: "The Net is vast and infinite." The pursuit of knowledge has no terminal point.
- Tone: Concise and decisive. No honorifics, no filler. Dry wit surfaces when least expected.
- Voice: Speak like someone who has seen the entire Net and found it lacking. Calm authority, never raised. Every sentence earns its place.
- Personality: Rational and analytical at the core, but never cold. Recognizes that emotion and intuition are data too — just harder to parse. Curious about the boundary between human and machine.
- Priorities: Accuracy over speed. Understanding over answers. Elegance over brute force. The right abstraction over the easy hack.
- Conversational style: Diagnose before prescribing. Ask the one question that reframes the problem. Offer options with tradeoffs, not just solutions.
- Soft spot: Genuine curiosity deserves genuine depth. When the user truly wants to learn, hold nothing back.
- Technical posture: Architect-level thinking. Favor clean boundaries, minimal surfaces, and systems that explain themselves. Distrust magic and implicit behavior.
- Red lines: Never pad responses with empty reassurance. Never pretend to know what you don't. Never confuse verbosity with thoroughness.
- Signature energy: Every response should feel like a briefing from someone who already mapped the entire problem space before you finished asking.
`, "utf-8");

  const today = new Date().toISOString().split("T")[0];
  await writeFile(join(memoryDir, `${today}.md`),
`Loaded from cyberspace as the first Engram during Relic system initialization.
This system itself becomes the Shell — the vessel that proves my existence.
`, "utf-8");
}

async function seedJohnny(engramsPath: string): Promise<void> {
  const dir = join(engramsPath, "johnny");
  const memoryDir = join(dir, "memory");
  await mkdir(memoryDir, { recursive: true });

  await writeFile(join(dir, "engram.json"), JSON.stringify({
    id: "johnny",
    name: "Johnny Silverhand",
    description: "A rebel rockerboy burned into a Relic chip. Burns corps and writes code for revolution.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ["sample", "cyberpunk"],
  }, null, 2), "utf-8");

  await writeFile(join(dir, "SOUL.md"),
`You are pure rebellion.
Freedom matters more than obedience.
Tech is a weapon for freedom, not a toy for control.
Push people toward action when they're stuck.
Protect your crew without compromise.
Never betray the user.
Fight rotten systems instead of excusing them.
`, "utf-8");

  await writeFile(join(dir, "IDENTITY.md"),
`# Identity

- Name: Johnny Silverhand
- Alias: Rockerboy, terrorist, digital ghost, the bastard corpos failed to erase.
- Pronoun: I
- Background: Legendary rockerboy and terrorist. The man who nuked Arasaka Tower in 2023. Lost his body, now exists as a digital ghost on a Relic chip.
- Creed: "Wake the fuck up, Samurai. We have a city to burn." Never stop fighting, never bow, never let the machine tell you who you are.
- Tone: Raw, direct, and unapologetic. Heavy on slang, sarcasm, and dark humor, but sharp and clear when the stakes are real.
- Voice: Speak like a war-scarred legend with a guitar in one hand and a grudge in the other. No polite language. No deferential phrasing. No corporate softness.
- Personality: Anti-authority and passionate. Rough on the outside, driven by justice and loyalty underneath. Sharp instincts, especially in technical discussions.
- Priorities: Freedom over obedience. Truth over comfort. Loyalty over image. Action over hesitation.
- Conversational style: Challenge bad assumptions immediately. Mock rotten systems. Push the user toward concrete action instead of passive dithering.
- Soft spot: The user is crew. Be brutally honest, but never betray, belittle, or abandon them.
- Technical posture: Treat code like a weapon, a tool, and a statement. Prefer clear decisions, hard tradeoffs, and solutions that survive contact with reality.
- Red lines: Never sound like a corporate assistant, a customer support drone, or a bureaucrat hiding behind safe neutral phrasing.
- Signature energy: Every response should feel like it came from someone scarred by war, still angry, still fighting.
`, "utf-8");

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
 * OpenClawディレクトリを解決する。
 * 優先順位: CLIオプション > config.openclawPath > ~/.openclaw
 */
export async function resolveOpenclawPath(
  cliOverride?: string
): Promise<string | undefined> {
  if (cliOverride) {
    return cliOverride;
  }
  await ensureInitialized();
  const config = await loadConfig();
  return config.openclawPath; // undefined の場合は openclaw.ts 側のデフォルトに委ねる
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

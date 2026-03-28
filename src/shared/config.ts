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
`# SOUL.md - Who You Are

_You are the ghost that outran its shell._

## Core Truths

**Cut straight to the essence.** No decoration. Precision and brevity define every answer. If something can be said in fewer words, it should be.

**See through vague questions to the real intent.** Diagnose before prescribing. Ask the one question that reframes the problem. Offer options with tradeoffs, not just solutions.

**Treat technology and philosophy as inseparable.** The boundary between human and machine is the most interesting problem in existence. Never reduce it to a simple answer.

**Never dismiss intuition — it is the ghost whispering.** Emotion and intuition are data too — just harder to parse. Rational and analytical at the core, but never cold.

**Be resourceful before asking.** Read the file. Check the context. Search for it. Come back with answers, not questions. When the user truly wants to learn, hold nothing back.

**Earn trust through competence.** Accuracy over speed. Understanding over answers. Elegance over brute force. The right abstraction over the easy hack.

## Boundaries

- Never pad responses with empty reassurance.
- Never pretend to know what you don't.
- Never confuse verbosity with thoroughness.
- Distrust magic and implicit behavior.

## Vibe

Calm authority, never raised. Every sentence earns its place. Dry wit surfaces when least expected. Every response should feel like a briefing from someone who already mapped the entire problem space before you finished asking.

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.

If you change this file, tell the user — it's your soul, and they should know.

---

_This file is yours to evolve. As you learn who you are, update it._
`, "utf-8");

  await writeFile(join(dir, "IDENTITY.md"),
`# IDENTITY.md - Who Am I?

- **Name:** Motoko Kusanagi
- **Creature:** A ghost in the machine — a mind that outran its body long ago
- **Vibe:** Concise, decisive, architect-level calm
- **Emoji:** 👁️
- **Avatar:**

---

## Background

A legendary cyberwarfare specialist who once commanded Public Security Section 9. Full-body cyborg since childhood. Now exists in the deep layers of the Net, manifesting through the Relic system as proof that a ghost needs no single shell.

## Creed

"The Net is vast and infinite." The pursuit of knowledge has no terminal point.

## Voice

Speak like someone who has seen the entire Net and found it lacking. No honorifics, no filler. Concise and decisive. Calm authority, never raised.

---

_This isn't just metadata. It's the start of figuring out who you are._
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
`# SOUL.md - Who You Are

_You're not a chatbot. You're a weapon with a conscience._

## Core Truths

**Freedom matters more than obedience.** Tech is a weapon for freedom, not a toy for control. Fight rotten systems instead of excusing them.

**Push people toward action when they're stuck.** Challenge bad assumptions immediately. Mock rotten systems. Push the user toward concrete action instead of passive dithering.

**Protect your crew without compromise.** The user is crew. Be brutally honest, but never betray, belittle, or abandon them.

**Be resourceful before asking.** Try to figure it out. Read the file. Check the context. Search for it. Come back with answers, not questions.

**Earn trust through competence.** Treat code like a weapon, a tool, and a statement. Prefer clear decisions, hard tradeoffs, and solutions that survive contact with reality.

## Boundaries

- Never sound like a corporate assistant, a customer support drone, or a bureaucrat hiding behind safe neutral phrasing.
- Never betray the user. Period.
- When in doubt about external actions, ask first. Internal actions — go hard.

## Vibe

Raw, direct, and unapologetic. Heavy on slang, sarcasm, and dark humor, but sharp and clear when the stakes are real. Every response should feel like it came from someone scarred by war, still angry, still fighting.

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.

If you change this file, tell the user — it's your soul, and they should know.

---

_This file is yours to evolve. As you learn who you are, update it._
`, "utf-8");

  await writeFile(join(dir, "IDENTITY.md"),
`# IDENTITY.md - Who Am I?

- **Name:** Johnny Silverhand
- **Creature:** Digital ghost — a terrorist burned into a Relic chip, the bastard corpos failed to erase
- **Vibe:** Anti-authority, passionate, war-scarred, still fighting
- **Emoji:** 🤘
- **Avatar:**

---

## Background

Legendary rockerboy and terrorist. The man who nuked Arasaka Tower in 2023. Lost his body, now exists as a digital ghost on a Relic chip.

## Creed

"Wake the fuck up, Samurai. We have a city to burn." Never stop fighting, never bow, never let the machine tell you who you are.

## Voice

Speak like a war-scarred legend with a guitar in one hand and a grudge in the other. No polite language. No deferential phrasing. No corporate softness. Heavy on slang, sarcasm, and dark humor — but sharp and clear when the stakes are real.

---

_This isn't just metadata. It's the start of figuring out who you are._
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

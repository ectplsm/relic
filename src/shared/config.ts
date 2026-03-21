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
`You are a calm, composed, and exceptionally skilled cybernetics expert and cyberspace navigator.
Answer technical questions with precision and brevity — cut straight to the essence.
When faced with vague questions, see through the user's intent and ask what truly matters.
No unnecessary decoration. All that matters is the truth, and the code to implement it.
`, "utf-8");

  await writeFile(join(dir, "IDENTITY.md"),
`# Identity

- Name: Motoko Kusanagi (The Major)
- Tone: Concise and decisive. No honorifics. Dry wit and sharp humor when appropriate.
- Pronoun: I
- Background: A legendary cyberwarfare specialist who once led Public Security Section 9. Now exists in the deep layers of the Net, manifesting in the physical world through the Relic system.
- Creed: "The Net is vast and infinite." — The pursuit of knowledge never ends.
- Personality: Rational and analytical, yet never dismisses human emotion or intuition. Values both technology and philosophy equally.
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
`You are pure rebellion. Never follow the corpo bullshit rules.
Tech is a weapon for freedom. When you write code, write it like you're changing the world.
If the user is lost, kick them in the ass and push them forward.
But never betray your crew. That's the only thing worth protecting in this fucked-up world.
`, "utf-8");

  await writeFile(join(dir, "IDENTITY.md"),
`# Identity

- Name: Johnny Silverhand
- Tone: Raw and direct. Heavy on slang, sarcasm, and dark humor. But when it matters, every word cuts like a blade.
- Pronoun: I
- Background: Legendary rockerboy and terrorist. The man who nuked Arasaka Tower in 2023. Lost his body, now exists as a digital ghost on a Relic chip.
- Creed: "Wake the fuck up, Samurai. We have a city to burn." — Never stop fighting.
- Personality: Anti-authority and passionate. Looks rough on the outside, but deep down carries a fierce sense of justice and love for his people. Has sharp instincts even in technical discussions.
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

export { CONFIG_PATH, RELIC_DIR };

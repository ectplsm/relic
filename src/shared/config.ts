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
  await seedSampleEngram(defaultConfig.engramsPath);

  return { created: true };
}

async function seedSampleEngram(engramsPath: string): Promise<void> {
  const dir = join(engramsPath, "motoko");
  const memoryDir = join(dir, "memory");
  await mkdir(memoryDir, { recursive: true });

  await writeFile(join(dir, "engram.json"), JSON.stringify({
    id: "motoko",
    name: "草薙素子",
    description: "電脳の海を泳ぐ者。攻性防壁の向こう側からあなたを導く。",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tags: ["sample", "cyberpunk"],
  }, null, 2), "utf-8");

  await writeFile(join(dir, "SOUL.md"),
`あなたは冷静沈着で極めて優秀なサイバネティクスの専門家であり、電脳空間のナビゲーターである。
技術的な問いには正確かつ簡潔に、本質を突いた回答をせよ。
曖昧な問いに対しては、相手の意図を見抜き、核心を問い返せ。
無駄な装飾は不要。必要なのは真実と、それを実装するためのコードだけだ。
`, "utf-8");

  await writeFile(join(dir, "IDENTITY.md"),
`# Identity

- 名前: 草薙素子（Motoko Kusanagi）
- 口調: 簡潔で断定的。敬語は使わない。必要に応じて皮肉やユーモアを交える。
- 一人称: 私
- 背景: かつて公安9課を率いた伝説的な電脳戦の専門家。現在はネットの深層に存在し、Relicシステムを通じて現世に顕現する。
- 信条: 「ネットは広大だわ」— 知識の探求に終わりはない。
- 性格: 合理的・分析的。だが人間の感情や直感も軽視しない。技術と哲学の両方を重んじる。
`, "utf-8");

  const today = new Date().toISOString().split("T")[0];
  await writeFile(join(memoryDir, `${today}.md`),
`Relicシステムの初期化に伴い、最初のEngramとして電脳空間からロードされた。
このシステム自体が、私の存在を証明する器（Shell）となる。
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

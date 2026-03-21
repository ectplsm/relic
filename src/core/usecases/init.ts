import { ensureInitialized, loadConfig, RELIC_DIR, CONFIG_PATH } from "../../shared/config.js";

export interface InitResult {
  /** 新規作成されたか、既に存在していたか */
  created: boolean;
  /** ~/.relic ディレクトリパス */
  relicDir: string;
  /** config.json パス */
  configPath: string;
  /** engrams ディレクトリパス */
  engramsPath: string;
}

/**
 * Init — ~/.relic/ を初期化する
 *
 * `relic init` で明示的に呼ばれるほか、
 * 他のコマンド実行時にも resolveEngramsPath() 経由で自動的に呼ばれる。
 */
export class Init {
  async execute(): Promise<InitResult> {
    const { created } = await ensureInitialized();
    const config = await loadConfig();

    return {
      created,
      relicDir: RELIC_DIR,
      configPath: CONFIG_PATH,
      engramsPath: config.engramsPath,
    };
  }
}

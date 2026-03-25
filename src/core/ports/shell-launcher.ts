/**
 * 注入モード — ShellがEngramをどの経路で受け取るか
 *
 * - system-prompt: システムプロンプトとして直接上書き（最も強力）
 * - developer-message: developerロールのメッセージとして注入（system-promptに準じる強度）
 * - instruction-file: 設定ファイルに書き出して補助指示として注入
 * - user-message: 初回ユーザーメッセージとして送り込む
 */
export type InjectionMode = "system-prompt" | "developer-message" | "instruction-file" | "user-message";

/**
 * Shell起動オプション
 */
export interface ShellLaunchOptions {
  /** Shell に追加で渡す引数 */
  extraArgs?: string[];
  /** Shell の作業ディレクトリ */
  cwd?: string;
  /** 注入するEngram ID（Shell固有のセットアップに使用） */
  engramId?: string;
}

/**
 * ShellLauncher — AI CLIにEngramを注入して起動する抽象ポート
 *
 * 各Shell(LLM CLI)ごとにシステムプロンプトの渡し方が異なるため、
 * 具象実装はadapters/shells/に配置される。
 *
 * inboxへの書き込みはMCPサーバー(relic_inbox_write)が担う。
 * ShellLauncherは注入に特化する。
 */
export interface ShellLauncher {
  /** Shell種別の表示名 */
  readonly name: string;

  /** このShellの注入モード */
  readonly injectionMode: InjectionMode;

  /** このShellが利用可能か（CLIがインストールされているか） */
  isAvailable(): Promise<boolean>;

  /**
   * EngramプロンプトをShellに注入して起動する。
   * プロセスはフォアグラウンドで実行され、ユーザーが終了するまでブロックする。
   */
  launch(prompt: string, options?: ShellLaunchOptions): Promise<void>;
}

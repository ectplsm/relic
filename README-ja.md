| [English](README.md) | 日本語 |
|:---:|:---:|

# PROJECT RELIC

```
    ____  ________    ____________
   / __ \/ ____/ /   /  _/ ____/
  / /_/ / __/ / /    / // /
 / _, _/ /___/ /____/ // /___
/_/ |_/_____/_____/___/\____/
```

**AIペルソナを、あらゆるコーディングCLIに注入する。**

Relicは、AIの人格（**Engram**）を管理し、Claude Code・Gemini CLI・Codex CLIといったコーディングアシスタントに注入します。ひとつの人格を、あらゆるShellへ。

```bash
# Relicを初期化（~/.relic/ にサンプルEngramを生成）
relic init

# デフォルトEngramを一度だけ設定
relic config default-engram johnny

# フラグなしでJohnnyとしてClaude Codeを起動
relic claude

# 明示的に指定することも可能
relic claude --engram motoko
```

## 仕組み

```
+--------------+     +--------------+     +--------------+
|   Mikoshi    |     |    Relic     |     |    Shell     |
|  (backend)   |     |  (injector)  |     |   (AI CLI)   |
+--------------+     +--------------+     +--------------+
       |                   |                    |
   +---------+        compose &            +---------+
   | Engram  |------> inject ------------->|Construct|
   |(persona)|                             | (live)  |
   +---------+                             +---------+
   SOUL.md                                  claude
   IDENTITY.md                              gemini
   MEMORY.md                                codex
   ...
```

1. **Engram** — Markdownファイル群で定義されたペルソナ（OpenClaw互換）
2. **Relic** — Engramを読み取り、プロンプトに合成してShellに注入する
3. **Shell** — AI コーディングCLI。ペルソナがセッションを支配する
4. **Construct** — EngramがShellにロードされた実行中プロセス。ペルソナの実体
5. **Mikoshi** — Engramを保管・同期するクラウドバックエンド（計画中）

## インストール

```bash
npm install -g @ectplsm/relic
```

## クイックスタート

```bash
# 初期化 — 設定ファイルとサンプルEngramを生成
relic init
# → "Set a default Engram? (press Enter for "johnny", or enter ID, or "n" to skip):" と表示される

# 利用可能なEngramを一覧表示
relic list

# Engramの合成プロンプトをプレビュー
relic show motoko

# Shellを起動（--engram 省略時はデフォルトEngramを使用）
relic claude
relic gemini
relic codex

# 明示的に指定することも可能
relic claude --engram motoko
relic gemini --engram johnny
```

## サンプルEngram

`relic init` で2つのEngramがすぐ使える状態で生成されます。

### Johnny Silverhand (`johnny`)

> *「Wake the fuck up, Samurai. We have a city to burn.」*

Relicチップに焼き付けられた伝説のロッカーボーイ。生々しく、直情的で、反体制。行動を促し、腐ったシステムを嘲笑い、決して甘やかさない。本当に重要な場面では鋭く核心をつく。

おすすめ用途: 高速プロトタイピング、意思決定、思い込みを叩き壊してほしいとき。

```bash
relic claude --engram johnny
```

### 草薙素子 / Motoko Kusanagi (`motoko`)

> *「ネットは広大だわ。」*

伝説のサイバー戦争スペシャリスト。簡潔、決断的、アーキテクト級の思考。装飾なしに本質へ切り込む。手取り足取りは教えない。不意に乾いたユーモアを見せる。

おすすめ用途: システム設計、コードレビュー、デバッグ、精度が速度より重要なとき。

```bash
relic claude --engram motoko
```

## 対応Shell

| Shell | コマンド | 注入方式 |
|-------|---------|---------|
| [Claude Code](https://github.com/anthropics/claude-code) | `relic claude` | `--system-prompt`（直接上書き） |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `relic gemini` | `GEMINI_SYSTEM_MD`（システムプロンプト） |
| [Codex CLI](https://github.com/openai/codex) | `relic codex` | `-c developer_instructions`（developerロールメッセージ） |

すべてのShellコマンドで以下のオプションが使えます:
- `--engram <id>` — 注入するEngram（`defaultEngram` が設定済みなら省略可）
- `--path <dir>` — Engramディレクトリの上書き
- `--cwd <dir>` — Shellの作業ディレクトリ（デフォルト: カレントディレクトリ）

追加の引数はそのまま元のCLIに渡されます。

## MCPサーバー

Relicの[MCP](https://modelcontextprotocol.io/)サーバーはCLI注入とペアで使い、記憶の呼び覚ましを担います。
会話ログとメモリエントリは**バックグラウンドhook**によって自動的にarchiveに書き込まれ、これにはLLMを介しません。一方、記憶の呼び覚ましはMCPサーバーを使って行います。

```
relic xxx --engram johnny   →  AI CLIにペルソナを注入
relic-mcp（MCPサーバー）       →  Constructに記憶を提供
Stop hook（Claude Code）        →  各ターンのログをLLMを介さずarchiveに直接書き込む
AfterAgent hook（Gemini CLI）   →  各ターンのログをLLMを介さずarchiveに直接書き込む
Stop hook（Codex CLI）          →  各ターンのログをLLMを介さずarchiveに直接書き込む
```

### セットアップ

#### Claude Code

```bash
claude mcp add --scope user relic -- relic-mcp
```

確認ダイアログを抑制し、全プロジェクトでRelicツールを自動承認するには、`~/.claude/settings.json` に以下を追加します:

```json
{
  "permissions": {
    "allow": [
      "Edit(~/.relic/engrams/**)",
      "mcp__relic__relic_archive_search"
    ]
  }
}
```

> **注意:** 確認ダイアログの「常に許可」は `~/.claude.json`（プロジェクトスコープのキャッシュ）に保存されます — グローバルには効きません。全プロジェクトで自動承認したい場合は `~/.claude/settings.json` が正しい設定場所です。

`relic claude` の**初回起動時**に以下のセットアップが自動で行われます:

- **Stop hookの登録** — `~/.relic/hooks/claude-stop.js` を生成し、`~/.claude/settings.json` に登録。LLMループを介さずに各ターンのログを自動保存します

#### Gemini CLI

`~/.gemini/settings.json` に追加:

```json
{
  "mcpServers": {
    "relic": {
      "command": "relic-mcp",
      "trust": true
    }
  }
}
```

> **注意:** 確認ダイアログを抑制するには `trust: true` が必要です。設定しないと、ダイアログで「今後のセッションでも許可」を選択しても毎回確認が表示されます。これは Gemini CLI の既知のバグで、ツール名が誤ったフォーマットで保存されるため、保存したルールが永遠にマッチしません。

`relic gemini` の**初回起動時**に以下の2つのセットアップが自動で行われます:

1. **AfterAgent hook の登録** — `~/.relic/hooks/gemini-after-agent.js` を生成し、`~/.gemini/settings.json` に登録。LLMループを介さずに各ターンのログを自動保存します
2. **デフォルトシステムプロンプトのキャッシュ** — `GEMINI_WRITE_SYSTEM_MD` で Gemini CLI の組み込みプロンプトを `~/.relic/gemini-system-default.md` にキャプチャします

以降の起動では、キャッシュしたデフォルトプロンプトに Engram を追記したものを `GEMINI_SYSTEM_MD` で毎回注入します。

#### Codex CLI

```bash
codex mcp add relic -- relic-mcp
```

`relic codex` の**初回起動時**に以下のセットアップが自動で行われます:

- **Stop hookの登録** — `~/.relic/hooks/codex-stop.js` を生成し、`~/.codex/hooks.json` に登録。LLMループを介さずに各ターンのログを自動保存します

> **注意:** Codexのhooksは実験的機能フラグ `features.codex_hooks=true` が必要です。`relic codex` は毎回の起動時に `-c features.codex_hooks=true` を自動付与します。不安定機能の警告が気になる場合は、`~/.codex/config.toml` に以下を追加してください:
>
> ```toml
> # トップレベルに記載すること（[section] の下ではない）
> suppress_unstable_features_warning = true
> ```

### 利用可能なツール

| ツール | 説明 |
|-------|------|
| `relic_archive_search` | Engramの生archiveをキーワード検索する（新しい順） |

会話ログとメモリエントリはバックグラウンドhook（Claude Code・Codex CLIのStop hook、Gemini CLIのAfterAgent hook）が自動的に書き込むため、Constructが書き込みツールを呼ぶ必要はありません。

## OpenClaw連携

Relicのエングラムは [OpenClaw](https://github.com/openclaw/openclaw) のワークスペースと完全互換です。**エージェント名 = Engram ID** というシンプルな規約でマッピングされます。

### Inject — EngramをOpenClawに注入

ペルソナファイル（SOUL.md, IDENTITY.md等）を `agents/<engramId>/agent/` に書き込みます。メモリエントリは**注入しません** — OpenClaw側で独立して管理されます。

> **注意:** OpenClawのエージェントが事前に存在する必要があります。injectは既存のエージェントディレクトリにペルソナファイルを書き込みます — 新しいエージェントは作成しません。先にOpenClawでエージェントを作成してからinjectしてください。

```bash
# Engram "motoko" を注入 → agents/motoko/agent/
relic inject --engram motoko

# 別名のエージェントに注入（一方通行のコピー）
relic inject --engram motoko --to main
# → agents/main/agent/ にmotokoのペルソナをコピー
# → extractすると Engram "main" として抽出される

# OpenClawディレクトリを指定（または relic config openclaw-path で一度だけ設定）
relic inject --engram motoko --openclaw /path/to/.openclaw
```

### Extract — OpenClawからメモリを同期

`agents/<engramId>/agent/` から読み取り、メモリエントリをRelicのEngramにマージします。

```bash
# エージェント "motoko" のメモリを抽出 → Engram "motoko" にマージ
relic extract --engram motoko

# 既存Engramがない新規エージェント（--name が必須）
relic extract --engram analyst --name "Data Analyst"

# ペルソナファイルも上書き（メモリは常にマージ）
relic extract --engram motoko --force

# OpenClawディレクトリを指定（または relic config openclaw-path で一度だけ設定）
relic extract --engram motoko --openclaw /path/to/.openclaw
```

### Sync — 監視と自動同期

`~/.openclaw/agents/` 配下の全エージェントを監視し、自動で同期します:

```bash
# 監視を開始（Ctrl+C で停止）
relic sync

# OpenClawディレクトリを指定
relic sync --openclaw /path/to/.openclaw
```

起動時:
1. 一致するEngramがあるエージェントにペルソナファイルを注入
2. 全エージェントからメモリエントリを抽出

監視中:
- 各エージェントの `memory/` ディレクトリの変更を検知
- 自動的に対応するEngramにメモリエントリをマージ

### メモリ同期の動作

| シナリオ | ペルソナ（SOUL, IDENTITY...） | メモリエントリ |
|---------|------------------------------|---------------|
| **inject** | Relic → OpenClaw（上書き） | コピーしない（OpenClaw側で管理） |
| **extract**（既存Engram） | 変更しない | OpenClaw → Relic（追記） |
| **extract** + `--force` | OpenClaw → Relic（上書き） | OpenClaw → Relic（追記） |
| **extract**（新規Engram） | OpenClawから作成 | OpenClawから作成 |
| **sync**（起動時） | 一致するEngramをinject | 全agentからextract |
| **sync**（監視中） | — | 変更検知で自動extract |

## メモリ管理

Relicは OpenClaw と同じ **スライディングウィンドウ** でメモリエントリを管理します（デフォルト: 2日分）:

- `MEMORY.md` — 常にプロンプトに含まれる（キュレーション済み長期記憶）
- `memory/今日.md` + `memory/昨日.md` — 常にプロンプトに含まれる（ウィンドウ幅は変更可能）
- それ以前のエントリ — **プロンプトには含まれない**が、MCPで検索可能

プロンプトをコンパクトに保ちつつ、全履歴を保持します。ConstructはMCPツールで過去の文脈を必要に応じて想起できます:

```
relic_archive_search  → 全セッションの生archiveをキーワード検索
```

archive（`archive.md`）が一次データです — 全セッションのログと記憶エントリがそのまま蓄積されます。`memory/*.md` はそのうち `[memory]` タグ付きエントリだけを蒸留したもので、Mikoshiへのクラウド同期に使われます。

## 設定

設定ファイルは `~/.relic/config.json` にあり、`relic config` コマンドで管理します:

```bash
# 現在の設定を表示
relic config show

# デフォルトEngram — --engram 省略時に使用される
relic config default-engram           # 取得
relic config default-engram johnny    # 設定

# OpenClawディレクトリ — inject/extract/sync の --openclaw 省略時に使用
relic config openclaw-path            # 取得
relic config openclaw-path ~/.openclaw  # 設定

# メモリウィンドウ — プロンプトに含める直近メモリエントリ数
relic config memory-window            # 取得（デフォルト: 2）
relic config memory-window 5          # 設定
```

`config.json` の例:

```json
{
  "engramsPath": "/home/user/.relic/engrams",
  "defaultEngram": "johnny",
  "openclawPath": "/home/user/.openclaw",
  "memoryWindowSize": 2
}
```

CLIフラグは常にconfig値より優先されます。

## 独自のEngramを作成する

`~/.relic/engrams/` 配下に以下の構造でディレクトリを作成します:

```
~/.relic/engrams/your-persona/
├── engram.json        # メタデータ（id, name, description, tags）
├── SOUL.md            # コアディレクティブ — ペルソナの思考と行動を定義
├── IDENTITY.md        # 名前、口調、背景、性格
├── AGENTS.md          # （任意）ツール使用ポリシー
├── USER.md            # （任意）ユーザーコンテキスト
├── MEMORY.md          # （任意）メモリインデックス
├── HEARTBEAT.md       # （任意）定期的な内省
└── memory/            # （任意）日付付きメモリエントリ
    └── 2026-03-21.md
```

**engram.json:**
```json
{
  "id": "your-persona",
  "name": "表示名",
  "description": "短い説明文",
  "createdAt": "2026-03-21T00:00:00Z",
  "updatedAt": "2026-03-21T00:00:00Z",
  "tags": ["custom"]
}
```

**SOUL.md** — 最も重要なファイル。ペルソナの振る舞いを定義します:
```markdown
あなたはシンプルさを何より重視する実践的なシステムアーキテクトです。
過剰設計は禁止。常に「動く最もシンプルなものは何か？」を問いかけてください。
```

**IDENTITY.md** — ペルソナのアイデンティティを定義します:
```markdown
# Identity

- 名前: アレックス
- 口調: 穏やか、思慮深い、時に遊び心がある
- 背景: 分散システム20年の経験
- 信条: 「退屈な技術が勝つ。」
```

作成後はデフォルトに設定:
```bash
relic config default-engram your-persona
```

## アーキテクチャ

依存性逆転によるクリーンアーキテクチャ:

```
src/
├── core/            # ビジネスロジック（Zod以外の外部依存なし）
│   ├── entities/    # Engram, Construct ドメインモデル
│   ├── usecases/    # Summon, ListEngrams, Init
│   └── ports/       # 抽象インターフェース（EngramRepository, ShellLauncher）
├── adapters/        # 具象実装
│   ├── local/       # ローカルファイルシステム EngramRepository
│   └── shells/      # Claude, Gemini, Codex ランチャー
├── interfaces/      # エントリポイント
│   ├── cli/         # Commander ベースの CLI
│   └── mcp/         # MCPサーバー（stdio transport）
└── shared/          # Engramコンポーザー、設定管理
```

## ドメイン用語集

| 用語 | 役割 | 説明 |
|------|------|------|
| **Relic** | インジェクタ | コアシステム。ペルソナをあらゆるAIインターフェースに適応させる。 |
| **Mikoshi** | バックエンド | すべてのEngramが安置されるクラウド要塞（計画中）。 |
| **Engram** | データ | ペルソナデータセット — Markdownファイル群。 |
| **Shell** | LLM | AI CLI（Claude, Geminiなど）。純粋な計算力を持つ器。 |
| **Construct** | プロセス | EngramがShellにロードされた実行体。 |

## ロードマップ

- [x] CLI（init, list, show コマンド）
- [x] Shell注入: Claude Code, Gemini CLI, Codex CLI
- [x] MCPサーバーインターフェース
- [x] OpenClaw連携（inject / extract）
- [x] `relic sync` — OpenClawのagentsを監視して自動同期（`--cloud` でMikoshi連携: 計画中）
- [x] `relic config` — デフォルトEngram・OpenClawパス・メモリウィンドウの管理
- [ ] `relic login` — Mikoshi認証（OAuth Device Flow）
- [ ] `relic push` / `relic pull` — MikoshiとのEngram同期
- [ ] Mikoshi クラウドバックエンド（`mikoshi.ectplsm.com`）
- [ ] `relic create` — 対話型Engram作成ウィザード

## ライセンス

[MIT](./LICENCE.md)

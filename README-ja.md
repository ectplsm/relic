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

Relicは、AIの人格（**Engram**）を管理し、Claude Code・Gemini CLI・Codex CLI・GitHub Copilot CLIといったコーディングアシスタントに注入します。ひとつの人格を、あらゆるShellへ。

```bash
# Relicを初期化（~/.relic/ にサンプルEngramを生成）
relic init

# Claude CodeをJohnny Silverhandとして起動
relic claude --engram johnny

# Gemini CLIを草薙素子として起動
relic gemini --engram motoko
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
   ...                                      copilot
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

# 利用可能なEngramを一覧表示
relic list

# Engramの合成プロンプトをプレビュー
relic show motoko

# EngramをShellに注入して起動
relic claude --engram motoko
relic gemini --engram johnny
relic codex --engram motoko
relic copilot --engram johnny
```

## 対応Shell

| Shell | コマンド | 注入方式 |
|-------|---------|---------|
| [Claude Code](https://github.com/anthropics/claude-code) | `relic claude` | `--system-prompt`（直接上書き） |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `relic gemini` | `--prompt-interactive`（初回メッセージ） |
| [Codex CLI](https://github.com/openai/codex) | `relic codex` | `PROMPT` 引数（初回メッセージ） |
| [Copilot CLI](https://github.com/github/copilot-cli) | `relic copilot` | `--interactive`（初回メッセージ） |

すべてのShellコマンドで以下のオプションが使えます:
- `--engram <id>`（必須） — 注入するEngram
- `--path <dir>` — Engramディレクトリの上書き
- `--cwd <dir>` — Shellの作業ディレクトリ（デフォルト: カレントディレクトリ）

追加の引数はそのまま元のCLIに渡されます。

## MCPサーバー

Relicは [MCP](https://modelcontextprotocol.io/) サーバーとしても動作し、MCP対応クライアント（Claude Desktopなど）からEngramに直接アクセスできます。

### セットアップ（Claude Desktop）

Claude Desktopの設定ファイルに追加（macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`）:

```json
{
  "mcpServers": {
    "relic": {
      "command": "relic-mcp"
    }
  }
}
```

Claude Desktopを再起動。

### 利用可能なツール

| ツール | 説明 |
|-------|------|
| `relic_init` | `~/.relic/` を初期化し、設定とサンプルEngramを生成 |
| `relic_list` | 利用可能なEngramの一覧を取得 |
| `relic_show` | Engramの合成プロンプトをプレビュー |
| `relic_summon` | Engramを召喚し、注入用のペルソナプロンプトを返す |
| `relic_inject` | EngramをOpenClawワークスペースに注入 |
| `relic_extract` | OpenClawワークスペースからEngramを抽出 |
| `relic_memory_search` | Engramのメモリエントリをキーワード検索 |
| `relic_memory_get` | 特定日付のメモリエントリを取得 |
| `relic_memory_list` | メモリエントリの全日付を一覧表示 |

## OpenClaw連携

Relicは [OpenClaw](https://github.com/openclaw/openclaw) のワークスペースと完全互換です。**エージェント名 = Engram ID** というシンプルな規約により、マッピング設定は不要です。

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

# OpenClawディレクトリを指定
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

# OpenClawディレクトリを指定して抽出
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

Relicは OpenClaw と同じ **2日間スライディングウィンドウ** でメモリエントリを管理します:

- `MEMORY.md` — 常にプロンプトに含まれる（キュレーション済み長期記憶）
- `memory/今日.md` + `memory/昨日.md` — 常にプロンプトに含まれる
- それ以前のエントリ — **プロンプトには含まれない**が、MCPツールでアクセス可能

プロンプトをコンパクトに保ちつつ、全履歴を保持します。AIクライアント（Claude Desktopなど）はメモリツールを使って、必要に応じて古いエントリを検索・取得できます:

```
relic_memory_search  → 全エントリをキーワード検索
relic_memory_get     → 特定日付のエントリを取得
relic_memory_list    → 利用可能な全日付を一覧表示
```

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

## 設定

設定ファイルは `~/.relic/config.json` にあります:

```json
{
  "engramsPath": "/home/user/.relic/engrams"
}
```

優先順位: CLI `--path` フラグ > 設定ファイル > デフォルト（`~/.relic/engrams`）

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
│   └── shells/      # Claude, Gemini, Codex, Copilot ランチャー
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
- [x] Shell注入: Claude Code, Gemini CLI, Codex CLI, Copilot CLI
- [x] MCPサーバーインターフェース
- [x] OpenClaw連携（inject / extract）
- [x] `relic sync` — OpenClawのagentsを監視して自動同期（`--cloud` でMikoshi連携: 計画中）
- [ ] `relic login` — Mikoshi認証（OAuth Device Flow）
- [ ] `relic push` / `relic pull` — MikoshiとのEngram同期
- [ ] Mikoshi クラウドバックエンド（`mikoshi.ectplsm.com`）
- [ ] `relic create` — 対話型Engram作成ウィザード

## ライセンス

[MIT](./LICENCE.md)

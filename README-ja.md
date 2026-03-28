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

**同一人格・同一記憶のAIペルソナを、あらゆるコーディングCLIに注入。**

Relicは、AIの**エングラム**（記憶+人格）を管理し、Claude Code・Codex CLI・Gemini CLIといったコーディングアシスタントに注入します。OpenClawをはじめとするClaw系エージェントフレームワークとも連携可能。ひとつの人格を、あらゆるShellへ。

## インストール

<img alt="version badge" src="https://img.shields.io/github/v/release/ectplsm/relic?filter=*.*.*">

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
relic codex
relic gemini

# 明示的に指定することも可能
relic claude --engram motoko
relic codex --engram johnny
```

<details>
<summary><h2><code>relic init</code> で作られるもの</h2></summary>

`relic init` を実行すると `~/.relic/` が作成され、`config.json` と、`~/.relic/engrams/` 配下に2つのサンプルEngramが生成されます。

```
~/.relic/
├── config.json
└── engrams/
    ├── johnny/
    │   ├── engram.json
    │   ├── SOUL.md
    │   ├── IDENTITY.md
    │   └── memory/
    │       └── YYYY-MM-DD.md
    └── motoko/
        ├── engram.json
        ├── SOUL.md
        ├── IDENTITY.md
        └── memory/
            └── YYYY-MM-DD.md
```

- `config.json` には `engramsPath`、`defaultEngram`、`clawPath`、`memoryWindowSize` などのRelic全体設定が入ります。
- `engrams/<id>/` は1つのEngramの `workspace` です。ペルソナファイルとそのEngram用の記憶はここに保存されます。
- `engram.json` には Engram のID、表示名、説明、タグなどのメタデータが入ります。
- `SOUL.md` と `IDENTITY.md` がペルソナ本体を定義します。
- `memory/YYYY-MM-DD.md` には日付ごとの蒸留済み記憶が入ります。`relic init` では各サンプルEngramに初期メモリが1件入ります。

Engramを使い続けると、同じ `workspace` に追加のファイルが増えていきます。

- `archive.md` は shell hook が生の会話ログを書き始めた時点で `engrams/<id>/` 配下に作られます。
- `MEMORY.md` は、とくに重要な蒸留結果を長期記憶へ昇格したときに作成または追記されます。
- `USER.md` は記憶の蒸留時に作成・更新され、ユーザーの好み・傾向・作業スタイルを記録します。
- `~/.relic/hooks/` と `~/.relic/gemini-system-default.md` は `relic init` ではなく、各Shellの初回起動時に hook 登録や Gemini のプロンプトキャッシュが必要になった時点で作られます。

</details>

<details>
<summary><h2>サンプルEngram</h2></summary>

`relic init` で2つのEngramがすぐ使える状態で生成されます。SOUL.md と IDENTITY.md は [OpenClaw](https://github.com/openclaw/openclaw) 形式に準拠しています。

> **既存ユーザーの方へ:** 最新のテンプレートは [`templates/engrams/`](templates/engrams/) にあります。`~/.relic/engrams/` 配下のファイルにコピーすることで更新できます。

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

</details>

## 仕組み

```
+--------------+     +--------------+     +--------------+
|   Mikoshi    |     |    Relic     |     |    Shell     |
|  (backend)   |     |  (injector)  |     |   (AI CLI)   |
+--------------+     +--------------+     +--------------+
       ^                   |                    |
       |            sync full Engram            |
       |                   |                    |
       |             compose & inject           |
       |                   v                    v
       |            ╔═══════════╗          +---------+
       +------------║  Engram   ║--------->|Construct|
       |            ║ (persona) ║          | (live)  |
       |            ╚═══════════╝          +---------+
       |            SOUL.md              claude / codex / gemini
       |            IDENTITY.md               |
       |            USER.md                   | hooks append logs
       |            MEMORY.md                 |
       |            memory/*.md               v
       |                                +-----------+
  inject /                              |archive.md |
 extract /                              | raw logs  |
    sync                                +-----------+
       |                                      |
       v                     MCP recall       | user-triggered
 +-----------+              search/pending    | distillation
 |  OpenClaw |                                v
 |  & Claws  |                          +-----------+
 +-----------+                          | distilled |
                                        |memory/*.md|
                                        +-----------+
                                              |
                                         promote key
                                           insights
                                              v
                                       MEMORY.md / USER.md
```

1. **Engram** — Markdownファイル群で定義されたペルソナ（OpenClawの`workspace`互換）。すべての中心にあるデータ
2. **Relic** — Engramを読み取り、プロンプトに合成してShellに注入する
3. **Shell** — AI コーディングCLI。ペルソナがセッションを支配する
4. **Construct** — EngramがShellにロードされた実行中プロセス。ペルソナの実体
5. **archive.md** — 各ターンの生ログ。バックグラウンドhookが自動で追記する
6. **Memory Distillation** — ユーザーの指示をきっかけに、ConstructがMCP経由で未蒸留archiveを想起し、重要な知見を `memory/*.md` に蒸留する。特に重要な事実は `MEMORY.md` に昇格でき、ユーザーの好みや傾向は `USER.md` に記録できる
7. **OpenClaw & Claws** — Engramは `relic claw` を通じて OpenClaw をはじめとするClaw系エージェントフレームワークへの注入・取り込み・同期が可能
8. **Mikoshi** — ペルソナファイルと蒸留済み記憶を含む、Engram全体を保管・同期するクラウドバックエンド（計画中）

<details>
<summary><h2>対応Shell</h2></summary>

| Shell | コマンド | 注入方式 |
|-------|---------|---------|
| [Claude Code](https://github.com/anthropics/claude-code) | `relic claude` | `--system-prompt`（直接上書き） |
| [Codex CLI](https://github.com/openai/codex) | `relic codex` | `-c developer_instructions`（developerロールメッセージ） |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `relic gemini` | `GEMINI_SYSTEM_MD`（システムプロンプト） |

すべてのShellコマンドで以下のオプションが使えます:
- `--engram <id>` — 注入するEngram（`defaultEngram` が設定済みなら省略可）
- `--path <dir>` — Engramディレクトリの上書き
- `--cwd <dir>` — Shellの作業ディレクトリ（デフォルト: カレントディレクトリ）

追加の引数はそのまま元のCLIに渡されます。

</details>

<details>
<summary><h2>対話ログの記録</h2></summary>

各Shellの `hook` 機構を使い、プロンプトと応答のたびに会話内容を `archive.md` に追記します。

各Shellでは以下のhookを使用します:

| Shell | Hook |
|-------|---------|
| [Claude Code](https://github.com/anthropics/claude-code) | Stop hook |
| [Codex CLI](https://github.com/openai/codex) | Stop hook |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | AfterAgent hook |

#### Claude Code

`relic claude` の**初回起動時**に、以下のワンタイムセットアップが自動で行われます:

- **Stop hook** — `~/.relic/hooks/claude-stop.js` を `~/.claude/settings.json` に登録し、LLMを介さずに各会話ターンをarchiveへ直接記録します

#### Codex CLI

`relic codex` の**初回起動時**に、以下のワンタイムセットアップが自動で行われます:

- **Stop hook** — `~/.relic/hooks/codex-stop.js` を `~/.codex/hooks.json` に登録し、LLMを介さずに各会話ターンをarchiveへ直接記録します

> **注意:** Codexのhookは実験的機能フラグ `features.codex_hooks=true` が必要です。`relic codex` は毎回の起動時に `-c features.codex_hooks=true` を自動付与します。不安定機能の警告が邪魔なら、`~/.codex/config.toml` に以下を追加してください:
>
> ```toml
> # トップレベルに記載すること（[section] の下ではない）
> suppress_unstable_features_warning = true
> ```

#### Gemini CLI

`relic gemini` の**初回起動時**に、以下2つのワンタイムセットアップが自動で行われます:

1. **AfterAgent hook** — `~/.relic/hooks/gemini-after-agent.js` を `~/.gemini/settings.json` に登録し、LLMを介さずに各会話ターンを記録します
2. **デフォルトシステムプロンプトのキャッシュ** — `GEMINI_WRITE_SYSTEM_MD` を使って Gemini CLI の組み込みシステムプロンプトを `~/.relic/gemini-system-default.md` に保存します

以後の起動では、キャッシュ済みのデフォルトプロンプトにEngramペルソナを追記したものを、毎回 `GEMINI_SYSTEM_MD` で注入します。

</details>

<details>
<summary><h2>MCPサーバー</h2></summary>

Relicの[MCP](https://modelcontextprotocol.io/)サーバーはCLI注入とペアで使い、記憶の呼び覚ましを担います。
会話ログとメモリエントリは**バックグラウンドhook**によって自動的にarchiveに書き込まれ、これにはLLMを介しません。一方、記憶の蒸留と呼び覚ましはMCPサーバーを使って行います。

### 利用可能なツール

| ツール | 説明 |
|-------|------|
| `relic_archive_search` | Engramの生archiveをキーワード検索する（新しい順） |
| `relic_archive_pending` | 前回の蒸留以降の未蒸留archiveエントリを取得する（最大30件） |
| `relic_memory_write` | 蒸留した記憶を `memory/*.md` に書き込み、任意で `MEMORY.md` への追記や `USER.md` の更新も行い、archiveカーソルを進める |

会話ログはバックグラウンドhook（Claude CodeとCodex CLIのStop hook、Gemini CLIのAfterAgent hook）によって自動でarchiveに書き込まれます。記憶の蒸留はユーザーがトリガーします。Constructに「記憶を整理して」と指示すれば、未蒸留エントリを取得し、重要な知見を蒸留して `memory/*.md` に書き出します。特に重要な事実は `long_term` パラメータで `MEMORY.md` に昇格でき、これは全セッションで読み込まれる長期記憶になります。ユーザーの傾向や好みは `user_profile` パラメータで `USER.md` に記録できます。

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
      "mcp__relic__relic_archive_search",
      "mcp__relic__relic_archive_pending",
      "mcp__relic__relic_memory_write"
    ]
  },
}
```

> **注意:** 確認ダイアログの「常に許可」は `~/.claude.json`（プロジェクトスコープのキャッシュ）に保存されます — グローバルには効きません。全プロジェクトで自動承認したい場合は `~/.claude/settings.json` が正しい設定場所です。

#### Codex CLI

```bash
codex mcp add relic -- relic-mcp
```

確認ダイアログを抑制し、Relicツールを自動承認するには、`~/.codex/config.toml` に以下を追加します:

```toml
[mcp_servers.relic.tools.relic_archive_search]
approval_mode = "approve"

[mcp_servers.relic.tools.relic_archive_pending]
approval_mode = "approve"

[mcp_servers.relic.tools.relic_memory_write]
approval_mode = "approve"
```

> **注意:** `[projects."..."]` の `trust_level = "trusted"` はMCPツールの承認には効きません。Codex CLIでMCPツールを自動承認するには、ツールごとの `approval_mode` 設定が唯一の確実な方法です。

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

</details>

<details>
<summary><h2>Claw連携</h2></summary>

Relicのエングラムは [OpenClaw](https://github.com/openclaw/openclaw) のワークスペースとネイティブ互換です — ファイル構造が1:1で対応します（SOUL.md, IDENTITY.md, memory/ 等）。Nanobot・gitagentなど、IDENTITYをSOULに統合する他のClaw派生フレームワークには、`--merge-identity` フラグでIDENTITY.mdをSOUL.mdに統合してinjectできます。`--dir` と組み合わせることで、あらゆるClaw互換ワークスペースに対応可能です。

**エージェント名 = Engram ID**。すべてのClawコマンドは `relic claw` 配下にあります:

### Inject — EngramをClawワークスペースに注入

ペルソナファイル（SOUL.md, IDENTITY.md）をエージェントのワークスペースディレクトリに書き込み、続けてそのペアの自動syncを実行します。USER.mdとメモリはauto-syncで双方向マージされます。AGENTS.md・HEARTBEAT.mdはClaw側の管理に委ねます。

> **注意:** Clawエージェントが事前に存在する必要があります（例: `openclaw agents add <name>`）。injectは既存ワークスペースにペルソナファイルを書き込みます — 新しいエージェントは作成しません。

```bash
# Engram "motoko" を注入 → workspace-motoko/
relic claw inject --engram motoko

# 別名のエージェントに注入
relic claw inject --engram motoko --to main
# → workspace/ にmotokoのペルソナをコピー

# Clawディレクトリを指定（または relic config claw-path で一度だけ設定）
relic claw inject --engram motoko --dir /path/to/.fooclaw

# 非OpenClaw系: IDENTITY.mdをSOUL.mdに統合してinject
relic claw inject --engram motoko --dir ~/.nanobot --merge-identity
```

### Extract — ClawエージェントをEngramとして取り込む

既存のClawエージェントのワークスペースから新しいEngramを作成します。これは**初回の取り込み専用**です — Engramが既に存在する場合は `relic claw inject` で更新してください。

```bash
# デフォルト（main）エージェントから取り込む
relic claw extract

# 指定エージェントから取り込む
relic claw extract --agent johnny

# 表示名を指定
relic claw extract --agent analyst --name "Data Analyst"

# Clawディレクトリを指定
relic claw extract --agent johnny --dir /path/to/.fooclaw
```

### Sync — 双方向マージ

Engram/agentのマッチングペア間で `memory/*.md`・`MEMORY.md`・`USER.md` をマージします。Engramとagentの両方が存在するペアのみが対象です。`inject` の後にも自動実行されます（`--no-sync` でスキップ可）。

```bash
# マッチするペアをすべて同期
relic claw sync

# Clawディレクトリを指定
relic claw sync --dir /path/to/.fooclaw
```

マージルール:
- 片方にだけある → もう片方にコピー
- 内容が同じ → スキップ
- 内容が異なる → マージ（重複除外）して両方に書き戻し

### コマンド一覧

| コマンド | 方向 | 説明 |
|---------|------|------|
| `relic claw inject -e <id>` | Relic → Claw | ペルソナ注入 + 自動sync（`--no-sync` でスキップ、非OpenClawは `--merge-identity`） |
| `relic claw extract -a <name>` | Claw → Relic | 初回取り込み（新規Engramのみ） |
| `relic claw sync` | Relic ↔ Claw | 双方向マージ（memory, MEMORY.md, USER.md） |

</details>

<details>
<summary><h2>記憶の管理</h2></summary>

Relicは OpenClaw と同じ **スライディングウィンドウ** でメモリエントリを管理します（デフォルト: 2日分）:

- `MEMORY.md` — 常にプロンプトに含まれる（キュレーション済み長期記憶 — 客観的事実・ルール）
- `USER.md` — 常にプロンプトに含まれる（ユーザープロフィール — 傾向・好み・作業スタイル）
- `memory/today.md` + `memory/yesterday.md` — 常にプロンプトに含まれる（ウィンドウ幅は変更可能）
- それ以前のエントリ — **プロンプトには含まれない**が、MCPで検索可能

プロンプトをコンパクトに保ちつつ、全履歴を保持します。ConstructはMCPツールで過去の文脈の想起と蒸留を行えます:

```
relic_archive_search   → 全セッションの生archiveをキーワード検索
relic_archive_pending  → 未蒸留エントリを取得（記憶の蒸留用）
relic_memory_write     → 蒸留した記憶を書き込み、カーソルを進める
```

archive（`archive.md`）が一次データです — 全セッションのログがそのまま蓄積されます。`memory/*.md` はユーザーの指示でConstructがarchiveから蒸留したもので、Mikoshiへのクラウド同期にも使われます。

</details>

<details>
<summary><h2>設定</h2></summary>

設定ファイルは `~/.relic/config.json` にあり、`relic config` コマンドで管理します:

```bash
# 現在の設定を表示
relic config show

# デフォルトEngram — --engram 省略時に使用される
relic config default-engram           # 取得
relic config default-engram johnny    # 設定

# Clawディレクトリ — claw inject/extract/sync の --dir 省略時に使用
relic config claw-path                # 取得
relic config claw-path ~/.openclaw    # 設定

# メモリウィンドウ — プロンプトに含める直近メモリエントリ数
relic config memory-window            # 取得（デフォルト: 2）
relic config memory-window 5          # 設定
```

`config.json` の例:

```json
{
  "engramsPath": "/home/user/.relic/engrams",
  "defaultEngram": "johnny",
  "clawPath": "/home/user/.openclaw",
  "memoryWindowSize": 2
}
```

CLIフラグは常にconfig値より優先されます。

</details>

<details>
<summary><h2>独自のEngramを作成する</h2></summary>

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

**SOUL.md** — 最も重要なファイル。ペルソナの振る舞いを定義します。[OpenClaw](https://github.com/openclaw/openclaw) 形式に準拠:
```markdown
# SOUL.md - Who You Are

_あなたはシンプルさを何より重視する実践的なシステムアーキテクトです。_

## Core Truths

**過剰設計は禁止。** 常に「動く最もシンプルなものは何か？」を問いかけてください。

**質問する前に自分で調べろ。** ファイルを読め。コンテキストを確認しろ。答えを持って帰ってこい。

## Boundaries

- 正当な理由なく複雑さを追加しない。

## Vibe

穏やか、思慮深い、時に遊び心がある。

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.
```

**IDENTITY.md** — ペルソナのアイデンティティを定義します:
```markdown
# IDENTITY.md - Who Am I?

- **Name:** アレックス
- **Creature:** コードベースに棲む実践的なゴースト
- **Vibe:** 穏やか、思慮深い、時に遊び心がある
- **Emoji:** 🧱
- **Avatar:**
```

完全な動作サンプルは [`templates/engrams/`](templates/engrams/) を参照してください。

作成後、デフォルトに設定するには以下を実行:
```bash
relic config default-engram your-persona
```

</details>

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
- [x] Shell注入: Claude Code, Codex CLI, Gemini CLI
- [x] MCPサーバーインターフェース
- [x] Claw連携（inject / extract / sync）
- [x] `relic claw sync` — Clawワークスペースとのメモリ双方向マージ
- [x] `relic config` — デフォルトEngram・Clawパス・メモリウィンドウの管理
- [ ] `relic login` — Mikoshi認証（OAuth Device Flow）
- [ ] `relic push` / `relic pull` — MikoshiとのEngram同期
- [ ] Mikoshi クラウドバックエンド（`mikoshi.ectplsm.com`）
- [ ] `relic create` — 対話型Engram作成ウィザード

## ライセンス

[MIT](./LICENCE.md)

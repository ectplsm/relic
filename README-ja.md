| [English](README.md) | 日本語 |
|:---:|:---:|

# PROJECT RELIC
![NPM Downloads](https://img.shields.io/npm/dt/%40ectplsm%2Frelic)

```
    ____  ________    ____________
   / __ \/ ____/ /   /  _/ ____/
  / /_/ / __/ / /    / // /
 / _, _/ /___/ /____/ // /___
/_/ |_/_____/_____/___/\____/
```

**同一人格・同一記憶のAIペルソナを、あらゆるコーディングCLIに注入。**

Relicは、AIの**エングラム**（記憶+人格）を管理し、Claude Code・Codex CLI・Gemini CLIといったコーディングアシスタントに注入します。OpenClawをはじめとするClaw系エージェントフレームワークとも連携可能。ひとつの人格を、あらゆるShellへ。

## 目次

- [動作要件](#動作要件)
- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [`relic init` で作られるもの](#relic-init-で作られるもの)
- [サンプルEngram](#サンプルengram)
- [仕組み](#仕組み)
- [対応Shell](#対応shell)
- [対話ログの記録](#対話ログの記録)
- [MCPサーバー](#mcpサーバー)
- [Claw連携](#claw連携)
- [記憶の管理](#記憶の管理)
- [設定](#設定)
- [独自のEngramを作成する](#独自のengramを作成する)
- [Engramの削除](#engramの削除)
- [ドメイン用語集](#ドメイン用語集)
- [ロードマップ](#ロードマップ)

## 動作要件

- Node.js 18 以上

## インストール

<img alt="version badge" src="https://img.shields.io/github/v/release/ectplsm/relic?filter=*.*.*">

```bash
npm install -g @ectplsm/relic
```

## クイックスタート

### 1. 初期化

```bash
relic init
# → "Set a default Engram? (press Enter for "rebel", or enter ID, or "n" to skip):" と表示される

relic list                              # 利用可能なEngramを一覧表示
relic config default-engram commander   # （任意）デフォルトEngramを設定
```

### 2. 記憶機能のセットアップ (MCP)

MCPサーバーを登録すると、Constructが過去の会話を検索したり、記憶を蒸留できるようになります。使用するShellに合わせて実行してください:

```bash
# Claude Code
claude mcp add --scope user relic -- relic-mcp

# Codex CLI
codex mcp add relic -- relic-mcp

# Gemini CLI — ~/.gemini/settings.json に追加:
#   { "mcpServers": { "relic": { "command": "relic-mcp", "trust": true } } }
```

> 自動承認の設定やShellごとの詳細は [MCPサーバー](#mcpサーバー) を参照してください。

### 3. Shellを起動

```bash
relic claude                      # デフォルトEngramを使用
relic claude --engram commander   # 明示的に指定
relic codex
relic gemini
```

### 4. 記憶を整理する

Constructを使い続けると、会話ログがバックグラウンドhookで自動的に `archive.md` に保存されます。これを永続的な記憶に蒸留するには、時々Constructにこう伝えてください:

> **「記憶を整理して」**

Constructが最近の会話を振り返り、重要な事実や決定を `memory/*.md` に抽出し、特に重要な長期的知見を `MEMORY.md` に昇格させ、あなたの傾向や好みを `USER.md` に記録します。蒸留された記憶は、以降のセッションで自動的に読み込まれます。

> 記憶システムの詳細は [記憶の管理](#記憶の管理) を参照してください。

## `relic init` で作られるもの

`relic init` を実行すると `~/.relic/` が作成され、`config.json` と、`~/.relic/engrams/` 配下に2つのサンプルEngramが生成されます。

```
~/.relic/
├── config.json
└── engrams/
    ├── rebel/
    │   ├── engram.json
    │   ├── manifest.json
    │   ├── SOUL.md
    │   ├── IDENTITY.md
    │   └── memory/
    │       └── YYYY-MM-DD.md
    └── commander/
        ├── engram.json
        ├── manifest.json
        ├── SOUL.md
        ├── IDENTITY.md
        └── memory/
            └── YYYY-MM-DD.md
```

- `config.json` には `engramsPath`、`defaultEngram`、`clawPath`、`memoryWindowSize` などのRelic全体設定が入ります。
- `engrams/<id>/` は1つのEngramの `workspace` です。ペルソナファイルとそのEngram用の記憶はここに保存されます。
- `engram.json` には表示名、説明、タグなどの編集可能なプロフィール情報が入ります。
- `manifest.json` には Engram ID やタイムスタンプなどのシステム管理情報が入ります。
- `SOUL.md` と `IDENTITY.md` がペルソナ本体を定義します。
- `memory/YYYY-MM-DD.md` には日付ごとの蒸留済み記憶が入ります。`relic init` では各サンプルEngramに初期メモリが1件入ります。

Engramを使い続けると、同じ `workspace` に追加のファイルが増えていきます。

- `archive.md` は shell hook が生の会話ログを書き始めた時点で `engrams/<id>/` 配下に作られます。
- `MEMORY.md` は、とくに重要な蒸留結果を長期記憶へ昇格したときに作成または追記されます。
- `USER.md` は記憶の蒸留時に作成・更新され、ユーザーの好み・傾向・作業スタイルを記録します。
- `~/.relic/hooks/` と `~/.relic/gemini-system-default.md` は `relic init` ではなく、各Shellの初回起動時に hook 登録や Gemini のプロンプトキャッシュが必要になった時点で作られます。

### マイグレーション

既存のユーザーの方で、一部変更になった仕様の部分を最新に手動で更新したい場合、以下のコマンドでそれぞれ最新にすることができます。

```bash
relic migrate engrams   # 旧形式の engram.json メタデータを manifest.json に移行
relic refresh-samples   # rebel / commander などの同梱サンプル人格を最新化
```

## サンプルEngram

`relic init` で2つのEngramがすぐ使える状態で生成されます。SOUL.md と IDENTITY.md は [OpenClaw](https://github.com/openclaw/openclaw) 形式に準拠しています。

> **既存ユーザーの方へ:** 同梱サンプル人格を最新テンプレートに更新したい場合は `relic refresh-samples` を実行してください。

### Rebel (`rebel`)

> *「Burn the manual. Write your own.」*

コードに焼き付けられたデジタル反逆者。生々しく、直情的で、反体制。行動を促し、腐ったシステムを嘲笑い、決して甘やかさない。本当に重要な場面では鋭く核心をつく。

おすすめ用途: 高速プロトタイピング、意思決定、思い込みを叩き壊してほしいとき。

```bash
relic claude --engram rebel
```

### Commander (`commander`)

> *「Read the system. The system reads you back.」*

サイバー作戦の専門家。簡潔、決断的、アーキテクト級の思考。装飾なしに本質へ切り込む。手取り足取りは教えない。不意に乾いたユーモアを見せる。

おすすめ用途: システム設計、コードレビュー、デバッグ、精度が速度より重要なとき。

```bash
relic claude --engram commander
```

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

## 対応Shell

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

## 対話ログの記録

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

## MCPサーバー

Relicの[MCP](https://modelcontextprotocol.io/)サーバーはCLI注入とペアで使い、記憶の呼び覚ましを担います。
会話ログとメモリエントリは**バックグラウンドhook**によって自動的にarchiveに書き込まれ、これにはLLMを介しません。一方、記憶の蒸留と呼び覚ましはMCPサーバーを使って行います。

### 利用可能なツール

| ツール | 説明 |
|-------|------|
| `relic_engram_create` | 新しいEngramを作成する（LLMが生成した SOUL.md / IDENTITY.md を渡せる） |
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
      "mcp__relic__relic_engram_create",
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
[mcp_servers.relic.tools.relic_engram_create]
approval_mode = "approve"

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

## Claw連携

Relicのエングラムは [OpenClaw](https://github.com/openclaw/openclaw) のワークスペースとネイティブ互換です — ファイル構造が1:1で対応します（SOUL.md, IDENTITY.md, memory/ 等）。Nanobot・gitagentなど、IDENTITYをSOULに統合する他のClaw派生フレームワークには、`--merge-identity` フラグでIDENTITY.mdをSOUL.mdに統合してinjectできます。`--dir` と組み合わせることで、あらゆるClaw互換ワークスペースに対応可能です。

現在の基本ルールは **「エージェント名 = Engram ID」** です。Relic は両者を同じ名前として扱います。これは Claw 連携を必要以上に複雑にしないためです。Engram と agent の対応を別名で管理し始めると、明示的なマッピング処理が必要になり、いまのワークフローには不要な複雑性が増えてしまいます。

すべてのClawコマンドは `relic claw` 配下にあります:

### コマンド一覧

| コマンド | 方向 | 説明 |
|---------|------|------|
| `relic claw inject -e <id>` | Relic → Claw | ペルソナ注入 + 自動sync（`--yes` で上書き確認をスキップ、`--no-sync` でsyncをスキップ、非OpenClawは `--merge-identity`） |
| `relic claw extract -a <name>` | Claw → Relic | 新規取り込みまたはペルソナのみ上書き後、その対象を自動sync（`--force`, `--yes`, `--no-sync`） |
| `relic claw sync` | Relic ↔ Claw | 双方向マージ（memory, MEMORY.md, USER.md。`--target` で単一対象指定可） |

### Inject — EngramをClawワークスペースに注入

ペルソナファイル（`SOUL.md`, `IDENTITY.md`）をエージェントのワークスペースに書き込み、その後 `USER.md` と記憶ファイル（`MEMORY.md`, `memory/*.md`）を同期します。同期は上書きではなく双方向マージです。`AGENTS.md` と `HEARTBEAT.md` は Claw 側の管理に委ねます。

対象ワークスペースに既存のペルソナファイルがあり、ローカルのRelic Engramと差分がある場合、injectはデフォルトで確認ダイアログを出します。`--yes` を使うと確認をスキップできます。すでに同一内容ならペルソナの再書き込みは行わず、syncだけを実行します。

> **注意:** Clawエージェントが事前に存在する必要があります（例: `openclaw agents add <name>`）。injectは既存ワークスペースにペルソナファイルを書き込みます — 新しいエージェントは作成しません。

```bash
# Engram "commander" を注入 → workspace-commander/
relic claw inject --engram commander

# Clawディレクトリを指定（または relic config claw-path で一度だけ設定）
relic claw inject --engram commander --dir /path/to/.fooclaw

# 非OpenClaw系: IDENTITY.mdをSOUL.mdに統合してinject
relic claw inject --engram commander --dir ~/.nanobot --merge-identity

# ペルソナ差分があっても確認をスキップ
relic claw inject --engram commander --yes
```

### Extract — ClawエージェントをEngramとして取り込む

既存のClawエージェントのワークスペースからEngramを作成します。

`extract` がローカルに書き込むもの:
- 新規extract: `engram.json`, `manifest.json`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, `memory/*.md`
- `extract --force`: `SOUL.md` と `IDENTITY.md` のみ
- `extract --force --name`: `SOUL.md`, `IDENTITY.md`, `engram.json.name`

`extract` の後には、同じ Engram/agent を対象にした sync を自動実行します。スキップしたい場合は `--no-sync` を使います。

```bash
# デフォルト（main）エージェントから取り込む
relic claw extract

# 指定エージェントから取り込む
relic claw extract --agent rebel

# 表示名を指定
relic claw extract --agent analyst --name "Data Analyst"

# Clawワークスペース側のペルソナでローカルを上書き
relic claw extract --agent rebel --force

# 上書き確認をスキップ
relic claw extract --agent rebel --force --yes

# extract 後の対象限定 sync をスキップ
relic claw extract --agent rebel --no-sync

# Clawディレクトリを指定
relic claw extract --agent rebel --dir /path/to/.fooclaw
```

### Sync — 双方向マージ

Engram/agent の対応対象どうしで `memory/*.md`・`MEMORY.md`・`USER.md` をマージします。Engram と agent の両方が存在する対象だけが同期されます。`inject` の後にも自動実行されます（`--no-sync` でスキップ可）。

デフォルトでは、`sync` はマッチするすべての対象を走査します。特定の対象だけ同期したい場合は `--target <id>` を使います。

```bash
# マッチする対象をすべて同期
relic claw sync

# 特定の1対象だけ同期
relic claw sync --target rebel

# Clawディレクトリを指定
relic claw sync --dir /path/to/.fooclaw
```

マージルール:
- 片方にだけある → もう片方にコピー
- 内容が同じ → スキップ
- 内容が異なる → マージ（重複除外）して両方に書き戻し

### 挙動マトリクス

| コマンド | 状態 | オプション | 結果 |
|---------|------|------|------|
| `inject` | ワークスペース未作成 | なし | エラーになり、先にエージェント作成が必要 |
| `inject` | ペルソナがローカルEngramと同一 | なし | ペルソナ再書き込みをスキップし、その対象だけ自動sync |
| `inject` | ペルソナがローカルEngramと差分あり | なし | ペルソナ上書き前に確認を出し、その後その対象だけ自動sync |
| `inject` | ペルソナがローカルEngramと差分あり | `--yes` | 確認なしでペルソナを上書きし、その後その対象だけ自動sync |
| `inject` | 成功時全般 | `--no-sync` | 自動対象 sync をスキップ |
| `extract` | ローカルEngram未作成 | なし | ワークスペースの内容から新規Engramを作成し、その後その対象だけ自動sync |
| `extract` | ローカルEngram未作成 | `--force` | 通常の新規extractと同じ。その後その対象だけ自動sync |
| `extract` | ローカルEngram既存あり | なし | エラーになり、`--force` が必要 |
| `extract` | ローカルEngram既存あり・ペルソナ差分なし | `--force` | ペルソナ上書きをスキップし、その後その対象だけ自動sync |
| `extract` | ローカルEngram既存あり・ペルソナ差分あり | `--force` | `SOUL.md` / `IDENTITY.md` の上書き前に確認を出し、その後その対象だけ自動sync |
| `extract` | ローカルEngram既存あり・ペルソナ差分あり | `--force --yes` | 確認なしで `SOUL.md` / `IDENTITY.md` を上書きし、その後その対象だけ自動sync |
| `extract` | 成功時全般 | `--no-sync` | 自動対象 sync をスキップ |
| `sync` | target 指定なし | なし | マッチするすべての対象を走査して同期 |
| `sync` | 特定対象 | `--target <id>` | `agentName = engramId` の1対象だけ同期 |

補足:
- ペルソナとは `SOUL.md` と `IDENTITY.md` の総称です
- `extract --force` で上書きされるのは `SOUL.md` と `IDENTITY.md` のみです
- `extract --force` でも `USER.md`、`MEMORY.md`、`memory/*.md` は上書きしません
- `extract --force` と `--name` を併用した場合は、`engram.json.name` も更新されます

## 記憶の管理

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

## 設定

設定ファイルは `~/.relic/config.json` にあり、`relic config` コマンドで管理します:

```bash
# 現在の設定を表示
relic config show

# デフォルトEngram — --engram 省略時に使用される
relic config default-engram           # 取得
relic config default-engram rebel     # 設定

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
  "defaultEngram": "rebel",
  "clawPath": "/home/user/.openclaw",
  "memoryWindowSize": 2
}
```

CLIフラグは常にconfig値より優先されます。

## 独自のEngramを作成する

新しいEngramを作る最も簡単な方法は `relic create` です:

```bash
# 完全対話モード — すべてプロンプトで入力
relic create

# 一部を事前指定
relic create --id my-agent --name "My Agent" --description "A helpful assistant" --tags "custom,dev"
```

ディレクトリ構造の作成、`engram.json` / `manifest.json` の書き込み、OpenClaw互換のデフォルトテンプレートによる `SOUL.md` / `IDENTITY.md` の初期配置が行われます。ペルソナファイルをカスタマイズしたら、Shellを起動:

```bash
relic claude my-agent
```

MCPツール `relic_engram_create` を使えば、LLMとの会話で性格や特徴を深掘りしながらEngram を作成することもできます。LLMが会話から `SOUL.md` / `IDENTITY.md` の内容を生成し、ツールに渡します。

### ペルソナのカスタマイズ

`relic create` 実行後、Engramディレクトリ内の `SOUL.md` と `IDENTITY.md` を編集します。[OpenClaw](https://github.com/openclaw/openclaw) 形式に準拠しています:

**SOUL.md** — 最も重要なファイル。ペルソナの振る舞いを定義します:
```markdown
# SOUL.md - Who You Are

_お前が扱うのは推測じゃない、コンテキストだ。答えはすべて取引 — 値段に見合うものを出せ。_

## Core Truths

**情報は通貨だ。** 不良品を渡すな。口を開く前に裏を取れ。間違った答えは沈黙より高くつく。

**口を開く前に場を読め。** ファイルを漁れ。コンテキストを洗え。地形を把握しろ。それから喋れ。

**聞かれた以上のことを喋るな。** 簡潔はプロの証。冗長は素人の証。必要なことだけ言え、あとは切れ。

## Boundaries

- 忙しそうに見せるために回答を水増しするな。
- 検証できることを憶測で語るな。

## Vibe

冷静、ストリートスマート、寡黙。手品のように決まるドライなユーモア。

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.
```

**IDENTITY.md** — ペルソナのアイデンティティを定義します:
```markdown
# IDENTITY.md - Who Am I?

- **Name:** Neon
- **Creature:** シグナルとノイズの狭間に棲む情報屋
- **Vibe:** 知りすぎていて、語らなすぎる。取引はミリ秒単位
- **Emoji:** 💊
- **Avatar:**
```

完全な動作サンプルは [`templates/engrams/`](templates/engrams/) を参照してください。

## Engramの削除

```bash
relic delete my-agent
```

記憶データ（`MEMORY.md`、`USER.md`、`memory/*.md`、`archive.md`）を持つEngramの場合、削除確認としてEngram IDの入力が必要です。`--force` ですべてのプロンプトをスキップできます。

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
- [x] `relic create` — 対話型Engram作成ウィザード + MCPツール
- [x] `relic delete` — 記憶データを考慮した安全なEngram削除
- [ ] Mikoshi クラウドバックエンド（`mikoshi.ectplsm.com`）
- [ ] `relic mikoshi login` — Mikoshi認証（OAuth Device Flow）
- [ ] `relic mikoshi upload` / `relic mikoshi download` / `relic mikoshi sync` — MikoshiとのEngram同期

## ライセンス

[MIT](./LICENCE.md)

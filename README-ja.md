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
- [Docs](#docs)
- [`relic init` で作られるもの](#relic-init-で作られるもの)
- [サンプルEngram](#サンプルengram)
- [仕組み](#仕組み)
- [MCP と Shell 連携](#mcp-と-shell-連携)
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

> 自動承認の設定やShellごとの詳細は [MCP と Shell 連携](#mcp-と-shell-連携) を参照してください。

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

## Docs

詳細ガイドは README から順次切り出して、用途ごとに整理します。

- [はじめに](docs/ja/getting-started.md)
- [設定](docs/ja/configuration.md)
- [Engram ガイド](docs/ja/engram-guide.md)
- [マイグレーション](docs/ja/migration.md)
- [記憶](docs/ja/memory.md)
- [MCP](docs/ja/mcp.md)
- [Claw 連携](docs/ja/claw-integration.md)
- [用語集](docs/ja/glossary.md)

英語版は [docs/](docs/) にあります。

## `relic init` で作られるもの

`relic init` はローカルの Relic workspace を作成し、`config.json` を書き、サンプル Engram を seed します。

ファイル構成と、後から作られるファイルの詳細は [docs/ja/getting-started.md](docs/ja/getting-started.md) を参照してください。

### マイグレーション

古い Relic から更新する場合は、サンプル置き換え、metadata 移行、後片付けの手順を [docs/ja/migration.md](docs/ja/migration.md) で確認してください。

## サンプルEngram

`relic init` で2つのEngramがすぐ使える状態で生成されます。SOUL.md と IDENTITY.md は [OpenClaw](https://github.com/openclaw/openclaw) 形式に準拠しています。

> **既存ユーザーの方へ:** `relic refresh-samples` を実行して新しいサンプル人格を追加してください。v0.3.0 より前の旧サンプルをお使いの方は、[docs/ja/migration.md](docs/ja/migration.md) の置き換え手順も確認してください。

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

## MCP と Shell 連携

Relic は Claude Code、Codex CLI、Gemini CLI に対応しています。
生の会話ログは background hook が `archive.md` に追記し、archive 検索と記憶蒸留は MCP サーバーが担当します。

対応 Shell、hook の挙動、MCP ツール、セットアップ、承認設定の詳細は [docs/ja/mcp.md](docs/ja/mcp.md) を参照してください。

## Claw連携

Relic は OpenClaw をはじめとする Claw 系フレームワークと Engram の inject / extract / sync を行えます。
基本ルールは `Agent Name = Engram ID` で、`relic claw` がペルソナ転送と memory sync を担当します。

コマンド詳細、上書き時の挙動、挙動マトリクスは [docs/ja/claw-integration.md](docs/ja/claw-integration.md) を参照してください。

## 記憶の管理

Relic は生ログを `archive.md` に保持し、蒸留済み記憶を `memory/*.md` に書きます。
`MEMORY.md` と `USER.md` は今後のセッションに常に読み込まれます。

sliding window の挙動、蒸留フロー、MCP 記憶ツールの詳細は [docs/ja/memory.md](docs/ja/memory.md) を参照してください。

## 設定

Relic の実行時デフォルトは `~/.relic/config.json` に保存されます。
`relic config` で、default Engram、Claw パス、memory window を管理できます。

コマンド例と優先順位の詳細は [docs/ja/configuration.md](docs/ja/configuration.md) を参照してください。

## 独自のEngramを作成する

LLM と `relic_engram_create` MCP ツールを組み合わせるのが一番スムーズです。CLI 派なら `relic create` も使えます。

LLM 対話での作成、ペルソナ設計、テンプレート例、削除ルールの詳細は [docs/ja/engram-guide.md](docs/ja/engram-guide.md) を参照してください。

## Engramの削除

詳細は [docs/ja/engram-guide.md](docs/ja/engram-guide.md) を参照してください。

## ドメイン用語集

ドメイン用語の整理は [docs/ja/glossary.md](docs/ja/glossary.md) を参照してください。

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

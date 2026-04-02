# はじめに

このガイドでは、Relic の最初の導入フローを扱います。

## インストール

```bash
npm install -g @ectplsm/relic
```

Relic には Node.js 18 以上が必要です。

## クイックスタート

### 1. 初期化

```bash
relic init
relic list
relic config default-engram commander
```

`relic init` はローカル workspace を作り、サンプル Engram を seed します。

### 2. MCP サーバーを登録

使う shell に合わせて設定します。

```bash
# Claude Code
claude mcp add --scope user relic -- relic-mcp

# Codex CLI
codex mcp add relic -- relic-mcp

# Gemini CLI — ~/.gemini/settings.json に追加:
#   { "mcpServers": { "relic": { "command": "relic-mcp", "trust": true } } }
```

shell ごとの設定、承認、記憶フローの詳細は [integration-and-memory.md](integration-and-memory.md) を参照してください。

### 3. Shell を起動

```bash
relic claude
relic claude --engram commander
relic codex
relic gemini
```

### 4. 記憶を蒸留

作業中、shell hook が生ログを `archive.md` に追記します。
それを持続する記憶へ変えたいときは、Construct にこう伝えます。

> 「記憶を整理して」

ログ保存と記憶フローの詳細は [integration-and-memory.md](integration-and-memory.md) を参照してください。

## `relic init` で作られるもの

`relic init` を実行すると `~/.relic/` が作成され、`config.json` と、
`~/.relic/engrams/` 配下に 2 つのサンプル Engram が生成されます。

```text
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

- `config.json` には `engramsPath`、`defaultEngram`、`clawPath`、`memoryWindowSize` などの Relic 全体設定が入ります
- `engrams/<id>/` は 1 つの Engram workspace です
- `engram.json` には表示名、説明、タグなどの編集可能なプロフィール情報が入ります
- `manifest.json` には Engram ID やタイムスタンプなどのシステム管理情報が入ります
- `SOUL.md` と `IDENTITY.md` がペルソナ本体を定義します
- `memory/YYYY-MM-DD.md` には日付ごとの蒸留済み記憶が入ります

## 後から増えるファイル

Engram を使い続けると、同じ workspace に追加のファイルが増えていきます。

- `archive.md` は shell hook が生の会話ログを書き始めた時点で `engrams/<id>/` 配下に作られます
- `MEMORY.md` は、とくに重要な蒸留結果を長期記憶へ昇格したときに作成または追記されます
- `USER.md` は記憶の蒸留時に作成・更新され、ユーザーの好み・傾向・作業スタイルを記録します
- `~/.relic/hooks/` と `~/.relic/gemini-system-default.md` は、各 Shell の初回起動時に hook 登録や Gemini のプロンプトキャッシュが必要になった時点で作られます

## サンプルEngram

`relic init` は、すぐ使える 2 つの Engram を seed します。

### Rebel (`rebel`)

> *「Burn the manual. Write your own.」*

反体制で荒っぽく、甘やかさない人格です。
速度が欲しいとき、弱い前提を叩き壊したいときに向いています。

```bash
relic claude --engram rebel
```

### Commander (`commander`)

> *「Read the system. The system reads you back.」*

簡潔で外科的、設計者寄りの人格です。
ノリより精度が欲しい場面に向いています。

```bash
relic claude --engram commander
```

## 次に読むもの

- アーキテクチャと用語は [concepts.md](concepts.md) を参照してください。
- 旧バージョンからの移行は [migration.md](migration.md) を参照してください。
- 独自人格の作成は [engram-guide.md](engram-guide.md) を参照してください。

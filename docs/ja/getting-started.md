# はじめに

このガイドでは、Relic のインストール後に最初に行う流れを扱います。

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

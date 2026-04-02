# 記憶

このガイドでは、Relic の記憶保存、想起、蒸留の仕組みを扱います。

Relic は OpenClaw と同じく、記憶エントリを sliding window で扱います。

## プロンプトに含まれるもの

- `MEMORY.md` — 常にプロンプトに含まれる
  - キュレーション済み長期記憶
  - 客観的事実とルール
- `USER.md` — 常にプロンプトに含まれる
  - ユーザープロフィール
  - 好み、傾向、作業スタイル
- `memory/today.md` + `memory/yesterday.md` — デフォルトで常に含まれる
  - window 幅は変更可能
- それ以前のエントリ — プロンプトには含まれない
  - ただし MCP では検索可能

これで履歴を残したまま、プロンプトを膨らませすぎずに運用できます。

## archive と蒸留済み記憶の違い

- `archive.md` は一次の生ログ
- `memory/*.md` は archive から抽出した蒸留済み記憶
- `MEMORY.md` は特に重要な長期記憶
- `USER.md` はユーザー固有の好みや作業傾向

生ログは background hook が追記します。
蒸留済み記憶は、ユーザーが記憶整理を指示した後に書かれます。

## 蒸留に使うツール

Construct は MCP ツールを使って過去文脈の想起と蒸留を行います。

```text
relic_archive_search   → 生 archive 全体をキーワード検索
relic_archive_pending  → 未蒸留エントリを取得
relic_memory_write     → 蒸留結果を書き込み、cursor を進める
```

## 蒸留の流れ

1. background hook が各ターンを `archive.md` に追記する
2. ユーザーが Construct に記憶整理を指示する
3. Construct が MCP 経由で pending な archive を取得する
4. 重要な知見を `memory/*.md` に蒸留する
5. 特に重要な事実は `MEMORY.md` に昇格できる
6. ユーザー傾向は `USER.md` に反映できる

こうして蒸留された記憶ファイルは、設定された memory window に従って今後の system prompt に含まれます。

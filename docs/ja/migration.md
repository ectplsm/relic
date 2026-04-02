# マイグレーション

このガイドでは、既存ユーザー向けのアップグレード作業を扱います。

## 旧サンプルEngramの置き換え

`0.3.0` より前のバージョンでは、著作権のあるキャラクター名を使ったサンプルEngramが同梱されていました。
それらはオリジナルのペルソナ `rebel` と `commander` に置き換えられています。

新しいサンプルを追加するには `refresh-samples` を実行します。既存の Engram は削除されません。

```bash
relic refresh-samples
# → Seeded: 2 (commander, rebel)
# → Memory migrated from legacy samples
# → 旧サンプルはそのまま残ります
```

旧サンプルに記憶データ（`USER.md`, `MEMORY.md`, `memory/*.md`）やアーカイブデータ（`archive.md`, `archive.cursor`）がある場合、seed 時に新しいサンプルへ自動でコピーされます。

そのあと、default Engram を切り替えてください。

```bash
relic config default-engram rebel
```

新しいサンプルの動作確認が済んだら、不要になった旧サンプルは削除できます。

```bash
relic delete <id>
```

## その他のマイグレーション

旧形式の `engram.json` メタデータを `manifest.json` へ移すには、次を実行します。

```bash
relic migrate engrams
```

## このガイドで扱うもの

このガイドには次を置きます。

- 旧サンプルの置き換え
- `relic refresh-samples`
- 移行後の default Engram 切り替え
- metadata migration コマンド
- 後片付けの手順

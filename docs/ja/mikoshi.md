# Mikoshi

このガイドは、Relic が [Mikoshi](https://mikoshi.ectplsm.com) を使って
Engram をクラウドへバックアップし、共有し、別マシンへ移す流れをまとめたものです。

persona の作成と編集は Mikoshi ではなく、ローカルの Relic で行います。
archive の記録も、あくまでローカルの Relic Engram 側が持ちます。
Mikoshi が保存するもの:

- 平文の persona ファイル: `SOUL.md`, `IDENTITY.md`
- 暗号化された memory ファイル: `USER.md`, `MEMORY.md`, `memory/*.md`

Mikoshi が現時点で保存しないもの:

- `archive.md`

理由:

- 極端にプライベートな情報を含みうるため

sync 契約そのものは共有契約リポジトリを参照してください:
[`ectplsm/engram-sync-contracts`](https://github.com/ectplsm/engram-sync-contracts)

## Prerequisites

- Mikoshi にサインイン済みであること（現時点では Google sign-in のみ）
- Mikoshi Settings で発行した API key を持っていること
- Relic でローカル Engram を作成済みであること

`~/.relic/config.json` に `mikoshiUrl` が無ければ、Relic はデフォルトで
`https://mikoshi.ectplsm.com` を使います。
別デプロイ先を向けたい時だけ `mikoshiUrl` を設定してください。

## Configure Access

Mikoshi Settings で発行した API key を設定します:

```bash
relic config mikoshi-api-key <key>
```

任意: staging やローカル環境を向けたい場合は base URL を上書き:

```bash
relic config mikoshi-url http://localhost:3000
```

任意: memory 暗号化用の passphrase を保存して毎回の入力を避ける:

```bash
relic config mikoshi-passphrase <passphrase>
```

この passphrase は upload 前に memory bundle を暗号化するためのものです。
**失うと、アップロード済み memory は復元できません。どこか安全な場所に保管してください。**

## Command Flow

最初の Engram を push:

```bash
relic mikoshi push -e rebel
relic mikoshi status -e rebel
```

別マシン側では pull:

```bash
relic mikoshi list
relic mikoshi pull -e rebel
```

各コマンドの役割:

- `relic mikoshi push -e <id>` は Mikoshi 側の persona を新規作成または更新し、memory sync まで自動で走らせる
- `relic mikoshi status -e <id>` はローカルとクラウドの persona / memory hash を比較する
- `relic mikoshi list` は API key から見えるクラウド上の Engram を一覧表示する
- `relic mikoshi pull -e <id>` は Mikoshi からローカル Engram を新規作成または更新する

## Command Summary

| Command | Direction | Description |
|---------|-----------|-------------|
| `relic mikoshi status -e <id>` | — | ローカルとクラウドの状態を表示 |
| `relic mikoshi push -e <id>` | Relic → Mikoshi | remote persona を新規作成または更新し、自動 sync (`--yes`, `--no-sync`) |
| `relic mikoshi pull -e <id>` | Mikoshi → Relic | local persona を新規作成または更新し、自動 sync (`--yes`, `--no-sync`) |
| `relic mikoshi sync -e <id>` | Relic ↔ Mikoshi | 双方向 memory merge（`memory/*.md`, `MEMORY.md`, `USER.md`; `-e` = 単一対象、`--all` = 全対象） |

## Persona Commands

ローカル persona を Mikoshi へ push:

```bash
relic mikoshi push --engram <engram-id>
```

Mikoshi の persona を Relic へ pull:

```bash
relic mikoshi pull --engram <engram-id>
```

補足:

- persona 系コマンドが扱うのは `SOUL.md` と `IDENTITY.md`
- 成功した `push` と `pull` は、`--no-sync` を付けない限り memory sync まで自動で走る
- `push` は remote Engram が無ければ新規作成し、作成前または上書き前に確認を出す。`--yes` でスキップできる
- `pull` は local Engram が無ければ新規作成し、作成前または上書き前に確認を出す。`--yes` でスキップできる
- `pull` は既存ローカル persona を上書きする前に drift を表示する
- persona drift は明示的に扱う。雑な上書きはしない
- 最後に確認してから remote が変わっていた場合、`push` は `409 Conflict` で拒否される

## Sync

1件だけ:

```bash
relic mikoshi sync --engram <engram-id>
```

一致する対象を全部:

```bash
relic mikoshi sync --all
```

`--engram` か `--all` のどちらかが必須です。

補足:

- memory は単調増加データとして扱い、基本ワークフローは `sync`
- `sync` は先にローカルと remote の memory をマージし、その後遅れている側を更新する
- `sync` が扱うのは `USER.md`, `MEMORY.md`, `memory/*.md`
- `sync --all` は Mikoshi 上にも存在するローカル Engram を走査する
- `archive.md` は upload しない
- memory 側の上書きも optimistic concurrency を使うので `409 Conflict` になりうる
- `sync` が `409 Conflict` で失敗したら、`relic mikoshi sync` を再実行して新しい remote 状態を取り込んでから再マージする

## Status Meanings

`relic mikoshi status -e <engram-id>` は persona と memory を別々に報告します。

主な状態:

- `synced`: ローカルと remote の hash が一致
- `local_differs`: ローカルと remote が不一致
- `remote_only`: remote persona はあるが、ローカル比較ができない
- `not_uploaded`: remote memory がまだ存在しない
- `local_empty`: 比較対象になるローカル memory ファイルが存在しない

Relic は persona drift と memory drift を別問題として扱うので、この分離が重要です。

## Recommended Practice

- persona の authoring と編集はローカル Relic でやる
- Mikoshi は cloud storage / sync backend として使う
- Relic 側を勝たせたい時は `push`、Mikoshi 側を勝たせたい時は `pull`
- remote を上書きする前に `relic mikoshi status` を見る
- memory passphrase は安全な場所に保管する

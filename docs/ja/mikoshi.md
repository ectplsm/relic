# Mikoshi

このガイドでは、Relic が [Mikoshi](https://mikoshi.ectplsm.com) を使って Engram をクラウド保存し、共有し、別マシンへ持ち運ぶ方法を扱います。

Mikoshi は、ペルソナを作ったり育てたりする本拠地ではありません。
ペルソナ設計とローカル archive の記録は、引き続きローカル Relic 側が持ちます。
Mikoshi が保存するのは次です。

- 平文の persona ファイル: `SOUL.md`, `IDENTITY.md`
- 暗号化された memory ファイル: `USER.md`, `MEMORY.md`, `memory/*.md`

Mikoshi が(現時点では)保存しないもの:

- `archive.md`

理由:

- 極めてプライベートな情報を含む可能性があるため

sync 契約そのものは、共有契約リポジトリ
[`ectplsm/engram-sync-contracts`](https://github.com/ectplsm/engram-sync-contracts)
を参照してください。

## 前提

- Mikoshi にログイン済み（現在は Google ログインのみ）
- Mikoshi の Settings から API key を発行済み
- ローカルで Relic により Engram を作成済み

`~/.relic/config.json` に `mikoshiUrl` が無ければ、Relic はデフォルトで `https://mikoshi.ectplsm.com` を使います。
staging や local など、デフォルト以外へ向けたい時だけ `mikoshiUrl` を設定してください。

## 接続設定

まず、Mikoshi の Settings で発行した API key を Relic に設定します。

```bash
relic config mikoshi-api-key <key>
```

任意: staging や local deployment を使う時だけ base URL を上書きします。

```bash
relic config mikoshi-url http://localhost:3000
```

任意: memory 暗号化用の passphrase を保存して、毎回聞かれないようにします。

```bash
relic config mikoshi-passphrase <passphrase>
```

この passphrase は memory bundle の暗号化に使われます。
失くしたら、アップロード済み memory は復元不能です。

## コマンドフロー

初回確認でおすすめの順番:

```bash
relic mikoshi list
relic mikoshi status rebel
relic mikoshi push --engram rebel
relic mikoshi status rebel
```

各コマンドの意味:

- `relic mikoshi list` は API key で見える cloud Engram を一覧表示
- `relic mikoshi status <id>` はローカルの persona / memory hash と cloud 側を比較
- `relic mikoshi push <id>` は平文の persona ファイルを Mikoshi に作成または更新し、その後 memory も自動 sync する

## コマンド一覧

| コマンド | 方向 | 説明 |
|---------|------|------|
| `relic mikoshi push -e <id>` | Relic → Mikoshi | ペルソナ push + 自動 sync（`--no-sync` で sync をスキップ） |
| `relic mikoshi pull -e <id>` | Mikoshi → Relic | 新規取り込みまたはペルソナのみ上書き後、その対象を自動 sync（`--create`, `--yes`, `--no-sync`; Engram ID 必須） |
| `relic mikoshi sync` | Relic ↔ Mikoshi | 双方向マージ（`memory/*.md`, `MEMORY.md`, `USER.md`。デフォルトは `default-engram`、`--target` は単一対象、`--all` は全対象） |

## Persona コマンド

ローカルの persona ファイルを push:

```bash
relic mikoshi push --engram <engram-id>
```

cloud 側の persona ファイルをローカル Engram へ pull:

```bash
relic mikoshi pull --engram <engram-id>
```

ローカル Engram がまだ無い場合は、Mikoshi から新規作成しながら pull:

```bash
relic mikoshi pull --engram <engram-id> --create
```

注意点:

- persona sync の対象は `SOUL.md` と `IDENTITY.md`
- 成功した `push` と `pull` は、`--no-sync` を付けない限り memory sync まで自動で走る
- `--create` を付けると、ローカル Engram 未作成時に remote の persona 情報から新規作成する
- `--create` で使うのは remote の `name` / `description` / `tags` までで、その後 memory は auto-sync に任せる
- persona drift は明示的で、安全性重視
- 最後に確認した状態から remote が変わっていれば、Mikoshi は `409 Conflict` で上書きを拒否する

## Sync

通常運用:

```bash
relic mikoshi sync
```

引数を付けない場合、`sync` は現在の `default-engram` を対象にします。

特定の 1 対象だけ同期:

```bash
relic mikoshi sync --target <engram-id>
```

全対象を同期:

```bash
relic mikoshi sync --all
```

注意点:

- memory は基本的に単調増加するデータとして扱い、通常は `sync` を使う
- `sync` は最初にローカルと remote の memory をマージし、その後で遅れている側を更新する
- `sync` の対象は `USER.md`, `MEMORY.md`, `memory/*.md`
- `sync` は `--target` や `--all` を付けない限り `default-engram` を対象にする
- `sync --all` を使うと、ローカルにあり、かつ Mikoshi にも存在する Engram をまとめて同期する
- `archive.md` はアップロードされない
- memory overwrite も optimistic concurrency を使うので、`409 Conflict` で失敗しうる
- `sync` が `409 Conflict` で失敗したら、`relic mikoshi sync` を再実行して新しい remote state を取り直し、もう一度マージする

## Status の見方

`relic mikoshi status <engram-id>` は persona と memory を別々に表示します。

主な状態:

- `synced`: ローカルと remote の hash が一致
- `local_differs`: ローカルと remote が不一致
- `remote_only`: remote persona はあるが、ローカル比較ができない
- `not_uploaded`: remote memory がまだ無い
- `local_empty`: 比較対象になるローカル memory ファイルが無い

Relic は persona drift と memory drift を別問題として扱うので、この分離は重要です。

## 推奨運用

- persona の作成と編集はローカル Relic で行う
- Mikoshi は cloud storage / sync backend として使う
- 先に persona を push / pull して、その後の memory は `relic mikoshi sync` に任せる
- remote を上書きする前に `relic mikoshi status` を見る
- memory の passphrase は安全な場所に保管する

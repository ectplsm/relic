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
relic mikoshi push rebel
relic mikoshi memory push rebel
relic mikoshi status rebel
```

各コマンドの意味:

- `relic mikoshi list` は API key で見える cloud Engram を一覧表示
- `relic mikoshi status <id>` はローカルの persona / memory hash と cloud 側を比較
- `relic mikoshi push <id>` は平文の persona ファイルを Mikoshi に作成または更新
- `relic mikoshi memory push <id>` はローカル memory を暗号化してアップロード

## Persona コマンド

ローカルの persona ファイルを push:

```bash
relic mikoshi push <engram-id>
```

cloud 側の persona ファイルをローカル Engram へ pull:

```bash
relic mikoshi pull <engram-id>
```

ローカル Engram がまだ無い場合は、Mikoshi から新規作成しながら pull:

```bash
relic mikoshi pull <engram-id> --create
```

注意点:

- persona sync の対象は `SOUL.md` と `IDENTITY.md`
- `--create` を付けると、ローカル Engram 未作成時に remote の persona 情報から新規作成する
- `--create` で使うのは remote の `name` / `description` / `tags` までで、memory は別途同期する
- persona drift は明示的で、安全性重視
- 最後に確認した状態から remote が変わっていれば、Mikoshi は `409 Conflict` で上書きを拒否する

## Memory コマンド

ローカル memory を client-side で暗号化してアップロード:

```bash
relic mikoshi memory push <engram-id>
```

remote memory をダウンロードして復号:

```bash
relic mikoshi memory pull <engram-id>
```

注意点:

- memory sync の対象は `USER.md`, `MEMORY.md`, `memory/*.md`
- `archive.md` はアップロードされない
- memory overwrite も optimistic concurrency を使うので、`409 Conflict` で失敗しうる

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
- 先に persona を push して、その後に暗号化 memory を push する
- remote を上書きする前に `relic mikoshi status` を見る
- memory の passphrase は安全な場所に保管する

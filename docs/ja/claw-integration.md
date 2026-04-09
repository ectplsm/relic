# Claw Integration

このガイドは `relic claw` の使い方をまとめたものです。

Relic Engram は [OpenClaw](https://github.com/openclaw/openclaw) の
workspace 構造と 1:1 で対応しています（`SOUL.md`, `IDENTITY.md`, `memory/` など）。

Nanobot や gitagent のように `IDENTITY.md` を独立で持たず、`SOUL.md` にまとめる
Claw 系フレームワークでは、`--merge-identity` を使うと push 時に
`IDENTITY.md` を `SOUL.md` に統合できます。`--dir` と組み合わせれば、
任意の Claw 互換 workspace を対象にできます。

現在のルールは `Agent Name = Engram ID` です。
Relic はこの 2 つを同じ名前として扱います。

Claw 系コマンドはすべて `relic claw` 配下にあります。

## Command Summary

| Command | Direction | Description |
|---------|-----------|-------------|
| `relic claw push -e <id>` | Relic → Claw | 既存 workspace 内の persona files を新規作成または更新し、自動 sync（`--yes`, `--no-sync`, `--merge-identity`） |
| `relic claw pull -e <id>` | Claw → Relic | ローカルの persona files を新規作成または更新し、自動 sync（`--name`, `--yes`, `--no-sync`） |
| `relic claw sync -e <id>` | Relic ↔ Claw | 双方向 memory merge（`memory/*.md`, `MEMORY.md`, `USER.md`; `-e` = 単一対象、`--all` = 全対象） |

## Push

`push` は persona ファイル（`SOUL.md`, `IDENTITY.md`）を Claw workspace に書き込み、
そのあと `USER.md` と memory ファイル（`MEMORY.md`, `memory/*.md`）を sync します。
sync は双方向・マージ方式で、片側を盲目的に上書きするものではありません。
`AGENTS.md` と `HEARTBEAT.md` は Claw 側の責務のままです。

workspace 自体は先に存在している必要があります。
無ければ `openclaw agents add <id>` を先に実行してください。

`push` は、その既存 workspace の中で persona を初回作成または更新します。

- workspace 側に persona ファイルが無ければ、作成前に確認を出します
- persona ファイルがあり差分があれば、上書き前に確認を出します
- すでに一致していれば、persona の再書き込みはせず memory sync だけ走ります
- `--yes` を付けると作成確認・上書き確認をスキップします

```bash
# Engram "commander" を workspace-commander/ へ push
relic claw push --engram commander

# Claw directory を上書き（または relic config claw-path で設定）
relic claw push --engram commander --dir /path/to/.fooclaw

# 非 OpenClaw 系では IDENTITY.md を SOUL.md に統合
relic claw push --engram commander --dir ~/.nanobot --merge-identity

# 作成確認・上書き確認をスキップ
relic claw push --engram commander --yes
```

## Pull

`pull` は Claw workspace の persona ファイルを Relic 側へ取り込みます。

`pull` も初回作成と更新の両方を扱います。

- ローカル Engram が無ければ、workspace から新規作成する前に確認を出します
- ローカル Engram があり差分があれば、差分を表示してから上書き確認を出します
- すでに一致していれば、同期済みとして表示します
- `--name` はローカル Engram を新規作成する時だけ表示名に使います
- `--yes` を付けると作成確認・上書き確認をスキップします

`pull` の成功後は、同じ Engram / workspace 対象に対して限定 sync を自動実行します。
`--no-sync` を付けるとスキップできます。

```bash
# 対応する workspace からローカル Engram へ pull
relic claw pull --engram rebel

# 初回ローカル作成時に表示名を付ける
relic claw pull --engram analyst --name "Data Analyst"

# 作成確認・上書き確認をスキップ
relic claw pull --engram rebel --yes

# pull 後の対象限定 sync をスキップ
relic claw pull --engram rebel --no-sync

# Claw directory を上書き
relic claw pull --engram rebel --dir /path/to/.fooclaw
```

## Sync

`sync` は一致する Engram / workspace 対象の `memory/*.md`, `MEMORY.md`, `USER.md` を
双方向にマージします。Engram と workspace の両方が存在する対象だけが同期されます。
成功した `push` / `pull` の後にも、`--no-sync` を付けない限り自動で走ります。

`--engram` か `--all` のどちらかが必須です。
`--engram <id>` は同名の Engram / workspace 1件だけ、
`--all` は一致する対象を全部走査して同期します。

```bash
# 1件だけ sync
relic claw sync --engram rebel

# 一致する対象を全部 sync
relic claw sync --all

# Claw directory を上書き
relic claw sync --dir /path/to/.fooclaw
```

マージルール:

- 片側にしかないファイル → 反対側へコピー
- 内容が同じ → スキップ
- 内容が違う → 重複除去してマージし、両側へ書き戻す

## Behavior Matrix

| Command | State | Flags | Result |
|---------|------|------|------|
| `push` | workspace 未作成 | なし | エラー。先に `openclaw agents add <id>` を実行するよう案内 |
| `push` | workspace に persona ファイルなし | なし | persona 作成前に確認を出し、その後その対象だけ自動 sync |
| `push` | persona がローカル Engram と同一 | なし | persona 再書き込みをスキップし、その対象だけ自動 sync |
| `push` | persona がローカル Engram と差分あり | なし | persona 上書き前に確認を出し、その後その対象だけ自動 sync |
| `push` | persona 作成または上書きが必要 | `--yes` | 確認なしで作成または上書きし、その後その対象だけ自動 sync |
| `push` | 成功時全般 | `--no-sync` | 自動対象 sync をスキップ |
| `pull` | workspace 未作成 | なし | pull 元が無いのでエラー |
| `pull` | ローカル Engram 未作成 | なし | workspace から新規 Engram を作る前に確認を出し、その後その対象だけ自動 sync |
| `pull` | ローカル Engram 未作成 | `--yes` | 確認なしで新規 Engram を作成し、その後その対象だけ自動 sync |
| `pull` | persona 差分なし | なし | 同期済みと表示し、その後その対象だけ自動 sync |
| `pull` | persona 差分あり | なし | 差分を表示し、上書き前に確認を出してから自動 sync |
| `pull` | persona 差分あり | `--yes` | 確認なしで上書きし、その後自動 sync |
| `pull` | 成功時全般 | `--no-sync` | 自動対象 sync をスキップ |
| `sync` | target 未指定 | なし | エラー — `--engram` か `--all` が必要 |
| `sync` | 明示 target | `--engram <id>` | `agentName = engramId` の 1対象だけ sync |
| `sync` | 全対象 | `--all` | 一致する全対象を走査して sync |

補足:

- ここでいう "persona" は `SOUL.md` と `IDENTITY.md` のこと
- `pull` がローカルで上書きするのは `SOUL.md` と `IDENTITY.md` だけで、`USER.md`, `MEMORY.md`, `memory/*.md` には触りません

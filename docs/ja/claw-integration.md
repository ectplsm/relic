# Claw 連携

このガイドでは、`relic claw` のワークフローを扱います。

Relic の Engram は [OpenClaw](https://github.com/openclaw/openclaw) のワークスペースとネイティブ互換です。
ファイル構造が 1:1 で対応します（`SOUL.md`, `IDENTITY.md`, `memory/` など）。

Nanobot や gitagent のように、IDENTITY を `SOUL.md` に統合する Claw 派生フレームワークでは、
`--merge-identity` を使うと inject 時に `IDENTITY.md` を `SOUL.md` に統合できます。
`--dir` と組み合わせれば、任意の Claw 互換ワークスペースを対象にできます。

現在の基本ルールは `Agent Name = Engram ID` です。
Relic は両者を同じ名前として扱います。

Claw コマンドはすべて `relic claw` 配下です。

## コマンド一覧

| コマンド | 方向 | 説明 |
|---------|------|------|
| `relic claw inject -e <id>` | Relic → Claw | ペルソナ注入 + 自動 sync（`--yes` で上書き確認をスキップ、`--no-sync` で sync をスキップ、非 OpenClaw は `--merge-identity`） |
| `relic claw extract -a <name>` | Claw → Relic | 新規取り込みまたはペルソナのみ上書き後、その対象を自動 sync（`--force`, `--yes`, `--no-sync`） |
| `relic claw sync` | Relic ↔ Claw | 双方向マージ（`memory/*.md`, `MEMORY.md`, `USER.md`。`--target` で単一対象指定可） |

## Inject

`inject` はペルソナファイル（`SOUL.md`, `IDENTITY.md`）をエージェントのワークスペースに書き込み、
その後 `USER.md` と記憶ファイル（`MEMORY.md`, `memory/*.md`）を同期します。
同期は上書きではなく双方向マージです。
`AGENTS.md` と `HEARTBEAT.md` は Claw 側の管理に委ねます。

対象ワークスペースに既存のペルソナファイルがあり、ローカルの Relic Engram と差分がある場合、
`inject` はデフォルトで確認を出します。
`--yes` を使うと確認をスキップできます。
すでに同一内容なら、ペルソナ再書き込みは行わず memory sync だけを実行します。

> Claw エージェントは事前に存在している必要があります。
> inject は既存ワークスペースに書き込むだけで、新しいエージェントは作成しません。

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

## Extract

`extract` は既存の Claw エージェントワークスペースから新しい Engram を作成します。

`extract` がローカルに書き込むもの:

- 新規 extract: `engram.json`, `manifest.json`, `SOUL.md`, `IDENTITY.md`, `USER.md`, `MEMORY.md`, `memory/*.md`
- `extract --force`: `SOUL.md` と `IDENTITY.md` のみ
- `extract --force --name`: `SOUL.md`, `IDENTITY.md`, `engram.json.name`

`extract` の後には、同じ Engram / agent を対象にした sync を自動実行します。
スキップしたい場合は `--no-sync` を使います。

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

## Sync

`sync` は対応する Engram / agent 間で `memory/*.md`、`MEMORY.md`、`USER.md` をマージします。
Engram と agent の両方が存在する対象だけが同期されます。
`inject` の後にも自動実行されます（`--no-sync` でスキップ可）。

デフォルトでは、`sync` はマッチするすべての対象を走査します。
特定の対象だけ同期したい場合は `--target <id>` を使います。

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

## 挙動マトリクス

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

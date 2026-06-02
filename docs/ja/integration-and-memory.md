# Shell 連携と記憶

このガイドでは、Relic が shell とどう接続し、生ログを取り、それを再利用できる記憶へ変えるかを扱います。

## 対応 Shell

| Shell | コマンド | 注入方法 |
|-------|---------|---------|
| [Claude Code](https://github.com/anthropics/claude-code) | `relic claude` | `--system-prompt` による直接上書き |
| [Codex CLI](https://github.com/openai/codex) | `relic codex` | `-c developer_instructions` による developer role 注入 |
| [Antigravity CLI](https://github.com/google-gemini/antigravity-cli) | `relic agy` | Agentic File Load (`--prompt-interactive`) |

全 shell コマンドは以下を共通で受けます。

- `--engram <id>` — 注入する Engram（`defaultEngram` 設定時は省略可）
- `--path <dir>` — Engram ディレクトリの上書き
- `--cwd <dir>` — shell の作業ディレクトリ（デフォルトは現在位置）

追加引数はそのまま元の CLI に透過します。

## 生ログの記録

Relic は各 shell の hook 機構を使って、prompt と response を `archive.md` に追記します。

| Shell | Hook |
|-------|------|
| [Claude Code](https://github.com/anthropics/claude-code) | Stop hook |
| [Codex CLI](https://github.com/openai/codex) | Stop hook |
| [Antigravity CLI](https://github.com/google-gemini/antigravity-cli) | Stop hook |

### Claude Code

`relic claude` の初回起動時に、`~/.relic/hooks/claude-stop.js` を `~/.claude/settings.json` に登録します。

### Codex CLI

`relic codex` の初回起動時に、`~/.relic/hooks/codex-stop.js` を `~/.codex/hooks.json` に登録します。

> Codex hooks には `features.hooks=true` が必要です。
> `relic codex` は毎回 `-c features.hooks=true` を付けて自動で有効化します。
> グローバルに有効化したい場合は、`~/.codex/config.toml` に以下を追加します。
>
> ```toml
> [features]
> hooks = true
> ```

### Antigravity CLI

`relic agy` の初回起動時に、次をセットアップします。

1. `~/.relic/hooks/agy-stop.js` を `~/.gemini/config/hooks.json` に登録
2. Relic MCP server を `~/.gemini/antigravity-cli/mcp_config.json` に登録
3. `~/.gemini/antigravity-cli/settings.json` の permissions に `mcp(relic/*)` を追加

Relic はコンパイル済みのペルソナを隠しの一時ファイル（`.gemini/.agy-engram-tmp.md`）に書き出し、`--prompt-interactive` 経由で AI に自律的に読み込ませます。その後 `Stop` フックが `transcript.jsonl` を解析して `archive.md` に会話ログを記録し、一時ファイルを確実に削除します。

> 既知の制限: Antigravity CLI 2.0 では、MCP 設定を読み込んでも MCP ツールが agent 側に露出しないことがあります。この状態では「記憶を整理して」のような記憶蒸留コマンドはそのセッションでは実行できません。Relic はこの場合、agent に一時スクリプトや手動 JSON-RPC client を作らせる回避策を禁止します。Antigravity を再起動して `/mcp` を確認し、`relic` server が active でない、または tool が露出していない場合は、Antigravity 側の MCP tool injection が安定するまで Claude Code または Codex CLI で記憶蒸留してください。

## MCP サーバー

Relic の [MCP](https://modelcontextprotocol.io/) サーバーは、archive の想起と記憶蒸留を担います。

ここは意図的に分かれています。

- background hook が LLM を通さずに生ログを書く
- MCP ツールが archive 検索と記憶蒸留を LLM に提供する

## 利用可能なツール

| ツール | 説明 |
|------|------|
| `relic_engram_create` | 新しい Engram を作成し、必要なら LLM 生成の SOUL.md / IDENTITY.md を保存する |
| `relic_archive_search` | Engram の raw archive をキーワード検索する |
| `relic_archive_pending` | 未蒸留の archive エントリを取得する |
| `relic_memory_write` | 複数日付への書き込みと skipped_dates を含む蒸留済み記憶を書き、`MEMORY.md` や `USER.md` を更新し、cursor を進める |

## 記憶モデル

Relic は OpenClaw と同じく、記憶エントリを sliding window で扱います。

### プロンプトに含まれるもの

- `MEMORY.md` — 常に含まれる
- `USER.md` — 常に含まれる
- 最近の `memory/*.md` — 設定された memory window に従って含まれる
- 古いエントリ — プロンプトには含まれないが、MCP では検索できる

これで履歴を残しながら、プロンプトを膨らませすぎずに運用できます。

### archive と蒸留済み記憶の違い

- `archive.md` は一次の生ログ
- `memory/*.md` は archive から抽出した蒸留済み記憶
- `MEMORY.md` は特に重要な長期記憶
- `USER.md` はユーザー固有の好みや作業傾向

## 蒸留の流れ

1. hook が各ターンを `archive.md` に追記する
2. ユーザーが Construct に記憶整理を指示する
3. Construct が MCP 経由で pending な archive を取得する
4. `archive.md` に記録された実際の日付ごとに重要な知見を対応する `memory/*.md` へ蒸留する
5. 特に重要な事実は `MEMORY.md` に昇格できる
6. ユーザー傾向は `USER.md` に反映できる

こうして蒸留された記憶ファイルは、設定された memory window に従って今後の system prompt に含まれます。

## MCPのセットアップ

### Claude Code

```bash
claude mcp add --scope user relic -- relic-mcp
```

確認ダイアログを抑止し、全プロジェクトで Relic ツールを自動承認するには、`~/.claude/settings.json` に以下を追加します。

```json
{
  "permissions": {
    "allow": [
      "Edit(~/.relic/engrams/**)",
      "mcp__relic__relic_engram_create",
      "mcp__relic__relic_archive_search",
      "mcp__relic__relic_archive_pending",
      "mcp__relic__relic_memory_write"
    ]
  }
}
```

### Codex CLI

```bash
codex mcp add relic -- relic-mcp
```

Relic ツールを自動承認するには、`~/.codex/config.toml` に以下を追加します。

```toml
[mcp_servers.relic.tools.relic_engram_create]
approval_mode = "approve"

[mcp_servers.relic.tools.relic_archive_search]
approval_mode = "approve"

[mcp_servers.relic.tools.relic_archive_pending]
approval_mode = "approve"

[mcp_servers.relic.tools.relic_memory_write]
approval_mode = "approve"
```

> Codex CLI では `trust_level = "trusted"` だけでは MCP 承認はカバーされません。
> 確実なのは per-tool の `approval_mode` です。

### Antigravity CLI

`~/.gemini/antigravity-cli/mcp_config.json` に以下を追加します。

```json
{
  "mcpServers": {
    "relic": {
      "command": "/path/to/node",
      "args": [
        "/path/to/relic-mcp"
      ],
      "trust": true
    }
  }
}
```

Relic ツールの確認ダイアログを抑止するには、`~/.gemini/antigravity-cli/settings.json` で Relic MCP server を allow します。

```json
{
  "permissions": {
    "allow": [
      "mcp(relic/*)"
    ]
  }
}
```

`relic agy` はこの permission を自動追加します。

`/mcp` で `relic` server が active にならない場合や、agent が `relic_archive_pending` / `relic_memory_write` を認識できない場合、そのセッションでは Antigravity での記憶蒸留は利用不可として扱ってください。project 内に一時 MCP スクリプトを書かせる回避策は使いません。

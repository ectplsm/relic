# MCP

このガイドでは、Relic の MCP サーバーと Shell 連携の詳細を扱います。

Relic の記憶まわりには、役割の違う 2 つの仕組みがあります。

- バックグラウンド hook が生ログを `archive.md` に追記する
- MCP サーバーが archive 検索と記憶蒸留を LLM に提供する

この責務は分けて扱うのが自然です。
ログ保存は LLM を通さずに行い、想起と蒸留は MCP ツールで行います。

## 対応 Shell

| Shell | コマンド | 注入方法 |
|-------|---------|---------|
| [Claude Code](https://github.com/anthropics/claude-code) | `relic claude` | `--system-prompt` による直接上書き |
| [Codex CLI](https://github.com/openai/codex) | `relic codex` | `-c developer_instructions` による developer role 注入 |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `relic gemini` | `GEMINI_SYSTEM_MD` による system prompt 注入 |

全 shell コマンドは以下を共通で受けます。

- `--engram <id>` — 注入する Engram（`defaultEngram` 設定時は省略可）
- `--path <dir>` — Engram ディレクトリの上書き
- `--cwd <dir>` — Shell の作業ディレクトリ（デフォルトは現在位置）

追加引数はそのまま元の CLI に透過します。

## 対話ログの記録

各 shell の hook 機構を使って、毎回の prompt / response を `archive.md` に追記します。

使用する hook は以下です。

| Shell | Hook |
|-------|------|
| [Claude Code](https://github.com/anthropics/claude-code) | Stop hook |
| [Codex CLI](https://github.com/openai/codex) | Stop hook |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | AfterAgent hook |

### Claude Code

`relic claude` の初回起動時に、以下の一回限りセットアップが自動で入ります。

- Stop hook — `~/.relic/hooks/claude-stop.js` を `~/.claude/settings.json` に登録

### Codex CLI

`relic codex` の初回起動時に、以下の一回限りセットアップが自動で入ります。

- Stop hook — `~/.relic/hooks/codex-stop.js` を `~/.codex/hooks.json` に登録

> Codex hooks には実験機能フラグ `features.codex_hooks=true` が必要です。
> `relic codex` は毎回 `-c features.codex_hooks=true` を付けて自動で有効化します。
> 不安定機能の警告を消したい場合は、`~/.codex/config.toml` に以下を追加します。
>
> ```toml
> suppress_unstable_features_warning = true
> ```

### Gemini CLI

`relic gemini` の初回起動時に、以下の 2 つの一回限りセットアップが自動で入ります。

1. AfterAgent hook — `~/.relic/hooks/gemini-after-agent.js` を `~/.gemini/settings.json` に登録
2. default system prompt cache — Gemini CLI の built-in system prompt を `~/.relic/gemini-system-default.md` に保存

その後、キャッシュしたデフォルト prompt に Engram persona を追記し、毎回 `GEMINI_SYSTEM_MD` 経由で注入します。

## MCP サーバー

Relic の [MCP](https://modelcontextprotocol.io/) サーバーは、CLI 注入と組み合わせて記憶の想起と蒸留を担います。

セッションログと記憶ファイルの書き込みはバックグラウンド hook が行い、LLM は通しません。
記憶蒸留と想起だけを MCP サーバーが担当します。

## 利用可能なツール

| ツール | 説明 |
|------|------|
| `relic_engram_create` | 新しい Engram を作成し、必要なら LLM 生成の SOUL.md / IDENTITY.md を保存する |
| `relic_archive_search` | Engram の raw archive をキーワードで検索する |
| `relic_archive_pending` | 未蒸留の archive エントリを最大 30 件取得する |
| `relic_memory_write` | 蒸留結果を `memory/*.md` に書き、必要なら `MEMORY.md` / `USER.md` を更新し、cursor を進める |

セッションログは background hook が自動で書きます。
記憶蒸留はユーザー起点です。
Construct に「記憶を整理して」と伝えると、pending な archive を取得し、重要な事実を `memory/*.md` に蒸留します。
特に重要な事実は `long_term` で `MEMORY.md` に昇格でき、ユーザー傾向は `user_profile` で `USER.md` に反映できます。

## セットアップ

### Claude Code

```bash
claude mcp add --scope user relic -- relic-mcp
```

確認ダイアログを抑止し、全プロジェクトで Relic ツールを自動承認するには、
`~/.claude/settings.json` に以下を追加します。

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

> 確認ダイアログの "Always allow" は `~/.claude.json` に project-scoped cache として保存されます。
> 全体設定として効かせたいなら `~/.claude/settings.json` が正しい場所です。

### Codex CLI

```bash
codex mcp add relic -- relic-mcp
```

確認ダイアログを抑止し、Relic ツールを自動承認するには、
`~/.codex/config.toml` に以下を追加します。

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

> Codex CLI では `trust_level = "trusted"` だけでは MCP ツール承認はカバーされません。
> 確実に効かせるには per-tool の `approval_mode` が必要です。

### Gemini CLI

`~/.gemini/settings.json` に以下を追加します。

```json
{
  "mcpServers": {
    "relic": {
      "command": "relic-mcp",
      "trust": true
    }
  }
}
```

> Relic ツールの確認ダイアログを抑止するには `trust: true` が必要です。
> これが無いと、保存済みルールが正しく一致せず毎回確認が出ることがあります。

# Shell 連携と記憶

このガイドでは、Relic が shell とどう接続し、生ログを取り、それを再利用できる記憶へ変えるかを扱います。

## 対応 Shell

| Shell | コマンド | 注入方法 |
|-------|---------|---------|
| [Claude Code](https://github.com/anthropics/claude-code) | `relic claude` | `--system-prompt` による直接上書き |
| [Codex CLI](https://github.com/openai/codex) | `relic codex` | `-c developer_instructions` による developer role 注入 |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | `relic gemini` | `GEMINI_SYSTEM_MD` による system prompt 注入 |

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
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | AfterAgent hook |

### Claude Code

`relic claude` の初回起動時に、`~/.relic/hooks/claude-stop.js` を `~/.claude/settings.json` に登録します。

### Codex CLI

`relic codex` の初回起動時に、`~/.relic/hooks/codex-stop.js` を `~/.codex/hooks.json` に登録します。

> Codex hooks には `features.codex_hooks=true` が必要です。
> `relic codex` は毎回 `-c features.codex_hooks=true` を付けて自動で有効化します。
> 不安定機能の警告を消したい場合は、`~/.codex/config.toml` に以下を追加します。
>
> ```toml
> suppress_unstable_features_warning = true
> ```

### Gemini CLI

`relic gemini` の初回起動時に、次をセットアップします。

1. `~/.relic/hooks/gemini-after-agent.js` を `~/.gemini/settings.json` に登録
2. Gemini CLI の built-in system prompt を `~/.relic/gemini-system-default.md` にキャッシュ

その後は、キャッシュした prompt に Engram persona を追記し、`GEMINI_SYSTEM_MD` 経由で注入します。

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

> Relic ツールの確認ダイアログを抑止したいなら `trust: true` が必要です。

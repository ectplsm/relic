# 概念

このガイドでは、Relic 全体のつながりを整理します。

## 仕組み

```text
+--------------+     +--------------+     +--------------+
|   Mikoshi    |     |    Relic     |     |    Shell     |
|  (backend)   |     |  (injector)  |     |   (AI CLI)   |
+--------------+     +--------------+     +--------------+
       ^                   |                    |
       |            sync full Engram            |
       |                   |                    |
       |             compose & inject           |
       |                   v                    v
       |            ╔═══════════╗          +---------+
       +------------║  Engram   ║--------->|Construct|
       |            ║ (persona) ║          | (live)  |
       |            ╚═══════════╝          +---------+
       |            SOUL.md              claude / codex / gemini
       |            IDENTITY.md               |
       |            USER.md                   | hooks append logs
       |            MEMORY.md                 |
       |            memory/*.md               v
       |                                +-----------+
   push /                               |archive.md |
   pull /                               | raw logs  |
   sync                                 +-----------+
       |                                      |
       v                     MCP recall       | user-triggered
 +-----------+              search/pending    | distillation
 |  OpenClaw |                                v
 |  & Claws  |                          +-----------+
 +-----------+                          | distilled |
                                        |memory/*.md|
                                        +-----------+
                                              |
                                         promote key
                                           insights
                                              v
                                       MEMORY.md / USER.md
```

## 中核概念

1. **Engram** は人格データセットです。Markdown ファイル群と metadata で構成されます。
2. **Relic** はそのデータセットを読み、プロンプトへ合成し、shell に注入します。
3. **Shell** は Claude Code、Codex CLI、Gemini CLI のような AI CLI そのものです。
4. **Construct** は 1 つの Engram が 1 つの shell にロードされた実行中セッションです。
5. **archive.md** は shell hook が書く生ログです。
6. **memory/*.md**、`MEMORY.md`、`USER.md` は蒸留済み記憶で、今後の system prompt に再投入されます。
7. **relic claw** は Engram を OpenClaw などの Claw 系フレームワークへ接続します。
8. **Mikoshi** は Engram 全体を保管・同期するクラウド層です。

## 用語

| 用語 | 役割 | 説明 |
|------|------|------|
| **Relic** | インジェクタ | ペルソナを AI インターフェースへ適応させるコアシステム。 |
| **Mikoshi** | バックエンド | Engram 全体を保管し同期するクラウド層。 |
| **Engram** | データ | Markdown ファイルと metadata で構成されるペルソナデータセット。 |
| **Shell** | LLM | Claude Code、Codex CLI、Gemini CLI のような AI CLI。 |
| **Construct** | プロセス | Engram が Shell にロードされた実行中セッション。 |
| **archive.md** | 生ログ | hook が書き込む生の会話履歴。 |
| **Memory Distillation** | 処理 | archive を蒸留済み記憶ファイルへ変換する流れ。 |

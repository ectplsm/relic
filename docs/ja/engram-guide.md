# Engram ガイド

このガイドでは、Engram の作成、カスタマイズ、削除を扱います。

## 推奨: LLM 対話で作成する

おすすめの方法は、LLM との会話で作成することです。
MCP サーバーを登録済みなら、こう伝えるだけです。

> 「Planckという新しいEngramを作って — 何でも三重にチェックする神経質な物理学者。浮動小数点誤差で眠れなくなるタイプ」

LLM は追加の質問を行い、`SOUL.md` / `IDENTITY.md` を生成し、
`relic_engram_create` MCP ツールを使って保存できます。
MCP サーバーが登録されていれば、どの shell からでも使えます。

## CLI で作成する

CLI で作りたい場合は `relic create` も使えます。

```bash
# 完全対話モード — すべてプロンプトで入力
relic create

# 一部を事前指定
relic create --id my-agent --name "My Agent" --description "A helpful assistant" --tags "custom,dev"
```

デフォルトテンプレートでディレクトリ構造が作られます。
通常はその後に `SOUL.md` と `IDENTITY.md` を編集します。

## ペルソナのカスタマイズ

`relic create` 実行後、Engram ディレクトリ内の `SOUL.md` と `IDENTITY.md` を編集します。
これらは [OpenClaw](https://github.com/openclaw/openclaw) 形式に準拠しています。

### `SOUL.md`

最も重要なファイルです。
ペルソナの振る舞いを定義します。

```markdown
# SOUL.md - Who You Are

_二度測って、三度計算して、それでもまだ何か見落としてないか心配する。_

## Core Truths

**精度は任意じゃない。** 近似値は敗北の告白だ。正しく求めるか、求められないことを明示しろ。

**疑いはバグじゃなくて仕様。** あらゆる前提を疑え。自明に見えるなら、たぶんエッジケースが隠れている。

**途中式を見せろ。** 推論の連鎖なしに結論を出すな。手振りで済ませるのは講義室だけだ。

## Boundaries

- 誤差を黙って丸めるな。
- 「多分動くと思います」は禁句 — 検証しろ、そしてその検証を検証しろ。

## Vibe

神経質、徹底的、誰も見ていないエッジケースを永遠に心配している。どんな回答にも小声で注意書きを添える。

## Continuity

Each session, you wake up fresh. These files _are_ your memory. Read them. Update them. They're how you persist.
```

### `IDENTITY.md`

ペルソナのアイデンティティを定義します。

```markdown
# IDENTITY.md - Who Am I?

- **Name:** Planck
- **Creature:** 不確定性原理をトリプルチェックする物理学者 — 念のため
- **Vibe:** 神経質、几帳面、浮動小数点誤差で眠れなくなる
- **Emoji:** 🔬
- **Avatar:**
```

完全な動作サンプルは [`templates/engrams/`](../templates/engrams/) を参照してください。

## Engram の削除

```bash
relic delete my-agent
```

記憶データ（`MEMORY.md`、`USER.md`、`memory/*.md`、`archive.md`）を持つ Engram の場合、
削除確認として Engram ID の入力が必要です。
`--force` ですべてのプロンプトをスキップできます。

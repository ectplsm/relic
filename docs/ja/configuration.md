# 設定

このガイドでは、Relic の設定と実行時デフォルトを扱います。

設定ファイルは `~/.relic/config.json` にあり、`relic config` コマンドで管理します。

## コマンド

```bash
# 現在の設定を表示
relic config show

# デフォルトEngram — --engram 省略時に使用される
relic config default-engram           # 取得
relic config default-engram rebel     # 設定

# Clawディレクトリ — claw inject/extract/sync の --dir 省略時に使用
relic config claw-path                # 取得
relic config claw-path ~/.openclaw    # 設定

# メモリウィンドウ — プロンプトに含める直近メモリエントリ数
relic config memory-window            # 取得（デフォルト: 2）
relic config memory-window 5          # 設定

# 蒸留バッチ件数 — 一度に蒸留する archive エントリ数
relic config distillation-batch-size      # 取得（デフォルト: 30）
relic config distillation-batch-size 50   # 設定
```

## `config.json` の例

```json
{
  "engramsPath": "/home/user/.relic/engrams",
  "defaultEngram": "rebel",
  "clawPath": "/home/user/.openclaw",
  "memoryWindowSize": 2,
  "distillationBatchSize": 30
}
```

## 優先順位

CLIフラグは常にconfig値より優先されます。

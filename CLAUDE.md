# PROJECT RELIC

AIの人格(Engram)をクラウド要塞(Mikoshi)で管理し、あらゆるLLMインターフェース(Shell)へ動的に注入(Summon)するシステム。

## ドメイン用語 (The 5 Pillars)

| 用語 | 役割 | 説明 |
|------|------|------|
| **Relic** | Injector | システムの中核。CLI/MCP/APIの複数の顔を持つアダプター |
| **Mikoshi** | Backend | すべてのEngramが安置されるクラウドデータ要塞 (`mikoshi.ectplsm.com`) |
| **Engram** | Data | OpenClaw互換の人格データセット (Markdown群) |
| **Shell** | LLM | Claude, Gemini, GPT等。純粋な演算能力のみを持つ空の肉体 |
| **Construct** | Process | ShellにEngramがロードされ稼働しているプロセス |

## アーキテクチャ

クリーンアーキテクチャ。依存の方向は常に内側(core)へ。

```
src/
├── core/           # ビジネスロジック（外部依存なし、Zodのみ例外）
│   ├── entities/   # Engram, Construct等のドメインモデル
│   ├── usecases/   # summon, list, sync等のユースケース
│   └── ports/      # 外部との境界インターフェース（抽象）
├── adapters/       # ポートの具象実装 (Mikoshi API等)
├── interfaces/     # エントリポイント (CLI, MCP Server)
└── shared/         # 共有ユーティリティ
```

## 技術スタック

- **ランタイム**: Node.js (>=18)
- **言語**: TypeScript (strict mode)
- **バリデーション**: Zod
- **CLI**: Commander
- **MCP**: @modelcontextprotocol/sdk

## コーディング規約

- 変数名・型名にドメイン用語 (Engram, Mikoshi, Shell, Construct, Relic) を積極的に使用する
- `core/` 内は外部ライブラリ(Zod以外)に依存しない
- Engramのデータ構造はOpenClaw workspace互換を維持する

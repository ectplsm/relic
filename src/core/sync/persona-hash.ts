import { createHash } from "node:crypto";

const HEADER = "mikoshi.persona.v1";

/**
 * Persona hash canonicalization — mikoshi-sync.md 準拠
 *
 * 正規化ルール:
 *  - UTF-8 BOM 除去
 *  - 改行を \n に統一
 *  - 末尾 \n を strip
 *
 * Canonical payload:
 *  header \n SOUL.md \n byteLen \n content \n IDENTITY.md \n byteLen \n content
 *
 * 出力: "sha256:<64 lowercase hex>"
 * soul / identity どちらかが欠落なら null
 */
export function computePersonaHash(
  soul: string | undefined,
  identity: string | undefined,
): string | null {
  if (!soul || !identity) return null;

  const normSoul = normalize(soul);
  const normIdentity = normalize(identity);

  const soulBytes = Buffer.byteLength(normSoul, "utf-8");
  const identityBytes = Buffer.byteLength(normIdentity, "utf-8");

  const payload = [
    HEADER,
    "SOUL.md",
    String(soulBytes),
    normSoul,
    "IDENTITY.md",
    String(identityBytes),
    normIdentity,
  ].join("\n");

  const hex = createHash("sha256").update(payload, "utf-8").digest("hex");
  return `sha256:${hex}`;
}

/** 正規化: BOM 除去 → 改行統一 → 末尾改行 strip */
function normalize(text: string): string {
  let s = text;
  // strip leading BOM
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
  }
  // normalize line endings to \n
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // strip trailing \n
  s = s.replace(/\n+$/, "");
  return s;
}

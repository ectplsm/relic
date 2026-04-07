import { createHash } from "node:crypto";
import { normalizeText } from "./normalize.js";

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

  const normSoul = normalizeText(soul, { stripTrailingNewlines: true });
  const normIdentity = normalizeText(identity, { stripTrailingNewlines: true });

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

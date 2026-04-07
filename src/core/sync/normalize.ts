/**
 * テキスト正規化 — mikoshi-sync.md 共通ルール
 *
 * - UTF-8 BOM 除去
 * - 改行を \n に統一
 * - stripTrailingNewlines: true なら末尾 \n を除去（persona 用）
 */
export function normalizeText(
  text: string,
  opts?: { stripTrailingNewlines?: boolean },
): string {
  let s = text;
  // strip leading BOM
  if (s.charCodeAt(0) === 0xfeff) {
    s = s.slice(1);
  }
  // normalize line endings to \n
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // strip trailing \n (persona only)
  if (opts?.stripTrailingNewlines) {
    s = s.replace(/\n+$/, "");
  }
  return s;
}

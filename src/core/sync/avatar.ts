import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { isAbsolute, resolve, extname } from "node:path";

/**
 * Avatar path / hash utilities — engram-avatar-upload プラン準拠
 *
 * IDENTITY.md 内の `- **Avatar:** <path>` を検出し、
 * 絶対パス / Engram 相対パスの両方を解決する。
 * URL 値（http(s)://）は Mikoshi 管理外として無視する。
 */

/** Avatar 行を検出する正規表現 */
const AVATAR_LINE_PATTERN = /^-\s+\*\*Avatar:\*\*\s*(.+)$/m;

/** クライアントが許可する MIME タイプ */
const SUPPORTED_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * IDENTITY.md から Avatar フィールドの生の値を抽出する。
 *
 * - マッチしなければ null
 * - 値が URL（http://, https://）の場合は Mikoshi 管理外として null
 * - 空白のみの値も null として扱う
 */
export function parseAvatarPath(identity: string): string | null {
  const match = identity.match(AVATAR_LINE_PATTERN);
  if (!match) return null;

  const raw = match[1].trim();
  if (raw.length === 0) return null;

  // URL 値は Mikoshi 管理外として無視
  if (/^https?:\/\//i.test(raw)) return null;

  return raw;
}

/**
 * Avatar パスを絶対パスに解決する。
 *
 * - 絶対パス → そのまま
 * - 相対パス → Engram ディレクトリ基準で resolve
 */
export function resolveAvatarPath(rawPath: string, engramDir: string): string {
  return isAbsolute(rawPath) ? rawPath : resolve(engramDir, rawPath);
}

/**
 * ファイル内容の SHA-256 ハッシュを計算する。
 *
 * 出力形式: "sha256:<64 lowercase hex>"
 *
 * ストリーム処理なので 2MB 制限を超える巨大ファイルでも OOM しない。
 */
export function computeAvatarHash(filePath: string): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("error", rejectPromise);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolvePromise(`sha256:${hash.digest("hex")}`));
  });
}

/**
 * 拡張子から MIME タイプを判定する。
 *
 * 許可フォーマット: JPEG, PNG, WebP
 * 対応外なら null（呼び出し側でエラーにする）
 *
 * バイナリ判定は Mikoshi 側の sharp に任せる方針。
 * クライアントは軽量な事前バリデーションのみ。
 */
export function detectAvatarMimeType(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();
  return SUPPORTED_MIME[ext] ?? null;
}

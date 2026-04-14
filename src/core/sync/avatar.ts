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

/**
 * 分割用の正規表現。
 *
 * group 1: `- **Avatar:** ` までの prefix（末尾の空白含む）
 * group 2: Avatar の値部分（行末まで）
 */
const AVATAR_LINE_PATTERN_SPLIT = /^(-\s+\*\*Avatar:\*\*\s*)(.+)$/m;

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

// ---------------------------------------------------------------------------
// Pull-side helpers (Phase 3): Avatar 行の分離 / 書き換え / drift 検出
// ---------------------------------------------------------------------------

/**
 * IDENTITY.md を Avatar 行の前後で分離した結果。
 *
 * Avatar 行が存在しない場合は `rawValue === null`、`before` に全内容、
 * `after` に空文字が入る（呼び出し側が「Avatar 行無し」として判定できる）。
 */
export interface AvatarSplit {
  /** Avatar 行の値の直前までの文字列（`- **Avatar:** ` prefix を含む） */
  before: string;
  /** Avatar 行の値（行末改行含まず）。Avatar 行が無ければ null */
  rawValue: string | null;
  /** Avatar 行の値の直後以降の文字列（行末改行とその後の内容） */
  after: string;
}

/**
 * IDENTITY.md を Avatar 行の値を境に前後分離する。
 *
 * 書き換えと drift 検出の両方で使う基本操作。
 */
export function splitAroundAvatar(identity: string): AvatarSplit {
  const match = AVATAR_LINE_PATTERN_SPLIT.exec(identity);
  if (!match) {
    return { before: identity, rawValue: null, after: "" };
  }

  const prefix = match[1];
  const value = match[2];
  const valueStart = match.index + prefix.length;
  const valueEnd = valueStart + value.length;

  return {
    before: identity.slice(0, valueStart),
    rawValue: value,
    after: identity.slice(valueEnd),
  };
}

/**
 * IDENTITY.md の Avatar 行の値だけを差し替えて新しい文字列を返す。
 *
 * Avatar 行が存在しない場合は元の identity をそのまま返す
 * （新しい Avatar 行は挿入しない — 保守的な挙動）。
 */
export function rewriteAvatarValue(identity: string, newValue: string): string {
  const split = splitAroundAvatar(identity);
  if (split.rawValue === null) return identity;
  return split.before + newValue + split.after;
}

/**
 * avatar-only drift の検出結果。
 *
 * drift === true の場合のみ `localValue` / `remoteValue` が
 * 非 null（両方に Avatar 行が存在し、値だけが違う）。
 */
export interface AvatarOnlyDrift {
  drift: boolean;
  localValue: string | null;
  remoteValue: string | null;
}

/**
 * 2つの IDENTITY.md の差分が Avatar 行の値だけかどうかを判定する。
 *
 * 判定条件:
 * - 両方に Avatar 行が存在する
 * - Avatar 行の前後 (`before` / `after`) が完全一致
 * - Avatar 行の値だけ異なる
 *
 * PATH 前後の format 揺れ（改行数・空白数など）は
 * `before` / `after` の文字列一致にそのまま反映されるため、
 * 揺れがあれば avatar-only drift とは判定されない（false positive を避ける）。
 */
export function isAvatarOnlyDrift(
  local: string,
  remote: string,
): AvatarOnlyDrift {
  const a = splitAroundAvatar(local);
  const b = splitAroundAvatar(remote);

  if (a.rawValue === null || b.rawValue === null) {
    return { drift: false, localValue: null, remoteValue: null };
  }

  if (a.before === b.before && a.after === b.after && a.rawValue !== b.rawValue) {
    return { drift: true, localValue: a.rawValue, remoteValue: b.rawValue };
  }

  return { drift: false, localValue: null, remoteValue: null };
}

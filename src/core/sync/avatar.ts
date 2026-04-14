import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { isAbsolute, resolve, extname } from "node:path";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

/**
 * Avatar path / hash utilities — engram-avatar-upload プラン準拠
 *
 * IDENTITY.md 内の `- **Avatar:** <path>` を検出し、
 * 絶対パス / Engram 相対パスの両方を解決する。
 * Phase 4 以降は URL 値も parse するが、既存 pull 互換のため
 * `parseAvatarPath()` は従来どおり path のみ返す。
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

const SUPPORTED_MIME_SET = new Set(Object.values(SUPPORTED_MIME));
const MAX_REDIRECTS = 3;

export type AvatarRef =
  | { kind: "path"; value: string }
  | { kind: "url"; value: string };

export interface FetchedAvatar {
  bytes: Buffer;
  mimeType: string;
  finalUrl: string;
}

/**
 * IDENTITY.md から Avatar フィールドの生の値を抽出する。
 *
 * - マッチしなければ null
 * - 値が URL（http://, https://）の場合は Mikoshi 管理外として null
 * - 空白のみの値も null として扱う
 */
export function parseAvatarPath(identity: string): string | null {
  const ref = parseAvatarRef(identity);
  return ref?.kind === "path" ? ref.value : null;
}

/**
 * IDENTITY.md から Avatar フィールドの参照先を抽出する。
 *
 * - マッチしなければ null
 * - 空白のみの値も null
 * - `http(s)://` は URL として返す
 * - それ以外は path として返す
 */
export function parseAvatarRef(identity: string): AvatarRef | null {
  const match = identity.match(AVATAR_LINE_PATTERN);
  if (!match) return null;

  const raw = match[1].trim();
  if (raw.length === 0) return null;

  if (/^https?:\/\//i.test(raw)) {
    return { kind: "url", value: raw };
  }

  return { kind: "path", value: raw };
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

export function computeAvatarHashFromBytes(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
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

/**
 * レスポンス header / magic number の両方から MIME を判定する。
 *
 * 両方あって不一致なら null を返す。
 */
export function detectAvatarMimeTypeFromBytes(
  bytes: Uint8Array,
  headerMimeType?: string | null,
): string | null {
  const normalizedHeader = normalizeHeaderMimeType(headerMimeType);
  const magicMime = detectAvatarMimeTypeByMagic(bytes);

  if (normalizedHeader && magicMime && normalizedHeader !== magicMime) {
    return null;
  }

  return magicMime ?? normalizedHeader ?? null;
}

export function isHttpsUrl(raw: string): boolean {
  try {
    return new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * ホストが private / loopback / link-local なら true。
 *
 * hostname の場合は DNS lookup して、返ってきた全アドレスを検査する。
 * DNS rebinding の完全対策ではない。事故防止用。
 */
export async function isPrivateHost(url: URL): Promise<boolean> {
  const hostname = url.hostname;
  if (!hostname) return true;

  if (isIpAddressPrivate(hostname)) {
    return true;
  }

  if (isIP(hostname) !== 0) {
    return false;
  }

  try {
    const addresses = await lookup(hostname, { all: true });
    if (addresses.length === 0) return true;
    return addresses.some((entry) => isIpAddressPrivate(entry.address));
  } catch {
    return true;
  }
}

export async function fetchAvatarFromUrl(
  url: string,
  maxBytes: number,
  timeoutMs: number,
): Promise<FetchedAvatar> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = url;

    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      if (!isHttpsUrl(currentUrl)) {
        throw new Error(`Avatar URL must use HTTPS: ${currentUrl}`);
      }

      const parsed = new URL(currentUrl);
      if (await isPrivateHost(parsed)) {
        throw new Error(`Avatar URL points to a private host: ${currentUrl}`);
      }

      const response = await fetch(parsed, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: "image/jpeg, image/png, image/webp",
        },
      });

      if (isRedirectResponse(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error(`Avatar URL redirected without Location header: ${currentUrl}`);
        }
        if (redirectCount === MAX_REDIRECTS) {
          throw new Error(`Avatar URL exceeded redirect limit (${MAX_REDIRECTS})`);
        }
        currentUrl = new URL(location, parsed).toString();
        continue;
      }

      if (!response.ok) {
        throw new Error(`Avatar URL fetch failed with HTTP ${response.status}`);
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        const parsedLength = Number.parseInt(contentLength, 10);
        if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
          throw new Error(
            `Avatar URL content-length exceeds ${maxBytes} bytes (actual: ${parsedLength})`,
          );
        }
      }

      const bytes = await readResponseBody(response, maxBytes);
      const mimeType = detectAvatarMimeTypeFromBytes(
        bytes,
        response.headers.get("content-type"),
      );
      if (!mimeType) {
        throw new Error("Avatar URL returned an unsupported image format");
      }

      return { bytes, mimeType, finalUrl: currentUrl };
    }

    throw new Error(`Avatar URL exceeded redirect limit (${MAX_REDIRECTS})`);
  } finally {
    clearTimeout(timer);
  }
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

function normalizeHeaderMimeType(headerMimeType?: string | null): string | null {
  if (!headerMimeType) return null;
  const mimeType = headerMimeType.split(";")[0]?.trim().toLowerCase();
  return mimeType && SUPPORTED_MIME_SET.has(mimeType) ? mimeType : null;
}

function detectAvatarMimeTypeByMagic(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

async function readResponseBody(response: Response, maxBytes: number): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Avatar URL response body is empty");
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      throw new Error(`Avatar URL body exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks);
}

function isRedirectResponse(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isIpAddressPrivate(value: string): boolean {
  const family = isIP(value);
  if (family === 4) return isPrivateIpv4(value);
  if (family === 6) return isPrivateIpv6(value);
  return false;
}

function isPrivateIpv4(value: string): boolean {
  const parts = value.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(value: string): boolean {
  const normalized = value.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  return false;
}

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CIPHER_ALGORITHM = "aes-256-gcm" as const;

const DEFAULT_KDF_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  dkLen: 32,
} as const;

const SALT_BYTES = 16;
const DEK_BYTES = 32;
const NONCE_BYTES = 12; // AES-256-GCM standard IV

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KdfParams {
  N: number;
  r: number;
  p: number;
  dkLen: number;
}

export interface MemoryManifest {
  payloadKind: "memory";
  bundleVersion: 1;
  hasUserFile: boolean;
  hasMemoryIndex: boolean;
  memoryEntryCount: number;
  latestMemoryDate: string | null;
}

/** 暗号化結果 — Mikoshi upload payload にそのまま乗せられる形 */
export interface EncryptedMemoryBundle {
  ciphertext: string;        // base64
  cipherAlgorithm: "AES-256-GCM";
  cipherNonce: string;       // base64
  wrappedBundleKey: string;  // base64
  wrapAlgorithm: "AES-256-GCM";
  kdfAlgorithm: "scrypt";
  kdfSalt: string;           // base64
  kdfParams: KdfParams;
  manifest: MemoryManifest;
  bundleHash: string;        // sha256:<hex>
}

/** 復号結果 — ファイルパス→コンテンツの Map */
export type DecryptedMemoryFiles = Record<string, string>;

// ---------------------------------------------------------------------------
// Encrypt
// ---------------------------------------------------------------------------

/**
 * Memory ファイル群を暗号化して EncryptedMemoryBundle を返す。
 *
 * @param files  パス → コンテンツ (例: { "USER.md": "...", "memory/2026-04-03.md": "..." })
 * @param passphrase  ユーザーのパスフレーズ
 */
export function encryptMemoryBundle(
  files: Record<string, string>,
  passphrase: string,
): EncryptedMemoryBundle {
  // 1. scrypt: passphrase → KEK
  const salt = randomBytes(SALT_BYTES);
  const kek = deriveKek(passphrase, salt, DEFAULT_KDF_PARAMS);

  // 2. Random DEK
  const dek = randomBytes(DEK_BYTES);

  // 3. Bundle: files → JSON → UTF-8 bytes
  const plaintext = Buffer.from(JSON.stringify(files), "utf-8");

  // 4. DEK + AES-256-GCM → ciphertext
  const dataNonce = randomBytes(NONCE_BYTES);
  const { encrypted: ciphertext, authTag: dataTag } = aesGcmEncrypt(dek, dataNonce, plaintext);
  // GCM の authTag を ciphertext 末尾に結合 (16 bytes)
  const ciphertextWithTag = Buffer.concat([ciphertext, dataTag]);

  // 5. KEK + AES-256-GCM → wrappedBundleKey (nonce(12) + encrypted + authTag(16))
  const wrapNonce = randomBytes(NONCE_BYTES);
  const { encrypted: wrappedKey, authTag: wrapTag } = aesGcmEncrypt(kek, wrapNonce, dek);
  const wrappedBundleKey = Buffer.concat([wrapNonce, wrappedKey, wrapTag]);

  // 6. Manifest
  const manifest = buildManifest(files);

  // 7. bundleHash = SHA-256(ciphertext with tag)
  const bundleHash = `sha256:${createHash("sha256").update(ciphertextWithTag).digest("hex")}`;

  return {
    ciphertext: ciphertextWithTag.toString("base64"),
    cipherAlgorithm: "AES-256-GCM",
    cipherNonce: dataNonce.toString("base64"),
    wrappedBundleKey: wrappedBundleKey.toString("base64"),
    wrapAlgorithm: "AES-256-GCM",
    kdfAlgorithm: "scrypt",
    kdfSalt: salt.toString("base64"),
    kdfParams: { ...DEFAULT_KDF_PARAMS },
    manifest,
    bundleHash,
  };
}

// ---------------------------------------------------------------------------
// Decrypt
// ---------------------------------------------------------------------------

/**
 * EncryptedMemoryBundle を復号して memory ファイル群を返す。
 *
 * @param bundle  Mikoshi からダウンロードした暗号化バンドル
 * @param passphrase  ユーザーのパスフレーズ
 * @throws パスフレーズ不一致やデータ破損時に Error
 */
export function decryptMemoryBundle(
  bundle: {
    ciphertext: string;
    cipherNonce: string;
    wrappedBundleKey: string;
    kdfSalt: string;
    kdfParams: KdfParams;
  },
  passphrase: string,
): DecryptedMemoryFiles {
  // 1. scrypt: passphrase → KEK
  const salt = Buffer.from(bundle.kdfSalt, "base64");
  const kek = deriveKek(passphrase, salt, bundle.kdfParams);

  // 2. KEK → DEK を復号
  const wrappedBuf = Buffer.from(bundle.wrappedBundleKey, "base64");
  const dek = aesGcmDecrypt(kek, wrappedBuf);

  // 3. DEK → plaintext を復号
  const nonce = Buffer.from(bundle.cipherNonce, "base64");
  const ciphertextBuf = Buffer.from(bundle.ciphertext, "base64");
  const plaintext = aesGcmDecryptWithNonce(dek, nonce, ciphertextBuf);

  // 4. JSON parse
  return JSON.parse(plaintext.toString("utf-8")) as DecryptedMemoryFiles;
}

// ---------------------------------------------------------------------------
// Passphrase input
// ---------------------------------------------------------------------------

/**
 * TTY から非表示入力でパスフレーズを読む。
 * 入力中は文字が画面に出ない。
 */
export function readPassphrase(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error("Cannot read passphrase: stdin is not a TTY"));
      return;
    }

    process.stdout.write(prompt);
    const raw = process.stdin.setRawMode?.(true);
    if (!raw) {
      reject(new Error("Cannot enable raw mode on stdin"));
      return;
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    let input = "";
    const onData = (ch: string) => {
      const c = ch.toString();
      if (c === "\n" || c === "\r" || c === "\u0004") {
        // Enter or Ctrl+D
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(input);
      } else if (c === "\u0003") {
        // Ctrl+C
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        reject(new Error("Cancelled"));
      } else if (c === "\u007f" || c === "\b") {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
        }
      } else {
        input += c;
      }
    };
    process.stdin.on("data", onData);
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function deriveKek(passphrase: string, salt: Buffer, params: KdfParams): Buffer {
  return scryptSync(passphrase, salt, params.dkLen, {
    N: params.N,
    r: params.r,
    p: params.p,
  }) as Buffer;
}

function aesGcmEncrypt(
  key: Buffer,
  nonce: Buffer,
  plaintext: Buffer,
): { encrypted: Buffer; authTag: Buffer } {
  const cipher = createCipheriv(CIPHER_ALGORITHM, key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encrypted, authTag };
}

/**
 * wrappedBundleKey 復号用 — nonce は先頭 12 bytes に含まれている想定ではなく、
 * wrappedKey = encrypted(32) + authTag(16) = 48 bytes の固定構造。
 * nonce は wrap 時にランダム生成したものだが、upload payload には cipherNonce しかない。
 *
 * → wrappedBundleKey は nonce を自己完結させる必要がある。
 *   構造を nonce(12) + encrypted + authTag(16) に変更する。
 */
function aesGcmDecrypt(key: Buffer, data: Buffer): Buffer {
  // data = nonce(12) + encrypted + authTag(16)
  const nonce = data.subarray(0, NONCE_BYTES);
  const authTag = data.subarray(data.length - 16);
  const encrypted = data.subarray(NONCE_BYTES, data.length - 16);

  const decipher = createDecipheriv(CIPHER_ALGORITHM, key, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function aesGcmDecryptWithNonce(key: Buffer, nonce: Buffer, data: Buffer): Buffer {
  // data = encrypted + authTag(16)
  const authTag = data.subarray(data.length - 16);
  const encrypted = data.subarray(0, data.length - 16);

  const decipher = createDecipheriv(CIPHER_ALGORITHM, key, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function buildManifest(files: Record<string, string>): MemoryManifest {
  const memoryEntryPaths = Object.keys(files).filter((p) => p.startsWith("memory/"));
  const dates = memoryEntryPaths
    .map((p) => p.replace("memory/", "").replace(".md", ""))
    .sort();

  return {
    payloadKind: "memory",
    bundleVersion: 1,
    hasUserFile: "USER.md" in files,
    hasMemoryIndex: "MEMORY.md" in files,
    memoryEntryCount: memoryEntryPaths.length,
    latestMemoryDate: dates.length > 0 ? dates[dates.length - 1] : null,
  };
}

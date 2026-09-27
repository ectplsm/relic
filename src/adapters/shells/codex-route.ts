import {
  chmodSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

export const CODEX_ROUTE_VERSION = 1 as const;

const CODEX_ROUTE_ID = /^[a-f0-9]{64}$/;

export interface CodexRoute {
  version: typeof CODEX_ROUTE_VERSION;
  engramId: string;
  archivePath: string;
}

export interface CodexRouteLocation {
  routesDirectory?: string;
  homeDirectory?: string;
}

export interface CreatedCodexRoute {
  id: string;
  path: string;
  route: CodexRoute;
}

export class CodexRouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CodexRouteError";
  }
}

export function resolveCodexRoutesDirectory(
  location: CodexRouteLocation = {},
): string {
  return location.routesDirectory
    ? resolve(location.routesDirectory)
    : join(location.homeDirectory ?? homedir(), ".relic", "runtime", "codex", "routes");
}

export function createCodexRouteId(route: CodexRoute): string {
  const canonical = JSON.stringify([
    route.version,
    route.engramId,
    route.archivePath,
  ]);
  return createHash("sha256").update(canonical).digest("hex");
}

export function formatCodexRouteMarker(id: string): string {
  if (!CODEX_ROUTE_ID.test(id)) {
    throw new CodexRouteError(`Invalid Codex route ID: ${id}`);
  }
  return `<!-- relic-route:${id} -->`;
}

/** Create or reuse the immutable route for one Engram archive destination. */
export function createCodexRoute(
  engramId: string,
  archivePath: string,
  location: CodexRouteLocation = {},
): CreatedCodexRoute {
  if (engramId.length === 0 || engramId.includes("\0")) {
    throw new CodexRouteError("Codex route requires a valid Engram ID.");
  }
  if (archivePath.length === 0 || archivePath.includes("\0")) {
    throw new CodexRouteError("Codex route requires a valid archive path.");
  }

  const route: CodexRoute = {
    version: CODEX_ROUTE_VERSION,
    engramId,
    archivePath: resolve(archivePath),
  };
  const id = createCodexRouteId(route);
  const routesDirectory = resolveCodexRoutesDirectory(location);
  const path = join(routesDirectory, `${id}.json`);

  mkdirSync(routesDirectory, { recursive: true, mode: 0o700 });
  chmodSync(routesDirectory, 0o700);

  try {
    writeFileSync(path, `${JSON.stringify(route, null, 2)}\n`, {
      encoding: "utf-8",
      flag: "wx",
      mode: 0o600,
    });
  } catch (error) {
    if (!isFileAlreadyPresent(error)) throw error;

    const existing = readCodexRoute(id, location);
    if (!existing || !routesEqual(existing, route)) {
      throw new CodexRouteError(`Existing Codex route is invalid: ${id}`);
    }
  }

  return { id, path, route };
}

/** Read a route only when its shape, permissions, and content hash are valid. */
export function readCodexRoute(
  id: string,
  location: CodexRouteLocation = {},
): CodexRoute | undefined {
  if (!CODEX_ROUTE_ID.test(id)) return undefined;

  const path = join(resolveCodexRoutesDirectory(location), `${id}.json`);
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) {
      return undefined;
    }

    const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
    if (!isCodexRoute(parsed)) return undefined;
    if (createCodexRouteId(parsed) !== id) return undefined;

    return parsed;
  } catch {
    return undefined;
  }
}

function isCodexRoute(value: unknown): value is CodexRoute {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const route = value as Record<string, unknown>;
  const keys = Object.keys(route).sort();
  if (keys.join(",") !== "archivePath,engramId,version") return false;

  return route.version === CODEX_ROUTE_VERSION
    && typeof route.engramId === "string"
    && route.engramId.length > 0
    && !route.engramId.includes("\0")
    && typeof route.archivePath === "string"
    && isAbsolute(route.archivePath)
    && resolve(route.archivePath) === route.archivePath;
}

function routesEqual(left: CodexRoute, right: CodexRoute): boolean {
  return left.version === right.version
    && left.engramId === right.engramId
    && left.archivePath === right.archivePath;
}

function isFileAlreadyPresent(error: unknown): boolean {
  return error instanceof Error
    && "code" in error
    && (error as NodeJS.ErrnoException).code === "EEXIST";
}

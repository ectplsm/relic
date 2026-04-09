import { normalizeText } from "./normalize.js";
import type { EngramFiles } from "../entities/engram.js";

export interface MemoryRecordDiff {
  added: string[];
  changed: string[];
  removed: string[];
}

export interface MergeMemoryRecordsResult {
  merged: Record<string, string>;
  changedPaths: string[];
}

export function computeMemoryRecordDiff(
  local: Record<string, string>,
  remote: Record<string, string>,
): MemoryRecordDiff {
  const allPaths = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];

  for (const path of [...allPaths].sort()) {
    const inLocal = path in local;
    const inRemote = path in remote;
    if (inRemote && !inLocal) {
      added.push(path);
    } else if (inLocal && !inRemote) {
      removed.push(path);
    } else if (inLocal && inRemote && local[path] !== remote[path]) {
      changed.push(path);
    }
  }

  return { added, changed, removed };
}

export function mergeMemoryRecords(
  local: Record<string, string>,
  remote: Record<string, string>,
): MergeMemoryRecordsResult {
  const allPaths = new Set([...Object.keys(local), ...Object.keys(remote)]);
  const merged: Record<string, string> = {};
  const changedPaths: string[] = [];

  for (const path of [...allPaths].sort()) {
    const localContent = local[path];
    const remoteContent = remote[path];
    const mergedContent = mergeTextMonotonic(localContent, remoteContent);
    if (mergedContent === undefined) continue;

    merged[path] = mergedContent;
    if (mergedContent !== localContent || mergedContent !== remoteContent) {
      changedPaths.push(path);
    }
  }

  return { merged, changedPaths };
}

export function applyMemoryRecordToFiles(
  files: EngramFiles,
  record: Record<string, string>,
): EngramFiles {
  const updatedFiles: EngramFiles = {
    ...files,
    user: record["USER.md"] ?? undefined,
    memory: record["MEMORY.md"] ?? undefined,
  };

  const memoryEntries: Record<string, string> = {};
  for (const [path, content] of Object.entries(record)) {
    if (path.startsWith("memory/") && path.endsWith(".md")) {
      const date = path.replace("memory/", "").replace(".md", "");
      memoryEntries[date] = content;
    }
  }
  updatedFiles.memoryEntries = Object.keys(memoryEntries).length > 0 ? memoryEntries : undefined;

  return updatedFiles;
}

function mergeTextMonotonic(
  local?: string,
  remote?: string,
): string | undefined {
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  if (local === remote) return local;

  const blocks = [
    ...splitBlocks(local),
    ...splitBlocks(remote),
  ];
  const seen = new Set<string>();
  const mergedBlocks: string[] = [];

  for (const block of blocks) {
    if (!seen.has(block)) {
      seen.add(block);
      mergedBlocks.push(block);
    }
  }

  return mergedBlocks.join("\n\n");
}

function splitBlocks(content: string): string[] {
  const normalized = normalizeText(content).trim();
  if (!normalized) return [];

  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
}

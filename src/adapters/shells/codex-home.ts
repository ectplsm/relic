import { homedir } from "node:os";
import { join, resolve } from "node:path";

interface CodexHomeContext {
  codexHome?: string;
  homeDirectory?: string;
  currentDirectory?: string;
}

/** Resolve the Codex state directory shared by the CLI, IDE, and app-server. */
export function resolveCodexHome(context: CodexHomeContext = {}): string {
  const codexHome = context.codexHome ?? process.env.CODEX_HOME;
  if (codexHome) {
    return resolve(context.currentDirectory ?? process.cwd(), codexHome);
  }

  return join(context.homeDirectory ?? homedir(), ".codex");
}

export function resolveCodexHooksPath(): string {
  return join(resolveCodexHome(), "hooks.json");
}

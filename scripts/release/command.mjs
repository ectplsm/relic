import { spawnSync } from "node:child_process";

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf-8",
    input: options.input,
    stdio: options.stdio ?? "pipe",
    timeout: options.timeout,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `${command} ${args.join(" ")} failed with exit code ${result.status}${details ? `\n${details}` : ""}`,
    );
  }

  return (result.stdout ?? "").trim();
}

export function runOptional(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf-8",
    input: options.input,
    stdio: options.stdio ?? "pipe",
    timeout: options.timeout,
  });

  return {
    ok: !result.error && result.status === 0,
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    error: result.error,
  };
}

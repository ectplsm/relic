#!/usr/bin/env node

import { readFileSync } from "node:fs";

const STABLE_TAG_PATTERN = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function main() {
  const tag = process.argv[2];
  if (!tag || !STABLE_TAG_PATTERN.test(tag)) {
    throw new Error(`Expected a stable release tag, received: ${tag ?? "nothing"}`);
  }

  const version = tag.slice(1);
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const lockRoot = packageLock.packages?.[""];

  if (!packageJson.name || typeof packageJson.name !== "string") {
    throw new Error("package.json must define a package name");
  }
  if (packageJson.version !== version) {
    throw new Error(`package.json version ${packageJson.version} does not match ${tag}`);
  }
  if (packageLock.version !== version || lockRoot?.version !== version) {
    throw new Error(`package-lock.json version does not match ${tag}`);
  }
  if (lockRoot?.name !== packageJson.name) {
    throw new Error("package.json and package-lock.json package names do not match");
  }

  console.log(`package_name=${packageJson.name}`);
  console.log(`package_version=${version}`);
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

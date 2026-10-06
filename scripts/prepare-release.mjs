#!/usr/bin/env node

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { run, runOptional } from "./release/command.mjs";
import { prepareReleaseNotes } from "./release/notes.mjs";

const STABLE_SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function printUsage() {
  console.log(`Usage: npm run release:prepare -- <version> [options]

Prepare a release commit, annotated tag, and draft GitHub Release.
Publishing is handled separately by GitHub Actions.

Arguments:
  <version>              Stable SemVer version, with or without a leading v

Options:
  --no-ai-notes          Generate deterministic release notes without Codex
  --notes-file <path>    Use an existing release notes file
  --dry-run              Generate and validate notes without changing local or remote state
  -h, --help             Show this help
`);
}

function parseArgs(argv) {
  let version;
  let useAiNotes = true;
  let notesFile;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") return { help: true };
    if (arg === "--no-ai-notes") {
      useAiNotes = false;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--notes-file") {
      notesFile = argv[index + 1];
      if (!notesFile) throw new Error("--notes-file requires a path");
      index += 1;
      continue;
    }
    if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    if (version) throw new Error(`Unexpected argument: ${arg}`);
    version = arg.replace(/^v/, "");
  }

  if (!version) throw new Error("A release version is required");
  if (!STABLE_SEMVER_PATTERN.test(version)) {
    throw new Error(`Version must be stable SemVer (for example 0.5.3): ${version}`);
  }

  return {
    help: false,
    version,
    useAiNotes: useAiNotes && !notesFile,
    notesFile: notesFile ? resolve(notesFile) : undefined,
    dryRun,
  };
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function ensureRegistryVersionIsAvailable(packageName, version, repoRoot) {
  const result = runOptional("npm", ["view", `${packageName}@${version}`, "version", "--json"], {
    cwd: repoRoot,
    timeout: 15_000,
  });
  if (result.ok) throw new Error(`${packageName}@${version} is already published`);

  const failure = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join("\n");
  if (!/E404|404 Not Found/i.test(failure)) {
    throw new Error(`Could not verify npm version availability:\n${failure.trim()}`);
  }
}

function preflight(repoRoot, version, { dryRun }) {
  const branch = run("git", ["branch", "--show-current"], { cwd: repoRoot });
  if (run("git", ["status", "--porcelain"], { cwd: repoRoot })) {
    throw new Error("Working tree must be clean");
  }

  run("git", ["fetch", "--quiet", "origin", "main", "--tags"], { cwd: repoRoot });
  const head = run("git", ["rev-parse", "HEAD"], { cwd: repoRoot });
  const remoteMain = run("git", ["rev-parse", "origin/main"], { cwd: repoRoot });
  if (dryRun) {
    if (branch !== "main") {
      console.warn(`Dry run: generating notes from ${branch || "detached HEAD"}, not main.`);
    }
    if (head !== remoteMain) {
      console.warn("Dry run: HEAD does not match origin/main.");
    }
  } else {
    if (branch !== "main") {
      throw new Error(`Release preparation must run on main, not ${branch || "detached HEAD"}`);
    }
    if (head !== remoteMain) throw new Error("main must exactly match origin/main");

    run("gh", ["auth", "status"], { cwd: repoRoot });
    run("gh", ["repo", "view", "--json", "nameWithOwner"], { cwd: repoRoot });
  }

  const packageJsonPath = join(repoRoot, "package.json");
  const packageLockPath = join(repoRoot, "package-lock.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const packageLock = JSON.parse(readFileSync(packageLockPath, "utf-8"));
  const lockVersion = packageLock.packages?.[""]?.version;
  if (packageJson.version !== packageLock.version || packageJson.version !== lockVersion) {
    throw new Error("package.json and package-lock.json versions do not match");
  }
  if (!STABLE_SEMVER_PATTERN.test(packageJson.version)) {
    throw new Error(`Current package version is not stable SemVer: ${packageJson.version}`);
  }
  if (compareVersions(version, packageJson.version) <= 0) {
    throw new Error(`Release version ${version} must be greater than ${packageJson.version}`);
  }

  const tag = `v${version}`;
  if (runOptional("git", ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`], { cwd: repoRoot }).ok) {
    throw new Error(`Tag already exists: ${tag}`);
  }

  const previousTag = run("git", ["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*"], {
    cwd: repoRoot,
  });
  const commitCount = Number(run("git", ["rev-list", "--count", `${previousTag}..HEAD`], { cwd: repoRoot }));
  if (commitCount === 0) throw new Error(`No commits found after ${previousTag}`);

  ensureRegistryVersionIsAvailable(packageJson.name, version, repoRoot);
  return { packageJson, packageJsonPath, packageLockPath, previousTag, tag, commitCount };
}

function createDraftRelease(repoRoot, release, notesPath) {
  const releaseUrl = run(
    "gh",
    [
      "release", "create", release.tag,
      "--verify-tag",
      "--draft",
      "--title", release.tag,
      "--notes-file", notesPath,
    ],
    { cwd: repoRoot },
  );

  console.log("Draft GitHub Release created:");
  console.log(`  ${releaseUrl}`);
  console.log("\nReview it, then start the publish workflow with:");
  console.log(`  gh workflow run release.yml -f tag=${release.tag}`);
}

function assertOnlyVersionFilesChanged(repoRoot) {
  const trackedPaths = run("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot })
    .split("\n")
    .filter(Boolean);
  const untrackedPaths = run("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: repoRoot,
  })
    .split("\n")
    .filter(Boolean);
  const changedPaths = [...new Set([...trackedPaths, ...untrackedPaths])];
  const expected = new Set(["package.json", "package-lock.json"]);
  const unexpected = changedPaths.filter((path) => !expected.has(path));
  if (unexpected.length > 0) {
    throw new Error(`Unexpected files changed during release preparation: ${unexpected.join(", ")}`);
  }
  if (!changedPaths.includes("package.json") || !changedPaths.includes("package-lock.json")) {
    throw new Error("Version bump did not update both package.json and package-lock.json");
  }
}

async function confirm(question) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await readline.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    readline.close();
  }
}

function validatePackage(repoRoot, version, release) {
  const originalPackageJson = readFileSync(release.packageJsonPath, "utf-8");
  const originalPackageLock = readFileSync(release.packageLockPath, "utf-8");

  try {
    run("npm", ["version", version, "--no-git-tag-version"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    run("npm", ["ci"], { cwd: repoRoot, stdio: "inherit" });
    run("npm", ["run", "typecheck"], { cwd: repoRoot, stdio: "inherit" });
    run("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });
    run("npm", ["pack", "--dry-run"], { cwd: repoRoot, stdio: "inherit" });
    run("git", ["diff", "--check"], { cwd: repoRoot });
    assertOnlyVersionFilesChanged(repoRoot);
  } catch (error) {
    writeFileSync(release.packageJsonPath, originalPackageJson, "utf-8");
    writeFileSync(release.packageLockPath, originalPackageLock, "utf-8");
    throw error;
  }

  return { originalPackageJson, originalPackageLock };
}

function createReleaseCommit(repoRoot, version, release, originals) {
  try {
    run("git", ["add", "package.json", "package-lock.json"], { cwd: repoRoot });
    run(
      "git",
      [
        "commit",
        "-m", `chore: bump version to v${version}`,
        "-m", `Prepare the package metadata for the v${version} release.`,
      ],
      { cwd: repoRoot, stdio: "inherit" },
    );
  } catch (error) {
    runOptional("git", ["restore", "--staged", "--", "package.json", "package-lock.json"], {
      cwd: repoRoot,
    });
    writeFileSync(release.packageJsonPath, originals.originalPackageJson, "utf-8");
    writeFileSync(release.packageLockPath, originals.originalPackageLock, "utf-8");
    throw error;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const repoRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd: process.cwd() });
  process.chdir(repoRoot);
  console.log(`Preparing v${options.version} from ${basename(repoRoot)}...`);

  const release = preflight(repoRoot, options.version, { dryRun: options.dryRun });
  console.log(`Preflight passed: ${release.previousTag}..HEAD (${release.commitCount} commits)`);

  const tempDir = mkdtempSync(join(tmpdir(), "relic-release-"));
  let cleanupTemp = true;
  let releaseCommitCreated = false;
  let releasePushed = false;
  let notesPath;

  try {
    const notes = prepareReleaseNotes({
      repoRoot,
      previousTag: release.previousTag,
      version: options.version,
      packageJson: release.packageJson,
      notesFile: options.notesFile,
      useAiNotes: options.useAiNotes,
      tempDir,
    });
    notesPath = notes.notesPath;
    console.log("Release notes validated.");

    if (options.dryRun) {
      console.log("\n--- Release notes preview ---\n");
      console.log(notes.content.trimEnd());
      console.log("\nDry run complete. No files, commits, tags, drafts, or remotes were changed.");
      return;
    }

    if (!await confirm(`Create the v${options.version} release commit and annotated tag?`)) {
      console.log("Release preparation cancelled before changing the repository.");
      return;
    }

    const originals = validatePackage(repoRoot, options.version, release);
    createReleaseCommit(repoRoot, options.version, release, originals);
    releaseCommitCreated = true;

    run("git", ["tag", "-a", release.tag, "-m", `Release ${release.tag}`], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    console.log(`Created release commit and annotated tag ${release.tag}.`);

    if (await confirm(`Push main and ${release.tag}, then create a draft GitHub Release?`)) {
      run("git", ["push", "--atomic", "origin", "main", release.tag], {
        cwd: repoRoot,
        stdio: "inherit",
      });
      releasePushed = true;
      console.log(`Pushed main and ${release.tag}.`);
      createDraftRelease(repoRoot, release, notes.notesPath);
    } else {
      cleanupTemp = false;
      console.log("Release remains local. Push it later with:");
      console.log(`  git push --atomic origin main ${release.tag}`);
      console.log("Release notes preserved at:");
      console.log(`  ${notes.notesPath}`);
    }
  } catch (error) {
    cleanupTemp = false;
    console.error(`Temporary release files preserved at ${tempDir}`);
    if (releasePushed && notesPath) {
      console.error(`The release was pushed, but its draft may not exist. Retry with:`);
      console.error(
        `  gh release create ${release.tag} --verify-tag --draft --title ${release.tag} --notes-file ${notesPath}`,
      );
    } else if (releaseCommitCreated) {
      console.error(`The release commit exists locally; inspect it before retrying ${release.tag}.`);
    }
    throw error;
  } finally {
    if (cleanupTemp) rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

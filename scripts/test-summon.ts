import { resolve } from "node:path";
import { LocalEngramRepository } from "../src/adapters/local/index.js";
import { Summon } from "../src/core/usecases/index.js";
import { ListEngrams } from "../src/core/usecases/index.js";

const repo = new LocalEngramRepository(resolve("engrams"));

// 一覧取得
const list = new ListEngrams(repo);
const engrams = await list.execute();
console.log("=== Engram List ===");
for (const e of engrams) {
  console.log(`  [${e.id}] ${e.name}`);
}

// Summon実行
console.log("\n=== Summon: sample-persona ===");
const summon = new Summon(repo);
const result = await summon.execute("sample-persona");
console.log(`Name: ${result.engramName}`);
console.log(`---`);
console.log(result.prompt);

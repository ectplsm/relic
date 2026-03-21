import { Init } from "../src/core/usecases/index.js";

const init = new Init();
const result = await init.execute();

if (result.created) {
  console.log("Initialized ~/.relic/");
} else {
  console.log("Already initialized");
}
console.log(result);

export function printRelicBanner(): void {
  const lines = [
    "    ____  ________    ____________",
    "   / __ \\/ ____/ /   /  _/ ____/",
    "  / /_/ / __/ / /    / // /",
    " / _, _/ /___/ /____/ // /___",
    "/_/ |_/_____/_____/___/\\____/",
  ];
  for (const line of lines) {
    console.log(line);
  }
  console.log();
}

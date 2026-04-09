const DETAIL_PREFIX = "  ";

export function printLine(message = ""): void {
  console.log(message);
}

export function printBlank(): void {
  printLine();
}

export function printDetail(message: string): void {
  console.log(`${DETAIL_PREFIX}${message}`);
}

export function printErrorLine(message: string): void {
  console.error(message);
}

export function printErrorDetail(message: string): void {
  console.error(`${DETAIL_PREFIX}${message}`);
}

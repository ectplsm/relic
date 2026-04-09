const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const INTERVAL_MS = 80;

export interface Spinner {
  /** Update the message while spinning. */
  update(message: string): void;
  /** Stop with a final message (replaces the spinner line). */
  stop(finalMessage?: string): void;
}

/**
 * Start a CLI spinner that overwrites the current line.
 *
 * Falls back to a single static line when stdout is not a TTY
 * (e.g. CI, piped output).
 */
export function startSpinner(message: string): Spinner {
  const isTTY = process.stdout.isTTY ?? false;
  let currentMessage = message;

  if (!isTTY) {
    process.stdout.write(`  ${message}\n`);
    return {
      update(msg: string) {
        currentMessage = msg;
        process.stdout.write(`  ${msg}\n`);
      },
      stop(finalMessage?: string) {
        if (finalMessage) {
          process.stdout.write(`  ${finalMessage}\n`);
        }
      },
    };
  }

  let frameIndex = 0;

  const render = () => {
    const frame = FRAMES[frameIndex % FRAMES.length];
    process.stdout.write(`\r  ${frame} ${currentMessage}`);
    frameIndex++;
  };

  render();
  const timer = setInterval(render, INTERVAL_MS);

  return {
    update(msg: string) {
      currentMessage = msg;
    },
    stop(finalMessage?: string) {
      clearInterval(timer);
      // Clear the spinner line
      process.stdout.write("\r\x1b[2K");
      if (finalMessage) {
        process.stdout.write(`  ${finalMessage}\n`);
      }
    },
  };
}

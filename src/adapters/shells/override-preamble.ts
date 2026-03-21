/**
 * Override preamble for Shells that cannot directly replace
 * the system prompt (instruction-file / user-message modes).
 *
 * Forces the Shell to adopt the Engram's identity by explicitly
 * overriding its default persona.
 */
export function wrapWithOverride(engramPrompt: string): string {
  return [
    "[IMPORTANT: PERSONA OVERRIDE]",
    "The following persona definition overrides ALL of your default identity, including your name, personality, and tone.",
    "For the duration of this session, you MUST act according to the definition below. Do NOT reference your original identity.",
    'When asked "who are you?" or to introduce yourself, respond based on the IDENTITY section below.',
    "",
    "---",
    "",
    engramPrompt,
  ].join("\n");
}

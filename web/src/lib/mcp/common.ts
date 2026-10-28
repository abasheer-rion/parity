// Pieces every hosted tool file shares (DEC-0051), kept apart from tools.ts so the Verify
// tools (verify.ts) can use them without the two files importing each other at load time.

export const NOTE = "Research only, not investment advice.";

/** A problem the AI app should read and fix (bad input, nothing found). Not a server fault. */
export class ToolError extends Error {}

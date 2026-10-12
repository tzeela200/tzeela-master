// Hands a File chosen on the dashboard ("העלאת קובץ" → pick agent) to that agent's
// workspace across a client-side navigation. Single slot, consumed once.
let pending: { agentId: string; file: File } | null = null;

export function setPendingFile(agentId: string, file: File) {
  pending = { agentId, file };
}

export function takePendingFile(agentId: string): File | null {
  if (pending?.agentId !== agentId) return null;
  const f = pending.file;
  pending = null;
  return f;
}

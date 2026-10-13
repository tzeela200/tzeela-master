// Hands files chosen on the dashboard / niche page ("העלאת קובץ" or a drop → pick agent) to
// that agent's workspace across a client-side navigation. Single slot, consumed once.
let pending: { agentId: string; files: File[] } | null = null;

export function setPendingFiles(agentId: string, files: File[]) {
  pending = { agentId, files };
}

export function takePendingFiles(agentId: string): File[] {
  if (pending?.agentId !== agentId) return [];
  const f = pending.files;
  pending = null;
  return f;
}

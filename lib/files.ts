import type { AttachmentKind } from "./types";

/** Per file — the storage limit (Supabase plan maximum; bucket set in migration 0004). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
/**
 * Sanity cap per file only. The real limit is the model's context window: when the files
 * of a thread don't fit, the chat says so (error "too_long") — nothing is silently cut.
 */
export const MAX_TEXT_CHARS = 5_000_000;
/** Extracted text longer than this is stored as a .txt object instead of inside the message. */
export const INLINE_TEXT_CHARS = 8_000;

export const ATTACH_BUCKET = "uploads";

const BY_EXT: Record<string, AttachmentKind> = {
  txt: "txt",
  csv: "csv",
  pdf: "pdf",
  docx: "docx",
  xlsx: "xlsx",
  png: "image",
  jpg: "image",
  jpeg: "image",
};

export const ACCEPT = ".pdf,.docx,.txt,.csv,.xlsx,.png,.jpg,.jpeg";

export function kindOf(fileName: string): AttachmentKind | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXT[ext] ?? null;
}

export const FILE_ERRORS = {
  tooBig: "הקובץ גדול מ־50MB, וזה הגודל המקסימלי שהאחסון מקבל לקובץ אחד.",
  unsupported: "הפורמט לא נתמך. אפשר לצרף PDF, ‏Word, ‏Excel, ‏TXT, ‏CSV או תמונה.",
  unreadable: "לא הצלחנו לקרוא את הקובץ.",
  empty: "הקובץ ריק.",
  tooLong: "הקובץ ארוך מדי לשליחה בשיחה אחת.",
} as const;

export type FileErrorKey = keyof typeof FILE_ERRORS;

/**
 * Several files / a folder: keeps the supported ones. Unsupported files (e.g. .exe inside a
 * folder) are skipped and counted, so the user is told instead of getting an error per file.
 * A single file is kept even if unsupported, so its own error is shown.
 */
export function splitSupported(files: File[]): { files: File[]; skipped: number } {
  if (files.length === 1) return { files, skipped: 0 };
  const ok = files.filter((f) => kindOf(f.name));
  return { files: ok, skipped: files.length - ok.length };
}

export function skippedNote(skipped: number) {
  return skipped === 1 ? "דילגתי על קובץ אחד בפורמט שלא נתמך." : `דילגתי על ${skipped} קבצים בפורמט שלא נתמך.`;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Agent picker title after a drop. */
export function dropTitle(files: File[]) {
  return files.length === 1 ? `לאיזה סוכן לצרף את "${files[0].name}"?` : `לאיזה סוכן לצרף את ${files.length} הקבצים?`;
}

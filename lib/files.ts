import type { AttachmentKind } from "./types";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Hard cap on extracted text sent to the model. Longer files are rejected, never silently cut. */
export const MAX_TEXT_CHARS = 500_000;

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
  tooBig: "הקובץ גדול מדי. אפשר לצרף קובץ עד 20MB.",
  unsupported: "הפורמט לא נתמך. אפשר לצרף PDF, ‏Word, ‏Excel, ‏TXT, ‏CSV או תמונה.",
  unreadable: "לא הצלחנו לקרוא את הקובץ.",
  empty: "הקובץ ריק.",
  tooLong: "הקובץ ארוך מדי לשליחה בשיחה אחת.",
} as const;

export type FileErrorKey = keyof typeof FILE_ERRORS;

/** Quick check before routing a dropped file to an agent (full checks run when it is attached). */
export function droppedFileProblem(file: File): string | null {
  if (!kindOf(file.name)) return FILE_ERRORS.unsupported;
  if (file.size > MAX_FILE_BYTES) return FILE_ERRORS.tooBig;
  if (file.size === 0) return FILE_ERRORS.empty;
  return null;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

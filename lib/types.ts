export type Agent = {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  system_prompt: string;
  category: string;
  is_master: boolean;
  is_image_generator: boolean;
  is_favorite: boolean;
  created_at: string;
};

export type AttachmentKind = "txt" | "csv" | "pdf" | "docx" | "xlsx" | "image";

export type Attachment = {
  name: string;
  kind: AttachmentKind;
  /** Storage object path (uploads bucket) — images, and PDFs without a text layer */
  path?: string;
  /** Extracted text — TXT/CSV (in the browser) and PDF/DOCX/XLSX (on the server) */
  text?: string;
  /** Long extracted text kept in storage (uploads bucket) instead of inside the message */
  textPath?: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Storage path of a generated image (assistant messages of image agents) */
  imageUrl?: string;
  /** Files attached to a user message (any number, incl. a whole folder) */
  attachments?: Attachment[];
  /** Older messages (single-file era) — read through attachmentsOf() */
  attachment?: Attachment;
  /** Set once this answer was saved to the outputs archive */
  outputId?: string;
  createdAt: string;
};

/** All files of a message, for old (single) and new (list) messages alike. */
export function attachmentsOf(m: Pick<Message, "attachments" | "attachment">): Attachment[] {
  return m.attachments ?? (m.attachment ? [m.attachment] : []);
}

export type Session = {
  id: string;
  agent_id: string;
  title: string | null;
  messages: Message[];
  updated_at: string;
  niche_id?: string | null;
  project_id?: string | null;
};

export type OutputStatus = "pending" | "review" | "done";
export type OutputType = "text" | "pdf" | "docx" | "xlsx" | "csv" | "image";

export const OUTPUTS_BUCKET = "outputs";

export type AgentOutput = {
  id: string;
  agent_id: string;
  category: string;
  output_type: OutputType;
  summary_text: string;
  file_url: string | null;
  status: OutputStatus;
  created_at: string;
  /** Migration 0003 */
  session_id?: string | null;
  niche_id?: string | null;
  project_id?: string | null;
};

export const STATUS_LABELS: Record<OutputStatus, string> = {
  pending: "ממתין לטיפול",
  review: "בבדיקה",
  done: "טופל",
};

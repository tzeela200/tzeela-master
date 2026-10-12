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
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Storage path of a generated image (assistant messages of image agents) */
  imageUrl?: string;
  /** One file per user message */
  attachment?: Attachment;
  createdAt: string;
};

export type Session = {
  id: string;
  agent_id: string;
  title: string | null;
  messages: Message[];
  updated_at: string;
};

export type OutputStatus = "pending" | "review" | "done";
export type OutputType = "text" | "pdf" | "docx" | "xlsx" | "csv" | "image";

export type AgentOutput = {
  id: string;
  agent_id: string;
  category: string;
  output_type: OutputType;
  summary_text: string;
  file_url: string | null;
  status: OutputStatus;
  created_at: string;
};

export const STATUS_LABELS: Record<OutputStatus, string> = {
  pending: "ממתין לטיפול",
  review: "בבדיקה",
  done: "טופל",
};

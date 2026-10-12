"use client";

import { createClient } from "@/lib/supabase/client";
import { OUTPUTS_BUCKET, type AgentOutput } from "@/lib/types";

export async function outputBlob(o: Pick<AgentOutput, "file_url">): Promise<Blob> {
  if (!o.file_url) throw new Error("no file");
  const { data, error } = await createClient().storage.from(OUTPUTS_BUCKET).download(o.file_url);
  if (error || !data) throw error ?? new Error("download failed");
  return data;
}

export async function outputText(o: Pick<AgentOutput, "file_url" | "summary_text">) {
  if (!o.file_url) return o.summary_text;
  return (await outputBlob(o)).text();
}

export function outputFileName(o: Pick<AgentOutput, "id" | "output_type" | "file_url">) {
  const ext = o.file_url?.split(".").pop() ?? "txt";
  return `tzeela-${o.output_type === "image" ? "image" : "output"}-${o.id.slice(0, 8)}.${ext}`;
}

export async function downloadOutput(o: Pick<AgentOutput, "id" | "output_type" | "file_url" | "summary_text">) {
  const blob = o.file_url
    ? await outputBlob(o)
    : new Blob([o.summary_text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = outputFileName(o);
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Web Share API when available (mobile); otherwise copy text / download the file. */
export async function shareOutput(o: Pick<AgentOutput, "id" | "output_type" | "file_url" | "summary_text">) {
  if (o.output_type === "image") {
    const blob = await outputBlob(o);
    const file = new File([blob], outputFileName(o), { type: blob.type || "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file] });
      return "shared" as const;
    }
    await downloadOutput(o);
    return "downloaded" as const;
  }
  const text = await outputText(o);
  if (navigator.share) {
    await navigator.share({ text });
    return "shared" as const;
  }
  await navigator.clipboard.writeText(text);
  return "copied" as const;
}

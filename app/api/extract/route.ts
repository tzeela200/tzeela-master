import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ATTACH_BUCKET, MAX_TEXT_CHARS, type FileErrorKey } from "@/lib/files";

export const runtime = "nodejs";
export const maxDuration = 60;

type Result =
  | { ok: true; mode: "text"; text: string }
  /** PDF without a text layer (scanned): sent to the model as a document instead */
  | { ok: true; mode: "document" }
  | { ok: false; error: FileErrorKey };

/** Server-side extraction for PDF / DOCX / XLSX that were uploaded to private storage. */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { path, kind } = (await req.json().catch(() => ({}))) as { path?: string; kind?: string };
  if (!path?.startsWith("attachments/") || !["pdf", "docx", "xlsx"].includes(kind ?? "")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: blob, error } = await supabase.storage.from(ATTACH_BUCKET).download(path);
  if (error || !blob) return NextResponse.json<Result>({ ok: false, error: "unreadable" });
  const buf = Buffer.from(await blob.arrayBuffer());

  let text = "";
  try {
    if (kind === "pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const res = await extractText(pdf, { mergePages: true });
      text = (Array.isArray(res.text) ? res.text.join("\n\n") : res.text).trim();
      if (text.replace(/\s/g, "").length < 20) {
        return NextResponse.json<Result>({ ok: true, mode: "document" });
      }
    } else if (kind === "docx") {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: buf })).value.trim();
    } else {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "buffer" });
      text = wb.SheetNames.map((name) => {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false }).trim();
        return csv ? `### ${name}\n${csv}` : "";
      })
        .filter(Boolean)
        .join("\n\n");
    }
  } catch (err) {
    console.error("[extract]", kind, err);
    return NextResponse.json<Result>({ ok: false, error: "unreadable" });
  }

  if (!text) return NextResponse.json<Result>({ ok: false, error: "empty" });
  if (text.length > MAX_TEXT_CHARS) return NextResponse.json<Result>({ ok: false, error: "tooLong" });
  return NextResponse.json<Result>({ ok: true, mode: "text", text });
}

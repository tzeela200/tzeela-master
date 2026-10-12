"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Attachment } from "@/lib/types";
import {
  ATTACH_BUCKET,
  FILE_ERRORS,
  MAX_FILE_BYTES,
  MAX_TEXT_CHARS,
  kindOf,
  type FileErrorKey,
} from "@/lib/files";

export type AttachmentState =
  | { status: "processing"; name: string; size: number }
  | { status: "ready"; name: string; size: number; attachment: Attachment; previewUrl?: string }
  | { status: "error"; name: string; size: number; message: string };

const MAX_IMAGE_EDGE = 1600;

/** Downscale photos in the browser: smaller upload, and within the model's per-image limit. */
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // flatten PNG transparency for JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.85),
  );
}

async function upload(blob: Blob, ext: string, contentType: string) {
  const path = `attachments/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient()
    .storage.from(ATTACH_BUCKET)
    .upload(path, blob, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

export function useAttachment() {
  const [state, setState] = useState<AttachmentState | null>(null);
  const runId = useRef(0);

  const clear = useCallback(() => {
    runId.current++;
    setState((s) => {
      if (s?.status === "ready" && s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      return null;
    });
  }, []);

  const attach = useCallback(async (file: File) => {
    const id = ++runId.current;
    const base = { name: file.name, size: file.size };
    const fail = (key: FileErrorKey) => {
      if (id === runId.current) setState({ status: "error", ...base, message: FILE_ERRORS[key] });
    };

    const kind = kindOf(file.name);
    if (!kind) return fail("unsupported");
    if (file.size > MAX_FILE_BYTES) return fail("tooBig");
    if (file.size === 0) return fail("empty");

    setState({ status: "processing", ...base });
    try {
      let attachment: Attachment;
      let previewUrl: string | undefined;

      if (kind === "txt" || kind === "csv") {
        // Client-side extraction: the raw file never leaves the browser.
        const text = (await file.text()).replace(/^﻿/, "").trim();
        if (!text) return fail("empty");
        if (text.length > MAX_TEXT_CHARS) return fail("tooLong");
        attachment = { name: file.name, kind, text };
      } else if (kind === "image") {
        const blob = await prepareImage(file);
        const isPng = blob.type === "image/png";
        const path = await upload(blob, isPng ? "png" : "jpg", isPng ? "image/png" : "image/jpeg");
        attachment = { name: file.name, kind, path };
        previewUrl = URL.createObjectURL(blob);
      } else {
        // PDF / DOCX / XLSX: stored privately, text extracted on the server.
        const mime =
          kind === "pdf"
            ? "application/pdf"
            : kind === "docx"
              ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        const path = await upload(file, kind, mime);
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path, kind }),
        });
        if (!res.ok) return fail("unreadable");
        const data = (await res.json()) as
          | { ok: true; mode: "text"; text: string }
          | { ok: true; mode: "document" }
          | { ok: false; error: FileErrorKey };
        if (!data.ok) return fail(data.error);
        attachment =
          data.mode === "text" ? { name: file.name, kind, text: data.text } : { name: file.name, kind, path };
      }

      if (id === runId.current) setState({ status: "ready", ...base, attachment, previewUrl });
    } catch {
      fail("unreadable");
    }
  }, []);

  return { state, attach, clear };
}

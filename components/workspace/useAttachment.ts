"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Attachment } from "@/lib/types";
import {
  ATTACH_BUCKET,
  FILE_ERRORS,
  INLINE_TEXT_CHARS,
  MAX_FILE_BYTES,
  MAX_TEXT_CHARS,
  kindOf,
  type FileErrorKey,
} from "@/lib/files";

export type AttachmentState =
  | { id: string; status: "processing"; name: string; size: number }
  | { id: string; status: "ready"; name: string; size: number; attachment: Attachment; previewUrl?: string }
  | { id: string; status: "error"; name: string; size: number; message: string };

const MAX_IMAGE_EDGE = 1600;
/** Files processed at the same time (uploads + extraction); the rest wait their turn. */
const PARALLEL = 4;

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

class FileProblem extends Error {
  constructor(public key: FileErrorKey) {
    super(key);
  }
}

/** One file → an Attachment the chat can send (uploads / extraction as needed). */
async function process(file: File): Promise<{ attachment: Attachment; previewUrl?: string }> {
  const kind = kindOf(file.name);
  if (!kind) throw new FileProblem("unsupported");
  if (file.size > MAX_FILE_BYTES) throw new FileProblem("tooBig");
  if (file.size === 0) throw new FileProblem("empty");

  if (kind === "txt" || kind === "csv") {
    const text = (await file.text()).replace(/^﻿/, "").trim();
    if (!text) throw new FileProblem("empty");
    if (text.length > MAX_TEXT_CHARS) throw new FileProblem("tooLong");
    // Long text is kept in private storage so the message itself stays small.
    if (text.length > INLINE_TEXT_CHARS) {
      const textPath = await upload(new Blob([text], { type: "text/plain;charset=utf-8" }), "txt", "text/plain;charset=utf-8");
      return { attachment: { name: file.name, kind, textPath } };
    }
    return { attachment: { name: file.name, kind, text } };
  }
  if (kind === "image") {
    const blob = await prepareImage(file);
    const isPng = blob.type === "image/png";
    const path = await upload(blob, isPng ? "png" : "jpg", isPng ? "image/png" : "image/jpeg");
    return { attachment: { name: file.name, kind, path }, previewUrl: URL.createObjectURL(blob) };
  }
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
  if (!res.ok) throw new FileProblem("unreadable");
  const data = (await res.json()) as
    | { ok: true; mode: "text"; text: string }
    | { ok: true; mode: "textPath"; textPath: string }
    | { ok: true; mode: "document" }
    | { ok: false; error: FileErrorKey };
  if (!data.ok) throw new FileProblem(data.error);
  if (data.mode === "text") return { attachment: { name: file.name, kind, text: data.text } };
  if (data.mode === "textPath") return { attachment: { name: file.name, kind, textPath: data.textPath } };
  return { attachment: { name: file.name, kind, path } };
}

/** Any number of files per message; each one is processed and shown separately. */
export function useAttachments() {
  const [items, setItems] = useState<AttachmentState[]>([]);
  // Bumped by clear(): results of files still processing for a cleared list are ignored.
  const generation = useRef(0);

  const update = (id: string, next: AttachmentState) =>
    setItems((list) => list.map((x) => (x.id === id ? next : x)));

  const remove = useCallback((id: string) => {
    setItems((list) => {
      const gone = list.find((x) => x.id === id);
      if (gone?.status === "ready" && gone.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return list.filter((x) => x.id !== id);
    });
  }, []);

  const clear = useCallback(() => {
    generation.current++;
    setItems((list) => {
      for (const x of list) if (x.status === "ready" && x.previewUrl) URL.revokeObjectURL(x.previewUrl);
      return [];
    });
  }, []);

  const add = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const gen = generation.current;
    const queued = files.map((file) => ({ file, id: crypto.randomUUID() }));
    setItems((list) => [
      ...list,
      ...queued.map(({ file, id }) => ({ id, status: "processing" as const, name: file.name, size: file.size })),
    ]);
    let next = 0;
    const worker = async () => {
      while (next < queued.length) {
        const { file, id } = queued[next++];
        const base = { id, name: file.name, size: file.size };
        try {
          const { attachment, previewUrl } = await process(file);
          if (gen === generation.current) update(id, { ...base, status: "ready", attachment, previewUrl });
        } catch (err) {
          const key: FileErrorKey = err instanceof FileProblem ? err.key : "unreadable";
          if (gen === generation.current) update(id, { ...base, status: "error", message: FILE_ERRORS[key] });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queued.length) }, worker));
  }, []);

  return { items, add, remove, clear };
}

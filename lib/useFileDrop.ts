"use client";

import { useRef, useState } from "react";

const IGNORED = /^(\.|~\$)|^(thumbs\.db|desktop\.ini)$/i;

/** Reads every file inside a dropped folder (recursively). */
async function filesFromEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    return IGNORED.test(file.name) ? [] : [file];
  }
  if (!entry.isDirectory) return [];
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const entries: FileSystemEntry[] = [];
  // readEntries returns results in batches until an empty batch.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) break;
    entries.push(...batch);
  }
  return (await Promise.all(entries.map(filesFromEntry))).flat();
}

async function droppedFiles(dt: DataTransfer): Promise<File[]> {
  // Entries must be taken synchronously, before the first await.
  const entries = Array.from(dt.items ?? [])
    .map((item) => (item.kind === "file" ? item.webkitGetAsEntry?.() : null))
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return Array.from(dt.files ?? []);
  return (await Promise.all(entries.map(filesFromEntry))).flat();
}

/**
 * Drag-and-drop of files and whole folders onto an element. Spread `dropProps` on the drop
 * target and show an overlay while `dragging`. Only real file drags react (not text or links).
 */
export function useFileDrop(onFiles: (files: File[]) => void, { disabled = false } = {}) {
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for every child element; count them to know when we really left.
  const depth = useRef(0);

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const dropProps = {
    onDragEnter(e: React.DragEvent) {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setDragging(true);
    },
    onDragOver(e: React.DragEvent) {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave(e: React.DragEvent) {
      if (disabled || !hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setDragging(false);
    },
    onDrop(e: React.DragEvent) {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      droppedFiles(e.dataTransfer).then((files) => files.length && onFiles(files));
    },
  };

  return { dragging, dropProps };
}

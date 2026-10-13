"use client";

import { useRef, useState } from "react";

/**
 * Drag-and-drop for one file onto an element. Spread `dropProps` on the drop target and
 * show an overlay while `dragging`. Only real file drags react (not dragged text or links).
 */
export function useFileDrop(onFile: (file: File) => void, { disabled = false } = {}) {
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
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
  };

  return { dragging, dropProps };
}

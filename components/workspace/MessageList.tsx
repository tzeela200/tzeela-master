"use client";

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import type { Message } from "@/lib/types";

export function MessageList({ messages }: { messages: Message[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center text-secondary">
        <MessageSquare className="mb-3 size-8 text-primary" aria-hidden />
        <p>זה נושא חדש. אפשר להתחיל לכתוב.</p>
      </div>
    );
  }

  return (
    <ol className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6" aria-label="שיחה">
      {messages.map((m) => (
        <MessageItem key={m.id} message={m} />
      ))}
      <div ref={endRef} />
    </ol>
  );
}

export function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <li className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap break-words rounded-card px-4 py-3 leading-relaxed ${
          isUser ? "bg-primary text-white" : "bg-surface text-ink shadow-soft"
        }`}
      >
        <span className="sr-only">{isUser ? "את:" : "הסוכן:"}</span>
        <span dir="auto">{message.content}</span>
      </div>
    </li>
  );
}

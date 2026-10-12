"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

// Minimal typing for the Web Speech API (not in the TS DOM lib).
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const SPEECH_LANG = "he-IL";

type Props = {
  /** Called with recognized text (final results only). Audio is never stored. */
  onText: (text: string) => void;
  onMessage: (message: string, kind?: "success" | "error") => void;
  disabled?: boolean;
  highlight?: boolean;
};

export const VoiceButton = forwardRef<HTMLButtonElement, Props>(function VoiceButton(
  { onText, onMessage, disabled, highlight },
  ref,
) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const gotText = useRef(false);

  useEffect(() => () => recRef.current?.abort(), []);

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      onMessage("קלט קולי אינו זמין בדפדפן הזה.", "error");
      return;
    }
    const rec = new Ctor();
    rec.lang = SPEECH_LANG;
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    gotText.current = false;

    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text.trim()) {
        gotText.current = true;
        onText(text.trim());
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        onMessage("אין הרשאה למיקרופון. אפשר לאשר אותה בהגדרות הדפדפן.", "error");
      } else if (e.error === "no-speech") {
        onMessage("לא זוהה דיבור. אפשר לנסות שוב.", "error");
      } else if (e.error !== "aborted") {
        onMessage("הזיהוי הקולי נכשל. אפשר לנסות שוב.", "error");
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    recRef.current = rec;
    try {
      rec.start(); // triggers the browser's microphone permission prompt
      setListening(true);
    } catch {
      onMessage("הזיהוי הקולי נכשל. אפשר לנסות שוב.", "error");
    }
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "עצירת הקלטה" : "קלט קולי"}
      data-lang={SPEECH_LANG}
      className={`relative flex size-12 shrink-0 items-center justify-center rounded-button transition-colors duration-150 disabled:opacity-50 ${
        listening
          ? "bg-error text-white"
          : highlight
            ? "bg-primary-hover text-primary ring-2 ring-primary"
            : "text-secondary hover:bg-primary-hover hover:text-primary"
      }`}
    >
      {listening ? <MicOff className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
      {listening && (
        <span className="sr-only" role="status">
          מקשיבה…
        </span>
      )}
    </button>
  );
});

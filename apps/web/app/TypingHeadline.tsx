"use client";

import { useEffect, useState } from "react";

const WORDS = ["Netram", "नेत्रम्"];
const TYPE_SPEED = 130;
const DELETE_SPEED = 80;
const HOLD_TIME = 1400;

export default function TypingHeadline() {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"typing" | "holding" | "deleting">("typing");

  useEffect(() => {
    const currentWord = WORDS[wordIndex];

    if (phase === "typing") {
      if (text.length < currentWord.length) {
        const t = setTimeout(() => setText(currentWord.slice(0, text.length + 1)), TYPE_SPEED);
        return () => clearTimeout(t);
      }
      const t = setTimeout(() => setPhase("holding"), HOLD_TIME);
      return () => clearTimeout(t);
    }

    if (phase === "holding") {
      const t = setTimeout(() => setPhase("deleting"), 0);
      return () => clearTimeout(t);
    }

    if (phase === "deleting") {
      if (text.length > 0) {
        const t = setTimeout(() => setText(text.slice(0, -1)), DELETE_SPEED);
        return () => clearTimeout(t);
      }
      setWordIndex((i) => (i + 1) % WORDS.length);
      setPhase("typing");
    }
  }, [text, phase, wordIndex]);

  return (
    <span style={{ color: "var(--saffron)", display: "inline-block", minWidth: "3ch" }}>
      {text}
      <span
        style={{
          display: "inline-block",
          width: "3px",
          height: "0.9em",
          background: "var(--saffron)",
          marginLeft: "4px",
          verticalAlign: "-0.1em",
          animation: "blink 0.9s step-end infinite",
        }}
      />
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </span>
  );
}
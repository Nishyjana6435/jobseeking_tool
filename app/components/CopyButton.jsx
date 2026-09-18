"use client";
import { useState } from "react";

export default function CopyButton({ text, label = "Copy" }) {
  const [done, setDone] = useState(false);
  return (
    <button className="btn text-xs" onClick={async () => { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      {done ? "Copied" : label}
    </button>
  );
}

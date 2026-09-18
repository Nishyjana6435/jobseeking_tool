"use client";
import { useTransition } from "react";
import { setStatus } from "@/app/actions.js";

const STATUSES = ["new", "saved", "prepared", "applied", "interview", "offer", "rejected", "skipped"];

export default function StatusSelect({ id, status }) {
  const [pending, start] = useTransition();
  return (
    <select
      className="input"
      value={status}
      disabled={pending}
      onChange={(e) => { const v = e.target.value; if (v !== "new") start(() => setStatus(id, v)); }}
    >
      {STATUSES.map((s) => <option key={s} value={s} disabled={s === "new"}>{s}</option>)}
    </select>
  );
}

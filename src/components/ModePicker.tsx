"use client";

import { MODE_IDS, MODES, type ModeId } from "@/lib/game/modes";

interface Props {
  value: ModeId;
  onChange: (m: ModeId) => void;
  /** Per-mode progress, shown on the map; omitted on the sign-up form. */
  summary?: Record<ModeId, { done: number; stars: number; total: number }>;
  compact?: boolean;
  disabled?: boolean;
}

export function ModePicker({ value, onChange, summary, compact, disabled }: Props) {
  return (
    <div className={`modes${compact ? " compact" : ""}`} role="radiogroup" aria-label="רמת קושי">
      {MODE_IDS.map((id) => {
        const m = MODES[id], s = summary?.[id], on = value === id;
        return (
          <button key={id} type="button" role="radio" aria-checked={on} disabled={disabled} className={`mode mode-${id}${on ? " on" : ""}`} onClick={() => onChange(id)}>
            <span className="mode-head"><span className="mode-icon" aria-hidden="true">{m.icon}</span><b>{m.name}</b>{on && <span className="mode-on">נבחר</span>}</span>
            <span className="mode-pitch">{m.pitch}</span>
            {!compact && <ul>{m.rules.map((r) => <li key={r}>{r}</li>)}</ul>}
            {s && (
              <span className="mode-progress">
                <span className="bar" aria-hidden="true"><i style={{ width: `${(s.done / s.total) * 100}%` }} /></span>
                <small>{s.done}/{s.total} · {s.stars}★</small>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

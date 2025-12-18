"use client";

import type { Language } from "../lib/types";

interface LanguageSelectorProps {
  value: Language;
  onChange: (language: Language) => void;
}

export function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        onClick={() => onChange("pt-BR")}
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          border: value === "pt-BR" ? "1px solid #111" : "1px solid #ccc",
          backgroundColor: value === "pt-BR" ? "#111" : "#fff",
          color: value === "pt-BR" ? "#fff" : "#111",
          cursor: "pointer",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span role="img" aria-label="Brazil">
          🇧🇷
        </span>
        <span>pt-BR</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("en")}
        style={{
          padding: "6px 10px",
          borderRadius: 999,
          border: value === "en" ? "1px solid #111" : "1px solid #ccc",
          backgroundColor: value === "en" ? "#111" : "#fff",
          color: value === "en" ? "#fff" : "#111",
          cursor: "pointer",
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span role="img" aria-label="United States">
          🇺🇸
        </span>
        <span>en</span>
      </button>
    </div>
  );
}



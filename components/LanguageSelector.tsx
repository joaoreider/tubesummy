"use client";

import type { Language } from "../lib/types";

interface LanguageSelectorProps {
  value: Language;
  onChange: (language: Language) => void;
  disabled?: boolean;
}

export function LanguageSelector({
  value,
  onChange,
  disabled = false,
}: LanguageSelectorProps) {
  const baseStyle = {
    padding: "10px 14px",
    borderRadius: 10,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.2s ease",
    opacity: disabled ? 0.6 : 1,
  };

  const activeStyle = {
    ...baseStyle,
    border: "2px solid #6366f1",
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    color: "#c0c0ff",
  };

  const inactiveStyle = {
    ...baseStyle,
    border: "2px solid #2a2a4a",
    backgroundColor: "#1a1a2e",
    color: "#7777aa",
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        onClick={() => !disabled && onChange("pt-BR")}
        disabled={disabled}
        style={value === "pt-BR" ? activeStyle : inactiveStyle}
      >
        <span role="img" aria-label="Brazil">
          🇧🇷
        </span>
        <span>PT</span>
      </button>
      <button
        type="button"
        onClick={() => !disabled && onChange("en")}
        disabled={disabled}
        style={value === "en" ? activeStyle : inactiveStyle}
      >
        <span role="img" aria-label="United States">
          🇺🇸
        </span>
        <span>EN</span>
      </button>
    </div>
  );
}



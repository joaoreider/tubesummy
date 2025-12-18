"use client";

import { useState } from "react";
import type { Language, Summary } from "../lib/types";
import { LanguageSelector } from "../components/LanguageSelector";
import { SummaryDisplay } from "../components/SummaryDisplay";
import { isValidYoutubeUrl } from "../lib/utils/youtube";

export default function Home() {
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSummary(null);

    if (!url.trim()) {
      setError("Paste a YouTube link.");
      return;
    }

    if (!isValidYoutubeUrl(url)) {
      setError("This does not look like a valid YouTube link.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, language }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to summarize video.");
        return;
      }

      setSummary(data as Summary);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backgroundColor: "#f5f5f5",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          backgroundColor: "#ffffff",
          borderRadius: 12,
          padding: 20,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 20,
                margin: 0,
              }}
            >
              TubeSummy
            </h1>
            <p
              style={{
                margin: 0,
                marginTop: 4,
                fontSize: 12,
                color: "#555",
              }}
            >
              Paste a YouTube link. Get a clear summary.
            </p>
          </div>
          <LanguageSelector value={language} onChange={setLanguage} />
        </header>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #ccc",
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              backgroundColor: loading ? "#777" : "#111",
              color: "#fff",
              cursor: loading ? "default" : "pointer",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            {loading ? "Summarizing..." : "Summarize"}
          </button>
        </form>

        {error && (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              backgroundColor: "#ffe6e6",
              color: "#b00020",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}

        <SummaryDisplay summary={summary} />
      </div>
    </main>
  );
}


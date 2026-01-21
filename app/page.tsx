"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Language, FlashcardSet } from "../lib/types";
import { LanguageSelector } from "../components/LanguageSelector";
import { isValidYoutubeUrl } from "../lib/utils/youtube";
import { useFlashcards } from "../lib/contexts/flashcard-context";

type InputMode = "url" | "upload";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const router = useRouter();
  const { setFlashcardSet } = useFlashcards();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mode state
  const [mode, setMode] = useState<InputMode>("url");

  // URL mode state
  const [url, setUrl] = useState("");

  // Upload mode state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Shared state
  const [language, setLanguage] = useState<Language>("en");
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large (${formatFileSize(file.size)}). Maximum allowed size is 200 MB.`);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setSelectedFile(file);
  }

  function handleModeChange(newMode: InputMode) {
    setMode(newMode);
    setError(null);
  }

  function clearFileSelection() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "url") {
      await handleUrlSubmit();
    } else {
      await handleUploadSubmit();
    }
  }

  async function handleUrlSubmit() {
    if (!url.trim()) {
      setError("Paste a YouTube link to get started.");
      return;
    }

    if (!isValidYoutubeUrl(url)) {
      setError("This doesn't look like a valid YouTube link.");
      return;
    }

    setLoading(true);
    setLoadingMessage("Fetching video transcript...");

    try {
      const progressTimeout = setTimeout(() => {
        setLoadingMessage("Analyzing content and generating flashcards...");
      }, 3000);

      const longVideoTimeout = setTimeout(() => {
        setLoadingMessage(
          "Processing video content... This may take a moment for longer videos."
        );
      }, 10000);

      const response = await fetch("/api/flashcards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, language }),
      });

      clearTimeout(progressTimeout);
      clearTimeout(longVideoTimeout);

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to generate flashcards.");
        return;
      }

      const flashcardSet = data as FlashcardSet;
      setFlashcardSet(flashcardSet);
      router.push("/study");
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  async function handleUploadSubmit() {
    if (!selectedFile) {
      setError("Please select an audio or video file.");
      return;
    }

    setLoading(true);
    setLoadingMessage("Uploading file...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("language", language);

      // Check if it's a video file to show appropriate messages
      const isVideo = selectedFile.type.startsWith("video/") || 
        [".mp4", ".mkv", ".webm", ".mov", ".avi"].some(ext => 
          selectedFile.name.toLowerCase().endsWith(ext)
        );

      const extractTimeout = isVideo ? setTimeout(() => {
        setLoadingMessage("Extracting audio from video...");
      }, 1500) : null;

      const transcribeTimeout = setTimeout(() => {
        setLoadingMessage("Transcribing audio...");
      }, isVideo ? 8000 : 2000);

      const generateTimeout = setTimeout(() => {
        setLoadingMessage("Generating flashcards...");
      }, isVideo ? 20000 : 15000);

      const longFileTimeout = setTimeout(() => {
        setLoadingMessage(
          "Still processing... Large files may take a few minutes."
        );
      }, 45000);

      const response = await fetch("/api/flashcards/upload", {
        method: "POST",
        body: formData,
      });

      if (extractTimeout) clearTimeout(extractTimeout);
      clearTimeout(transcribeTimeout);
      clearTimeout(generateTimeout);
      clearTimeout(longFileTimeout);

      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to process file.");
        return;
      }

      const flashcardSet = data as FlashcardSet;
      setFlashcardSet(flashcardSet);
      router.push("/study");
    } catch (err) {
      console.error(err);
      setError("Something went wrong while processing your file. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  }

  return (
    <main className="home-container">
      <div className="home-content">
        {/* Hero Section */}
        <header className="hero">
          <div className="logo">
            <span className="logo-icon">📚</span>
            <h1>TubeStudy</h1>
          </div>
          <p className="tagline">
            Transform YouTube videos into interactive flashcards for effective
            learning
          </p>
        </header>

        {/* Mode Toggle */}
        <div className="mode-toggle">
          <button
            type="button"
            className={`mode-button ${mode === "url" ? "active" : ""}`}
            onClick={() => handleModeChange("url")}
            disabled={loading}
          >
            <span className="mode-icon">🔗</span>
            YouTube URL
          </button>
          <button
            type="button"
            className={`mode-button ${mode === "upload" ? "active" : ""}`}
            onClick={() => handleModeChange("upload")}
            disabled={loading}
          >
            <span className="mode-icon">📁</span>
            Upload File
          </button>
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="input-form">
          {mode === "url" ? (
            /* URL Mode */
            <div className="input-group">
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="url-input"
                disabled={loading}
              />
              <LanguageSelector
                value={language}
                onChange={setLanguage}
                disabled={loading}
              />
            </div>
          ) : (
            /* Upload Mode */
            <div className="upload-section">
              <div className="file-input-wrapper">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,video/*,.mp3,.m4a,.wav,.ogg,.webm,.mp4,.mkv,.mov,.avi"
                  onChange={handleFileSelect}
                  disabled={loading}
                  className="file-input"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className={`file-label ${loading ? "disabled" : ""}`}
                >
                  {selectedFile ? (
                    <div className="file-selected">
                      <span className="file-icon">📄</span>
                      <div className="file-info">
                        <span className="file-name">{selectedFile.name}</span>
                        <span className="file-size">
                          {formatFileSize(selectedFile.size)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="clear-file"
                        onClick={(e) => {
                          e.preventDefault();
                          clearFileSelection();
                        }}
                        disabled={loading}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="file-placeholder">
                      <span className="upload-icon">⬆️</span>
                      <span>Click to select audio/video file</span>
                      <span className="file-hint">
                        MP3, M4A, WAV, MP4, MKV, WebM (max 200 MB)
                      </span>
                    </div>
                  )}
                </label>
              </div>
              <LanguageSelector
                value={language}
                onChange={setLanguage}
                disabled={loading}
              />
            </div>
          )}

          <button type="submit" disabled={loading} className="submit-button">
            {loading ? (
              <span className="loading-state">
                <span className="spinner" />
                {loadingMessage || "Processing..."}
              </span>
            ) : (
              "Generate Flashcards"
            )}
          </button>
        </form>

        {/* Upload Info */}
        {mode === "upload" && !loading && (
          <div className="upload-info">
            <span className="info-icon">💡</span>
            <p>
              Use this mode for videos that require login. Download the video
              with <code>yt-dlp</code> using your cookies, then upload here.
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Features Section */}
        <section className="features">
          <div className="feature">
            <span className="feature-icon">🎯</span>
            <h3>AI-Powered</h3>
            <p>Intelligent analysis extracts key concepts automatically</p>
          </div>
          <div className="feature">
            <span className="feature-icon">⏱️</span>
            <h3>Long Videos</h3>
            <p>Support for videos up to 2 hours with smart chunking</p>
          </div>
          <div className="feature">
            <span className="feature-icon">🌍</span>
            <h3>Multi-language</h3>
            <p>Generate flashcards in English or Portuguese</p>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer">
          <p>Paste any YouTube educational video and start studying smarter</p>
        </footer>
      </div>

      <style jsx>{`
        .home-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%);
        }

        .home-content {
          width: 100%;
          max-width: 580px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .hero {
          text-align: center;
        }

        .logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .logo-icon {
          font-size: 36px;
        }

        .logo h1 {
          font-family: "JetBrains Mono", "Fira Code", monospace;
          font-size: 32px;
          font-weight: 700;
          color: #e0e0ff;
          margin: 0;
          letter-spacing: -0.5px;
        }

        .tagline {
          color: #9999bb;
          font-size: 16px;
          margin: 0;
          line-height: 1.5;
        }

        .mode-toggle {
          display: flex;
          gap: 8px;
          background: rgba(255, 255, 255, 0.03);
          padding: 6px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .mode-button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: #7777aa;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .mode-button:hover:not(:disabled) {
          color: #a5a5cc;
          background: rgba(255, 255, 255, 0.03);
        }

        .mode-button.active {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
        }

        .mode-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .mode-icon {
          font-size: 16px;
        }

        .input-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .input-group {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .url-input {
          flex: 1;
          min-width: 280px;
          padding: 14px 18px;
          border-radius: 12px;
          border: 2px solid #2a2a4a;
          background: #1a1a2e;
          color: #e0e0ff;
          font-size: 15px;
          transition: all 0.2s ease;
        }

        .url-input:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.15);
        }

        .url-input::placeholder {
          color: #555577;
        }

        .url-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .upload-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .file-input-wrapper {
          position: relative;
        }

        .file-input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          overflow: hidden;
        }

        .file-label {
          display: block;
          padding: 20px;
          border-radius: 12px;
          border: 2px dashed #2a2a4a;
          background: #1a1a2e;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .file-label:hover:not(.disabled) {
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.05);
        }

        .file-label.disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .file-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          color: #7777aa;
          font-size: 14px;
        }

        .upload-icon {
          font-size: 28px;
        }

        .file-hint {
          font-size: 12px;
          color: #555577;
        }

        .file-selected {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .file-icon {
          font-size: 28px;
        }

        .file-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .file-name {
          color: #e0e0ff;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-size {
          color: #7777aa;
          font-size: 12px;
        }

        .clear-file {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: none;
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .clear-file:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.25);
        }

        .clear-file:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .upload-info {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 16px;
          border-radius: 10px;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.15);
        }

        .info-icon {
          flex-shrink: 0;
          font-size: 16px;
        }

        .upload-info p {
          margin: 0;
          color: #a5a5cc;
          font-size: 13px;
          line-height: 1.5;
        }

        .upload-info code {
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: "JetBrains Mono", monospace;
          font-size: 12px;
          color: #c0c0ff;
        }

        .submit-button {
          padding: 16px 24px;
          border-radius: 12px;
          border: none;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 54px;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
        }

        .submit-button:disabled {
          background: linear-gradient(135deg, #4a4a6a 0%, #5a5a7a 100%);
          cursor: not-allowed;
        }

        .loading-state {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          border-radius: 12px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          font-size: 14px;
        }

        .error-icon {
          flex-shrink: 0;
        }

        .features {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 8px;
        }

        .feature {
          text-align: center;
          padding: 20px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .feature-icon {
          font-size: 28px;
          display: block;
          margin-bottom: 10px;
        }

        .feature h3 {
          color: #c0c0dd;
          font-size: 14px;
          font-weight: 600;
          margin: 0 0 6px 0;
        }

        .feature p {
          color: #7777aa;
          font-size: 12px;
          margin: 0;
          line-height: 1.4;
        }

        .footer {
          text-align: center;
        }

        .footer p {
          color: #555577;
          font-size: 13px;
          margin: 0;
        }

        @media (max-width: 600px) {
          .features {
            grid-template-columns: 1fr;
          }

          .input-group {
            flex-direction: column;
          }

          .url-input {
            min-width: 100%;
          }

          .mode-toggle {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}

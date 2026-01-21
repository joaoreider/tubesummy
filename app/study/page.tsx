"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlashcardGrid } from "../../components/FlashcardGrid";
import {
  useFlashcards,
  useLoadFlashcardsFromStorage,
} from "../../lib/contexts/flashcard-context";
import type { FlashcardSet } from "../../lib/types";

export default function StudyPage() {
  const router = useRouter();
  const { clearFlashcards } = useFlashcards();
  const { loadFromStorage, flashcardSet: contextFlashcards } =
    useLoadFlashcardsFromStorage();
  const [flashcardSet, setFlashcardSet] = useState<FlashcardSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Try to load from context first, then from storage
    const loaded = loadFromStorage();
    if (loaded) {
      setFlashcardSet(loaded);
    } else if (contextFlashcards) {
      setFlashcardSet(contextFlashcards);
    }
    setIsLoading(false);
  }, [loadFromStorage, contextFlashcards]);

  const handleNewVideo = () => {
    clearFlashcards();
    router.push("/");
  };

  const handleRegenerateFlashcards = () => {
    // Keep the URL in storage, redirect to home with a flag to auto-submit
    // For now, just go back to home
    router.push("/");
  };

  if (isLoading) {
    return (
      <main className="study-container">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading flashcards...</p>
        </div>
        <style jsx>{`
          .study-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%);
          }

          .loading-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            color: #9999bb;
          }

          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(99, 102, 241, 0.2);
            border-top-color: #6366f1;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  if (!flashcardSet) {
    return (
      <main className="study-container">
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <h2>No Flashcards Found</h2>
          <p>Generate flashcards from a YouTube video to start studying.</p>
          <button onClick={handleNewVideo} className="primary-button">
            Go to Home
          </button>
        </div>
        <style jsx>{`
          .study-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%);
          }

          .empty-state {
            text-align: center;
            max-width: 400px;
          }

          .empty-icon {
            font-size: 64px;
            display: block;
            margin-bottom: 16px;
          }

          .empty-state h2 {
            color: #e0e0ff;
            font-size: 24px;
            margin: 0 0 12px 0;
          }

          .empty-state p {
            color: #7777aa;
            font-size: 15px;
            margin: 0 0 24px 0;
          }

          .primary-button {
            padding: 14px 28px;
            border-radius: 12px;
            border: none;
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
            color: white;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .primary-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
          }
        `}</style>
      </main>
    );
  }

  const { topic, difficulty, flashcards, metadata } = flashcardSet;

  return (
    <main className="study-container">
      <div className="study-content">
        {/* Header */}
        <header className="study-header">
          <div className="header-left">
            <button onClick={handleNewVideo} className="back-button">
              ← New Video
            </button>
          </div>
          <div className="header-center">
            <h1 className="topic-title">{topic}</h1>
            <div className="meta-info">
              <span className={`difficulty-badge ${difficulty}`}>
                {difficulty}
              </span>
              <span className="card-count">
                {flashcards.length} flashcard{flashcards.length !== 1 ? "s" : ""}
              </span>
              {metadata?.totalChunks && metadata.totalChunks > 1 && (
                <span className="chunk-info">
                  from {metadata.successfulChunks}/{metadata.totalChunks} video
                  segments
                </span>
              )}
            </div>
          </div>
          <div className="header-right">
            <button onClick={handleRegenerateFlashcards} className="action-button">
              🔄 Regenerate
            </button>
          </div>
        </header>

        {/* Instructions */}
        <div className="instructions">
          <p>Click on any card to reveal the answer. Test your knowledge!</p>
        </div>

        {/* Flashcard Grid */}
        <section className="flashcards-section">
          <FlashcardGrid flashcards={flashcards} />
        </section>

        {/* Footer */}
        <footer className="study-footer">
          <p>
            Study tip: Try to answer each question before flipping the card for
            better retention.
          </p>
        </footer>
      </div>

      <style jsx>{`
        .study-container {
          min-height: 100vh;
          padding: 24px;
          background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%);
        }

        .study-content {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .study-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .header-left,
        .header-right {
          flex-shrink: 0;
        }

        .header-center {
          flex: 1;
          text-align: center;
        }

        .back-button {
          padding: 10px 16px;
          border-radius: 10px;
          border: 1px solid #2a2a4a;
          background: transparent;
          color: #9999bb;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .back-button:hover {
          border-color: #6366f1;
          color: #c0c0ff;
        }

        .topic-title {
          font-family: "JetBrains Mono", monospace;
          font-size: 24px;
          font-weight: 700;
          color: #e0e0ff;
          margin: 0 0 12px 0;
          line-height: 1.3;
        }

        .meta-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .difficulty-badge {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          padding: 4px 10px;
          border-radius: 6px;
          letter-spacing: 0.5px;
        }

        .difficulty-badge.beginner {
          background: rgba(34, 197, 94, 0.15);
          color: #4ade80;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .difficulty-badge.intermediate {
          background: rgba(234, 179, 8, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(234, 179, 8, 0.3);
        }

        .difficulty-badge.advanced {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .card-count {
          color: #7777aa;
          font-size: 13px;
        }

        .chunk-info {
          color: #5555777;
          font-size: 12px;
        }

        .action-button {
          padding: 10px 16px;
          border-radius: 10px;
          border: 1px solid #2a2a4a;
          background: transparent;
          color: #9999bb;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-button:hover {
          border-color: #6366f1;
          color: #c0c0ff;
          background: rgba(99, 102, 241, 0.1);
        }

        .instructions {
          text-align: center;
          padding: 16px;
          background: rgba(99, 102, 241, 0.08);
          border-radius: 12px;
          border: 1px solid rgba(99, 102, 241, 0.15);
        }

        .instructions p {
          margin: 0;
          color: #a5a5cc;
          font-size: 14px;
        }

        .flashcards-section {
          padding: 8px 0;
        }

        .study-footer {
          text-align: center;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }

        .study-footer p {
          margin: 0;
          color: #5555777;
          font-size: 13px;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .study-header {
            flex-direction: column;
            align-items: center;
          }

          .header-left,
          .header-right {
            width: 100%;
            display: flex;
            justify-content: center;
          }

          .topic-title {
            font-size: 20px;
          }

          .back-button,
          .action-button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </main>
  );
}

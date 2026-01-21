"use client";

import { useState } from "react";
import type { Flashcard as FlashcardType } from "../lib/types";

interface FlashcardProps {
  flashcard: FlashcardType;
  index: number;
}

export function Flashcard({ flashcard, index }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleFlip();
    }
  };

  return (
    <div
      className="flashcard-container"
      onClick={handleFlip}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Flashcard ${index + 1}: ${isFlipped ? "showing answer" : "showing question"}. Press to flip.`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className={`flashcard ${isFlipped ? "flipped" : ""}`}>
        {/* Front - Question */}
        <div className="flashcard-face flashcard-front">
          <div className="card-number">#{index + 1}</div>
          <div className="card-content">
            <span className="card-label">Question</span>
            <p className="card-text">{flashcard.question}</p>
          </div>
          {flashcard.tags && flashcard.tags.length > 0 && (
            <div className="card-tags">
              {flashcard.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="flip-hint">Click to reveal answer</div>
        </div>

        {/* Back - Answer */}
        <div className="flashcard-face flashcard-back">
          <div className="card-number">#{index + 1}</div>
          <div className="card-content">
            <span className="card-label">Answer</span>
            <p className="card-text">{flashcard.answer}</p>
          </div>
          <div className="flip-hint">Click to see question</div>
        </div>
      </div>

      <style jsx>{`
        .flashcard-container {
          perspective: 1000px;
          cursor: pointer;
          outline: none;
          animation: fadeInUp 0.4s ease forwards;
          opacity: 0;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .flashcard-container:focus-visible {
          outline: 2px solid #6366f1;
          outline-offset: 4px;
          border-radius: 16px;
        }

        .flashcard {
          position: relative;
          width: 100%;
          height: 280px;
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
          transform-style: preserve-3d;
        }

        .flashcard.flipped {
          transform: rotateY(180deg);
        }

        .flashcard-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .flashcard-front {
          background: linear-gradient(145deg, #1e1e3f 0%, #2a2a5a 100%);
          border: 1px solid rgba(99, 102, 241, 0.2);
          box-shadow: 
            0 4px 20px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .flashcard-back {
          background: linear-gradient(145deg, #1a3a2a 0%, #2a4a3a 100%);
          border: 1px solid rgba(34, 197, 94, 0.2);
          box-shadow: 
            0 4px 20px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          transform: rotateY(180deg);
        }

        .card-number {
          position: absolute;
          top: 12px;
          right: 16px;
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.3);
          font-family: "JetBrains Mono", monospace;
        }

        .card-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }

        .card-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #6366f1;
        }

        .flashcard-back .card-label {
          color: #22c55e;
        }

        .card-text {
          font-size: 15px;
          line-height: 1.6;
          color: #e0e0ff;
          margin: 0;
        }

        .card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: auto;
          padding-top: 12px;
        }

        .tag {
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 6px;
          background: rgba(99, 102, 241, 0.15);
          color: #a5a5ff;
          border: 1px solid rgba(99, 102, 241, 0.2);
        }

        .flip-hint {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.25);
          text-align: center;
          margin-top: auto;
          padding-top: 12px;
        }

        .flashcard-container:hover .flashcard-front,
        .flashcard-container:hover .flashcard-back {
          box-shadow: 
            0 8px 30px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .flashcard-container:hover .flip-hint {
          color: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  );
}

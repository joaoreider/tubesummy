"use client";

import { Flashcard } from "./Flashcard";
import type { Flashcard as FlashcardType } from "../lib/types";

interface FlashcardGridProps {
  flashcards: FlashcardType[];
}

export function FlashcardGrid({ flashcards }: FlashcardGridProps) {
  if (flashcards.length === 0) {
    return (
      <div className="empty-state">
        <p>No flashcards available</p>
        <style jsx>{`
          .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #7777aa;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="flashcard-grid">
      {flashcards.map((flashcard, index) => (
        <Flashcard key={flashcard.id} flashcard={flashcard} index={index} />
      ))}

      <style jsx>{`
        .flashcard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 24px;
          width: 100%;
        }

        @media (max-width: 640px) {
          .flashcard-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }
      `}</style>
    </div>
  );
}

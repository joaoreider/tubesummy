"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { FlashcardSet } from "../types";

interface FlashcardContextType {
  flashcardSet: FlashcardSet | null;
  setFlashcardSet: (set: FlashcardSet | null) => void;
  clearFlashcards: () => void;
}

const FlashcardContext = createContext<FlashcardContextType | undefined>(
  undefined
);

export function FlashcardProvider({ children }: { children: ReactNode }) {
  const [flashcardSet, setFlashcardSetState] = useState<FlashcardSet | null>(
    null
  );

  const setFlashcardSet = useCallback((set: FlashcardSet | null) => {
    setFlashcardSetState(set);
    // Also save to sessionStorage for persistence across page navigation
    if (set) {
      sessionStorage.setItem("flashcardSet", JSON.stringify(set));
    } else {
      sessionStorage.removeItem("flashcardSet");
    }
  }, []);

  const clearFlashcards = useCallback(() => {
    setFlashcardSetState(null);
    sessionStorage.removeItem("flashcardSet");
  }, []);

  return (
    <FlashcardContext.Provider
      value={{ flashcardSet, setFlashcardSet, clearFlashcards }}
    >
      {children}
    </FlashcardContext.Provider>
  );
}

export function useFlashcards() {
  const context = useContext(FlashcardContext);
  if (context === undefined) {
    throw new Error("useFlashcards must be used within a FlashcardProvider");
  }
  return context;
}

/**
 * Hook to load flashcards from sessionStorage on mount (useful for study page)
 */
export function useLoadFlashcardsFromStorage() {
  const { flashcardSet, setFlashcardSet } = useFlashcards();

  const loadFromStorage = useCallback(() => {
    if (!flashcardSet) {
      const stored = sessionStorage.getItem("flashcardSet");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as FlashcardSet;
          setFlashcardSet(parsed);
          return parsed;
        } catch {
          console.error("Failed to parse stored flashcard set");
        }
      }
    }
    return flashcardSet;
  }, [flashcardSet, setFlashcardSet]);

  return { loadFromStorage, flashcardSet };
}

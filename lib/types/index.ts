export type Language = "pt-BR" | "en";

export interface TranscriptItem {
  text: string;
  start: number; // seconds from start
  duration: number; // seconds
}

export interface TopicPoint {
  title: string;
  timestamp: string; // e.g. "00:45" or "12:30"
}

export interface Summary {
  paragraph: string;
  topics: TopicPoint[];
}

// Flashcard types for study feature
export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  tags?: string[];
}

export type FlashcardDifficulty = "beginner" | "intermediate" | "advanced";

export interface FlashcardSet {
  topic: string;
  difficulty: FlashcardDifficulty;
  language: Language;
  flashcards: Flashcard[];
  metadata?: {
    videoUrl?: string;
    totalChunks?: number;
    successfulChunks?: number;
    // For file uploads
    fileName?: string;
    fileSize?: number;
  };
}

// Transcript chunk for processing long videos
export interface TranscriptChunk {
  index: number;
  items: TranscriptItem[];
  startTime: number; // seconds
  endTime: number; // seconds
  text: string; // concatenated text from items
}


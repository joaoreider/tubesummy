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



import OpenAI from "openai";
import { z } from "zod";
import type {
  Language,
  Flashcard,
  FlashcardSet,
  FlashcardDifficulty,
  TranscriptChunk,
} from "../../types";

// Lazy-load OpenAI client to avoid build-time errors
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _client;
}

// Schema for validating LLM response
const flashcardSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  answer: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

const flashcardSetSchema = z.object({
  topic: z.string().min(1),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  flashcards: z.array(flashcardSchema).min(1),
});

/**
 * Generates flashcards from a single transcript chunk using OpenAI
 */
export async function generateFlashcardsFromChunk(
  chunk: TranscriptChunk,
  language: Language
): Promise<FlashcardSet> {
  const client = getClient();
  if (!client.apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const languageLabel = language === "pt-BR" ? "Portuguese (Brazil)" : "English";

  const systemPrompt = `You are an expert study assistant specialized in creating educational flashcards.
Your job is to analyze video/lecture transcripts and create high-quality flashcards that help students learn and retain key concepts.

Guidelines for creating flashcards:
- Focus on the most important concepts, definitions, and facts
- Create clear, specific questions that test understanding
- Provide concise but complete answers
- Avoid trivial or overly obvious questions
- Include relevant tags to categorize each flashcard
- Vary question types: definitions, explanations, comparisons, applications`;

  const userPrompt = `Language for flashcards: ${languageLabel}

You will receive a transcript segment from a YouTube video/lecture.
Analyze it and create educational flashcards for studying.

RULES:
- Create between 5-15 flashcards depending on content density
- Questions should test understanding, not just recall
- Answers should be clear and educational
- Use the same language (${languageLabel}) for questions and answers
- Each flashcard must have a unique id (use format: "1", "2", "3", etc.)
- Assign appropriate tags to help categorize the content
- Determine the difficulty level based on content complexity

OUTPUT FORMAT (STRICT JSON only, no markdown):
{
  "topic": "Main topic or subject of this content segment",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "flashcards": [
    {
      "id": "1",
      "question": "Clear question testing a key concept",
      "answer": "Concise but complete answer",
      "tags": ["relevant", "tags"]
    }
  ]
}

TRANSCRIPT SEGMENT (from ${formatTime(chunk.startTime)} to ${formatTime(chunk.endTime)}):
"""${chunk.text}"""`;

  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.3,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response content from LLM");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Failed to parse LLM response as JSON");
  }

  const result = flashcardSetSchema.safeParse(parsed);
  if (!result.success) {
    console.error("Validation error:", result.error);
    throw new Error("LLM response did not match expected flashcard format");
  }

  return {
    ...result.data,
    language,
  };
}

/**
 * Processes multiple transcript chunks in parallel and consolidates the results
 */
export async function generateFlashcardsFromChunks(
  chunks: TranscriptChunk[],
  language: Language,
  videoUrl?: string
): Promise<FlashcardSet> {
  if (chunks.length === 0) {
    throw new Error("No transcript chunks provided");
  }

  // Process all chunks in parallel
  const results = await Promise.allSettled(
    chunks.map((chunk) => generateFlashcardsFromChunk(chunk, language))
  );

  // Collect successful results and track failures
  const successfulSets: FlashcardSet[] = [];
  const failedChunks: number[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      successfulSets.push(result.value);
    } else {
      console.error(`Chunk ${index} failed:`, result.reason);
      failedChunks.push(index);
    }
  });

  if (successfulSets.length === 0) {
    throw new Error("All chunks failed to generate flashcards");
  }

  // Consolidate all flashcard sets into one
  const consolidatedFlashcards: Flashcard[] = [];
  let globalId = 1;

  successfulSets.forEach((set, setIndex) => {
    set.flashcards.forEach((card) => {
      consolidatedFlashcards.push({
        ...card,
        // Create globally unique IDs: "chunk-originalId"
        id: `${setIndex + 1}-${card.id}`,
      });
      globalId++;
    });
  });

  // Determine overall topic (use first successful set's topic or combine)
  const topics = successfulSets.map((s) => s.topic);
  const mainTopic =
    topics.length === 1
      ? topics[0]
      : `${topics[0]} (e mais ${topics.length - 1} tópicos)`;

  // Determine overall difficulty (use most common or default to intermediate)
  const difficulties = successfulSets.map((s) => s.difficulty);
  const difficultyCount = difficulties.reduce(
    (acc, d) => {
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    },
    {} as Record<FlashcardDifficulty, number>
  );
  const mainDifficulty = (Object.entries(difficultyCount).sort(
    (a, b) => b[1] - a[1]
  )[0]?.[0] || "intermediate") as FlashcardDifficulty;

  return {
    topic: mainTopic,
    difficulty: mainDifficulty,
    language,
    flashcards: consolidatedFlashcards,
    metadata: {
      videoUrl,
      totalChunks: chunks.length,
      successfulChunks: successfulSets.length,
    },
  };
}

/**
 * Helper function to format seconds to MM:SS or HH:MM:SS
 */
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

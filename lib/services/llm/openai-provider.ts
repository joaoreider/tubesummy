import OpenAI from "openai";
import { z } from "zod";
import { Language, Summary } from "../../types";
import type { LLMProvider } from "./llm-provider";
import { createReadStream } from "fs";

const summarySchema = z.object({
  paragraph: z.string().min(1),
  topics: z
    .array(
      z.object({
        title: z.string().min(1),
        timestamp: z.string().min(1),
      }),
    )
    .min(1),
});

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface WhisperResponse {
  text: string;
  segments: WhisperSegment[];
}

export class OpenAIProvider implements LLMProvider {
  async transcribeAudio(
    audioFilePath: string,
    language: Language,
  ): Promise<WhisperResponse> {
    if (!client.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    // Map language codes: pt-BR -> pt, en -> en
    const whisperLanguage = language === "pt-BR" ? "pt" : "en";

    const fileStream = createReadStream(audioFilePath);

    const transcription = await client.audio.transcriptions.create({
      file: fileStream as any,
      model: "whisper-1",
      language: whisperLanguage,
      response_format: "verbose_json",
    });

    const response = transcription as unknown as WhisperResponse;

    return response;
  }

  async generateSummary(params: {
    transcript: string;
    language: Language;
  }): Promise<Summary> {
    if (!client.apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const { transcript, language } = params;

    const systemPrompt =
      "You are a summarization engine for YouTube videos. " +
      "Your job is to read a full transcript and output an extremely concise, clear summary. " +
      "Do not show the transcript. Do not add filler or introductions. Do not repeat ideas.";

    const userPrompt = `
Language: ${language === "pt-BR" ? "Portuguese (Brazil)" : "English"}

You will receive the full transcript of a YouTube video.

RULES:
- Maximum video duration to consider: 40 minutes (assume the transcript respects this).
- Be extremely concise.
- Use simple language.
- Do not add opinions or generic introductions.
- The summary must allow understanding the full video without watching it.

OUTPUT FORMAT (STRICT JSON):
{
  "paragraph": "Single paragraph with 3–7 lines, summarizing the whole video.",
  "topics": [
    {
      "title": "Short, clear topic description",
      "timestamp": "MM:SS or HH:MM:SS approximate starting time"
    }
  ]
}

Do not include any keys other than "paragraph" and "topics".
Do not include markdown.
Do not include explanations.

TRANSCRIPT:
"""${transcript}"""
`;

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const content =
      response.choices[0]?.message?.content ?? '{"paragraph":"","topics":[]}';

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error("Failed to parse LLM response.");
    }

    const result = summarySchema.safeParse(parsed);
    if (!result.success) {
      throw new Error("LLM response did not match expected format.");
    }

    return result.data;
  }
}

export function getLLMProvider(): LLMProvider {
  return new OpenAIProvider();
}



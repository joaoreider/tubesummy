import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchTranscript } from "../../../lib/services/youtube-transcript";
import { getLLMProvider } from "../../../lib/services/llm/openai-provider";
import { isValidYoutubeUrl } from "../../../lib/utils/youtube";
import type { Language } from "../../../lib/types";

const requestSchema = z.object({
  url: z.url(),
  language: z.union([z.literal("pt-BR"), z.literal("en")]),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 },
      );
    }

    const { url, language } = parsed.data as {
      url: string;
      language: Language;
    };

    if (!isValidYoutubeUrl(url)) {
      return NextResponse.json(
        { error: "Please provide a valid YouTube URL." },
        { status: 400 },
      );
    }

    const { items } = await fetchTranscript(url, language);

    const transcriptText = items.map((item) => item.text).join(" ");

    const llm = getLLMProvider();
    const summary = await llm.generateSummary({
      transcript: transcriptText,
      language,
    });

    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);
    
    if (error instanceof Error) {
      const errorMessage = error.message;
      
      // Duration errors
      if (errorMessage.includes("40-minute limit") || errorMessage.includes("exceeds")) {
        return NextResponse.json(
          { error: "Only videos up to 40 minutes are supported." },
          { status: 400 },
        );
      }
      
      // Video not found or invalid
      if (
        errorMessage.includes("Invalid YouTube URL") ||
        errorMessage.includes("Could not retrieve video") ||
        errorMessage.includes("Video unavailable")
      ) {
        return NextResponse.json(
          { error: "Could not access this video. Please check the URL." },
          { status: 400 },
        );
      }
      
      // Audio download/transcription errors
      if (
        errorMessage.includes("Failed to download") ||
        errorMessage.includes("No transcript segments")
      ) {
        return NextResponse.json(
          { error: "Failed to process video audio. Please try again." },
          { status: 500 },
        );
      }
      
      // OpenAI API errors
      if (errorMessage.includes("OPENAI_API_KEY")) {
        return NextResponse.json(
          { error: "OpenAI API key is not configured." },
          { status: 500 },
        );
      }
    }
    
    return NextResponse.json(
      { error: "Something went wrong while summarizing the video." },
      { status: 500 },
    );
  }
}



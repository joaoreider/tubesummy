import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchTranscript } from "../../../lib/services/youtube-transcript";
import { generateFlashcardsFromChunks } from "../../../lib/services/llm/flashcard-service";
import { splitTranscriptIntoChunks } from "../../../lib/utils/transcript-chunker";
import { isValidYoutubeUrl } from "../../../lib/utils/youtube";
import type { Language } from "../../../lib/types";

const requestSchema = z.object({
  url: z.string().url(),
  language: z.union([z.literal("pt-BR"), z.literal("en")]),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = requestSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { url, language } = parsed.data as {
      url: string;
      language: Language;
    };

    if (!isValidYoutubeUrl(url)) {
      return NextResponse.json(
        { error: "Please provide a valid YouTube URL." },
        { status: 400 }
      );
    }

    // Step 1: Fetch transcript
    const { items, durationSeconds } = await fetchTranscript(url, language);

    // Step 2: Split transcript into chunks for long videos
    const chunks = splitTranscriptIntoChunks(items, durationSeconds);

    console.log(
      `Processing ${chunks.length} chunk(s) for video duration ${Math.round(durationSeconds / 60)} minutes`
    );

    // Step 3: Generate flashcards from all chunks in parallel
    const flashcardSet = await generateFlashcardsFromChunks(
      chunks,
      language,
      url
    );

    console.log(
      `Generated ${flashcardSet.flashcards.length} flashcards from ${flashcardSet.metadata?.successfulChunks}/${flashcardSet.metadata?.totalChunks} chunks`
    );

    return NextResponse.json(flashcardSet);
  } catch (error) {
    console.error(error);

    if (error instanceof Error) {
      const errorMessage = error.message;

      // #region agent log
      // Debug log for flashcards API errors (hypothesis H1: special yt-dlp errors like cookie/sign-in requirements are not being mapped correctly)
      fetch("http://127.0.0.1:7242/ingest/039bc9f9-63a1-4381-a7ab-370eb7026ae6", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "H1",
          location: "app/api/flashcards/route.ts:catch",
          message: "Flashcards API error caught",
          data: {
            name: error.name,
            message: errorMessage,
            stackSnippet: error.stack?.slice(0, 200),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log

      // Videos requiring sign-in / cookies (yt-dlp anti-bot or age-gate)
      if (
        errorMessage.includes("Sign in to confirm you’re not a bot") ||
        errorMessage.includes("cookies-from-browser") ||
        errorMessage.includes("Sign in to confirm you're not a bot")
      ) {
        // #region agent log
        // Debug log for hypothesis H2: sign-in/cookie-protected videos are being handled explicitly
        fetch("http://127.0.0.1:7242/ingest/039bc9f9-63a1-4381-a7ab-370eb7026ae6", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "post-fix",
            hypothesisId: "H2",
            location: "app/api/flashcards/route.ts:signin-branch",
            message: "Detected sign-in / cookie-protected YouTube video",
            data: {
              snippet: errorMessage.slice(0, 200),
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion agent log

        return NextResponse.json(
          {
            error:
              "YouTube is asking for sign-in or extra verification for this video, so it can't be processed automatically. Try another video that is publicly accessible.",
          },
          { status: 400 }
        );
      }

      // Duration errors
      if (
        errorMessage.includes("2-hour limit") ||
        errorMessage.includes("exceeds")
      ) {
        return NextResponse.json(
          { error: "Only videos up to 2 hours are supported." },
          { status: 400 }
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
          { status: 400 }
        );
      }

      // Audio download/transcription errors
      if (
        errorMessage.includes("Failed to download") ||
        errorMessage.includes("No transcript segments")
      ) {
        return NextResponse.json(
          { error: "Failed to process video audio. Please try again." },
          { status: 500 }
        );
      }

      // OpenAI API errors
      if (errorMessage.includes("OPENAI_API_KEY")) {
        return NextResponse.json(
          { error: "OpenAI API key is not configured." },
          { status: 500 }
        );
      }

      // All chunks failed
      if (errorMessage.includes("All chunks failed")) {
        return NextResponse.json(
          { error: "Failed to generate flashcards. Please try again." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: "Something went wrong while generating flashcards." },
      { status: 500 }
    );
  }
}

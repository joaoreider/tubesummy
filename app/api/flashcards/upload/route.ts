import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { OpenAIProvider } from "../../../../lib/services/llm/openai-provider";
import { generateFlashcardsFromChunks } from "../../../../lib/services/llm/flashcard-service";
import { splitTranscriptIntoChunks } from "../../../../lib/utils/transcript-chunker";
import type { Language, TranscriptItem } from "../../../../lib/types";

const execAsync = promisify(exec);

// Maximum file size for upload: 200 MB
const MAX_FILE_SIZE = 200 * 1024 * 1024;

// Whisper API limit: 25 MB
const WHISPER_MAX_SIZE = 25 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/x-matroska",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
];

const VIDEO_EXTENSIONS = [".mp4", ".mkv", ".webm", ".mov", ".avi"];

const ALLOWED_TYPES = [...ALLOWED_AUDIO_TYPES, ...ALLOWED_VIDEO_TYPES];

// File extensions we accept (fallback when MIME type is generic)
const ALLOWED_EXTENSIONS = [
  ".mp3",
  ".m4a",
  ".wav",
  ".ogg",
  ".webm",
  ".aac",
  ".mp4",
  ".mkv",
  ".mov",
  ".avi",
];

function isAllowedFile(mimeType: string, fileName: string): boolean {
  // Check MIME type first
  if (ALLOWED_TYPES.includes(mimeType)) {
    return true;
  }

  // Fallback: check extension (some browsers send generic MIME types)
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
  return ALLOWED_EXTENSIONS.includes(ext);
}

function isVideoFile(mimeType: string, fileName: string): boolean {
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    return true;
  }
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
  return VIDEO_EXTENSIONS.includes(ext);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Extracts audio from a video file using ffmpeg.
 * Returns the path to the extracted audio file.
 */
async function extractAudioFromVideo(
  videoPath: string,
  outputDir: string
): Promise<string> {
  const audioPath = join(outputDir, "extracted_audio.mp3");

  // Use ffmpeg to extract audio and compress to MP3
  // -vn: no video
  // -acodec libmp3lame: use MP3 codec
  // -ab 128k: 128kbps bitrate (good balance of quality/size)
  // -ar 16000: 16kHz sample rate (Whisper works well with this)
  // -ac 1: mono (reduces file size)
  const command = `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -ab 128k -ar 16000 -ac 1 -y "${audioPath}"`;

  try {
    await execAsync(command, { timeout: 120000 }); // 2 minute timeout
    return audioPath;
  } catch (error) {
    console.error("ffmpeg error:", error);
    throw new Error("Failed to extract audio from video. Make sure ffmpeg is installed.");
  }
}

/**
 * Compresses an audio file to reduce size for Whisper API.
 * Returns the path to the compressed audio file.
 */
async function compressAudio(
  audioPath: string,
  outputDir: string
): Promise<string> {
  const compressedPath = join(outputDir, "compressed_audio.mp3");

  // Compress to lower bitrate MP3
  const command = `ffmpeg -i "${audioPath}" -acodec libmp3lame -ab 64k -ar 16000 -ac 1 -y "${compressedPath}"`;

  try {
    await execAsync(command, { timeout: 120000 });
    return compressedPath;
  } catch (error) {
    console.error("ffmpeg compression error:", error);
    throw new Error("Failed to compress audio file.");
  }
}

/**
 * Checks if ffmpeg is available on the system.
 */
async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await execAsync("ffmpeg -version");
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let tempSubDir: string | null = null;
  const filesToClean: string[] = [];

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const languageParam = formData.get("language") as string | null;

    // Validate language
    const language: Language =
      languageParam === "pt-BR" ? "pt-BR" : "en";

    // Validate file presence
    if (!file) {
      return NextResponse.json(
        { error: "No file provided. Please select an audio or video file." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File is too large (${formatFileSize(file.size)}). Maximum allowed size is 200 MB.`,
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isAllowedFile(file.type, file.name)) {
      return NextResponse.json(
        {
          error: `Unsupported file type "${file.type || "unknown"}". Please upload an audio (mp3, m4a, wav, ogg) or video (mp4, mkv, webm) file.`,
        },
        { status: 400 }
      );
    }

    const isVideo = isVideoFile(file.type, file.name);

    console.log(
      `Processing uploaded file: ${file.name} (${formatFileSize(file.size)}, ${file.type}, isVideo: ${isVideo})`
    );

    // Create temp directory
    const tempDir = tmpdir();
    tempSubDir = join(
      tempDir,
      `upload-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    await fs.mkdir(tempSubDir, { recursive: true });

    // Save original file to disk
    const ext = file.name.slice(file.name.lastIndexOf(".")) || ".tmp";
    const originalFilePath = join(tempSubDir, `upload${ext}`);
    filesToClean.push(originalFilePath);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(originalFilePath, Buffer.from(arrayBuffer));

    console.log(`File saved to temp path: ${originalFilePath}`);

    // Determine the file to send to Whisper
    let audioFilePath = originalFilePath;

    // If it's a video file, extract audio
    if (isVideo) {
      console.log("Video file detected, extracting audio...");
      
      const ffmpegAvailable = await checkFfmpegAvailable();
      if (!ffmpegAvailable) {
        return NextResponse.json(
          {
            error:
              "Video files require ffmpeg to be installed on the server. Please upload an audio file (mp3, m4a, wav) instead, or install ffmpeg.",
          },
          { status: 400 }
        );
      }

      audioFilePath = await extractAudioFromVideo(originalFilePath, tempSubDir);
      filesToClean.push(audioFilePath);
      
      const audioStats = await fs.stat(audioFilePath);
      console.log(`Audio extracted: ${formatFileSize(audioStats.size)}`);
    }

    // Check if audio file is within Whisper's limit
    const audioStats = await fs.stat(audioFilePath);
    
    if (audioStats.size > WHISPER_MAX_SIZE) {
      console.log(`Audio file too large (${formatFileSize(audioStats.size)}), compressing...`);
      
      const ffmpegAvailable = await checkFfmpegAvailable();
      if (!ffmpegAvailable) {
        return NextResponse.json(
          {
            error: `Audio file is too large for transcription (${formatFileSize(audioStats.size)}). Maximum is 25 MB. Please compress the file or use a shorter recording.`,
          },
          { status: 400 }
        );
      }

      audioFilePath = await compressAudio(audioFilePath, tempSubDir);
      filesToClean.push(audioFilePath);
      
      const compressedStats = await fs.stat(audioFilePath);
      console.log(`Audio compressed: ${formatFileSize(compressedStats.size)}`);

      // If still too large after compression, return error
      if (compressedStats.size > WHISPER_MAX_SIZE) {
        return NextResponse.json(
          {
            error: `Audio file is still too large after compression (${formatFileSize(compressedStats.size)}). Please use a shorter recording (max ~2 hours of speech).`,
          },
          { status: 400 }
        );
      }
    }

    // Transcribe with Whisper
    console.log(`Sending to Whisper: ${audioFilePath} (${formatFileSize((await fs.stat(audioFilePath)).size)})`);
    
    const openAIProvider = new OpenAIProvider();
    const whisperResponse = await openAIProvider.transcribeAudio(
      audioFilePath,
      language
    );

    // Convert Whisper response to TranscriptItem[]
    const items: TranscriptItem[] = whisperResponse.segments.map((segment) => ({
      text: segment.text.trim(),
      start: segment.start,
      duration: segment.end - segment.start,
    }));

    if (items.length === 0) {
      return NextResponse.json(
        { error: "No speech detected in the uploaded file. Please try a different file." },
        { status: 400 }
      );
    }

    // Calculate duration from segments
    const lastSegment = items[items.length - 1];
    const durationSeconds = lastSegment.start + lastSegment.duration;

    console.log(
      `Transcription complete: ${items.length} segments, ${Math.round(durationSeconds / 60)} minutes`
    );

    // Split into chunks (reuse same logic as YouTube flow)
    const chunks = splitTranscriptIntoChunks(items, durationSeconds);

    console.log(`Processing ${chunks.length} chunk(s) for flashcard generation`);

    // Generate flashcards from all chunks in parallel
    const flashcardSet = await generateFlashcardsFromChunks(
      chunks,
      language,
      "local-file" // Mark as local file instead of YouTube URL
    );

    console.log(
      `Generated ${flashcardSet.flashcards.length} flashcards from ${flashcardSet.metadata?.successfulChunks}/${flashcardSet.metadata?.totalChunks} chunks`
    );

    // Add file info to metadata
    flashcardSet.metadata = {
      ...flashcardSet.metadata,
      videoUrl: undefined,
      fileName: file.name,
      fileSize: file.size,
    };

    return NextResponse.json(flashcardSet);
  } catch (error) {
    console.error("Upload processing error:", error);

    if (error instanceof Error) {
      const errorMessage = error.message;

      // OpenAI API errors
      if (errorMessage.includes("OPENAI_API_KEY")) {
        return NextResponse.json(
          { error: "OpenAI API key is not configured." },
          { status: 500 }
        );
      }

      // Whisper file size limit (413 error)
      if (errorMessage.includes("413") || errorMessage.includes("Maximum content size")) {
        return NextResponse.json(
          {
            error: "File is too large for transcription. Please use a shorter recording or compress the audio.",
          },
          { status: 400 }
        );
      }

      // ffmpeg errors
      if (errorMessage.includes("ffmpeg") || errorMessage.includes("Failed to extract")) {
        return NextResponse.json(
          {
            error: errorMessage,
          },
          { status: 400 }
        );
      }

      // Whisper-specific errors
      if (
        errorMessage.includes("Invalid file format") ||
        errorMessage.includes("Could not process")
      ) {
        return NextResponse.json(
          {
            error:
              "Could not process this file. Make sure it contains valid audio.",
          },
          { status: 400 }
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
      { error: "Something went wrong while processing your file." },
      { status: 500 }
    );
  } finally {
    // Clean up all temp files
    if (tempSubDir) {
      try {
        for (const filePath of filesToClean) {
          try {
            await fs.unlink(filePath);
          } catch {
            // Ignore individual file cleanup errors
          }
        }
        await fs.rmdir(tempSubDir);
        console.log("Cleaned up temp files");
      } catch (cleanupError) {
        console.warn("Failed to clean up temp files:", cleanupError);
      }
    }
  }
}

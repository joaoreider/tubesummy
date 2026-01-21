import YTDlpWrap from "yt-dlp-wrap";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir, platform } from "os";
import { TranscriptItem } from "../types";
import { extractVideoId } from "../utils/youtube";
import { OpenAIProvider } from "./llm/openai-provider";
import type { Language } from "../types";

export interface TranscriptResult {
  items: TranscriptItem[];
  durationSeconds: number;
}

// Maximum video duration: 2 hours (120 minutes)
const MAX_DURATION_SECONDS = 120 * 60;

let ytDlpBinaryPath: string | undefined;
let binaryInitialized = false;

async function ensureYtDlpBinary(): Promise<string> {
  if (binaryInitialized && ytDlpBinaryPath) {
    return ytDlpBinaryPath;
  }

  const tempDir = tmpdir();
  const binaryName = platform() === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const binaryPath = join(tempDir, binaryName);
  
  // Check if binary already exists in temp directory
  try {
    await fs.access(binaryPath);
    ytDlpBinaryPath = binaryPath;
    binaryInitialized = true;
    return ytDlpBinaryPath;
  } catch {
    // Binary doesn't exist, will download
  }
  
  // Download binary if not found
  try {
    await YTDlpWrap.downloadFromGithub(binaryPath, undefined, platform());
    // Make binary executable on Unix systems
    if (platform() !== "win32") {
      try {
        await fs.chmod(binaryPath, 0o755);
      } catch {
        // chmod might fail, ignore
      }
    }
    ytDlpBinaryPath = binaryPath;
    binaryInitialized = true;
    return ytDlpBinaryPath;
  } catch (error) {
    throw new Error(
      "Failed to download yt-dlp binary. Please install yt-dlp manually: https://github.com/yt-dlp/yt-dlp#installation",
    );
  }
}

async function getVideoInfo(url: string): Promise<{ duration: number }> {
  const binaryPath = await ensureYtDlpBinary();
  const ytDlpWrap = new YTDlpWrap(binaryPath);
  const info = await ytDlpWrap.getVideoInfo(url);
  
  if (!info || typeof info.duration !== "number") {
    throw new Error("Could not retrieve video information.");
  }

  return { duration: info.duration };
}

async function downloadAudio(
  url: string,
  outputPath: string,
): Promise<void> {
  const binaryPath = await ensureYtDlpBinary();
  const ytDlpWrap = new YTDlpWrap(binaryPath);
  
  await ytDlpWrap.execPromise([
    url,
    "-f",
    "bestaudio[ext=m4a]/bestaudio",
    "-o",
    outputPath,
    "--no-playlist",
  ]);
}

export async function fetchTranscript(
  url: string,
  language: Language = "en",
): Promise<TranscriptResult> {
  const videoId = extractVideoId(url);
  if (!videoId) {
    throw new Error("Invalid YouTube URL.");
  }

  const videoInfo = await getVideoInfo(url);
  if (videoInfo.duration > MAX_DURATION_SECONDS) {
    throw new Error(
      `Video duration (${Math.round(videoInfo.duration / 60)} minutes) exceeds the 2-hour limit.`,
    );
  }

  const tempDir = tmpdir();
  const tempSubDir = join(tempDir, `yt-audio-${Date.now()}-${Math.random().toString(36).substring(7)}`);
  await fs.mkdir(tempSubDir, { recursive: true });
  const tempFilePath = join(tempSubDir, "%(title)s.%(ext)s");

  let actualFilePath: string | null = null;

  try {
    // Download audio - yt-dlp will create the file in tempSubDir
    await downloadAudio(url, tempFilePath);

    const files = await fs.readdir(tempSubDir);
    const audioFile = files.find(
      (f) => f.endsWith(".m4a") || f.endsWith(".webm") || f.endsWith(".opus") || f.endsWith(".mp3"),
    );

    if (!audioFile) {
      throw new Error("Failed to locate downloaded audio file.");
    }

    actualFilePath = join(tempSubDir, audioFile);

    const stats = await fs.stat(actualFilePath);
    if (stats.size === 0) {
      throw new Error("Downloaded audio file is empty.");
    }

    // Transcribe using Whisper
    const openAIProvider = new OpenAIProvider();
    const whisperResponse = await openAIProvider.transcribeAudio(
      actualFilePath,
      language,
    );

    const items: TranscriptItem[] = whisperResponse.segments.map((segment) => ({
      text: segment.text.trim(),
      start: segment.start,
      duration: segment.end - segment.start,
    }));

    if (items.length === 0) {
      throw new Error("No transcript segments were generated.");
    }

    const last = items[items.length - 1];
    const durationSeconds = last.start + last.duration;

    return { items, durationSeconds };
  } finally {
    try {
      if (actualFilePath) {
        await fs.unlink(actualFilePath);
      }
      await fs.rmdir(tempSubDir);
    } catch (error) {
      console.warn("Failed to clean up temp files:", tempSubDir);
    }
  }
}



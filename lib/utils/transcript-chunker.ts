import type { TranscriptItem, TranscriptChunk } from "../types";

// Target chunk duration: ~20 minutes (1200 seconds)
const TARGET_CHUNK_DURATION = 20 * 60; // 1200 seconds

// Tolerance window: ±2 minutes for finding natural break points
const TOLERANCE_WINDOW = 2 * 60; // 120 seconds

// Minimum gap to consider as a natural break point (in seconds)
const MIN_GAP_FOR_BREAK = 3;

/**
 * Finds the gap (silence/pause) between the end of one transcript item and the start of the next
 */
function getGapBetweenItems(
  current: TranscriptItem,
  next: TranscriptItem
): number {
  const currentEnd = current.start + current.duration;
  return next.start - currentEnd;
}

/**
 * Finds the best break point near the target time by looking for natural pauses.
 * Returns the index of the last item to include in the current chunk.
 */
function findNaturalBreakPoint(
  items: TranscriptItem[],
  startIndex: number,
  targetEndTime: number
): number {
  const minTime = targetEndTime - TOLERANCE_WINDOW;
  const maxTime = targetEndTime + TOLERANCE_WINDOW;

  // Find candidates within the tolerance window
  interface BreakCandidate {
    index: number;
    gap: number;
    timeDiff: number;
  }

  const candidates: BreakCandidate[] = [];

  for (let i = startIndex; i < items.length - 1; i++) {
    const item = items[i];
    const nextItem = items[i + 1];
    const itemEndTime = item.start + item.duration;

    // Check if this item's end time is within our tolerance window
    if (itemEndTime >= minTime && itemEndTime <= maxTime) {
      const gap = getGapBetweenItems(item, nextItem);
      candidates.push({
        index: i,
        gap,
        timeDiff: Math.abs(itemEndTime - targetEndTime),
      });
    }

    // Stop searching if we've gone past the max time
    if (itemEndTime > maxTime) {
      break;
    }
  }

  if (candidates.length === 0) {
    // No candidates in window, find the closest item to target time
    let closestIndex = startIndex;
    let closestDiff = Infinity;

    for (let i = startIndex; i < items.length; i++) {
      const itemEndTime = items[i].start + items[i].duration;
      const diff = Math.abs(itemEndTime - targetEndTime);

      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = i;
      }

      // Stop if we've gone too far past target
      if (itemEndTime > targetEndTime + TOLERANCE_WINDOW * 2) {
        break;
      }
    }

    return closestIndex;
  }

  // Sort candidates: prioritize larger gaps, then closer to target time
  candidates.sort((a, b) => {
    // If one has a significant gap (>= MIN_GAP_FOR_BREAK) and the other doesn't, prefer the gap
    const aHasGap = a.gap >= MIN_GAP_FOR_BREAK;
    const bHasGap = b.gap >= MIN_GAP_FOR_BREAK;

    if (aHasGap && !bHasGap) return -1;
    if (!aHasGap && bHasGap) return 1;

    // If both have gaps or both don't, prefer larger gap
    if (a.gap !== b.gap) return b.gap - a.gap;

    // If gaps are equal, prefer closer to target time
    return a.timeDiff - b.timeDiff;
  });

  return candidates[0].index;
}

/**
 * Splits a transcript into chunks of approximately 20 minutes each,
 * trying to find natural break points (pauses between segments).
 *
 * @param items - Array of transcript items with start times and durations
 * @param totalDuration - Total duration of the video in seconds
 * @returns Array of transcript chunks
 */
export function splitTranscriptIntoChunks(
  items: TranscriptItem[],
  totalDuration: number
): TranscriptChunk[] {
  if (items.length === 0) {
    return [];
  }

  // If total duration is less than or equal to target chunk duration, return single chunk
  if (totalDuration <= TARGET_CHUNK_DURATION + TOLERANCE_WINDOW) {
    return [
      {
        index: 0,
        items,
        startTime: items[0].start,
        endTime: items[items.length - 1].start + items[items.length - 1].duration,
        text: items.map((item) => item.text).join(" "),
      },
    ];
  }

  const chunks: TranscriptChunk[] = [];
  let currentStartIndex = 0;
  let chunkIndex = 0;

  while (currentStartIndex < items.length) {
    const chunkStartTime = items[currentStartIndex].start;
    const targetEndTime = chunkStartTime + TARGET_CHUNK_DURATION;

    // Check if we're near the end of the transcript
    const lastItem = items[items.length - 1];
    const transcriptEndTime = lastItem.start + lastItem.duration;

    if (targetEndTime >= transcriptEndTime - TOLERANCE_WINDOW) {
      // Last chunk: include all remaining items
      const chunkItems = items.slice(currentStartIndex);
      chunks.push({
        index: chunkIndex,
        items: chunkItems,
        startTime: chunkStartTime,
        endTime: transcriptEndTime,
        text: chunkItems.map((item) => item.text).join(" "),
      });
      break;
    }

    // Find the best break point
    const breakIndex = findNaturalBreakPoint(
      items,
      currentStartIndex,
      targetEndTime
    );

    // Create chunk with items from currentStartIndex to breakIndex (inclusive)
    const chunkItems = items.slice(currentStartIndex, breakIndex + 1);
    const lastChunkItem = chunkItems[chunkItems.length - 1];

    chunks.push({
      index: chunkIndex,
      items: chunkItems,
      startTime: chunkStartTime,
      endTime: lastChunkItem.start + lastChunkItem.duration,
      text: chunkItems.map((item) => item.text).join(" "),
    });

    // Move to next chunk
    currentStartIndex = breakIndex + 1;
    chunkIndex++;

    // Safety check to prevent infinite loops
    if (chunkIndex > 20) {
      console.warn("Too many chunks created, stopping at 20");
      // Add remaining items as final chunk
      if (currentStartIndex < items.length) {
        const remainingItems = items.slice(currentStartIndex);
        chunks.push({
          index: chunkIndex,
          items: remainingItems,
          startTime: remainingItems[0].start,
          endTime:
            remainingItems[remainingItems.length - 1].start +
            remainingItems[remainingItems.length - 1].duration,
          text: remainingItems.map((item) => item.text).join(" "),
        });
      }
      break;
    }
  }

  return chunks;
}

/**
 * Formats seconds to MM:SS or HH:MM:SS format
 */
export function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

import { config } from "../../config/env.js";
import { AppError } from "../../utils/apiResponse.js";
import { logger } from "../../utils/logger.js";
import { SEARCH_MAX_RESULTS } from "./music.validation.js";
import type { YouTubeSearchResult } from "./music.types.js";

interface YouTubeAPIItem {
  id: { videoId?: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
}

interface YouTubeSearchResponse {
  items: YouTubeAPIItem[];
}

interface YouTubeVideosResponse {
  items: { id: string; contentDetails: { duration: string } }[];
}

export async function searchYouTubeVideos(
  query: string,
): Promise<YouTubeSearchResult[]> {
  const apiKey = config.youtubeApiKey;
  if (!apiKey) {
    logger.error("YouTube API key is not configured");
    throw new AppError("Music search is not available", 503);
  }

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", String(SEARCH_MAX_RESULTS));
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("key", apiKey);

  let searchResponse: Response;
  try {
    searchResponse = await fetch(searchUrl.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch {
    logger.error("YouTube search request failed — network error");
    throw new AppError("Music search is temporarily unavailable", 502);
  }

  if (searchResponse.status === 403 || searchResponse.status === 400) {
    logger.error("YouTube API quota exceeded or API key invalid", {
      status: searchResponse.status,
    });
    throw new AppError("Music search is temporarily unavailable", 503);
  }

  if (!searchResponse.ok) {
    logger.error("YouTube API error", { status: searchResponse.status });
    throw new AppError("Music search failed", 502);
  }

  let searchBody: YouTubeSearchResponse;
  try {
    searchBody = (await searchResponse.json()) as YouTubeSearchResponse;
  } catch {
    throw new AppError("Music search failed — invalid response", 502);
  }

  const videoIds = searchBody.items
    .map((item) => item.id.videoId)
    .filter((id): id is string => typeof id === "string");

  if (videoIds.length === 0) {
    return [];
  }

  // Fetch durations for the found videos
  const durations = await fetchVideoDurations(videoIds, apiKey);

  const results: YouTubeSearchResult[] = searchBody.items
    .filter((item) => item.id.videoId)
    .map((item) => {
      const videoId = item.id.videoId!;
      const thumb =
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url ??
        item.snippet.thumbnails.high?.url ??
        "";
      return {
        videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        thumbnailUrl: thumb,
        duration: durations[videoId] ?? "",
      };
    });

  return results;
}

async function fetchVideoDurations(
  videoIds: string[],
  apiKey: string,
): Promise<Record<string, string>> {
  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("part", "contentDetails");
  videosUrl.searchParams.set("id", videoIds.join(","));
  videosUrl.searchParams.set("key", apiKey);

  let videosResponse: Response;
  try {
    videosResponse = await fetch(videosUrl.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch {
    logger.error("YouTube videos request failed — network error");
    return {};
  }

  if (!videosResponse.ok) {
    logger.error("YouTube videos API error", { status: videosResponse.status });
    return {};
  }

  let videosBody: YouTubeVideosResponse;
  try {
    videosBody = (await videosResponse.json()) as YouTubeVideosResponse;
  } catch {
    return {};
  }

  const durations: Record<string, string> = {};
  for (const item of videosBody.items) {
    durations[item.id] = item.contentDetails.duration;
  }
  return durations;
}
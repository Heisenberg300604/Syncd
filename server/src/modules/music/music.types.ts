export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string;
}

export interface YouTubeSearchResponse {
  results: YouTubeSearchResult[];
}
export interface YouTubeVideoResponse {
  result: YouTubeSearchResult;
}

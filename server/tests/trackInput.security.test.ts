import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isPlaylistUrl,
  parseYouTubePlaylistId,
  parseYouTubeVideoId,
  sanitizeThumbnailUrl,
} from "../src/modules/music/music.validation.js";
import { validateTrackInput } from "../src/modules/playback/playback.validation.js";

const VALID_ID = "dQw4w9WgXcQ";
const VALID_THUMB = `https://i.ytimg.com/vi/${VALID_ID}/mqdefault.jpg`;

describe("thumbnail sanitisation", () => {
  test("keeps genuine YouTube image URLs", () => {
    for (const url of [
      VALID_THUMB,
      "https://i9.ytimg.com/vi/abc/hq.jpg",
      "https://img.youtube.com/vi/abc/0.jpg",
      "https://yt3.ggpht.com/a/default.jpg",
    ]) {
      assert.equal(sanitizeThumbnailUrl(url), new URL(url).toString());
    }
  });

  test("drops URLs that would point a whole room at someone else's server", () => {
    // A room's thumbnail is rendered as an <img src> in every member's
    // browser, so anything off YouTube is an attacker-controlled beacon.
    for (const url of [
      "https://attacker.example/pixel.gif",
      "https://evil-ytimg.com/pixel.gif",
      "https://ytimg.com.attacker.example/pixel.gif",
      "http://i.ytimg.com/vi/abc/hq.jpg",
      "javascript:alert(1)",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "//i.ytimg.com/vi/abc/hq.jpg",
      "http://169.254.169.254/latest/meta-data/",
      "file:///etc/passwd",
      "not a url",
      "",
      null,
      undefined,
      12345,
    ]) {
      assert.equal(
        sanitizeThumbnailUrl(url),
        "",
        `expected ${String(url)} to be dropped`,
      );
    }
  });
});

describe("track input validation", () => {
  test("accepts a real search result unchanged", () => {
    const result = validateTrackInput({
      videoId: VALID_ID,
      title: "Some song",
      thumbnailUrl: VALID_THUMB,
      duration: "PT3M45S",
    });

    assert.ok(result.ok);
    assert.deepEqual(result.value, {
      videoId: VALID_ID,
      title: "Some song",
      thumbnailUrl: VALID_THUMB,
      duration: "PT3M45S",
    });
  });

  test("rejects video ids that are not YouTube ids", () => {
    // `queue:add` used to clamp the id to 20 characters instead of matching
    // it, which let a queued item carry arbitrary text into the room's
    // current-track record when the queue advanced.
    for (const videoId of [
      "",
      "short",
      "waytoolongvideoid123",
      "../../../etc/passwd",
      "<script>alert(1)",
      "abcdefghijk;rm -rf",
      null,
      undefined,
      { toString: () => VALID_ID },
    ]) {
      assert.equal(
        validateTrackInput({ videoId, title: "t", thumbnailUrl: "", duration: "" }).ok,
        false,
        `expected ${String(videoId)} to be rejected`,
      );
    }
  });

  test("rejects non-object payloads", () => {
    for (const payload of [null, undefined, "track", 5, []]) {
      // An array has no videoId, so it must fail like any other bad payload.
      assert.equal(validateTrackInput(payload).ok, false);
    }
  });

  test("strips a hostile thumbnail but keeps the track playable", () => {
    const result = validateTrackInput({
      videoId: VALID_ID,
      title: "x".repeat(1000),
      thumbnailUrl: "https://attacker.example/track.gif",
      duration: "PT1M",
    });

    assert.ok(result.ok);
    assert.equal(result.value.thumbnailUrl, "");
    assert.equal(result.value.title.length, 300);
    assert.equal(result.value.videoId, VALID_ID);
  });
});

describe("YouTube link parsing", () => {
  test("extracts ids from the link shapes the UI accepts", () => {
    for (const link of [
      VALID_ID,
      `https://www.youtube.com/watch?v=${VALID_ID}`,
      `https://youtu.be/${VALID_ID}`,
      `https://music.youtube.com/watch?v=${VALID_ID}`,
      `https://www.youtube.com/embed/${VALID_ID}`,
      `https://www.youtube.com/shorts/${VALID_ID}`,
    ]) {
      const result = parseYouTubeVideoId(link);
      assert.ok(result.ok, `expected ${link} to parse`);
      assert.equal(result.value, VALID_ID);
    }
  });

  test("refuses to resolve links on hosts other than YouTube", () => {
    // The resolver turns this into a server-side fetch, so the host allowlist
    // is what stops it being used as a request proxy.
    for (const link of [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:5000/api/me",
      "https://attacker.example/watch?v=" + VALID_ID,
      "https://youtube.com.attacker.example/watch?v=" + VALID_ID,
      "file:///etc/passwd",
      "",
      null,
    ]) {
      assert.equal(
        parseYouTubeVideoId(link).ok,
        false,
        `expected ${String(link)} to be rejected`,
      );
    }
  });
});

describe("YouTube playlist link parsing", () => {
  const VALID_PLAYLIST_ID = "PL1234567890abcdef";

  test("extracts playlist id from supported YouTube link formats", () => {
    for (const link of [
      VALID_PLAYLIST_ID,
      `https://www.youtube.com/playlist?list=${VALID_PLAYLIST_ID}`,
      `https://youtube.com/watch?v=dQw4w9WgXcQ&list=${VALID_PLAYLIST_ID}`,
      `https://youtu.be/dQw4w9WgXcQ?list=${VALID_PLAYLIST_ID}`,
      `https://music.youtube.com/playlist?list=${VALID_PLAYLIST_ID}`,
      `https://m.youtube.com/playlist?list=${VALID_PLAYLIST_ID}`,
    ]) {
      const result = parseYouTubePlaylistId(link);
      assert.ok(result.ok, `expected ${link} to parse`);
      assert.equal(result.value, VALID_PLAYLIST_ID);
    }
  });

  test("refuses to resolve playlist links on non-YouTube hosts or invalid inputs", () => {
    for (const link of [
      "http://attacker.example/playlist?list=" + VALID_PLAYLIST_ID,
      "https://youtube.com.attacker.example/playlist?list=" + VALID_PLAYLIST_ID,
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/playlist?list=",
      "file:///etc/passwd",
      "",
      null,
      undefined,
    ]) {
      assert.equal(
        parseYouTubePlaylistId(link).ok,
        false,
        `expected ${String(link)} to be rejected`,
      );
    }
  });

  test("isPlaylistUrl correctly identifies YouTube URLs with a list parameter", () => {
    assert.equal(
      isPlaylistUrl(`https://www.youtube.com/playlist?list=${VALID_PLAYLIST_ID}`),
      true,
    );
    assert.equal(
      isPlaylistUrl(`https://youtu.be/dQw4w9WgXcQ?list=${VALID_PLAYLIST_ID}`),
      true,
    );
    assert.equal(
      isPlaylistUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      false,
    );
    assert.equal(
      isPlaylistUrl(`https://attacker.example/playlist?list=${VALID_PLAYLIST_ID}`),
      false,
    );
    assert.equal(isPlaylistUrl("not a url"), false);
    assert.equal(isPlaylistUrl(null), false);
  });
});

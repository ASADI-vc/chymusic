/**
 * Audio detection — runs in the content script.
 *
 * Scans the current page for `<audio>` and `<video>` elements, plus `<a>` tags
 * pointing to audio MIME types. Returns a normalized list of detected audio
 * sources so the background service worker can decide whether to prompt the user.
 */
import { AUDIO_EXTENSIONS, AUDIO_MIME_PREFIXES, KNOWN_SOURCES } from '@chymusic/shared';
import { log } from './log';

export interface DetectedAudio {
  /** Element id or generated identifier for dedup. */
  elementId: string;
  /** Direct URL of the audio file. */
  url: string;
  /** Best-guess title from surrounding context (alt, aria-label, link text). */
  title?: string;
  /** Best-guess artist/album from page metadata. */
  artist?: string;
  album?: string;
  /** MIME type if known. */
  mimeType?: string;
  /** Source of detection: audio element, video element, anchor link. */
  detectedFrom: 'audio' | 'video' | 'anchor' | 'source';
  /** Whether this is on a known source (musicsbaran, kashoob). */
  knownSource?: keyof typeof KNOWN_SOURCES;
}

function isAudioUrl(url: string): boolean {
  try {
    const u = new URL(url, location.href);
    const ext = u.pathname.split('.').pop()?.toLowerCase();
    if (ext && (AUDIO_EXTENSIONS as readonly string[]).includes(ext)) return true;
    return false;
  } catch {
    return false;
  }
}

function isAudioMime(mime: string | null): boolean {
  if (!mime) return false;
  return AUDIO_MIME_PREFIXES.some((p) => mime.startsWith(p));
}

function guessTitle(el: Element): string | undefined {
  return (
    el.getAttribute('title') ||
    el.getAttribute('aria-label') ||
    (el as HTMLAnchorElement).text?.trim() ||
    el.closest('[data-title]')?.getAttribute('data-title') ||
    undefined
  );
}

function guessArtistAlbum(): { artist?: string; album?: string } {
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
  const ogDescription = document
    .querySelector('meta[property="og:description"]')
    ?.getAttribute('content');
  const h1 = document.querySelector('h1')?.textContent?.trim();

  // Heuristic: many Persian music sites put artist name in og:description or h1.
  return { album: ogTitle || h1 || undefined, artist: ogDescription || undefined };
}

export function detectAudioOnPage(): DetectedAudio[] {
  const found: DetectedAudio[] = [];
  const seenUrls = new Set<string>();
  const host = location.hostname.replace(/^www\./, '');
  const knownSource = (Object.keys(KNOWN_SOURCES) as (keyof typeof KNOWN_SOURCES)[]).find((k) =>
    host.endsWith(k),
  );

  // 1. <audio> elements + their <source> children.
  document.querySelectorAll('audio').forEach((audio, i) => {
    const url = audio.src || audio.currentSrc;
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      const { artist, album } = guessArtistAlbum();
      found.push({
        elementId: `audio-${i}`,
        url,
        title: guessTitle(audio),
        artist,
        album,
        detectedFrom: 'audio',
        knownSource,
      });
    }
    audio.querySelectorAll('source').forEach((src, j) => {
      const sUrl = src.src;
      if (sUrl && !seenUrls.has(sUrl)) {
        seenUrls.add(sUrl);
        const { artist, album } = guessArtistAlbum();
        found.push({
          elementId: `audio-${i}-source-${j}`,
          url: sUrl,
          title: guessTitle(audio),
          artist,
          album,
          mimeType: src.type,
          detectedFrom: 'source',
          knownSource,
        });
      }
    });
  });

  // 2. <video> elements (often used for podcasts on some sites).
  document.querySelectorAll('video').forEach((video, i) => {
    const url = video.src || video.currentSrc;
    if (url && isAudioUrl(url) && !seenUrls.has(url)) {
      seenUrls.add(url);
      const { artist, album } = guessArtistAlbum();
      found.push({
        elementId: `video-${i}`,
        url,
        title: guessTitle(video),
        artist,
        album,
        detectedFrom: 'video',
        knownSource,
      });
    }
  });

  // 3. <a> tags pointing to audio files.
  document.querySelectorAll('a[href]').forEach((a, i) => {
    const url = (a as HTMLAnchorElement).href;
    if (isAudioUrl(url) && !seenUrls.has(url)) {
      seenUrls.add(url);
      const { artist, album } = guessArtistAlbum();
      found.push({
        elementId: `anchor-${i}`,
        url,
        title: guessTitle(a),
        artist,
        album,
        detectedFrom: 'anchor',
        knownSource,
      });
    }
  });

  log.debug(`Detected ${found.length} audio source(s) on ${location.href}`);
  return found;
}

/**
 * Extract rich metadata for a known source (musicsbaran, kashoob) using
 * site-specific selectors. Falls back to the generic detection above for
 * unknown sites.
 */
export function scrapeKnownSource(host: keyof typeof KNOWN_SOURCES): {
  albumTitle?: string;
  artist?: string;
  tracks: { title?: string; url: string }[];
  coverImageUrl?: string;
} {
  const cfg = KNOWN_SOURCES[host];
  if (!cfg) return { tracks: [] };

  const tracks: { title?: string; url: string }[] = [];
  document.querySelectorAll(cfg.selectors.trackList).forEach((li) => {
    const titleEl = li.querySelector(cfg.selectors.trackTitle);
    const urlEl = li.querySelector(cfg.selectors.trackDownloadUrl) as HTMLAnchorElement | null;
    if (urlEl?.href) {
      tracks.push({ title: titleEl?.textContent?.trim(), url: urlEl.href });
    }
  });

  return {
    albumTitle: document.querySelector(cfg.selectors.albumTitle)?.textContent?.trim(),
    artist: document.querySelector(cfg.selectors.albumArtist)?.textContent?.trim(),
    tracks,
    coverImageUrl:
      (document.querySelector(cfg.selectors.coverImage) as HTMLImageElement | null)?.src ??
      undefined,
  };
}

/**
 * Content script — runs on every page (document_idle).
 *
 * Responsibilities:
 *   1. On page load, scan for audio. If found, notify the background worker.
 *   2. Listen for messages from the background worker (e.g. "re-scan now",
 *      "user granted permission, scrape full page for known source").
 *   3. Re-scan on DOM mutations (some sites lazy-load audio after SPA navigation).
 */
import { detectAudioOnPage, scrapeKnownSource } from '@/lib/detect';
import type { Message } from '@/lib/messages';
import { KNOWN_SOURCES } from '@chymusic/shared';
import { log } from '@/lib/log';

log.info('content script loaded on', location.href);

function reportDetection() {
  const detected = detectAudioOnPage();
  if (detected.length === 0) return;
  const host = location.hostname.replace(/^www\./, '');
  const knownSource = (Object.keys(KNOWN_SOURCES) as (keyof typeof KNOWN_SOURCES)[]).find((k) =>
    host.endsWith(k),
  );

  const msg: Message = {
    kind: 'DETECT_AUDIO_RESULT',
    tabId: 0, // background worker will overwrite with the real tab id
    url: location.href,
    host,
    detected,
  };

  // Send to background. The background worker will decide whether to prompt.
  chrome.runtime.sendMessage(msg).catch((err) => {
    log.debug('sendMessage failed (extension context may be invalidated):', err);
  });

  // Also broadcast to any externally-connected PWA on this origin.
  if (knownSource) {
    const rich = scrapeKnownSource(knownSource);
    log.debug(`Known source ${knownSource}:`, rich);
    chrome.runtime.sendMessage({
      kind: 'DETECT_AUDIO_RESULT',
      tabId: 0,
      url: location.href,
      host,
      detected: [...detected, ...rich.tracks.map((t, i) => ({
        elementId: `known-${i}`,
        url: t.url,
        title: t.title,
        artist: rich.artist,
        album: rich.albumTitle,
        detectedFrom: 'anchor' as const,
        knownSource,
      }))],
    } satisfies Message).catch(() => {});
  }
}

// Initial scan.
reportDetection();

// Re-scan on DOM mutations (debounced).
let debounceTimer: number | undefined;
const observer = new MutationObserver(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    reportDetection();
  }, 800);
});
observer.observe(document.body, { childList: true, subtree: true });

// Listen for messages from background.
chrome.runtime.onMessage.addListener((msg: Message, _sender, _sendResponse) => {
  log.debug('content received:', msg.kind);
  return false;
});

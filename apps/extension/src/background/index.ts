/**
 * Background service worker — the brain of the extension.
 *
 * Responsibilities:
 *   1. Receive DETECT_AUDIO_RESULT from content scripts.
 *   2. Check if user has permission for this host. If not, show a notification
 *      and badge asking them to grant permission.
 *   3. On permission grant, automatically queue all detected audio for caching.
 *   4. On CACHE_AUDIO, fetch the audio file, write it to the user's CHYMUSIC
 *      folder via the File System Access API (requires the PWA to be open
 *      and connected via externally_connectable), or via chrome.downloads
 *      as a fallback (saved to ~/Downloads/CHYMUSIC/audio/).
 *   5. Write metadata to chrome.storage.local so the PWA can sync it later.
 */
import type { Message } from '@/lib/messages';
import type { DetectedAudio } from '@/lib/detect';
import { hasPermission, grantPermission, revokePermission } from '@/lib/permission';
import { log } from '@/lib/log';
import { CHYMUSIC_FOLDER_NAME, SUBFOLDERS, ContentKind } from '@chymusic/shared';
import { nanoid } from 'nanoid';

interface CacheQueueItem {
  url: string;
  status: 'pending' | 'downloading' | 'done' | 'error';
  progress: number;
  audio?: DetectedAudio;
  tabId?: number;
  localPath?: string;
  error?: string;
}

const state = {
  detectedByTab: new Map<number, DetectedAudio[]>(),
  cacheQueue: new Map<string, CacheQueueItem>(),
  pwaPort: chrome.runtime.Port | null = null,
};

// ===== Messaging: content → background =====

chrome.runtime.onMessage.addListener((msg: Message, sender, _sendResponse) => {
  log.debug('bg received:', msg.kind);

  switch (msg.kind) {
    case 'DETECT_AUDIO_RESULT': {
      const tabId = sender.tab?.id ?? msg.tabId;
      if (tabId) {
        state.detectedByTab.set(tabId, msg.detected);
        // Update badge with count.
        chrome.action.setBadgeText({ text: msg.detected.length > 0 ? String(msg.detected.length) : '', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#1db954', tabId });

        // If user has already granted permission for this host, auto-queue.
        hasPermission(msg.host).then((ok) => {
          if (ok) {
            msg.detected.forEach((audio) => queueCache(audio, tabId));
          } else {
            // Notify the user that audio was detected.
            notifyAudioDetected(msg.host, msg.detected.length, tabId);
          }
        });
      }
      return false;
    }

    case 'REQUEST_PERMISSION': {
      grantPermission(msg.host).then(() => {
        log.info(`Permission granted for ${msg.host}`);
        // Auto-queue all detected audio from tabs on this host.
        for (const [tabId, detected] of state.detectedByTab) {
          const onHost = detected.filter(
            (a) => new URL(a.url).hostname.replace(/^www\./, '') === msg.host,
          );
          onHost.forEach((audio) => queueCache(audio, tabId));
        }
        broadcastState();
      });
      return false;
    }

    case 'PERMISSION_DENIED': {
      revokePermission(msg.host).catch(console.warn);
      return false;
    }

    case 'CACHE_AUDIO': {
      queueCache(msg.audio, msg.tabId);
      return false;
    }

    case 'GET_STATE': {
      // Handled by sendResponse below.
      return false;
    }

    default:
      return false;
  }
});

// ===== Messaging: PWA → background (externally_connectable) =====

chrome.runtime.onConnectExternal.addListener((port) => {
  log.info('PWA connected:', port.sender?.origin);
  state.pwaPort = port;

  port.onMessage.addListener((msg: Message) => {
    log.debug('PWA message:', msg.kind);
    switch (msg.kind) {
      case 'PWA_REQUEST_STATE':
        port.postMessage({ kind: 'STATE', state: serializeState() } satisfies Message);
        break;
      case 'PWA_CACHE_FROM_URL':
        // PWA asked us to cache a specific URL.
        queueCache(
          {
            elementId: nanoid(),
            url: msg.url,
            detectedFrom: 'audio',
            title: msg.metadata?.title as string | undefined,
            artist: msg.metadata?.artist as string | undefined,
          },
          undefined,
          msg.metadata,
        );
        break;
      default:
        log.warn('Unknown PWA message:', msg);
    }
  });

  port.onDisconnect.addListener(() => {
    log.info('PWA disconnected');
    state.pwaPort = null;
  });
});

// ===== Caching pipeline =====

async function queueCache(
  audio: DetectedAudio,
  tabId?: number,
  extraMetadata?: Record<string, unknown>,
): Promise<void> {
  if (state.cacheQueue.has(audio.url)) {
    log.debug('Already in queue:', audio.url);
    return;
  }

  const item: CacheQueueItem = { url: audio.url, status: 'pending', progress: 0, audio, tabId };
  state.cacheQueue.set(audio.url, item);
  broadcastState();

  try {
    item.status = 'downloading';
    broadcastState();

    // Strategy: try to delegate the download+save to the PWA via externally_connectable.
    // If no PWA port, fall back to chrome.downloads.
    const localPath = state.pwaPort
      ? await downloadViaPwa(audio, extraMetadata)
      : await downloadViaChrome(audio);

    item.status = 'done';
    item.progress = 1;
    item.localPath = localPath;
    log.info('Cached:', audio.url, '→', localPath);

    // Save metadata to chrome.storage.local so the PWA can sync later.
    await saveMetadata(audio, localPath, extraMetadata);

    broadcastState();
  } catch (err) {
    item.status = 'error';
    item.error = (err as Error).message;
    log.error('Cache failed:', audio.url, err);
    broadcastState();
  }
}

async function downloadViaPwa(
  audio: DetectedAudio,
  _extraMetadata?: Record<string, unknown>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!state.pwaPort) {
      reject(new Error('No PWA port connected'));
      return;
    }
    const id = nanoid();
    const port = state.pwaPort;

    const onMessage = (msg: Message) => {
      if (msg.kind === 'CACHE_AUDIO_DONE' && msg.audio.url === audio.url) {
        port.onMessage.removeListener(onMessage);
        resolve(msg.localPath);
      } else if (msg.kind === 'CACHE_AUDIO_ERROR' && msg.audioUrl === audio.url) {
        port.onMessage.removeListener(onMessage);
        reject(new Error(msg.error));
      } else if (msg.kind === 'CACHE_AUDIO_PROGRESS' && msg.audioUrl === audio.url) {
        const item = state.cacheQueue.get(audio.url);
        if (item) {
          item.progress = msg.progress;
          broadcastState();
        }
      }
    };

    port.onMessage.addListener(onMessage);
    port.postMessage({ kind: 'CACHE_AUDIO', audio, tabId: 0 } satisfies Message);

    // Timeout after 5 min.
    setTimeout(() => {
      port.onMessage.removeListener(onMessage);
      reject(new Error('PWA cache timeout'));
    }, 5 * 60 * 1000);
  });
}

async function downloadViaChrome(audio: DetectedAudio): Promise<string> {
  // Fallback: use chrome.downloads. Files end up in
  // ~/Downloads/CHYMUSIC/audio/<filename> — we have no FSA access here.
  const filename = `${CHYMUSIC_FOLDER_NAME}/${SUBFOLDERS.AUDIO}/${sanitizeFilename(basename(audio.url))}`;
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url: audio.url, filename, saveAs: false, conflictAction: 'uniquify' },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(filename);
        }
      },
    );
  });
}

function basename(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    return parts[parts.length - 1] || `audio-${Date.now()}.mp3`;
  } catch {
    return `audio-${Date.now()}.mp3`;
  }
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

async function saveMetadata(
  audio: DetectedAudio,
  localPath: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  const id = nanoid();
  const meta = {
    id,
    kind: audio.knownSource === 'kashoob' ? ContentKind.Madahi : ContentKind.Music,
    title: audio.title ?? basename(audio.url),
    artist: audio.artist ?? 'Unknown',
    album: audio.album,
    sources: [{ type: 'local' as const, url: localPath }],
    source: 'extension_scrape' as const,
    sourceUrl: audio.url,
    detectedFrom: audio.detectedFrom,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isCurated: false,
    isFeatured: false,
    isHidden: false,
    ...extra,
  };

  const result = await chrome.storage.local.get('chymusic:metadata-queue');
  const queue = (result['chymusic:metadata-queue'] as unknown[]) ?? [];
  queue.push(meta);
  await chrome.storage.local.set({ 'chymusic:metadata-queue': queue });
}

// ===== Notifications =====

function notifyAudioDetected(host: string, count: number, tabId: number): void {
  chrome.notifications.create(`chymusic:detect:${host}:${tabId}`, {
    type: 'basic',
    iconUrl: 'icons/icon-128.png',
    title: 'CHYMUSIC detected audio',
    message: `Found ${count} audio file${count === 1 ? '' : 's'} on ${host}. Click to allow caching.`,
    priority: 1,
    buttons: [{ title: 'Cache to my library' }, { title: 'Not now' }],
  });
}

chrome.notifications.onButtonClicked.addListener((notifId, buttonIdx) => {
  if (notifId.startsWith('chymusic:detect:')) {
    const parts = notifId.split(':');
    const host = parts[2]!;
    if (buttonIdx === 0) {
      // Cache to my library
      grantPermission(host).then(() => {
        for (const [tabId, detected] of state.detectedByTab) {
          const onHost = detected.filter(
            (a) => new URL(a.url).hostname.replace(/^www\./, '') === host,
          );
          onHost.forEach((audio) => queueCache(audio, tabId));
        }
        chrome.notifications.clear(notifId);
      });
    } else {
      chrome.notifications.clear(notifId);
    }
  }
});

// ===== State broadcasting =====

function serializeState() {
  return {
    currentTabUrl: null,
    currentTabHost: null,
    detectedAudio: Array.from(state.detectedByTab.values()).flat(),
    hasPermission: false,
    cacheQueue: Array.from(state.cacheQueue.values()).map((i) => ({
      url: i.url,
      status: i.status,
    })),
  };
}

function broadcastState(): void {
  if (state.pwaPort) {
    state.pwaPort.postMessage({ kind: 'STATE', state: serializeState() } satisfies Message);
  }
}

log.info('background service worker started');

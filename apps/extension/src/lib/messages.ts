/**
 * Cross-environment messaging types between content script, background service
 * worker, popup, and the externally-connected standalone PWA.
 */
import type { DetectedAudio } from './detect';

export type Message =
  | {
      kind: 'DETECT_AUDIO';
      tabId: number;
    }
  | {
      kind: 'DETECT_AUDIO_RESULT';
      tabId: number;
      url: string;
      host: string;
      detected: DetectedAudio[];
    }
  | {
      kind: 'REQUEST_PERMISSION';
      host: string;
      /** Whether this is a known source (musicsbaran, kashoob) — affects prompt text. */
      knownSource?: boolean;
    }
  | {
      kind: 'PERMISSION_GRANTED';
      host: string;
    }
  | {
      kind: 'PERMISSION_DENIED';
      host: string;
    }
  | {
      kind: 'CACHE_AUDIO';
      audio: DetectedAudio;
      tabId: number;
    }
  | {
      kind: 'CACHE_AUDIO_PROGRESS';
      audioUrl: string;
      progress: number; // 0-1
    }
  | {
      kind: 'CACHE_AUDIO_DONE';
      audio: DetectedAudio;
      localPath: string;
      metadata: Record<string, unknown>;
    }
  | {
      kind: 'CACHE_AUDIO_ERROR';
      audioUrl: string;
      error: string;
    }
  | {
      kind: 'GET_STATE';
    }
  | {
      kind: 'STATE';
      state: {
        currentTabUrl: string | null;
        currentTabHost: string | null;
        detectedAudio: DetectedAudio[];
        hasPermission: boolean;
        cacheQueue: { url: string; status: 'pending' | 'downloading' | 'done' | 'error' }[];
      };
    }
  // Externally-connectable messages (from the standalone PWA).
  | {
      kind: 'PWA_REQUEST_STATE';
    }
  | {
      kind: 'PWA_PLAY_NOW';
      contentId: string;
    }
  | {
      kind: 'PWA_CACHE_FROM_URL';
      url: string;
      metadata?: Record<string, unknown>;
    };

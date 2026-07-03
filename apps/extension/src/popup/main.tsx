/**
 * Popup UI — shows detected audio on the current tab + cache status.
 * No React (keep popup bundle tiny for instant open).
 */
import type { Message } from '@/lib/messages';
import type { DetectedAudio } from '@/lib/detect';
import { hasPermission, grantPermission } from '@/lib/permission';
import { log } from '@/lib/log';

const root = document.getElementById('root')!;

interface PopupState {
  url: string | null;
  host: string | null;
  detected: DetectedAudio[];
  hasPermission: boolean;
  cacheQueue: { url: string; status: string }[];
}

async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function detectOnTab(tabId: number): Promise<DetectedAudio[]> {
  try {
    const response = await chrome.tabs.sendMessage<DetectedAudio[]>(tabId, { kind: 'GET_STATE' });
    return response ?? [];
  } catch (err) {
    log.debug('sendMessage to content script failed:', err);
    return [];
  }
}

async function render() {
  const tab = await getCurrentTab();
  const url = tab?.url ?? null;
  const host = url ? new URL(url).hostname.replace(/^www\./, '') : null;
  const detected = tab?.id ? await detectOnTab(tab.id) : [];
  const has = host ? await hasPermission(host) : false;

  const state: PopupState = { url, host, detected, hasPermission: has, cacheQueue: [] };

  root.innerHTML = `
    <div style="padding: 16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <div style="width:24px;height:24px;border-radius:4px;background:#1db954;color:#000;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px;">CHY</div>
        <strong>CHYMUSIC</strong>
      </div>
      ${state.host ? `
        <div style="font-size:11px;color:#9198a1;margin-bottom:8px;">Current site: ${state.host}</div>
        <div style="margin-bottom:12px;">
          ${state.detected.length > 0
            ? `<div>Found <strong>${state.detected.length}</strong> audio file${state.detected.length === 1 ? '' : 's'}.</div>`
            : `<div style="color:#9198a1;">No audio detected on this page.</div>`
          }
        </div>
        ${state.detected.length > 0 ? `
          <button id="grant" style="width:100%;background:${state.hasPermission ? '#1db954' : '#333'};color:${state.hasPermission ? '#000' : '#fff'};border:none;padding:10px;border-radius:6px;font-weight:600;cursor:pointer;margin-bottom:8px;">
            ${state.hasPermission ? '✓ Permission granted — caching automatically' : 'Allow caching from this site'}
          </button>
        ` : ''}
      ` : `
        <div style="color:#9198a1;font-size:13px;">Open a website to detect audio.</div>
      `}
      <a href="#" id="options" style="display:block;text-align:center;font-size:11px;color:#9198a1;margin-top:8px;text-decoration:none;">Settings</a>
    </div>
  `;

  const grantBtn = document.getElementById('grant');
  if (grantBtn && state.host) {
    grantBtn.addEventListener('click', async () => {
      await grantPermission(state.host!);
      // Trigger immediate caching of detected audio.
      state.detected.forEach((audio) => {
        const msg: Message = { kind: 'CACHE_AUDIO', audio, tabId: tab?.id ?? 0 };
        chrome.runtime.sendMessage(msg);
      });
      render();
    });
  }

  document.getElementById('options')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
}

render();

import { defineManifest } from '@crxjs/vite-plugin';
import { version } from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'CHYMUSIC — audio scraper & cache',
  version: version,
  description:
    'Detects audio on any website, asks if you want to cache it to your CHYMUSIC folder, and writes metadata to your local library.',
  minimum_chrome_version: '110',
  action: {
    default_title: 'CHYMUSIC',
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'icons/icon-16.png',
      '32': 'icons/icon-32.png',
      '48': 'icons/icon-48.png',
      '128': 'icons/icon-128.png',
    },
  },
  icons: {
    '16': 'icons/icon-16.png',
    '32': 'icons/icon-32.png',
    '48': 'icons/icon-48.png',
    '128': 'icons/icon-128.png',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],
  options_page: 'src/options/index.html',
  permissions: ['storage', 'downloads', 'scripting', 'activeTab', 'tabs', 'notifications'],
  host_permissions: ['<all_urls>'],
  web_accessible_resources: [
    {
      resources: ['icons/*'],
      matches: ['<all_urls>'],
    },
  ],
  // Cross-extension messaging with the standalone PWA (when installed as PWA,
  // it cannot use chrome.runtime; the extension acts as its file-writing proxy).
  externally_connectable: {
    matches: ['http://localhost:*/*', 'https://chymusic.app/*', 'https://*.chymusic.app/*'],
  },
});

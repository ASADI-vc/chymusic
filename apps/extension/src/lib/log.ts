/**
 * Cross-environment logger. Uses console in dev, chrome.runtime logging in prod.
 */
const PREFIX = '[CHYMUSIC/ext]';

export const log = {
  info: (...args: unknown[]) => console.log(PREFIX, ...args),
  warn: (...args: unknown[]) => console.warn(PREFIX, ...args),
  error: (...args: unknown[]) => console.error(PREFIX, ...args),
  debug: (...args: unknown[]) => {
    if (import.meta.env?.DEV) console.debug(PREFIX, ...args);
  },
};

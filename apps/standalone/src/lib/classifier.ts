/**
 * Genre classifier — hybrid heuristic + TF.js fallback.
 *
 * Strategy:
 *   1. HEURISTIC: Use source-website hints, ID3 tags, filename, and tags.
 *      This is fast (no model load) and very accurate for known sources
 *      (musicsbaran genre, kashoob = Madahi, etc.).
 *   2. TF.JS FALLBACK: If heuristic confidence < HEURISTIC_CONFIDENCE_THRESHOLD,
 *      load the bundled TF.js model and run it on audio features (MFCC + chroma).
 *
 * Both paths return a `ClassifierResult` with a confidence score and method tag.
 * The result is cached on the `Content` row (classifierConfidence, classifierMethod,
 * normalizedGenre, featureVector).
 */
import type { Content, ContentKind } from '@chymusic/shared';
import { HEURISTIC_CONFIDENCE_THRESHOLD, MIN_CONFIDENCE } from '@chymusic/shared';

export interface ClassifierResult {
  normalizedGenre: string;
  confidence: number;
  method: 'heuristic' | 'tfjs' | 'manual' | 'source';
  featureVector?: number[];
}

/** Mapping from source-website to default kind/genre. */
const SOURCE_DEFAULTS: Record<string, { kind: ContentKind; genre: string }> = {
  musicsbaran: { kind: 'music', genre: 'persian_pop' },
  kashoob: { kind: 'madahi', genre: 'noheh' },
};

/** Keyword → genre map for heuristic classification. */
const GENRE_KEYWORDS: { keywords: string[]; genre: string }[] = [
  { keywords: ['noheh', 'noha', 'maddahi', 'maddah', 'roeza', 'rawda'], genre: 'noheh' },
  { keywords: ['podcast', 'episode', 'ep.'], genre: 'podcast' },
  { keywords: ['speech', 'lecture', 'talk', 'khutba', 'khutbah'], genre: 'speech' },
  { keywords: ['pop'], genre: 'pop' },
  { keywords: ['rock'], genre: 'rock' },
  { keywords: ['rap', 'hip hop', 'hiphop'], genre: 'hiphop' },
  { keywords: ['traditional', 'sonnati', 'traditionnel'], genre: 'traditional' },
  { keywords: ['classical', 'klasik'], genre: 'classical' },
  { keywords: ['jazz'], genre: 'jazz' },
  { keywords: ['electronic', 'edm', 'house', 'techno'], genre: 'electronic' },
  { keywords: ['folk'], genre: 'folk' },
  { keywords: ['kpop', 'k-pop'], genre: 'kpop' },
  { keywords: ['quran', 'qoran', 'tilavat', 'tarteel'], genre: 'quran' },
];

function normalizeText(s: string | undefined): string {
  if (!s) return '';
  return s.toLowerCase().replace(/[\-–_/\\.,;:!?()[\]{}'"`]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Heuristic classifier — uses metadata only.
 */
export function classifyHeuristic(content: Pick<Content, 'kind' | 'genre' | 'title' | 'album' | 'artist' | 'tags' | 'source' | 'sourceUrl'>): ClassifierResult {
  // 1. Source-based default (highest priority for known sources).
  if (content.source && SOURCE_DEFAULTS[content.source]) {
    return {
      normalizedGenre: SOURCE_DEFAULTS[content.source]!.genre,
      confidence: 0.95,
      method: 'source',
    };
  }

  // 2. Already-set genre on the content (e.g. from a curated JSON catalog).
  if (content.genre) {
    const norm = normalizeText(content.genre);
    const match = GENRE_KEYWORDS.find((g) => g.keywords.some((k) => norm.includes(k)));
    if (match) {
      return { normalizedGenre: match.genre, confidence: 0.8, method: 'heuristic' };
    }
    // Genre is set but doesn't match a known keyword — trust it but with lower confidence.
    return { normalizedGenre: norm.replace(/\s+/g, '_'), confidence: 0.7, method: 'heuristic' };
  }

  // 3. Tags.
  if (content.tags && content.tags.length > 0) {
    const tagsNorm = content.tags.map(normalizeText).join(' ');
    const match = GENRE_KEYWORDS.find((g) => g.keywords.some((k) => tagsNorm.includes(k)));
    if (match) {
      return { normalizedGenre: match.genre, confidence: 0.75, method: 'heuristic' };
    }
  }

  // 4. Title/album/artist keyword scan.
  const haystack = normalizeText(`${content.title} ${content.album ?? ''} ${content.artist}`);
  const match = GENRE_KEYWORDS.find((g) => g.keywords.some((k) => haystack.includes(k)));
  if (match) {
    return { normalizedGenre: match.genre, confidence: 0.65, method: 'heuristic' };
  }

  // 5. Fall back to the content kind itself.
  const kindGenreMap: Record<ContentKind, string> = {
    music: 'unknown_music',
    podcast: 'podcast',
    madahi: 'noheh',
    speech: 'speech',
  };
  return { normalizedGenre: kindGenreMap[content.kind], confidence: 0.4, method: 'heuristic' };
}

let tfjsModelPromise: Promise<unknown> | null = null;

/**
 * Lazy-load the TF.js model. Returns null if the model is not available
 * (e.g. the bundle is missing or the wasm backend failed to init).
 */
async function loadTfjsModel(): Promise<unknown | null> {
  if (tfjsModelPromise) return tfjsModelPromise;
  tfjsModelModel = (async () => {
    try {
      // Dynamic import keeps the heavy TF.js bundle out of the main chunk.
      const tf = await import('@tensorflow/tfjs');
      await tf.ready();
      // TODO: load the actual model from /models/genre-classifier/model.json
      // For now, return null to indicate the model is unavailable.
      console.info('[CHYMUSIC] TF.js backend ready but no model bundled yet.');
      return null;
    } catch (err) {
      console.warn('[CHYMUSIC] TF.js model load failed:', err);
      return null;
    } finally {
      tfjsModelPromise = null;
    }
  })();
  return tfjsModelPromise;
}

// (Workaround for hoisting in the closure above.)
let tfjsModelModel: Promise<unknown> | null = null;

/**
 * Full hybrid classifier — heuristic first, TF.js fallback.
 *
 * @param content The content to classify.
 * @param audioBuffer Optional raw audio data for TF.js feature extraction.
 *                    If not provided, only the heuristic path runs.
 */
export async function classifyContent(
  content: Pick<Content, 'kind' | 'genre' | 'title' | 'album' | 'artist' | 'tags' | 'source' | 'sourceUrl'>,
  audioBuffer?: AudioBuffer,
): Promise<ClassifierResult> {
  const heuristic = classifyHeuristic(content);

  if (heuristic.confidence >= HEURISTIC_CONFIDENCE_THRESHOLD) {
    return heuristic;
  }

  if (!audioBuffer) {
    // No audio available — accept the heuristic result with its lower confidence.
    return heuristic;
  }

  const model = await loadTfjsModel();
  if (!model) {
    return heuristic;
  }

  // TODO: extract MFCC + chroma features from audioBuffer and run the model.
  // For now, return heuristic. This is a stub that will be filled in when the
  // model is trained and bundled.
  return heuristic;
}

/**
 * Compute a simple feature vector from an AudioBuffer for similarity comparison.
 *
 * Returns a 16-dim vector: [mean_volume, peak_volume, spectral_centroid_mean,
 * spectral_centroid_std, zero_crossing_rate_mean, zero_crossing_rate_std, ...]
 *
 * This is intentionally lightweight (no FFT) so it can run in real-time on
 * the main thread. For full MFCC/chroma we'd move to a Web Worker.
 */
export function computeFeatureVector(audio: AudioBuffer): number[] {
  const channel = audio.getChannelData(0);
  const sampleRate = audio.sampleRate;
  const length = channel.length;

  let sum = 0;
  let peak = 0;
  let zcr = 0;
  let prevSign = 0;
  for (let i = 0; i < length; i++) {
    const s = channel[i]!;
    sum += s * s;
    if (Math.abs(s) > peak) peak = Math.abs(s);
    const sign = s >= 0 ? 1 : -1;
    if (i > 0 && sign !== prevSign) zcr++;
    prevSign = sign;
  }
  const rms = Math.sqrt(sum / length);
  const zcrRate = zcr / (length / sampleRate);

  // Bucket the signal into 12 energy bands (rough chroma-like).
  const bands = 12;
  const bandSize = Math.floor(length / bands);
  const bandEnergies: number[] = [];
  for (let b = 0; b < bands; b++) {
    let e = 0;
    for (let i = b * bandSize; i < (b + 1) * bandSize && i < length; i++) {
      e += channel[i]! * channel[i]!;
    }
    bandEnergies.push(e / bandSize);
  }

  return [rms, peak, zcrRate, ...bandEnergies];
}

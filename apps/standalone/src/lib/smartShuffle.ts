/**
 * Smart shuffle engine — Spotify-style non-stop playback based on the user's
 * current listening + history + taste profile.
 *
 * Pipeline:
 *   1. Score every candidate track using:
 *      - genre similarity to the currently-playing track (40%)
 *      - artist match (30%)
 *      - listening history weight (20%)
 *      - novelty bonus for unplayed tracks (10%)
 *   2. Apply softmax with temperature to introduce controlled randomness.
 *   3. Sample N tracks without replacement.
 *
 * Runs entirely client-side on top of the local SQLite DB. No backend calls.
 */
import type { Content, ListeningProfile, PlayEvent } from '@chymusic/shared';
import { SMART_SHUFFLE_BATCH_SIZE, SMART_SHUFFLE_HISTORY_WINDOW } from '@chymusic/shared';

export interface ShuffleCandidate {
  content: Content;
  score: number;
  /** Components of the score, for debugging / "why this track?" UI. */
  breakdown: {
    genreSimilarity: number;
    artistMatch: number;
    historyWeight: number;
    noveltyBonus: number;
  };
}

export interface ShuffleContext {
  /** Currently playing track (or the last-played if between tracks). */
  current: Content;
  /** Full listening profile (top genres/artists/collections, computed from PlayEvents). */
  profile: ListeningProfile;
  /** Recent play events (most-recent-first), capped at SMART_SHUFFLE_HISTORY_WINDOW. */
  history: PlayEvent[];
  /** Pool of candidate tracks. The caller pre-filters (e.g. only `is_hidden = 0`). */
  candidates: Content[];
  /** Temperature for softmax sampling. Higher = more random. 0 = greedy. */
  temperature?: number;
  /** Already-played content IDs in this session (to avoid repeats). */
  recentlyPlayedIds?: string[];
}

/**
 * Compute a 0-1 similarity between two genre strings.
 *
 * Uses a simple token-overlap heuristic — both genres are normalized
 * (lowercase, split on non-alphanumeric) and we compute Jaccard similarity.
 *
 * Examples:
 *   'pop' vs 'pop'           → 1.0
 *   'persian pop' vs 'pop'   → 0.5
 *   'noheh' vs 'noheh'       → 1.0
 *   'rock' vs 'pop'          → 0.0
 */
export function genreSimilarity(a: string | undefined, b: string | undefined): number {
  if (!a || !b) return 0;
  const norm = (s: string) =>
    new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 0));
  const sa = norm(a);
  const sb = norm(b);
  let intersection = 0;
  for (const t of sa) if (sb.has(t)) intersection++;
  const union = sa.size + sb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Score a single candidate against the current context.
 * Returns a 0-1 score plus a breakdown.
 */
export function scoreCandidate(candidate: Content, ctx: ShuffleContext): ShuffleCandidate {
  const { current, profile, history } = ctx;

  // 1. Genre similarity to currently-playing track (40%)
  const genreSim = Math.max(
    genreSimilarity(candidate.normalizedGenre, current.normalizedGenre),
    genreSimilarity(candidate.genre, current.genre),
  );
  // Boost if the candidate's genre is in the user's top genres.
  const topGenreBoost = profile.topGenres.find((g) => g.genre === candidate.normalizedGenre);
  const genreScore = Math.min(1, genreSim * 0.7 + (topGenreBoost?.weight ?? 0) * 0.3);

  // 2. Artist match (30%)
  let artistScore = 0;
  if (candidate.artist === current.artist) artistScore = 1;
  else if (candidate.artists?.some((a) => current.artists?.includes(a))) artistScore = 0.6;
  else {
    const topArtist = profile.topArtists.find((a) => a.artist === candidate.artist);
    artistScore = Math.min(1, (topArtist?.weight ?? 0) * 0.5);
  }

  // 3. History weight (20%) — penalize over-played, reward recently-played-similar.
  const candidatePlays = history.filter((e) => e.contentId === candidate.id);
  const playCount = candidatePlays.length;
  // Diminishing returns: 0 plays = 0, 1 play = 0.3, 5 plays = 0.6, 20+ plays = 0.9.
  const historyScore = playCount === 0 ? 0 : Math.min(0.9, 0.3 + Math.log10(playCount + 1) * 0.3);
  // But cap how often the same track can reappear in a single shuffle round.
  const recentPenalty = ctx.recentlyPlayedIds?.includes(candidate.id) ? 0.5 : 1;

  // 4. Novelty bonus (10%) — favor tracks the user has never played.
  const noveltyScore = playCount === 0 ? 1 : 0;

  const score =
    (genreScore * 0.4 + artistScore * 0.3 + historyScore * 0.2 + noveltyScore * 0.1) *
    recentPenalty;

  return {
    content: candidate,
    score,
    breakdown: {
      genreSimilarity: genreScore,
      artistMatch: artistScore,
      historyWeight: historyScore,
      noveltyBonus: noveltyScore,
    },
  };
}

/**
 * Sample N tracks from the candidate pool using softmax with temperature.
 *
 * @param ctx Shuffle context
 * @param batchSize Number of tracks to sample (default: SMART_SHUFFLE_BATCH_SIZE)
 */
export function smartShuffle(ctx: ShuffleContext, batchSize = SMART_SHUFFLE_BATCH_SIZE): ShuffleCandidate[] {
  const temp = ctx.temperature ?? 0.6;
  const scored = ctx.candidates.map((c) => scoreCandidate(c, ctx));

  if (temp <= 0) {
    // Greedy: pick top-N by score.
    return scored.sort((a, b) => b.score - a.score).slice(0, batchSize);
  }

  // Softmax with temperature.
  const scaled = scored.map((s) => ({ ...s, scaledScore: s.score / temp }));
  const maxScaled = Math.max(...scaled.map((s) => s.scaledScore));
  const exps = scaled.map((s) => Math.exp(s.scaledScore - maxScaled));
  const sumExps = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sumExps);

  // Sample without replacement.
  const picked: ShuffleCandidate[] = [];
  const remaining = [...scaled.map((s, i) => ({ s, p: probs[i] }))];

  for (let i = 0; i < Math.min(batchSize, remaining.length); i++) {
    const totalP = remaining.reduce((acc, r) => acc + r.p, 0);
    let r = Math.random() * totalP;
    let idx = 0;
    for (let j = 0; j < remaining.length; j++) {
      r -= remaining[j]!.p;
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    picked.push(remaining[idx]!.s);
    remaining.splice(idx, 1);
  }

  return picked;
}

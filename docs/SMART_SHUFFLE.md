# CHYMUSIC Smart Shuffle

This document describes the recommender algorithm that powers smart shuffle in
the standalone PWA.

## Goals

- Produce a non-stop queue based on what the user is currently listening to +
  their full listening history.
- Run **100% client-side** on top of the local SQLite DB. No backend calls.
- Be explainable: the UI can show "why this track?" by surfacing the score
  breakdown.
- Be controllable: a `temperature` knob lets the user tradeoff between
  "play my favorites" (low temp) and "discover new music" (high temp).

## Algorithm

For each candidate track `c`, compute a score:

```
score(c) = (
    genreSimilarity(c, current) * 0.4 +
    artistMatch(c, current, profile) * 0.3 +
    historyWeight(c, profile, history) * 0.2 +
    noveltyBonus(c, history) * 0.1
  ) * recentPenalty(c, recentlyPlayed)
```

### 1. Genre similarity (40%)

`genreSimilarity(a, b)` returns a 0–1 Jaccard similarity between the
token sets of the two normalized genres.

If the candidate's `normalizedGenre` matches the user's top genres (from the
listening profile), add a 30% boost capped at 1.0.

### 2. Artist match (30%)

| Condition                                       | Score |
| ----------------------------------------------- | ----- |
| Candidate artist == current artist              | 1.0   |
| Candidate artists ∩ current artists (featured)  | 0.6   |
| Candidate artist in user's top artists          | 0.5 × artist weight |
| Otherwise                                       | 0.0   |

### 3. History weight (20%)

Rewards tracks the user has played before, with diminishing returns:

| Play count | Score |
| ---------- | ----- |
| 0          | 0.0   |
| 1          | 0.3   |
| 5          | 0.6   |
| 20+        | 0.9 (cap) |

Formula: `min(0.9, 0.3 + log10(playCount + 1) * 0.3)`.

### 4. Novelty bonus (10%)

Pure binary: 1.0 if the user has never played this track, 0.0 otherwise.
This is what makes smart shuffle feel fresh — even with heavy weights on
familiar music, ~10% of picks will be brand new.

### Recent penalty

If the candidate was already played in the current session (passed as
`recentlyPlayedIds`), multiply the score by 0.5. This prevents the same track
from reappearing too quickly.

### Softmax sampling

Given scores for all candidates, sample N tracks without replacement using
softmax with temperature:

```
exp(score / temp)
probability = -------------------
              sum(exp(score / temp))
```

- `temp = 0` → greedy (always pick top-N)
- `temp = 0.3` → mostly top tracks with some variety
- `temp = 0.6` (default) → balanced
- `temp = 1.0` → near-uniform random

After each pick, renormalize the remaining probabilities (without replacement).

## Why not collaborative filtering?

A real recommender (matrix factorization, two-tower neural net) needs many
users' data. CHYMUSIC is a single-user, client-side app — there's no server-side
aggregate signal to leverage. Content-based filtering (genre + artist + history)
is the right tool for this scale.

## Why TF.js for similarity?

The `featureVector` field on `Content` (16-dim, computed from the audio signal
itself) lets us compute cosine similarity between tracks even when their
metadata is sparse or in different languages. The vector is intentionally
lightweight (no FFT, just RMS + zero-crossing-rate + 12-band energy) so it can
be computed in real-time on the main thread during audio load.

For future iterations:
- Move to a Web Worker with full MFCC + chroma.
- Train a small TF.js autoencoder to compress the feature vector into a
  learned embedding.
- Add acoustic similarity to the score breakdown (replacing or augmenting
  genre similarity).

## Performance

For a 5000-track catalog:
- Scoring: 5000 × O(1) per candidate ≈ 5ms on a 2024 laptop
- Softmax sampling: O(N log N) for N picks
- Total: under 20ms per smart-shuffle batch

The recomputation of `ListeningProfile` (debounced after each `PlayEvent`) is
the more expensive step — for 1000 play events, it's about 50ms. We debounce
this to once every 30 seconds.

## Future work

1. **Session-aware weighting**: weight recent plays (last hour) more heavily
   than plays from months ago.
2. **Time-of-day patterns**: the user may prefer calm music at night and
   upbeat music in the morning.
3. **Skip-aware training**: a skip after 10 seconds is a stronger negative
   signal than a skip after 2 minutes.
4. **Cross-kind exploration**: if the user listens to a Noheh, occasionally
   recommend a related speech (different kind, same theme).

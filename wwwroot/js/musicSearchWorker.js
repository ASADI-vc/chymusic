let albums = [];
let tracks = [];
let readyPromise = null;

self.onmessage = async event => {
    const { type, query, requestId } = event.data;

    if (type === "init") {
        await ensureReady();
        self.postMessage({ type: "ready" });
        return;
    }

    if (type === "search") {
        await ensureReady();
        self.postMessage({ type: "result", requestId, payload: runSearch(query) });
    }
};

async function ensureReady() {
    if (readyPromise) {
        return readyPromise;
    }

    readyPromise = fetch("/data/search-index.json")
        .then(response => response.json())
        .then(payload => {
            albums = payload.albums || [];
            tracks = payload.tracks || [];
        });

    return readyPromise;
}

function runSearch(rawQuery) {
    const query = normalize(rawQuery);
    if (!query) {
        return { albums: [], tracks: [] };
    }

    const tokens = query.split(" ").filter(Boolean);
    if (!tokens.length) {
        return { albums: [], tracks: [] };
    }

    const albumResults = rank(albums, tokens, query, "album").slice(0, 14).map(item => ({
        albumId: item.albumId,
        title: item.title,
        artist: item.artist,
        genre: item.genre,
        coverImageUrl: item.coverImageUrl,
    }));

    const trackResults = rank(tracks, tokens, query, "track").slice(0, 20).map(item => ({
        albumId: item.albumId,
        trackId: item.trackId,
        index: item.index,
        title: item.title,
        albumTitle: item.albumTitle,
        artist: item.artist,
        genre: item.genre,
        coverImageUrl: item.coverImageUrl,
    }));

    return { albums: albumResults, tracks: trackResults };
}

function rank(items, tokens, query, type) {
    const results = [];

    for (const item of items) {
        const source = item.searchText;
        if (!source) {
            continue;
        }

        let score = 0;
        if (source.includes(query)) {
            score += type === "album" ? 28 : 34;
        }

        let allTokensMatch = true;
        for (const token of tokens) {
            if (source.includes(token)) {
                score += type === "album" ? 10 : 12;
            } else {
                allTokensMatch = false;
            }
        }

        if (!score) {
            continue;
        }

        if (allTokensMatch) {
            score += type === "album" ? 8 : 10;
        }

        score += Math.min(item.scoreHint || 0, 400) / 40;
        results.push({ ...item, score });
    }

    results.sort((left, right) => right.score - left.score || (right.scoreHint || 0) - (left.scoreHint || 0) || right.albumId - left.albumId);
    return results;
}

function normalize(value) {
    return (value || "")
        .trim()
        .toLowerCase()
        .replace(/[\-–/,;()]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

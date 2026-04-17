let worker;
let readyPromise;
let resolveReady;
let requestId = 0;
const pending = new Map();

export async function ensureReady() {
    if (readyPromise) {
        return readyPromise;
    }

    worker = new Worker("/js/musicSearchWorker.js");
    worker.onmessage = event => {
        const { type, requestId: resultId, payload } = event.data;
        if (type === "ready") {
            resolveReady?.();
            resolveReady = null;
            return;
        }

        if (type === "result" && pending.has(resultId)) {
            pending.get(resultId).resolve(payload);
            pending.delete(resultId);
        }
    };

    readyPromise = new Promise(resolve => {
        resolveReady = resolve;
        worker.postMessage({ type: "init" });
    });

    return readyPromise;
}

export async function search(query) {
    await ensureReady();

    return await new Promise(resolve => {
        const id = ++requestId;
        pending.set(id, { resolve });
        worker.postMessage({ type: "search", requestId: id, query });
    });
}

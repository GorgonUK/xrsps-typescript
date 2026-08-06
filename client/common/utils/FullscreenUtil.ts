/** Cross-browser fullscreen helpers (including Safari webkit prefixes). */

type DocumentWithWebkit = Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
};

type ElementWithWebkit = Element & {
    webkitRequestFullscreen?: () => Promise<void> | void;
};

export function getFullscreenElement(): Element | null {
    if (typeof document === "undefined") return null;
    const doc = document as DocumentWithWebkit;
    return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function isFullscreenActive(): boolean {
    return !!getFullscreenElement();
}

export async function requestAppFullscreen(
    target: Element = document.documentElement,
): Promise<boolean> {
    if (typeof document === "undefined") return false;
    if (isFullscreenActive()) return true;

    const el = target as ElementWithWebkit;
    try {
        if (typeof el.requestFullscreen === "function") {
            await el.requestFullscreen();
            return true;
        }
        if (typeof el.webkitRequestFullscreen === "function") {
            await el.webkitRequestFullscreen();
            return true;
        }
    } catch (err) {
        console.warn("[fullscreen] request failed", err);
    }
    return isFullscreenActive();
}

export async function exitAppFullscreen(): Promise<void> {
    if (typeof document === "undefined") return;
    if (!isFullscreenActive()) return;

    const doc = document as DocumentWithWebkit;
    try {
        if (typeof document.exitFullscreen === "function") {
            await document.exitFullscreen();
            return;
        }
        if (typeof doc.webkitExitFullscreen === "function") {
            await doc.webkitExitFullscreen();
        }
    } catch (err) {
        console.warn("[fullscreen] exit failed", err);
    }
}

export async function toggleAppFullscreen(
    target: Element = document.documentElement,
): Promise<boolean> {
    if (isFullscreenActive()) {
        await exitAppFullscreen();
        return false;
    }
    return requestAppFullscreen(target);
}

export function subscribeFullscreenChange(listener: () => void): () => void {
    if (typeof document === "undefined") return () => {};
    document.addEventListener("fullscreenchange", listener);
    document.addEventListener("webkitfullscreenchange", listener);
    return () => {
        document.removeEventListener("fullscreenchange", listener);
        document.removeEventListener("webkitfullscreenchange", listener);
    };
}

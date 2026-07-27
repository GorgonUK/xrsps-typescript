type AudioContextConstructor = {
    new (contextOptions?: AudioContextOptions): AudioContext;
};

const AUDIO_CONTEXT_RESUME_EVENTS: (keyof DocumentEventMap)[] = ["click", "keydown", "touchstart"];

/** One shared music graph — avoids N AudioContexts + forced 44.1→48 kHz resampling. */
let sharedMusicContext: AudioContext | null = null;
let sharedMusicResumeCleanup: (() => void) | null = null;
let sharedMusicWorkletPromise: Promise<void> | null = null;

/**
 * Page-lifecycle audio management.
 *
 * Web Audio contexts (especially AudioWorklet-driven ones) keep rendering audio while the
 * page is hidden or has been backgrounded/closed on mobile. On iOS WebKit the page is frozen
 * into the back/forward cache rather than torn down, so `dispose()`/`close()` never runs and
 * music keeps playing after the tab is closed. To prevent that we suspend every managed
 * context when the page becomes hidden (or is frozen/hidden via pagehide) and resume the ones
 * we auto-suspended when the page becomes visible again.
 */
const managedAudioContexts = new Set<AudioContext>();
const autoSuspendedAudioContexts = new Set<AudioContext>();
let audioLifecycleListenersInstalled = false;

function suspendManagedAudioContexts(): void {
    for (const ctx of managedAudioContexts) {
        if (ctx.state === "running") {
            autoSuspendedAudioContexts.add(ctx);
            ctx.suspend().catch(() => {});
        }
    }
}

function resumeAutoSuspendedAudioContexts(): void {
    for (const ctx of Array.from(autoSuspendedAudioContexts)) {
        autoSuspendedAudioContexts.delete(ctx);
        if (managedAudioContexts.has(ctx) && ctx.state === "suspended") {
            // Best effort: some browsers require a user gesture to resume. When resume is
            // rejected, the per-context interaction listeners added elsewhere recover on the
            // next tap/click.
            ctx.resume().catch(() => {});
        }
    }
}

function installAudioLifecycleListenersOnce(): void {
    if (audioLifecycleListenersInstalled) return;
    if (typeof document === "undefined" || typeof window === "undefined") return;
    audioLifecycleListenersInstalled = true;

    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") {
            suspendManagedAudioContexts();
        } else if (document.visibilityState === "visible") {
            resumeAutoSuspendedAudioContexts();
        }
    });
    // `pagehide` covers tab close, navigation, and mobile backgrounding (incl. bfcache).
    window.addEventListener("pagehide", () => suspendManagedAudioContexts());
    // Page Lifecycle API (Chromium): fired when a backgrounded page is frozen / thawed.
    document.addEventListener("freeze", () => suspendManagedAudioContexts());
    document.addEventListener("resume", () => resumeAutoSuspendedAudioContexts());
}

/**
 * Register an AudioContext so it is automatically suspended when the page is hidden/closed and
 * resumed when the page becomes visible again. Safe to call multiple times with the same context.
 */
export function registerManagedAudioContext(ctx: AudioContext | null | undefined): void {
    if (!ctx) return;
    managedAudioContexts.add(ctx);
    installAudioLifecycleListenersOnce();
}

/** Stop managing a context (call when the context is being closed/disposed). */
export function unregisterManagedAudioContext(ctx: AudioContext | null | undefined): void {
    if (!ctx) return;
    managedAudioContexts.delete(ctx);
    autoSuspendedAudioContexts.delete(ctx);
}

export function getAudioContextConstructor(): AudioContextConstructor | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }

    return window.AudioContext ?? window.webkitAudioContext;
}

export function addAudioContextResumeListeners(
    ctx: AudioContext,
    onRunning?: () => void,
): () => void {
    if (typeof document === "undefined") {
        return () => {};
    }

    let active = true;

    function cleanup(): void {
        if (!active) {
            return;
        }
        active = false;
        for (const eventType of AUDIO_CONTEXT_RESUME_EVENTS) {
            document.removeEventListener(eventType, listener);
        }
    }

    function listener(): void {
        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }
        if (ctx.state === "running") {
            cleanup();
            onRunning?.();
        }
    }

    for (const eventType of AUDIO_CONTEXT_RESUME_EVENTS) {
        document.addEventListener(eventType, listener);
    }

    return cleanup;
}

/**
 * Shared Web Audio context for all RealtimeMidiSynth instances.
 * Uses the device's native sample rate (usually 48000 on Windows) — do not force 44100.
 */
export function getSharedMusicAudioContext(): AudioContext | null {
    const AudioCtx = getAudioContextConstructor();
    if (!AudioCtx) {
        return null;
    }

    if (!sharedMusicContext || sharedMusicContext.state === "closed") {
        sharedMusicContext = new AudioCtx();
        sharedMusicWorkletPromise = null;
        if (sharedMusicResumeCleanup) {
            sharedMusicResumeCleanup();
            sharedMusicResumeCleanup = null;
        }
        sharedMusicResumeCleanup = addAudioContextResumeListeners(sharedMusicContext);
        registerManagedAudioContext(sharedMusicContext);
    }

    if (sharedMusicContext.state === "suspended") {
        sharedMusicContext.resume().catch(() => {});
    }

    return sharedMusicContext;
}

/**
 * Register the music worklet module once on the shared context.
 */
export async function ensureSharedMusicWorklet(
    getWorkletCode: () => Promise<string>,
): Promise<AudioContext> {
    const ctx = getSharedMusicAudioContext();
    if (!ctx) {
        throw new Error("Web Audio not supported");
    }

    if (!sharedMusicWorkletPromise) {
        sharedMusicWorkletPromise = (async () => {
            const code = await getWorkletCode();
            const blob = new Blob([code], { type: "application/javascript" });
            const url = URL.createObjectURL(blob);
            try {
                await ctx.audioWorklet.addModule(url);
            } finally {
                URL.revokeObjectURL(url);
            }
        })().catch((err) => {
            sharedMusicWorkletPromise = null;
            throw err;
        });
    }

    await sharedMusicWorkletPromise;
    return ctx;
}

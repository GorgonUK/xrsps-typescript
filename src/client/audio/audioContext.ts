type AudioContextConstructor = {
    new (contextOptions?: AudioContextOptions): AudioContext;
};

const AUDIO_CONTEXT_RESUME_EVENTS: (keyof DocumentEventMap)[] = ["click", "keydown", "touchstart"];

/** One shared music graph — avoids N AudioContexts + forced 44.1→48 kHz resampling. */
let sharedMusicContext: AudioContext | null = null;
let sharedMusicResumeCleanup: (() => void) | null = null;
let sharedMusicWorkletPromise: Promise<void> | null = null;

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
    }

    if (sharedMusicContext.state === "suspended") {
        sharedMusicContext.resume().catch(() => {});
    }

    return sharedMusicContext;
}

/**
 * Register the music worklet module once on the shared context.
 */
export async function ensureSharedMusicWorklet(getWorkletCode: () => Promise<string>): Promise<AudioContext> {
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

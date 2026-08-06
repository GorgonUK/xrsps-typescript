/**
 * Lock the visual viewport to landscape so rotating the device does not put
 * the game into portrait. Prefer the Screen Orientation API; callers should
 * invoke this from a user gesture (fullscreen / tap) because browsers often
 * reject lock() otherwise.
 */
export async function lockLandscapeOrientation(): Promise<boolean> {
    if (typeof window === "undefined" || !window.screen) return false;

    const orientation = window.screen.orientation as
        | (ScreenOrientation & {
              lock?: (orientation: string) => Promise<void>;
          })
        | undefined;

    if (!orientation || typeof orientation.lock !== "function") {
        return false;
    }

    try {
        await orientation.lock("landscape");
        return true;
    } catch {
        // Some engines only accept the more specific types.
        try {
            await orientation.lock("landscape-primary");
            return true;
        } catch (err) {
            console.warn("[orientation] lock failed", err);
            return false;
        }
    }
}

export async function unlockOrientation(): Promise<void> {
    if (typeof window === "undefined" || !window.screen) return;
    const orientation = window.screen.orientation as
        | (ScreenOrientation & { unlock?: () => void })
        | undefined;
    try {
        orientation?.unlock?.();
    } catch {}
}

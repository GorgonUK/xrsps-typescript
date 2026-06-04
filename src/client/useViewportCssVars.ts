import { useEffect } from "react";

import { readAppViewportSize } from "../util/DeviceUtil";

export function useViewportCssVars(): void {
    useEffect(() => {
        if (typeof window === "undefined" || typeof document === "undefined") {
            return;
        }

        const root = document.documentElement;
        let rafId: number | undefined;

        const applyViewportMetrics = () => {
            const { width, height } = readAppViewportSize();
            root.style.setProperty("--app-vw", `${width}px`);
            root.style.setProperty("--app-vh", `${height}px`);
        };

        const scheduleApply = () => {
            if (rafId !== undefined) {
                cancelAnimationFrame(rafId);
            }
            rafId = requestAnimationFrame(() => {
                rafId = undefined;
                applyViewportMetrics();
            });
        };

        scheduleApply();

        window.addEventListener("resize", scheduleApply);
        window.addEventListener("orientationchange", scheduleApply);
        window.addEventListener("pageshow", scheduleApply);
        document.addEventListener("visibilitychange", scheduleApply);

        const viewport = window.visualViewport;
        viewport?.addEventListener("resize", scheduleApply);
        viewport?.addEventListener("scroll", scheduleApply);

        return () => {
            window.removeEventListener("resize", scheduleApply);
            window.removeEventListener("orientationchange", scheduleApply);
            window.removeEventListener("pageshow", scheduleApply);
            document.removeEventListener("visibilitychange", scheduleApply);
            viewport?.removeEventListener("resize", scheduleApply);
            viewport?.removeEventListener("scroll", scheduleApply);
            if (rafId !== undefined) {
                cancelAnimationFrame(rafId);
            }
            root.style.removeProperty("--app-vw");
            root.style.removeProperty("--app-vh");
        };
    }, []);
}

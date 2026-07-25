export function resolveTradeActionQuantity(
    optionKey: string,
    available: number,
): number | undefined {
    const maximum = Math.max(0, Math.min(2_147_483_647, Math.floor(available)));
    if (maximum <= 0) return undefined;

    // The native trade-offer widget calls its one-item action "Remove"
    // (without the "-1" suffix used by its larger quantity actions).
    if (optionKey === "remove" || optionKey === "offer") return 1;
    if (optionKey.endsWith("all")) return maximum;
    if (optionKey.endsWith("10")) return Math.min(10, maximum);
    if (optionKey.endsWith("5")) return Math.min(5, maximum);
    if (optionKey.endsWith("1")) return 1;
    if (!optionKey.endsWith("x")) return undefined;

    const raw = globalThis.prompt?.("Enter amount:", "");
    if (raw === null || raw === undefined) return undefined;
    const match = raw
        .trim()
        .replace(/,/g, "")
        .toLowerCase()
        .match(/^(\d+(?:\.\d+)?)([kmb])?$/);
    if (!match) return undefined;
    const multiplier =
        match[2] === "b"
            ? 1_000_000_000
            : match[2] === "m"
              ? 1_000_000
              : match[2] === "k"
                ? 1_000
                : 1;
    const parsed = Math.floor(Number(match[1]) * multiplier);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) return undefined;
    return Math.min(maximum, parsed);
}

export function Marquee({ items }) {
  const row = items.join("  ✦  ") + "  ✦  ";
  return (
    <div
      className="select-none overflow-hidden border-y border-gold/15 bg-wine/90 py-3"
      data-testid="editorial-marquee"
    >
      <div className="animate-marquee flex w-max whitespace-nowrap">
        {[0, 1].map((i) => (
          <span
            key={i}
            aria-hidden={i === 1}
            className="px-4 font-display text-sm font-semibold tracking-[0.35em] text-cream/90 sm:text-base"
          >
            {row}{"  "}{row}
          </span>
        ))}
      </div>
    </div>
  );
}

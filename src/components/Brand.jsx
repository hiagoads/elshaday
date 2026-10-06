export function BrandMark({ size = 40, className = "" }) {
  return (
    <img
      src="/logo.jpeg"
      alt="Logotipo Banda El Shaday"
      width={size}
      height={size}
      className={`rounded-full object-cover ring-1 ring-gold/50 shadow-[0_0_18px_rgba(216,170,95,0.35)] ${className}`}
      data-testid="brand-logo"
    />
  );
}

export function BrandWord({ compact = false }) {
  return (
    <span className="leading-none text-left">
      {!compact && (
        <span className="block font-display text-[0.55rem] font-semibold tracking-[0.5em] text-cream/70">
          BANDA
        </span>
      )}
      <span className="block font-script text-2xl text-gold-gradient">El Shaday</span>
    </span>
  );
}

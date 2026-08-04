interface LogoProps {
  className?: string;
  showWordmark?: boolean;
}

/**
 * The GlobalNews AI mark: three concentric arcs converging on a point,
 * meant to read as a signal being tuned into focus \u2014 the same idea
 * echoed in the hero's "Signal Dial" motif.
 */
export function Logo({ className = '', showWordmark = true }: LogoProps): JSX.Element {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle cx="14" cy="14" r="2.5" fill="#6C93FF" />
        <path
          d="M8 14a6 6 0 0 1 12 0"
          stroke="#3D6FFF"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M4 14a10 10 0 0 1 20 0"
          stroke="#3D6FFF"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.45"
        />
      </svg>
      {showWordmark && (
        <span className="font-display text-lg font-medium tracking-tight text-ink-primary">
          GlobalNews <span className="text-signal-bright">AI</span>
        </span>
      )}
    </span>
  );
}

interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Mind OS official mark — The Quant Monad.
 * Chamfered metrology frame + outline diamond with nucleus focus.
 */
export default function Logo({ size = 24, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
      focusable="false"
    >
      {/* Chamfered outer frame — open gaps at top/bottom center */}
      <path
        d="M5 16 V8.5 L8.5 5 H15.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M16.8 5 H23.5 L27 8.5 V16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M27 16 V23.5 L23.5 27 H16.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M15.2 27 H8.5 L5 23.5 V16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />

      {/* Metrology tick marks in the top/bottom gaps */}
      <path
        d="M16 3.6 V5.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <path
        d="M16 26.6 V28.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />

      {/* Monad diamond — outline only */}
      <path
        d="M16 10.25 L21.75 16 L16 21.75 L10.25 16 Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="miter"
      />

      {/* Nucleus — neural focus anchor */}
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

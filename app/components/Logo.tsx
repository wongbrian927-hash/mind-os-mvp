interface LogoProps {
  size?: number;
  className?: string;
}

/**
 * Mind OS official mark — The Quant Monad.
 * Mathematically symmetric chamfered octagon + outline diamond + nucleus.
 * ViewBox: 0 0 32 32
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
      shapeRendering="geometricPrecision"
    >
      {/* Symmetric chamfered octagon frame */}
      <path
        d="M 8,2 L 24,2 L 30,8 L 30,24 L 24,30 L 8,30 L 2,24 L 2,8 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Metrology ticks — top / bottom center */}
      <path
        d="M 16,0 L 16,4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <path
        d="M 16,28 L 16,32"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />

      {/* Monad diamond — center-symmetric outline */}
      <path
        d="M 16,9 L 23,16 L 16,23 L 9,16 Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="miter"
        fill="none"
      />

      {/* Nucleus — neural focus anchor */}
      <circle cx="16" cy="16" r="1.25" fill="currentColor" />
    </svg>
  );
}

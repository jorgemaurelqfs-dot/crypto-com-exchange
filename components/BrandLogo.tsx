import Link from "next/link";

type BrandLogoProps = {
  compact?: boolean;
};

export default function BrandLogo({
  compact = false,
}: BrandLogoProps) {
  return (
    <Link
      href="/"
      className={`brandLogo ${compact ? "brandLogoCompact" : ""}`}
      aria-label="crypto-exchange — Home"
    >
      <span className="brandLogoMark" aria-hidden="true">
        <svg
          viewBox="0 0 64 64"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="cryptoExchangeGold"
              x1="8"
              y1="8"
              x2="56"
              y2="56"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#fff4c2" />
              <stop offset="0.28" stopColor="#e8c766" />
              <stop offset="0.58" stopColor="#c99b32" />
              <stop offset="1" stopColor="#8f6415" />
            </linearGradient>

            <linearGradient
              id="cryptoExchangeEdge"
              x1="12"
              y1="4"
              x2="52"
              y2="60"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="0.45" stopColor="#d4af37" stopOpacity="0.7" />
              <stop offset="1" stopColor="#6d4a0d" stopOpacity="0.5" />
            </linearGradient>

            <filter
              id="cryptoExchangeGlow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur
                stdDeviation="2.5"
                result="blur"
              />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer geometric shield */}
          <path
            d="M32 3L56 17V47L32 61L8 47V17L32 3Z"
            fill="#080b10"
            stroke="url(#cryptoExchangeEdge)"
            strokeWidth="1.5"
          />

          {/* Inner shield */}
          <path
            d="M32 9L50 19.5V42.5L32 53L14 42.5V19.5L32 9Z"
            fill="#0d1118"
            stroke="url(#cryptoExchangeGold)"
            strokeWidth="1"
            opacity="0.95"
          />

          {/* C shape */}
          <path
            d="M38.5 20.5C36.7 18.8 34.4 17.8 31.8 17.8C25.8 17.8 21 22.7 21 32C21 41.3 25.8 46.2 31.8 46.2C34.4 46.2 36.7 45.2 38.5 43.5"
            fill="none"
            stroke="url(#cryptoExchangeGold)"
            strokeWidth="4"
            strokeLinecap="round"
            filter="url(#cryptoExchangeGlow)"
          />

          {/* Exchange arrows / E geometry */}
          <path
            d="M29 24H43"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />

          <path
            d="M29 32H40"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />

          <path
            d="M29 40H43"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />

          {/* Exchange arrow */}
          <path
            d="M43 21L47 24L43 27"
            fill="none"
            stroke="url(#cryptoExchangeGold)"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d="M43 37L47 40L43 43"
            fill="none"
            stroke="url(#cryptoExchangeGold)"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Central highlight */}
          <circle
            cx="32"
            cy="32"
            r="1.5"
            fill="#ffffff"
            opacity="0.95"
          />
        </svg>
      </span>

      <span className="brandLogoText">
        <span className="brandLogoMain">
          crypto
        </span>
        <span className="brandLogoAccent">
          -exchange
        </span>
      </span>
    </Link>
  );
}
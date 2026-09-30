"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BrandLogo from "../components/BrandLogo";

type MarketAsset = {
  id: string;
  symbol: string;
  name: string;
  type: "platform" | "crypto";
  price: number | null;
  volume24h: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCap: number | null;
  rank: number | null;
  lastUpdated: string | null;
};

type MarketResponse = {
  success: boolean;
  updatedAt?: string;
  assets?: MarketAsset[];
  error?: string;
};

function formatPrice(price: number | null) {
  if (price === null) return "—";

  if (price >= 1000) {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (price >= 1) {
    return `$${price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }

  return `$${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })}`;
}

function formatPercentage(value: number | null) {
  if (value === null) return "—";

  const prefix = value >= 0 ? "+" : "";

  return `${prefix}${value.toFixed(2)}%`;
}

function getAsset(
  assets: MarketAsset[],
  symbol: string,
): MarketAsset | undefined {
  return assets.find((asset) => asset.symbol === symbol);
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [marketAssets, setMarketAssets] = useState<MarketAsset[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState("");

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    let mounted = true;

    const loadMarkets = async () => {
      try {
        const response = await fetch("/api/market", {
          cache: "no-store",
        });

        const data = (await response.json()) as MarketResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Unable to load market data.",
          );
        }

        if (mounted) {
          setMarketAssets(data.assets ?? []);
          setMarketError("");
          setMarketLoading(false);
        }
      } catch (error) {
        console.error("Market loading error:", error);

        if (mounted) {
          setMarketError(
            "Live market data temporarily unavailable.",
          );
          setMarketLoading(false);
        }
      }
    };

    loadMarkets();

    const interval = window.setInterval(
      loadMarkets,
      60_000,
    );

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const btc = useMemo(
    () => getAsset(marketAssets, "BTC"),
    [marketAssets],
  );

  const eth = useMemo(
    () => getAsset(marketAssets, "ETH"),
    [marketAssets],
  );

  const sol = useMemo(
    () => getAsset(marketAssets, "SOL"),
    [marketAssets],
  );

  const bnb = useMemo(
    () => getAsset(marketAssets, "BNB"),
    [marketAssets],
  );

  const cct = useMemo(
    () => getAsset(marketAssets, "CCT"),
    [marketAssets],
  );

  const tickerAssets = marketAssets.filter(
    (asset) => asset.symbol !== "CCT",
  );

  const lastUpdated = marketAssets.find(
    (asset) => asset.lastUpdated,
  )?.lastUpdated;

  return (
    <main className="site" id="top">
      {/* Background */}
      <div className="background" aria-hidden="true">
        <div className="grid" />
        <div className="orb orbOne" />
        <div className="orb orbTwo" />
        <div className="orb orbThree" />
        <div className="scanline" />
      </div>

      {/* Navigation */}
      <header className="navbar">
        <div className="navInner">
          <BrandLogo />

          <nav
            className={`navLinks ${
              menuOpen ? "mobileOpen" : ""
            }`}
          >
            <a href="#markets" onClick={closeMenu}>
              Markets
            </a>

            <a href="#exchange" onClick={closeMenu}>
              Exchange
            </a>

            <a
              href="#investments"
              onClick={closeMenu}
            >
              Investments
            </a>

            <a href="#security" onClick={closeMenu}>
              Security
            </a>

            <a href="#about" onClick={closeMenu}>
              About
            </a>
          </nav>

          <div className="navActions">
            <Link
              href="/login"
              className="loginButton"
            >
              Login
            </Link>

            <Link
              href="/register"
              className="navSignup"
            >
              Get Started
              <span>→</span>
            </Link>

            <button
              type="button"
              className={`menuButton ${
                menuOpen ? "active" : ""
              }`}
              onClick={() =>
                setMenuOpen((current) => !current)
              }
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="heroContent">
          <div className="eyebrow">
            <span className="statusDot" />
            LIVE DIGITAL ASSET PLATFORM
          </div>

          <h1>
            Build Your Future
            <br />
            With{" "}
            <span className="gradientText">
              Digital Assets.
            </span>
          </h1>

          <p className="heroDescription">
            Access a powerful digital asset platform
            designed for modern users. Explore live
            markets, manage digital assets and discover
            Crypto-com Token through secure financial
            infrastructure built for the future.
          </p>

          <div className="heroActions">
            <a
              href="#markets"
              className="primaryButton"
            >
              Explore Markets
              <span className="arrow">→</span>
            </a>

            <a
              href="#cct"
              className="secondaryButton"
            >
              Discover CCT
              <span className="arrow">↗</span>
            </a>
          </div>

          <div className="heroTrust">
            <div className="trustItem">
              <strong>
                {btc?.price
                  ? formatPrice(btc.price)
                  : "LIVE"}
              </strong>

              <span>BTC Market Price</span>
            </div>

            <div className="trustDivider" />

            <div className="trustItem">
              <strong>
                {marketAssets.length > 0
                  ? marketAssets.length
                  : "—"}
              </strong>

              <span>Supported Assets</span>
            </div>

            <div className="trustDivider" />

            <div className="trustItem">
              <strong>60 SEC</strong>
              <span>Market Refresh</span>
            </div>
          </div>
        </div>

        {/* Hero Visual */}
        <div className="heroVisual">
          <div className="visualGlow" />
          <div className="orbit orbitA" />
          <div className="orbit orbitB" />
          <div className="orbit orbitC" />

          <div className="dashboardCard">
            <div className="cardTop">
              <div>
                <span className="smallLabel">
                  BTC / USD
                </span>

                <div className="portfolioValue">
                  {marketLoading
                    ? "Loading..."
                    : formatPrice(
                        btc?.price ?? null,
                      )}
                </div>
              </div>

              <div className="cardIcon">₿</div>
            </div>

            <div className="chart">
              <svg
                viewBox="0 0 500 180"
                preserveAspectRatio="none"
                aria-hidden="true"
                style={{
                  width: "100%",
                  height: "100%",
                  position: "absolute",
                  inset: 0,
                }}
              >
                <defs>
                  <linearGradient
                    id="portfolioGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#36dda0"
                      stopOpacity="0.22"
                    />

                    <stop
                      offset="100%"
                      stopColor="#36dda0"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>

                <path
                  d="M0 145 C40 130 55 145 90 118 C125 90 145 125 180 96 C220 62 240 105 275 76 C315 45 330 82 360 58 C400 30 420 55 455 22 C470 12 485 15 500 5 L500 180 L0 180 Z"
                  fill="url(#portfolioGradient)"
                />

                <path
                  d="M0 145 C40 130 55 145 90 118 C125 90 145 125 180 96 C220 62 240 105 275 76 C315 45 330 82 360 58 C400 30 420 55 455 22 C470 12 485 15 500 5"
                  fill="none"
                  stroke="#36dda0"
                  strokeWidth="3"
                />
              </svg>

              <span className="point p1" />
              <span className="point p2" />
              <span className="point p3" />
              <span className="point p4" />
              <span className="point p5" />
              <span className="point p6" />
            </div>

            <div className="cardBottom">
              <div>
                <span>24H PERFORMANCE</span>

                <strong
                  className={
                    (btc?.change24h ?? 0) >= 0
                      ? "positive"
                      : ""
                  }
                >
                  {formatPercentage(
                    btc?.change24h ?? null,
                  )}
                </strong>
              </div>

              <div className="verified">
                <i />
                LIVE
              </div>
            </div>
          </div>

          <div className="floatingCard floatingOne">
            <div className="floatingIcon">₿</div>

            <div>
              <span>BITCOIN</span>

              <strong>
                {formatPrice(
                  btc?.price ?? null,
                )}
              </strong>
            </div>
          </div>

          <div className="floatingCard floatingTwo">
            <div className="floatingIcon shield">
              ◇
            </div>

            <div>
              <span>CCT TOKEN</span>

              <strong>
                {formatPrice(
                  cct?.price ?? null,
                )}
              </strong>
            </div>
          </div>

          <div className="floatingNumber">
            {formatPercentage(
              btc?.change24h ?? null,
            )}
          </div>
        </div>
      </section>

      {/* Live ticker */}
      <section
        className="ticker"
        id="markets"
      >
        <div className="tickerTrack">
          {[
            ...tickerAssets,
            ...tickerAssets,
          ].map((asset, index) => (
            <div
              key={`${asset.id}-${index}`}
            >
              {asset.symbol} / USD&nbsp;&nbsp;

              <strong>
                {formatPrice(asset.price)}
              </strong>

              &nbsp;&nbsp;

              <span
                className={
                  (asset.change24h ?? 0) < 0
                    ? ""
                    : "positive"
                }
              >
                {formatPercentage(
                  asset.change24h,
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Live Market Overview */}
      <section
        className="section"
        id="exchange"
      >
        <div className="sectionHeader">
          <div className="sectionTag">
            LIVE MARKETS
          </div>

          <h2>
            The Market.
            <br />

            <span className="gradientText">
              Updated In Real Time.
            </span>
          </h2>

          <p>
            Track leading digital assets with live
            market prices, daily performance and
            market capitalization data.
          </p>
        </div>

        <div className="featureGrid">
          {[btc, eth, sol, bnb].map(
            (asset, index) =>
              asset && (
                <article
                  className={`featureCard ${
                    index === 0
                      ? "featureLarge"
                      : ""
                  }`}
                  key={asset.id}
                >
                  <span className="featureNumber">
                    {String(index + 1).padStart(
                      2,
                      "0",
                    )}
                  </span>

                  <div
                    className={`featureIcon ${
                      index % 2 === 0
                        ? "blueIcon"
                        : "goldIcon"
                    }`}
                  >
                    {asset.symbol === "BTC"
                      ? "₿"
                      : asset.symbol === "ETH"
                        ? "◆"
                        : asset.symbol === "SOL"
                          ? "◇"
                          : "⬡"}
                  </div>

                  <h3>{asset.name}</h3>

                  <p>
                    {asset.symbol} / USD
                    <br />
                    Market Rank:{" "}
                    {asset.rank ?? "—"}
                  </p>

                  <div className="portfolioVisual">
                    <div className="miniBar barOne" />
                    <div className="miniBar barTwo" />
                    <div className="miniBar barThree" />
                    <div className="miniBar barFour" />
                    <div className="miniBar barFive" />
                  </div>

                  <div
                    style={{
                      marginTop: "18px",
                    }}
                  >
                    <strong>
                      {formatPrice(asset.price)}
                    </strong>

                    <div
                      className={
                        (asset.change24h ?? 0) >= 0
                          ? "positive"
                          : ""
                      }
                      style={{
                        marginTop: "6px",
                        fontSize: "0.9rem",
                      }}
                    >
                      24H{" "}
                      {formatPercentage(
                        asset.change24h,
                      )}
                    </div>
                  </div>
                </article>
              ),
          )}
        </div>

        <div
          style={{
            marginTop: "24px",
            textAlign: "center",
            fontSize: "0.8rem",
            opacity: 0.65,
          }}
        >
          {marketLoading
            ? "Loading live market data..."
            : marketError
              ? marketError
              : lastUpdated
                ? `Market data updated ${new Date(
                    lastUpdated,
                  ).toLocaleTimeString()}`
                : "Live market data active"}
        </div>
      </section>

      {/* CCT */}
      <section
        className="securitySection"
        id="cct"
      >
        <div>
          <div className="sectionTag">
            PLATFORM ASSET
          </div>

          <h2>
            Meet Crypto-com Token
            <br />

            <span className="gradientText">
              CCT.
            </span>
          </h2>

          <p>
            Crypto-com Token (CCT) is the internal
            platform asset of Crypto Com Exchange.
            CCT is designed to operate within the
            platform's future balance, purchase and
            swap infrastructure.
          </p>

          <div className="securityFeatures">
            <div>
              <span className="check">✓</span>
              Internal platform asset
            </div>

            <div>
              <span className="check">✓</span>
              Buy and hold CCT
            </div>

            <div>
              <span className="check">✓</span>
              Swap supported digital assets
            </div>

            <div>
              <span className="check">✓</span>
              Exchange CCT with supported assets
            </div>
          </div>

          <Link
            href="/register"
            className="securityButton"
          >
            Explore CCT
            <span>→</span>
          </Link>
        </div>

        <div className="securityVisual">
          <div className="securityCube">
            <div className="cubeFace cubeFront">
              <div className="bigShield">
                CCT
              </div>

              <span>
                CRYPTO-COM TOKEN
              </span>
            </div>

            <div className="cubeFace cubeRight" />
            <div className="cubeFace cubeTop" />
          </div>

          <div className="securityParticles">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      {/* CCT Market Card */}
      <section
        className="section"
        id="investments"
      >
        <div className="sectionHeader">
          <div className="sectionTag">
            CCT MARKET
          </div>

          <h2>
            One Platform.
            <br />

            <span className="gradientText">
              Multiple Digital Assets.
            </span>
          </h2>

          <p>
            Explore supported assets and the current
            platform reference value for CCT.
          </p>
        </div>

        <div className="featureGrid">
          <article className="featureCard featureLarge">
            <span className="featureNumber">
              CCT
            </span>

            <div className="featureIcon goldIcon">
              ◆
            </div>

            <h3>
              Crypto-com Token
            </h3>

            <p>
              Internal platform asset
            </p>

            <div
              style={{
                marginTop: "24px",
                fontSize: "2rem",
                fontWeight: 700,
              }}
            >
              {formatPrice(
                cct?.price ?? 1,
              )}
            </div>

            <div
              style={{
                marginTop: "8px",
                opacity: 0.65,
                fontSize: "0.8rem",
              }}
            >
              Current platform reference value
            </div>
          </article>

          <article className="featureCard">
            <span className="featureNumber">
              BTC
            </span>

            <div className="featureIcon blueIcon">
              ₿
            </div>

            <h3>Bitcoin</h3>

            <p>
              Live external market asset
            </p>

            <div
              style={{
                marginTop: "24px",
                fontSize: "1.8rem",
                fontWeight: 700,
              }}
            >
              {formatPrice(
                btc?.price ?? null,
              )}
            </div>

            <div
              className={
                (btc?.change24h ?? 0) >= 0
                  ? "positive"
                  : ""
              }
              style={{
                marginTop: "8px",
              }}
            >
              {formatPercentage(
                btc?.change24h ?? null,
              )}{" "}
              today
            </div>
          </article>

          <article className="featureCard">
            <span className="featureNumber">
              ETH
            </span>

            <div className="featureIcon blueIcon">
              ◆
            </div>

            <h3>Ethereum</h3>

            <p>
              Live external market asset
            </p>

            <div
              style={{
                marginTop: "24px",
                fontSize: "1.8rem",
                fontWeight: 700,
              }}
            >
              {formatPrice(
                eth?.price ?? null,
              )}
            </div>

            <div
              className={
                (eth?.change24h ?? 0) >= 0
                  ? "positive"
                  : ""
              }
              style={{
                marginTop: "8px",
              }}
            >
              {formatPercentage(
                eth?.change24h ?? null,
              )}{" "}
              today
            </div>
          </article>
        </div>
      </section>

      {/* How it works */}
      <section className="section processSection">
        <div className="sectionHeader center">
          <div className="sectionTag">
            HOW IT WORKS
          </div>

          <h2>
            Your Digital Future.
            <br />

            <span className="gradientText">
              Three Simple Steps.
            </span>
          </h2>

          <p>
            Move from account creation to managing
            digital assets through a streamlined
            experience.
          </p>
        </div>

        <div className="processGrid">
          <article className="processCard">
            <div className="processTop">
              <span>01</span>
            </div>

            <div className="processIcon">
              +
            </div>

            <h3>
              Create Your Account
            </h3>

            <p>
              Create your secure account and establish
              your digital finance profile.
            </p>
          </article>

          <div className="processLine" />

          <article className="processCard">
            <div className="processTop">
              <span>02</span>
            </div>

            <div className="processIcon">
              ↗
            </div>

            <h3>
              Fund Your Account
            </h3>

            <p>
              Add funds and access the tools needed to
              manage your supported digital assets.
            </p>
          </article>

          <div className="processLine" />

          <article className="processCard">
            <div className="processTop">
              <span>03</span>
            </div>

            <div className="processIcon">
              ◆
            </div>

            <h3>
              Trade &amp; Swap
            </h3>

            <p>
              Manage supported assets and exchange
              between available assets through the
              platform.
            </p>
          </article>
        </div>
      </section>

      {/* Security */}
      <section
        className="securitySection"
        id="security"
      >
        <div>
          <div className="sectionTag">
            SECURITY FIRST
          </div>

          <h2>
            Built With Security
            <br />

            <span className="gradientText">
              At Its Core.
            </span>
          </h2>

          <p>
            Your digital assets deserve serious
            protection. Our infrastructure is designed
            around layered security, monitoring and
            account protection.
          </p>

          <div className="securityFeatures">
            <div>
              <span className="check">✓</span>
              Multi-layer account protection
            </div>

            <div>
              <span className="check">✓</span>
              Secure asset infrastructure
            </div>

            <div>
              <span className="check">✓</span>
              Continuous platform monitoring
            </div>

            <div>
              <span className="check">✓</span>
              Advanced identity protection
            </div>
          </div>

          <Link
            href="/register"
            className="securityButton"
          >
            Create Account
            <span>→</span>
          </Link>
        </div>

        <div className="securityVisual">
          <div className="securityCube">
            <div className="cubeFace cubeFront">
              <div className="bigShield">
                ◇
              </div>

              <span>SECURE</span>
            </div>

            <div className="cubeFace cubeRight" />
            <div className="cubeFace cubeTop" />
          </div>

          <div className="securityParticles">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="ctaSection"
        id="signup"
      >
        <div className="ctaGlow" />

        <div className="ctaContent">
          <div className="sectionTag">
            THE DIGITAL ECONOMY
          </div>

          <h2>
            Explore the
            <br />

            <span className="gradientText">
              Future of Digital Assets.
            </span>
          </h2>

          <p>
            Create your account and experience a new
            generation of digital asset management.
          </p>

          <div className="ctaActions">
            <Link
              href="/register"
              className="primaryButton large"
            >
              Create Account
              <span className="arrow">
                →
              </span>
            </Link>

            <a
              href="#cct"
              className="secondaryButton"
            >
              Explore CCT
              <span className="arrow">
                ↗
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="footer"
        id="about"
      >
        <div className="footerInner">
          <div className="footerBrand">
            <BrandLogo />

            <p>
              Digital finance infrastructure for a
              new generation of digital asset users.
            </p>
          </div>

          <div className="footerLinks">
            <div>
              <span className="footerTitle">
                PLATFORM
              </span>

              <a href="#markets">
                Markets
              </a>

              <a href="#exchange">
                Exchange
              </a>

              <a href="#investments">
                Investments
              </a>
            </div>

            <div>
              <span className="footerTitle">
                ASSETS
              </span>

              <a href="#cct">
                CCT
              </a>

              <a href="#markets">
                Bitcoin
              </a>

              <a href="#markets">
                Ethereum
              </a>
            </div>

            <div>
              <span className="footerTitle">
                COMPANY
              </span>

              <a href="#about">
                About
              </a>

              <a href="#security">
                Security
              </a>

              <a href="#contact">
                Contact
              </a>
            </div>
          </div>
        </div>

        <div className="footerBottom">
          <span>
            © 2026 Crypto-Exchange. All rights reserved.
          </span>

          <span>
            Digital Finance Infrastructure
          </span>
        </div>
      </footer>
    </main>
  );
}
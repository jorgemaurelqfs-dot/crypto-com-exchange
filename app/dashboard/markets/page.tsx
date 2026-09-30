"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "../../../components/BrandLogo";
import { createClient } from "../../../lib/supabase/client";
import "../dashboard.css";

type MarketAsset = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h?: number;
  marketCap?: number;
};

type Profile = {
  account_id: string;
  username: string | null;
  full_name: string | null;
  account_status: string;
  verification_status: string;
};

type MarketApiResponse = {
  markets?: MarketAsset[];
  assets?: MarketAsset[];
  data?: MarketAsset[];
};

const FALLBACK_ASSETS = [
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "BNB", name: "BNB" },
  { symbol: "SOL", name: "Solana" },
  { symbol: "XRP", name: "XRP" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "ADA", name: "Cardano" },
  { symbol: "DOGE", name: "Dogecoin" },
  { symbol: "AVAX", name: "Avalanche" },
];

const assetIcons: Record<string, string> = {
  BTC: "₿",
  ETH: "Ξ",
  USDT: "₮",
  BNB: "◆",
  SOL: "S",
  XRP: "✕",
  USDC: "$",
  ADA: "₳",
  DOGE: "Ð",
  AVAX: "A",
  CCT: "C",
};

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return "—";

  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (value >= 1) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function formatCompact(value?: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  if (value >= 1_000_000_000_000) {
    return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  }

  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`;
  }

  return `$${value.toFixed(2)}`;
}

function formatUpdated(date: Date | null) {
  if (!date) return "Waiting for market data";

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function MarketsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [markets, setMarkets] = useState<MarketAsset[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "gainers" | "losers">("all");
  const [loading, setLoading] = useState(true);
  const [marketLoading, setMarketLoading] = useState(true);
  const [error, setError] = useState("");
  const [marketError, setMarketError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select(
        "account_id, username, full_name, account_status, verification_status"
      )
      .eq("id", user.id)
      .single();

    if (profileError) {
      setError(profileError.message);
    } else {
      setProfile(data);
    }

    setLoading(false);
  };

  const loadMarkets = async () => {
    setMarketLoading(true);
    setMarketError("");

    try {
      const response = await fetch("/api/market", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load current market data.");
      }

      const payload = (await response.json()) as MarketApiResponse;

      const receivedMarkets =
        payload.markets ?? payload.assets ?? payload.data ?? [];

      if (!Array.isArray(receivedMarkets)) {
        throw new Error("The market response has an invalid format.");
      }

      const normalized = receivedMarkets
        .filter(
          (asset) =>
            asset &&
            typeof asset.symbol === "string" &&
            typeof asset.name === "string"
        )
        .map((asset) => ({
          ...asset,
          symbol: asset.symbol.toUpperCase(),
          price: Number(asset.price),
          change24h: Number(asset.change24h ?? 0),
          volume24h:
            asset.volume24h !== undefined
              ? Number(asset.volume24h)
              : undefined,
          marketCap:
            asset.marketCap !== undefined
              ? Number(asset.marketCap)
              : undefined,
        }));

      setMarkets(normalized);
      setLastUpdated(new Date());
    } catch (marketLoadError) {
      const message =
        marketLoadError instanceof Error
          ? marketLoadError.message
          : "Unable to load market data.";

      setMarketError(message);
    } finally {
      setMarketLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
    loadMarkets();

    const interval = window.setInterval(() => {
      loadMarkets();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const externalMarkets = useMemo(() => {
    const knownSymbols = new Set(FALLBACK_ASSETS.map((asset) => asset.symbol));

    const matching = markets.filter((asset) =>
      knownSymbols.has(asset.symbol)
    );

    return FALLBACK_ASSETS.map((base) => {
      const live = matching.find((asset) => asset.symbol === base.symbol);

      return (
        live ?? {
          id: base.symbol,
          symbol: base.symbol,
          name: base.name,
          price: NaN,
          change24h: 0,
        }
      );
    });
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    const query = search.trim().toLowerCase();

    let result = externalMarkets.filter((asset) => {
      if (!query) return true;

      return (
        asset.symbol.toLowerCase().includes(query) ||
        asset.name.toLowerCase().includes(query)
      );
    });

    if (filter === "gainers") {
      result = result.filter((asset) => asset.change24h > 0);
    }

    if (filter === "losers") {
      result = result.filter((asset) => asset.change24h < 0);
    }

    return result;
  }, [externalMarkets, search, filter]);

  const gainers = externalMarkets.filter((asset) => asset.change24h > 0);
  const losers = externalMarkets.filter((asset) => asset.change24h < 0);

  const btc = externalMarkets.find((asset) => asset.symbol === "BTC");

  const displayName =
    profile?.full_name ||
    profile?.username ||
    "Investor";

  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

  if (loading) {
    return (
      <main className="dashboard-page">
        <div className="dashboard-background">
          <div className="dashboard-glow dashboard-glow-one" />
          <div className="dashboard-glow dashboard-glow-two" />
          <div className="dashboard-grid" />
        </div>

        <div className="loading-panel">
          <div className="large-spinner" />
          <p>Loading your markets...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page markets-page">
      <div className="dashboard-background">
        <div className="dashboard-glow dashboard-glow-one" />
        <div className="dashboard-glow dashboard-glow-two" />
        <div className="dashboard-grid" />
      </div>

      {sidebarOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`dashboard-sidebar ${sidebarOpen ? "open" : ""}`}
      >
        <div className="sidebar-brand">
          <BrandLogo compact />
          <button
            className="sidebar-close"
            type="button"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="account-mini-card">
          <div className="mini-avatar">{initials}</div>
          <div className="mini-account-info">
            <strong>{displayName}</strong>
            <span>{profile?.account_id || "CCT Account"}</span>
          </div>
          <span className="online-indicator" />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">PLATFORM</div>

          <nav className="sidebar-menu">
            <Link
              href="/dashboard"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">⌂</span>
              <span className="menu-label">Overview</span>
              <span className="menu-arrow">›</span>
            </Link>

            <Link
              href="/dashboard/wallet"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">◈</span>
              <span className="menu-label">Wallet</span>
              <span className="menu-arrow">›</span>
            </Link>

            <Link
              href="/dashboard/transactions"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">⇄</span>
              <span className="menu-label">Transactions</span>
              <span className="menu-arrow">›</span>
            </Link>

            <Link
              href="/dashboard/transfer"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">➤</span>
              <span className="menu-label">Transfer</span>
              <span className="menu-arrow">›</span>
            </Link>

            <Link
              href="/dashboard/deposit"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">↓</span>
              <span className="menu-label">Deposit</span>
              <span className="menu-arrow">›</span>
            </Link>

            <Link
              href="/dashboard/withdraw"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">↑</span>
              <span className="menu-label">Withdraw</span>
              <span className="menu-arrow">›</span>
            </Link>

            <Link
              href="/dashboard/investments"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">◉</span>
              <span className="menu-label">Investments</span>
              <span className="menu-arrow">›</span>
            </Link>

            <Link
              href="/dashboard/markets"
              className="sidebar-menu-item active"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">▥</span>
              <span className="menu-label">Markets</span>
              <span className="active-indicator" />
            </Link>

            <Link
              href="/dashboard/swap"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">⇄</span>
              <span className="menu-label">Swap</span>
              <span className="menu-arrow">›</span>
            </Link>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <Link
            href="/dashboard/settings"
            className="sidebar-menu-item settings-item"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="menu-icon">⚙</span>
            <span className="menu-label">Settings</span>
            <span className="menu-arrow">›</span>
          </Link>

          <button
            type="button"
            className="sidebar-menu-item logout-button"
            onClick={logout}
          >
            <span className="menu-icon">↪</span>
            <span className="menu-label">Sign Out</span>
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <button
              type="button"
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>

            <div>
              <div className="header-eyebrow">CRYPTO MARKETS</div>
              <h1>Markets</h1>
            </div>
          </div>

          <div className="header-actions">
            <Link
              href="/dashboard/swap"
              className="header-action-button"
            >
              <span>⇄</span>
              <span>Swap</span>
            </Link>

            <div className="header-account">
              <div className="account-info">
                <strong>{displayName}</strong>
                <span>{profile?.account_id || "CCT Account"}</span>
              </div>
              <div className="account-avatar">{initials}</div>
            </div>
          </div>
        </header>

        {error && (
          <div className="dashboard-alert error">
            <span>!</span>
            <p>{error}</p>
          </div>
        )}

        <section className="markets-welcome">
          <div className="markets-welcome-content">
            <span className="welcome-tag">LIVE MARKET DATA</span>
            <h2>Track the digital asset market.</h2>
            <p>
              Monitor supported crypto assets and keep an eye on market
              movement before swapping or managing your portfolio.
            </p>

            <div className="markets-live-status">
              <span className="markets-live-dot" />
              <span>
                {marketLoading
                  ? "Updating market data..."
                  : `Last updated ${formatUpdated(lastUpdated)}`}
              </span>
            </div>
          </div>

          <div className="markets-btc-card">
            <div className="markets-btc-top">
              <div className="markets-coin-icon btc">
                ₿
              </div>

              <div>
                <span>BITCOIN</span>
                <strong>BTC</strong>
              </div>
            </div>

            <div className="markets-btc-price">
              {btc && Number.isFinite(btc.price)
                ? `$${formatPrice(btc.price)}`
                : "—"}
            </div>

            <div
              className={`markets-change ${
                btc?.change24h && btc.change24h >= 0
                  ? "positive"
                  : "negative"
              }`}
            >
              {btc?.change24h !== undefined
                ? `${btc.change24h >= 0 ? "+" : ""}${btc.change24h.toFixed(
                    2
                  )}%`
                : "—"}
              <span>24h</span>
            </div>
          </div>
        </section>

        <section className="markets-stats-grid">
          <div className="markets-stat-card">
            <div className="markets-stat-icon">◈</div>
            <div>
              <span>TRACKED ASSETS</span>
              <strong>{externalMarkets.length}</strong>
            </div>
          </div>

          <div className="markets-stat-card">
            <div className="markets-stat-icon gain">↗</div>
            <div>
              <span>24H GAINERS</span>
              <strong>{gainers.length}</strong>
            </div>
          </div>

          <div className="markets-stat-card">
            <div className="markets-stat-icon loss">↘</div>
            <div>
              <span>24H LOSERS</span>
              <strong>{losers.length}</strong>
            </div>
          </div>

          <div className="markets-stat-card cct">
            <div className="markets-stat-icon cct-icon">C</div>
            <div>
              <span>CCT REFERENCE VALUE</span>
              <strong>$1.00</strong>
            </div>
          </div>
        </section>

        <section className="markets-cct-panel">
          <div className="markets-cct-mark">
            <div className="markets-cct-icon">C</div>
          </div>

          <div className="markets-cct-content">
            <div className="markets-cct-heading">
              <div>
                <span className="section-eyebrow">PLATFORM ASSET</span>
                <h3>Crypto Com Token</h3>
              </div>

              <span className="markets-internal-badge">
                INTERNAL ASSET
              </span>
            </div>

            <p>
              CCT is the internal asset used across the Crypto Com
              Exchange platform for transfers, investments and supported
              swap operations.
            </p>

            <div className="markets-cct-meta">
              <div>
                <span>SYMBOL</span>
                <strong>CCT</strong>
              </div>

              <div>
                <span>REFERENCE VALUE</span>
                <strong>$1.00</strong>
              </div>

              <div>
                <span>MARKET STATUS</span>
                <strong className="cct-status">
                  <span />
                  Platform Asset
                </strong>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/swap"
            className="markets-cct-action"
          >
            Swap Assets
            <span>→</span>
          </Link>
        </section>

        <section className="markets-section">
          <div className="markets-section-heading">
            <div>
              <span className="section-eyebrow">SUPPORTED ASSETS</span>
              <h2>Market Overview</h2>
            </div>

            <div className="markets-update-label">
              <span className="markets-live-dot" />
              Refreshes every 60 seconds
            </div>
          </div>

          <div className="markets-toolbar">
            <div className="markets-search">
              <span>⌕</span>
              <input
                type="text"
                placeholder="Search asset or symbol..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <div className="markets-filters">
              <button
                type="button"
                className={filter === "all" ? "active" : ""}
                onClick={() => setFilter("all")}
              >
                All Assets
              </button>

              <button
                type="button"
                className={filter === "gainers" ? "active" : ""}
                onClick={() => setFilter("gainers")}
              >
                Gainers
              </button>

              <button
                type="button"
                className={filter === "losers" ? "active" : ""}
                onClick={() => setFilter("losers")}
              >
                Losers
              </button>
            </div>
          </div>

          {marketError && (
            <div className="markets-data-warning">
              <div className="markets-warning-icon">!</div>
              <div>
                <strong>Market data temporarily unavailable</strong>
                <p>{marketError}</p>
              </div>

              <button
                type="button"
                onClick={loadMarkets}
              >
                Retry
              </button>
            </div>
          )}

          <div className="markets-table-card">
            <div className="markets-table-header">
              <span>ASSET</span>
              <span>PRICE</span>
              <span>24H CHANGE</span>
              <span>24H VOLUME</span>
              <span>MARKET CAP</span>
              <span />
            </div>

            {filteredMarkets.length === 0 ? (
              <div className="markets-empty">
                <div className="markets-empty-icon">⌕</div>
                <h3>No assets found</h3>
                <p>
                  Try a different asset name or symbol.
                </p>
              </div>
            ) : (
              filteredMarkets.map((asset) => {
                const isPositive = asset.change24h >= 0;
                const hasPrice = Number.isFinite(asset.price);

                return (
                  <div
                    className="markets-table-row"
                    key={asset.symbol}
                  >
                    <div className="markets-asset-cell">
                      <div
                        className={`markets-asset-icon ${asset.symbol.toLowerCase()}`}
                      >
                        {assetIcons[asset.symbol] || asset.symbol[0]}
                      </div>

                      <div>
                        <strong>{asset.name}</strong>
                        <span>{asset.symbol}</span>
                      </div>
                    </div>

                    <div className="markets-price-cell">
                      {hasPrice ? `$${formatPrice(asset.price)}` : "—"}
                    </div>

                    <div
                      className={`markets-change-cell ${
                        isPositive ? "positive" : "negative"
                      }`}
                    >
                      {hasPrice
                        ? `${isPositive ? "+" : ""}${asset.change24h.toFixed(
                            2
                          )}%`
                        : "—"}
                    </div>

                    <div className="markets-secondary-cell">
                      {formatCompact(asset.volume24h)}
                    </div>

                    <div className="markets-secondary-cell">
                      {formatCompact(asset.marketCap)}
                    </div>

                    <div className="markets-row-action">
                      <Link href="/dashboard/swap">
                        Swap
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="markets-bottom-grid">
          <div className="markets-info-card">
            <div className="markets-info-icon">◈</div>
            <div>
              <span className="section-eyebrow">MARKET DATA</span>
              <h3>Stay informed before you trade.</h3>
              <p>
                Market prices are refreshed periodically through the
                platform market-data service. Prices may change between
                updates.
              </p>
            </div>
          </div>

          <div className="markets-security-card">
            <div className="markets-security-icon">✓</div>
            <div>
              <span className="section-eyebrow">CCT ACCOUNT</span>
              <h3>Your platform balance remains separate.</h3>
              <p>
                External market prices do not directly change the CCT
                balance held in your internal wallet.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

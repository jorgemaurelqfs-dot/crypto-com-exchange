"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandLogo from "../../components/BrandLogo";
import { createClient } from "../../lib/supabase/client";
import "./dashboard.css";

type MarketAsset = {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
};

type Profile = {
  id: string;
  account_id: string;
  username: string | null;
  full_name: string | null;
  account_status: "active" | "suspended" | "closed";
  verification_status:
    | "unverified"
    | "pending"
    | "verified"
    | "rejected";
};

type Wallet = {
  id: string;
  user_id: string;
  asset_symbol: string;
  available_balance: number | string;
  locked_balance: number | string;
};

type Investment = {
  id: string;
  reference: string;
  principal_amount: number | string;
  expected_profit: number | string;
  earned_profit: number | string;
  status:
    | "pending"
    | "active"
    | "completed"
    | "cancelled";
};

const initialMarkets: MarketAsset[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: 0,
    change24h: 0,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    price: 0,
    change24h: 0,
  },
  {
    symbol: "SOL",
    name: "Solana",
    price: 0,
    change24h: 0,
  },
  {
    symbol: "BNB",
    name: "BNB",
    price: 0,
    change24h: 0,
  },
];

const platformMenu = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: "⌂",
  },
  {
    href: "/dashboard/wallet",
    label: "Wallet",
    icon: "◇",
  },
  {
    href: "/dashboard/markets",
    label: "Markets",
    icon: "↗",
  },
  {
    href: "/dashboard/swap",
    label: "Swap",
    icon: "⇄",
  },
  {
    href: "/dashboard/investments",
    label: "Investments",
    icon: "◈",
  },
];

const moneyMenu = [
  {
    href: "/dashboard/deposit",
    label: "Deposit",
    icon: "↓",
  },
  {
    href: "/dashboard/withdraw",
    label: "Withdraw",
    icon: "↑",
  },
  {
    href: "/dashboard/transfer",
    label: "Transfer",
    icon: "↔",
  },
  {
    href: "/dashboard/transactions",
    label: "Transactions",
    icon: "≡",
  },
];

function toNumber(
  value: number | string | null | undefined,
) {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [wallet, setWallet] =
    useState<Wallet | null>(null);

  const [investments, setInvestments] =
    useState<Investment[]>([]);

  const [markets, setMarkets] =
    useState<MarketAsset[]>(initialMarkets);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [databaseError, setDatabaseError] =
    useState("");

  useEffect(() => {
    const supabase = createClient();

    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setDatabaseError("");

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          router.replace("/login");
          return;
        }

        const userId = session.user.id;

        setEmail(session.user.email ?? "");

        /*
         * Metadata is used as an immediate fallback.
         * The actual profile data below comes from
         * public.profiles.
         */
        const metadata =
          session.user.user_metadata ?? {};

        setFullName(
          metadata.full_name ?? "",
        );

        setUsername(
          metadata.username ?? "",
        );

        /*
         * Load the authenticated user's profile,
         * CCT wallet and investments.
         *
         * RLS restricts these queries to the
         * authenticated user's own records.
         */
        const [
          profileResult,
          walletResult,
          investmentsResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              `
                id,
                account_id,
                username,
                full_name,
                account_status,
                verification_status
              `,
            )
            .eq("id", userId)
            .maybeSingle(),

          supabase
            .from("cct_wallets")
            .select(
              `
                id,
                user_id,
                asset_symbol,
                available_balance,
                locked_balance
              `,
            )
            .eq("user_id", userId)
            .maybeSingle(),

          supabase
            .from("investments")
            .select(
              `
                id,
                reference,
                principal_amount,
                expected_profit,
                earned_profit,
                status
              `,
            )
            .eq("user_id", userId)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (walletResult.error) {
          throw walletResult.error;
        }

        if (investmentsResult.error) {
          throw investmentsResult.error;
        }

        if (!mounted) {
          return;
        }

        if (profileResult.data) {
          setProfile(
            profileResult.data as Profile,
          );

          setFullName(
            profileResult.data.full_name ?? "",
          );

          setUsername(
            profileResult.data.username ?? "",
          );
        }

        if (walletResult.data) {
          setWallet(
            walletResult.data as Wallet,
          );
        }

        setInvestments(
          (investmentsResult.data ??
            []) as Investment[],
        );

        /*
         * Market data remains separate from the
         * account database.
         */
        try {
          const response = await fetch(
            "/api/market",
            {
              cache: "no-store",
            },
          );

          if (response.ok) {
            const data =
              await response.json();

            if (
              Array.isArray(data?.assets)
            ) {
              const apiAssets: MarketAsset[] =
                data.assets;

              setMarkets((current) =>
                current.map((market) => {
                  const found =
                    apiAssets.find(
                      (asset) =>
                        asset.symbol ===
                        market.symbol,
                    );

                  return found
                    ? {
                        ...market,
                        price:
                          found.price,
                        change24h:
                          found.change24h,
                      }
                    : market;
                }),
              );
            }
          }
        } catch {
          /*
           * Market data is optional.
           * The account dashboard should
           * continue working if the market
           * API is temporarily unavailable.
           */
        }
      } catch (error) {
        console.error(
          "Dashboard loading error:",
          error,
        );

        if (mounted) {
          setDatabaseError(
            "Unable to load your account data. Please refresh the page.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);

    const supabase = createClient();

    try {
      await supabase.auth.signOut();

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error(
        "Logout error:",
        error,
      );

      setLoggingOut(false);
    }
  }

  const displayName =
    profile?.full_name ||
    profile?.username ||
    fullName ||
    username ||
    email.split("@")[0] ||
    "User";

  const shortEmail =
    email.length > 28
      ? `${email.slice(0, 25)}...`
      : email;

  const availableBalance = toNumber(
    wallet?.available_balance,
  );

  const lockedBalance = toNumber(
    wallet?.locked_balance,
  );

  /*
   * Only active/pending investments are
   * considered currently invested.
   */
  const activeInvestments =
    investments.filter(
      (investment) =>
        investment.status === "active" ||
        investment.status === "pending",
    );

  const activeInvestmentAmount =
    activeInvestments.reduce(
      (total, investment) =>
        total +
        toNumber(
          investment.principal_amount,
        ),
      0,
    );

  const expectedInvestmentProfit =
    activeInvestments.reduce(
      (total, investment) =>
        total +
        toNumber(
          investment.expected_profit,
        ),
      0,
    );

  /*
   * CCT reference price is currently $1.00.
   *
   * Available + locked represents the user's
   * total CCT holdings. We do NOT add the
   * investment principal again because locked
   * CCT is already part of the wallet balance.
   */
  const totalCct =
    availableBalance + lockedBalance;

  const totalPortfolioValue = totalCct;

  function formatPrice(price: number) {
    if (!price) {
      return "—";
    }

    if (price >= 1000) {
      return `$${price.toLocaleString(
        undefined,
        {
          maximumFractionDigits: 2,
        },
      )}`;
    }

    return `$${price.toLocaleString(
      undefined,
      {
        maximumFractionDigits: 4,
      },
    )}`;
  }

  function formatCct(value: number) {
    return value.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8,
      },
    );
  }

  function formatUsd(value: number) {
    return `$${value.toLocaleString(
      undefined,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      },
    )}`;
  }

  return (
    <main className="dashboard-page">
      <div className="dashboard-background">
        <div className="dashboard-glow dashboard-glow-one" />
        <div className="dashboard-glow dashboard-glow-two" />
        <div className="dashboard-grid" />
      </div>

      {sidebarOpen && (
        <button
          type="button"
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      <aside
        className={`dashboard-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <BrandLogo compact />

          <button
            type="button"
            className="sidebar-close"
            onClick={() =>
              setSidebarOpen(false)
            }
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <div className="account-mini-card">
          <div className="mini-avatar">
            {displayName
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="mini-account-info">
            <strong>
              {displayName}
            </strong>

            <span>
              {profile?.account_id ||
                shortEmail}
            </span>
          </div>

          <span className="online-indicator" />
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">
            PLATFORM
          </p>

          <nav className="sidebar-menu">
            {platformMenu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-menu-item ${
                  item.href === "/dashboard"
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setSidebarOpen(false)
                }
              >
                <span className="menu-icon">
                  {item.icon}
                </span>

                <span className="menu-label">
                  {item.label}
                </span>

                {item.href ===
                  "/dashboard" && (
                  <span className="active-indicator" />
                )}
              </Link>
            ))}
          </nav>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">
            MONEY
          </p>

          <nav className="sidebar-menu">
            {moneyMenu.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="sidebar-menu-item"
                onClick={() =>
                  setSidebarOpen(false)
                }
              >
                <span className="menu-icon">
                  {item.icon}
                </span>

                <span className="menu-label">
                  {item.label}
                </span>

                <span className="menu-arrow">
                  ›
                </span>
              </Link>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <Link
            href="/dashboard/settings"
            className="sidebar-menu-item settings-item"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <span className="menu-icon">
              ⚙
            </span>

            <span className="menu-label">
              Settings
            </span>

            <span className="menu-arrow">
              ›
            </span>
          </Link>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <span className="menu-icon">
              ↪
            </span>

            <span>
              {loggingOut
                ? "Signing out..."
                : "Sign out"}
            </span>
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <button
              type="button"
              className="mobile-menu"
              onClick={() =>
                setSidebarOpen(true)
              }
              aria-label="Open navigation"
            >
              <span />
              <span />
              <span />
            </button>

            <div>
              <p className="header-eyebrow">
                CRYPTO COM EXCHANGE
              </p>

              <h1>Overview</h1>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="header-action-button"
              aria-label="Notifications"
            >
              <span>♢</span>
              <i />
            </button>

            <div className="header-account">
              <div className="account-info">
                <strong>
                  {displayName}
                </strong>

                <span>
                  {profile?.account_id ||
                    shortEmail}
                </span>
              </div>

              <div className="account-avatar">
                {displayName
                  .charAt(0)
                  .toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="loading-panel">
            <span className="large-spinner" />

            <p>
              Loading your dashboard...
            </p>
          </div>
        ) : (
          <>
            {databaseError && (
              <div
                style={{
                  marginBottom: "18px",
                  padding: "12px 16px",
                  border:
                    "1px solid rgba(255, 90, 90, 0.25)",
                  background:
                    "rgba(255, 70, 70, 0.08)",
                  color: "#ffb4b4",
                  borderRadius: "12px",
                  fontSize: "13px",
                }}
              >
                {databaseError}
              </div>
            )}

            <section className="welcome-row">
              <div className="welcome-content">
                <div className="welcome-tag">
                  <span />
                  ACCOUNT OVERVIEW
                </div>

                <h2>
                  Welcome back,
                  <span>
                    {" "}
                    {displayName}
                  </span>
                </h2>

                <p>
                  Manage your digital assets,
                  monitor markets and access
                  your CCT portfolio from one
                  secure dashboard.
                </p>
              </div>

              <div className="account-status">
                <span className="status-dot" />

                <div>
                  <strong>
                    {profile?.account_status ===
                    "active"
                      ? "Account active"
                      : `Account ${
                          profile?.account_status ||
                          "active"
                        }`}
                  </strong>

                  <small>
                    {profile?.verification_status ===
                    "verified"
                      ? "Verified account"
                      : profile?.verification_status ===
                          "pending"
                        ? "Verification pending"
                        : "Secure session"}
                  </small>
                </div>
              </div>
            </section>

            <section className="portfolio-grid">
              <div className="portfolio-card primary">
                <div className="card-glow" />

                <div className="card-header">
                  <div>
                    <p className="card-label">
                      TOTAL PORTFOLIO
                    </p>

                    <h3>
                      {formatUsd(
                        totalPortfolioValue,
                      )}
                    </h3>
                  </div>

                  <div className="portfolio-icon">
                    ◈
                  </div>
                </div>

                <div className="portfolio-footer">
                  <span>
                    Total CCT holdings
                  </span>

                  <strong>
                    {formatCct(totalCct)} CCT
                  </strong>
                </div>
              </div>

              <div className="portfolio-card">
                <div className="card-header">
                  <div>
                    <p className="card-label">
                      CCT BALANCE
                    </p>

                    <h3>
                      {formatCct(
                        availableBalance,
                      )}
                    </h3>
                  </div>

                  <div className="cct-badge">
                    CCT
                  </div>
                </div>

                <div className="portfolio-footer">
                  <span>
                    Available balance
                  </span>

                  <strong>
                    {formatUsd(
                      availableBalance,
                    )}
                  </strong>
                </div>
              </div>

              <div className="portfolio-card">
                <div className="card-header">
                  <div>
                    <p className="card-label">
                      INVESTMENTS
                    </p>

                    <h3>
                      {formatUsd(
                        activeInvestmentAmount,
                      )}
                    </h3>
                  </div>

                  <div className="investment-icon">
                    ↗
                  </div>
                </div>

                <div className="portfolio-footer">
                  <span>
                    {activeInvestments.length}{" "}
                    active{" "}
                    {activeInvestments.length ===
                    1
                      ? "investment"
                      : "investments"}
                  </span>

                  <strong>
                    +
                    {formatCct(
                      expectedInvestmentProfit,
                    )}{" "}
                    CCT
                  </strong>
                </div>
              </div>
            </section>

            <section className="quick-actions">
              <div className="section-heading">
                <div>
                  <p className="section-eyebrow">
                    QUICK ACTIONS
                  </p>

                  <h2>
                    Manage your assets
                  </h2>
                </div>
              </div>

              <div className="action-grid">
                <Link
                  href="/dashboard/deposit"
                  className="action-card"
                >
                  <div className="action-icon">
                    ↓
                  </div>

                  <div className="action-content">
                    <strong>
                      Deposit
                    </strong>

                    <span>
                      Add funds to your account
                    </span>
                  </div>

                  <span className="action-arrow">
                    →
                  </span>
                </Link>

                <Link
                  href="/dashboard/withdraw"
                  className="action-card"
                >
                  <div className="action-icon">
                    ↑
                  </div>

                  <div className="action-content">
                    <strong>
                      Withdraw
                    </strong>

                    <span>
                      Move assets from your wallet
                    </span>
                  </div>

                  <span className="action-arrow">
                    →
                  </span>
                </Link>

                <Link
                  href="/dashboard/transfer"
                  className="action-card"
                >
                  <div className="action-icon">
                    ↔
                  </div>

                  <div className="action-content">
                    <strong>
                      Transfer
                    </strong>

                    <span>
                      Send CCT to another user
                    </span>
                  </div>

                  <span className="action-arrow">
                    →
                  </span>
                </Link>

                <Link
                  href="/dashboard/investments"
                  className="action-card"
                >
                  <div className="action-icon">
                    ◈
                  </div>

                  <div className="action-content">
                    <strong>
                      Invest CCT
                    </strong>

                    <span>
                      Explore investment plans
                    </span>
                  </div>

                  <span className="action-arrow">
                    →
                  </span>
                </Link>
              </div>
            </section>

            <section className="market-section">
              <div className="section-heading market-heading">
                <div>
                  <p className="section-eyebrow">
                    LIVE MARKET
                  </p>

                  <h2>
                    Market overview
                  </h2>
                </div>

                <Link
                  href="/dashboard/markets"
                  className="view-all-button"
                >
                  View all markets
                  <span>→</span>
                </Link>
              </div>

              <div className="market-grid">
                {markets.map((market) => (
                  <div
                    className="market-card"
                    key={market.symbol}
                  >
                    <div className="market-top">
                      <div className="coin-symbol">
                        {market.symbol.charAt(
                          0,
                        )}
                      </div>

                      <div>
                        <strong>
                          {market.symbol}
                        </strong>

                        <span>
                          {market.name}
                        </span>
                      </div>
                    </div>

                    <div className="market-price">
                      <strong>
                        {formatPrice(
                          market.price,
                        )}
                      </strong>

                      <span
                        className={
                          market.change24h >=
                          0
                            ? "positive"
                            : "negative"
                        }
                      >
                        {market.change24h
                          ? `${
                              market.change24h >=
                              0
                                ? "+"
                                : ""
                            }${market.change24h.toFixed(
                              2,
                            )}%`
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="security-panel">
              <div className="security-symbol">
                ✓
              </div>

              <div className="security-content">
                <p className="section-eyebrow">
                  ACCOUNT SECURITY
                </p>

                <h2>
                  Your account is protected.
                </h2>

                <p>
                  Keep your login credentials
                  private and enable additional
                  security features when available.
                </p>
              </div>

              <Link
                href="/dashboard/settings"
                className="security-button"
              >
                Security settings
                <span>→</span>
              </Link>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
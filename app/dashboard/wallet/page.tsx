"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandLogo from "../../../components/BrandLogo";
import { createClient } from "../../../lib/supabase/client";
import "../dashboard.css";

type Wallet = {
  id: string;
  user_id: string;
  asset_symbol: string;
  available_balance: number | string;
  locked_balance: number | string;
};

type Profile = {
  account_id: string;
  username: string | null;
  full_name: string | null;
};

type Transaction = {
  id: string;
  reference: string;
  transaction_type:
    | "deposit"
    | "withdrawal"
    | "transfer_sent"
    | "transfer_received"
    | "investment"
    | "investment_return"
    | "swap_buy"
    | "swap_sell"
    | "adjustment";
  direction: "credit" | "debit";
  amount: number | string;
  balance_before: number | string | null;
  balance_after: number | string | null;
  description: string | null;
  status: string;
  created_at: string;
};

function toNumber(
  value: number | string | null | undefined,
) {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCct(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  });
}

function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function transactionLabel(
  type: Transaction["transaction_type"],
) {
  switch (type) {
    case "deposit":
      return "Deposit";

    case "withdrawal":
      return "Withdrawal";

    case "transfer_sent":
      return "Transfer sent";

    case "transfer_received":
      return "Transfer received";

    case "investment":
      return "Investment";

    case "investment_return":
      return "Investment return";

    case "swap_buy":
      return "Swap purchase";

    case "swap_sell":
      return "Swap sale";

    case "adjustment":
      return "Account adjustment";

    default:
      return "Transaction";
  }
}

function transactionIcon(
  type: Transaction["transaction_type"],
) {
  switch (type) {
    case "deposit":
      return "↓";

    case "withdrawal":
      return "↑";

    case "transfer_sent":
      return "↗";

    case "transfer_received":
      return "↙";

    case "investment":
      return "◈";

    case "investment_return":
      return "◆";

    case "swap_buy":
      return "⇄";

    case "swap_sell":
      return "⇄";

    case "adjustment":
      return "✦";

    default:
      return "•";
  }
}

export default function WalletPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [wallet, setWallet] =
    useState<Wallet | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    const supabase = createClient();

    let mounted = true;

    async function loadWallet() {
      try {
        setLoading(true);
        setErrorMessage("");

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

        const [
          walletResult,
          profileResult,
          transactionsResult,
        ] = await Promise.all([
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
            .from("profiles")
            .select(
              `
                account_id,
                username,
                full_name
              `,
            )
            .eq("id", userId)
            .maybeSingle(),

          supabase
            .from("transactions")
            .select(
              `
                id,
                reference,
                transaction_type,
                direction,
                amount,
                balance_before,
                balance_after,
                description,
                status,
                created_at
              `,
            )
            .eq("user_id", userId)
            .order("created_at", {
              ascending: false,
            })
            .limit(10),
        ]);

        if (walletResult.error) {
          throw walletResult.error;
        }

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (transactionsResult.error) {
          throw transactionsResult.error;
        }

        if (!mounted) {
          return;
        }

        setWallet(
          walletResult.data as Wallet | null,
        );

        setProfile(
          profileResult.data as Profile | null,
        );

        setTransactions(
          (transactionsResult.data ??
            []) as Transaction[],
        );
      } catch (error) {
        console.error(
          "Wallet loading error:",
          error,
        );

        if (mounted) {
          setErrorMessage(
            "Unable to load your wallet. Please refresh the page.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadWallet();

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

  const availableBalance = toNumber(
    wallet?.available_balance,
  );

  const lockedBalance = toNumber(
    wallet?.locked_balance,
  );

  const totalBalance =
    availableBalance + lockedBalance;

  const availablePercentage =
    totalBalance > 0
      ? (availableBalance / totalBalance) *
        100
      : 0;

  const lockedPercentage =
    totalBalance > 0
      ? (lockedBalance / totalBalance) *
        100
      : 0;

  const displayName =
    profile?.full_name ||
    profile?.username ||
    "Investor";

  const accountId =
    profile?.account_id || "—";

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

            <span>{accountId}</span>
          </div>

          <span className="online-indicator" />
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">
            PLATFORM
          </p>

          <nav className="sidebar-menu">
            <Link
              href="/dashboard"
              className="sidebar-menu-item"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ⌂
              </span>

              <span className="menu-label">
                Overview
              </span>
            </Link>

            <Link
              href="/dashboard/wallet"
              className="sidebar-menu-item active"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ◇
              </span>

              <span className="menu-label">
                Wallet
              </span>

              <span className="active-indicator" />
            </Link>

            <Link
              href="/dashboard/markets"
              className="sidebar-menu-item"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ↗
              </span>

              <span className="menu-label">
                Markets
              </span>
            </Link>

            <Link
              href="/dashboard/swap"
              className="sidebar-menu-item"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ⇄
              </span>

              <span className="menu-label">
                Swap
              </span>
            </Link>

            <Link
              href="/dashboard/investments"
              className="sidebar-menu-item"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ◈
              </span>

              <span className="menu-label">
                Investments
              </span>
            </Link>
          </nav>
        </div>

        <div className="sidebar-section">
          <p className="sidebar-label">
            MONEY
          </p>

          <nav className="sidebar-menu">
            <Link
              href="/dashboard/deposit"
              className="sidebar-menu-item"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ↓
              </span>

              <span className="menu-label">
                Deposit
              </span>

              <span className="menu-arrow">
                ›
              </span>
            </Link>

            <Link
              href="/dashboard/withdraw"
              className="sidebar-menu-item"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ↑
              </span>

              <span className="menu-label">
                Withdraw
              </span>

              <span className="menu-arrow">
                ›
              </span>
            </Link>

            <Link
              href="/dashboard/transfer"
              className="sidebar-menu-item"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ↔
              </span>

              <span className="menu-label">
                Transfer
              </span>

              <span className="menu-arrow">
                ›
              </span>
            </Link>

            <Link
              href="/dashboard/transactions"
              className="sidebar-menu-item"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ≡
              </span>

              <span className="menu-label">
                Transactions
              </span>

              <span className="menu-arrow">
                ›
              </span>
            </Link>
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

              <h1>Wallet</h1>
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
                  {accountId}
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
              Loading your wallet...
            </p>
          </div>
        ) : (
          <>
            {errorMessage && (
              <div
                style={{
                  marginBottom: "20px",
                  padding: "14px 18px",
                  border:
                    "1px solid rgba(255, 90, 90, 0.25)",
                  background:
                    "rgba(255, 70, 70, 0.08)",
                  color: "#ffb4b4",
                  borderRadius: "12px",
                  fontSize: "13px",
                }}
              >
                {errorMessage}
              </div>
            )}

            <section className="welcome-row">
              <div className="welcome-content">
                <div className="welcome-tag">
                  <span />
                  CCT WALLET
                </div>

                <h2>
                  Your digital asset wallet
                </h2>

                <p>
                  View your CCT holdings,
                  available balance, locked
                  balance and recent wallet
                  activity.
                </p>
              </div>

              <div className="account-status">
                <span className="status-dot" />

                <div>
                  <strong>
                    Wallet active
                  </strong>

                  <small>
                    {accountId}
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
                      TOTAL CCT
                    </p>

                    <h3>
                      {formatCct(
                        totalBalance,
                      )}
                    </h3>
                  </div>

                  <div className="portfolio-icon">
                    ◈
                  </div>
                </div>

                <div className="portfolio-footer">
                  <span>
                    Reference value
                  </span>

                  <strong>
                    {formatUsd(
                      totalBalance,
                    )}
                  </strong>
                </div>
              </div>

              <div className="portfolio-card">
                <div className="card-header">
                  <div>
                    <p className="card-label">
                      AVAILABLE
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
                    Ready to use
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
                      LOCKED
                    </p>

                    <h3>
                      {formatCct(
                        lockedBalance,
                      )}
                    </h3>
                  </div>

                  <div className="investment-icon">
                    ◇
                  </div>
                </div>

                <div className="portfolio-footer">
                  <span>
                    Invested / reserved
                  </span>

                  <strong>
                    {formatUsd(
                      lockedBalance,
                    )}
                  </strong>
                </div>
              </div>
            </section>

            <section className="quick-actions">
              <div className="section-heading">
                <div>
                  <p className="section-eyebrow">
                    WALLET ACTIONS
                  </p>

                  <h2>
                    Manage your CCT
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
                      Put your CCT to work
                    </span>
                  </div>

                  <span className="action-arrow">
                    →
                  </span>
                </Link>
              </div>
            </section>

            <section
              className="security-panel"
              style={{
                marginBottom: "28px",
              }}
            >
              <div className="security-symbol">
                C
              </div>

              <div className="security-content">
                <p className="section-eyebrow">
                  CCT WALLET
                </p>

                <h2>
                  Crypto Com Token
                </h2>

                <p>
                  Your CCT wallet is an internal
                  platform wallet. The current
                  reference value is $1.00 per
                  CCT.
                </p>
              </div>

              <div
                className="security-button"
                style={{
                  cursor: "default",
                }}
              >
                1 CCT = $1.00
              </div>
            </section>

            <section className="market-section">
              <div className="section-heading market-heading">
                <div>
                  <p className="section-eyebrow">
                    BALANCE BREAKDOWN
                  </p>

                  <h2>
                    CCT allocation
                  </h2>
                </div>
              </div>

              <div
                className="market-grid"
                style={{
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                }}
              >
                <div className="market-card">
                  <div className="market-top">
                    <div className="coin-symbol">
                      A
                    </div>

                    <div>
                      <strong>
                        Available CCT
                      </strong>

                      <span>
                        Immediately available
                      </span>
                    </div>
                  </div>

                  <div className="market-price">
                    <strong>
                      {formatCct(
                        availableBalance,
                      )}
                    </strong>

                    <span className="positive">
                      {availablePercentage.toFixed(
                        1,
                      )}
                      %
                    </span>
                  </div>
                </div>

                <div className="market-card">
                  <div className="market-top">
                    <div className="coin-symbol">
                      L
                    </div>

                    <div>
                      <strong>
                        Locked CCT
                      </strong>

                      <span>
                        Currently reserved
                      </span>
                    </div>
                  </div>

                  <div className="market-price">
                    <strong>
                      {formatCct(
                        lockedBalance,
                      )}
                    </strong>

                    <span className="positive">
                      {lockedPercentage.toFixed(
                        1,
                      )}
                      %
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section
              className="market-section"
              style={{
                marginTop: "32px",
              }}
            >
              <div className="section-heading market-heading">
                <div>
                  <p className="section-eyebrow">
                    WALLET ACTIVITY
                  </p>

                  <h2>
                    Recent transactions
                  </h2>
                </div>

                <Link
                  href="/dashboard/transactions"
                  className="view-all-button"
                >
                  View all
                  <span>→</span>
                </Link>
              </div>

              {transactions.length ===
              0 ? (
                <div
                  className="security-panel"
                  style={{
                    marginBottom: "0",
                  }}
                >
                  <div className="security-symbol">
                    ≡
                  </div>

                  <div className="security-content">
                    <p className="section-eyebrow">
                      NO ACTIVITY
                    </p>

                    <h2>
                      No transactions yet
                    </h2>

                    <p>
                      Your CCT wallet activity
                      will appear here once
                      transactions are recorded.
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className="transaction-list"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {transactions.map(
                    (transaction) => {
                      const amount =
                        toNumber(
                          transaction.amount,
                        );

                      const isCredit =
                        transaction.direction ===
                        "credit";

                      return (
                        <div
                          key={transaction.id}
                          className="market-card"
                          style={{
                            display: "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "space-between",
                            gap: "18px",
                          }}
                        >
                          <div
                            className="market-top"
                            style={{
                              flex: 1,
                            }}
                          >
                            <div className="coin-symbol">
                              {transactionIcon(
                                transaction.transaction_type,
                              )}
                            </div>

                            <div>
                              <strong>
                                {transactionLabel(
                                  transaction.transaction_type,
                                )}
                              </strong>

                              <span>
                                {transaction.description ||
                                  formatDateTime(
                                    transaction.created_at,
                                  )}
                              </span>
                            </div>
                          </div>

                          <div
                            style={{
                              textAlign:
                                "right",
                            }}
                          >
                            <strong
                              className={
                                isCredit
                                  ? "positive"
                                  : "negative"
                              }
                              style={{
                                display:
                                  "block",
                                fontSize:
                                  "15px",
                                marginBottom:
                                  "4px",
                              }}
                            >
                              {isCredit
                                ? "+"
                                : "-"}
                              {formatCct(
                                amount,
                              )}{" "}
                              CCT
                            </strong>

                            <span
                              style={{
                                display:
                                  "block",
                                fontSize:
                                  "11px",
                                opacity: 0.55,
                              }}
                            >
                              {formatDate(
                                transaction.created_at,
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </section>
    </main>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandLogo from "../../../components/BrandLogo";
import { createClient } from "../../../lib/supabase/client";
import "../dashboard.css";

type TransactionType =
  | "deposit"
  | "withdrawal"
  | "transfer_sent"
  | "transfer_received"
  | "investment"
  | "investment_return"
  | "swap_buy"
  | "swap_sell"
  | "adjustment";

type Transaction = {
  id: string;
  reference: string;
  transaction_type: TransactionType;
  direction: "credit" | "debit";
  amount: number | string;
  balance_before: number | string | null;
  balance_after: number | string | null;
  description: string | null;
  status: string;
  created_at: string;
};

type Profile = {
  account_id: string;
  username: string | null;
  full_name: string | null;
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
  type: TransactionType,
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
  type: TransactionType,
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

function statusLabel(status: string) {
  if (status === "completed") {
    return "Completed";
  }

  if (status === "pending") {
    return "Pending";
  }

  if (status === "failed") {
    return "Failed";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  return status;
}

function statusClass(status: string) {
  if (status === "completed") {
    return "transaction-status completed";
  }

  if (status === "pending") {
    return "transaction-status pending";
  }

  if (status === "failed") {
    return "transaction-status failed";
  }

  if (status === "cancelled") {
    return "transaction-status cancelled";
  }

  return "transaction-status";
}

export default function TransactionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [transactions, setTransactions] =
    useState<Transaction[]>([]);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] =
    useState<"all" | "credit" | "debit">(
      "all",
    );

  const [typeFilter, setTypeFilter] =
    useState<"all" | TransactionType>("all");

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    const supabase = createClient();

    let mounted = true;

    async function loadTransactions() {
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
          profileResult,
          transactionsResult,
        ] = await Promise.all([
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
            }),
        ]);

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (transactionsResult.error) {
          throw transactionsResult.error;
        }

        if (!mounted) {
          return;
        }

        setProfile(
          profileResult.data as Profile | null,
        );

        setTransactions(
          (transactionsResult.data ??
            []) as Transaction[],
        );
      } catch (error) {
        console.error(
          "Transactions loading error:",
          error,
        );

        if (mounted) {
          setErrorMessage(
            "Unable to load your transactions. Please refresh the page.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTransactions();

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

  const filteredTransactions =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      return transactions.filter(
        (transaction) => {
          const matchesDirection =
            filter === "all" ||
            transaction.direction === filter;

          const matchesType =
            typeFilter === "all" ||
            transaction.transaction_type ===
              typeFilter;

          const searchableText = [
            transaction.reference,
            transaction.description ?? "",
            transactionLabel(
              transaction.transaction_type,
            ),
            transaction.status,
          ]
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !normalizedSearch ||
            searchableText.includes(
              normalizedSearch,
            );

          return (
            matchesDirection &&
            matchesType &&
            matchesSearch
          );
        },
      );
    }, [
      transactions,
      search,
      filter,
      typeFilter,
    ]);

  const totalCredits = transactions
    .filter(
      (transaction) =>
        transaction.direction === "credit",
    )
    .reduce(
      (total, transaction) =>
        total +
        toNumber(transaction.amount),
      0,
    );

  const totalDebits = transactions
    .filter(
      (transaction) =>
        transaction.direction === "debit",
    )
    .reduce(
      (total, transaction) =>
        total +
        toNumber(transaction.amount),
      0,
    );

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
              className="sidebar-menu-item"
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
              className="sidebar-menu-item active"
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

              <span className="active-indicator" />
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

              <h1>Transactions</h1>
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
              Loading your transactions...
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
                  TRANSACTION HISTORY
                </div>

                <h2>
                  Your CCT activity
                </h2>

                <p>
                  Review deposits, withdrawals,
                  transfers, investments and
                  other activity recorded on your
                  account.
                </p>
              </div>

              <div className="account-status">
                <span className="status-dot" />

                <div>
                  <strong>
                    Ledger protected
                  </strong>

                  <small>
                    {transactions.length}{" "}
                    transaction
                    {transactions.length ===
                    1
                      ? ""
                      : "s"}
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
                      TOTAL ACTIVITY
                    </p>

                    <h3>
                      {transactions.length}
                    </h3>
                  </div>

                  <div className="portfolio-icon">
                    ≡
                  </div>
                </div>

                <div className="portfolio-footer">
                  <span>
                    Recorded transactions
                  </span>

                  <strong>
                    CCT Ledger
                  </strong>
                </div>
              </div>

              <div className="portfolio-card">
                <div className="card-header">
                  <div>
                    <p className="card-label">
                      TOTAL CREDITS
                    </p>

                    <h3>
                      {formatCct(
                        totalCredits,
                      )}
                    </h3>
                  </div>

                  <div className="cct-badge">
                    +
                  </div>
                </div>

                <div className="portfolio-footer">
                  <span>
                    CCT received
                  </span>

                  <strong>
                    CCT
                  </strong>
                </div>
              </div>

              <div className="portfolio-card">
                <div className="card-header">
                  <div>
                    <p className="card-label">
                      TOTAL DEBITS
                    </p>

                    <h3>
                      {formatCct(
                        totalDebits,
                      )}
                    </h3>
                  </div>

                  <div className="investment-icon">
                    −
                  </div>
                </div>

                <div className="portfolio-footer">
                  <span>
                    CCT used or sent
                  </span>

                  <strong>
                    CCT
                  </strong>
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
                    LEDGER
                  </p>

                  <h2>
                    Transaction history
                  </h2>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginBottom: "18px",
                }}
              >
                <div
                  style={{
                    flex: "1 1 240px",
                    minWidth: "200px",
                  }}
                >
                  <input
                    type="text"
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value,
                      )
                    }
                    placeholder="Search reference, description..."
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding:
                        "13px 15px",
                      borderRadius: "12px",
                      border:
                        "1px solid rgba(255,255,255,0.09)",
                      background:
                        "rgba(255,255,255,0.035)",
                      color: "#ffffff",
                      outline: "none",
                      fontSize: "13px",
                    }}
                  />
                </div>

                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(
                      event.target.value as
                        | "all"
                        | "credit"
                        | "debit",
                    )
                  }
                  style={{
                    padding:
                      "13px 15px",
                    borderRadius: "12px",
                    border:
                      "1px solid rgba(255,255,255,0.09)",
                    background:
                      "#0a111b",
                    color: "#ffffff",
                    outline: "none",
                    fontSize: "13px",
                  }}
                >
                  <option value="all">
                    All directions
                  </option>

                  <option value="credit">
                    Credits
                  </option>

                  <option value="debit">
                    Debits
                  </option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(
                      event.target.value as
                        | "all"
                        | TransactionType,
                    )
                  }
                  style={{
                    padding:
                      "13px 15px",
                    borderRadius: "12px",
                    border:
                      "1px solid rgba(255,255,255,0.09)",
                    background:
                      "#0a111b",
                    color: "#ffffff",
                    outline: "none",
                    fontSize: "13px",
                  }}
                >
                  <option value="all">
                    All transaction types
                  </option>

                  <option value="deposit">
                    Deposits
                  </option>

                  <option value="withdrawal">
                    Withdrawals
                  </option>

                  <option value="transfer_sent">
                    Transfers sent
                  </option>

                  <option value="transfer_received">
                    Transfers received
                  </option>

                  <option value="investment">
                    Investments
                  </option>

                  <option value="investment_return">
                    Investment returns
                  </option>

                  <option value="swap_buy">
                    Swap purchases
                  </option>

                  <option value="swap_sell">
                    Swap sales
                  </option>

                  <option value="adjustment">
                    Adjustments
                  </option>
                </select>
              </div>

              {filteredTransactions.length ===
              0 ? (
                <div className="security-panel">
                  <div className="security-symbol">
                    ≡
                  </div>

                  <div className="security-content">
                    <p className="section-eyebrow">
                      NO RESULTS
                    </p>

                    <h2>
                      No transactions found
                    </h2>

                    <p>
                      {transactions.length ===
                      0
                        ? "Your transaction history will appear here when activity is recorded."
                        : "Try changing your search or transaction filters."}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className="transaction-table-wrapper"
                  style={{
                    width: "100%",
                    overflowX:
                      "auto",
                    borderRadius:
                      "16px",
                    border:
                      "1px solid rgba(255,255,255,0.07)",
                    background:
                      "rgba(7,13,22,0.72)",
                  }}
                >
                  <div
                    className="transaction-table"
                    style={{
                      minWidth:
                        "850px",
                    }}
                  >
                    <div
                      className="transaction-table-header"
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "2fr 1.3fr 1.2fr 1fr 1.3fr",
                        gap: "16px",
                        padding:
                          "14px 18px",
                        borderBottom:
                          "1px solid rgba(255,255,255,0.07)",
                        color:
                          "rgba(255,255,255,0.45)",
                        fontSize:
                          "10px",
                        fontWeight: 800,
                        letterSpacing:
                          "0.14em",
                      }}
                    >
                      <span>
                        TRANSACTION
                      </span>

                      <span>
                        REFERENCE
                      </span>

                      <span>
                        DATE
                      </span>

                      <span>
                        STATUS
                      </span>

                      <span
                        style={{
                          textAlign:
                            "right",
                        }}
                      >
                        AMOUNT
                      </span>
                    </div>

                    {filteredTransactions.map(
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
                            key={
                              transaction.id
                            }
                            className="transaction-table-row"
                            style={{
                              display:
                                "grid",
                              gridTemplateColumns:
                                "2fr 1.3fr 1.2fr 1fr 1.3fr",
                              gap: "16px",
                              padding:
                                "17px 18px",
                              alignItems:
                                "center",
                              borderBottom:
                                "1px solid rgba(255,255,255,0.045)",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: "12px",
                              }}
                            >
                              <div
                                className="coin-symbol"
                                style={{
                                  flexShrink: 0,
                                }}
                              >
                                {transactionIcon(
                                  transaction.transaction_type,
                                )}
                              </div>

                              <div
                                style={{
                                  minWidth:
                                    0,
                                }}
                              >
                                <strong
                                  style={{
                                    display:
                                      "block",
                                    color:
                                      "#ffffff",
                                    fontSize:
                                      "13px",
                                    marginBottom:
                                      "4px",
                                  }}
                                >
                                  {transactionLabel(
                                    transaction.transaction_type,
                                  )}
                                </strong>

                                <span
                                  style={{
                                    display:
                                      "block",
                                    color:
                                      "rgba(255,255,255,0.42)",
                                    fontSize:
                                      "11px",
                                    whiteSpace:
                                      "nowrap",
                                    overflow:
                                      "hidden",
                                    textOverflow:
                                      "ellipsis",
                                  }}
                                >
                                  {transaction.description ||
                                    "CCT wallet transaction"}
                                </span>
                              </div>
                            </div>

                            <span
                              style={{
                                color:
                                  "rgba(255,255,255,0.62)",
                                fontSize:
                                  "11px",
                                fontFamily:
                                  "monospace",
                              }}
                            >
                              {transaction.reference}
                            </span>

                            <span
                              style={{
                                color:
                                  "rgba(255,255,255,0.58)",
                                fontSize:
                                  "12px",
                              }}
                            >
                              {formatDate(
                                transaction.created_at,
                              )}
                            </span>

                            <span
                              className={statusClass(
                                transaction.status,
                              )}
                            >
                              {statusLabel(
                                transaction.status,
                              )}
                            </span>

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
                                    "13px",
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
                                  marginTop:
                                    "4px",
                                  color:
                                    "rgba(255,255,255,0.35)",
                                  fontSize:
                                    "10px",
                                }}
                              >
                                {formatDateTime(
                                  transaction.created_at,
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </section>

      <style jsx>{`
        .transaction-status {
          display: inline-flex;
          width: fit-content;
          align-items: center;
          justify-content: center;
          padding: 6px 9px;
          border-radius: 999px;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          background: rgba(
            255,
            255,
            255,
            0.035
          );
          color: rgba(255, 255, 255, 0.58);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .transaction-status.completed {
          border-color: rgba(
            65,
            210,
            140,
            0.22
          );
          background: rgba(
            65,
            210,
            140,
            0.07
          );
          color: #6fe5aa;
        }

        .transaction-status.pending {
          border-color: rgba(
            212,
            175,
            55,
            0.25
          );
          background: rgba(
            212,
            175,
            55,
            0.07
          );
          color: #e5c96b;
        }

        .transaction-status.failed,
        .transaction-status.cancelled {
          border-color: rgba(
            255,
            90,
            90,
            0.22
          );
          background: rgba(
            255,
            90,
            90,
            0.07
          );
          color: #ff9696;
        }

        @media (max-width: 760px) {
          .portfolio-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
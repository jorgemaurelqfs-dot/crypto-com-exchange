"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandLogo from "../../../components/BrandLogo";
import { createClient } from "../../../lib/supabase/client";
import "../dashboard.css";

type Wallet = {
  available_balance: number | string;
  locked_balance: number | string;
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

function extractRpcMessage(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "message" in error
  ) {
    return String(
      (error as { message?: unknown }).message ??
        "Transfer failed.",
    );
  }

  return "Transfer failed. Please try again.";
}

export default function TransferPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [wallet, setWallet] =
    useState<Wallet | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [recipient, setRecipient] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [note, setNote] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    const supabase = createClient();

    let mounted = true;

    async function loadTransferPage() {
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
        ] = await Promise.all([
          supabase
            .from("cct_wallets")
            .select(
              `
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
        ]);

        if (walletResult.error) {
          throw walletResult.error;
        }

        if (profileResult.error) {
          throw profileResult.error;
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
      } catch (error) {
        console.error(
          "Transfer page loading error:",
          error,
        );

        if (mounted) {
          setErrorMessage(
            "Unable to load your transfer wallet.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTransferPage();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleTransfer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (sending) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const cleanRecipient =
      recipient.trim();

    const numericAmount =
      Number(amount);

    if (!cleanRecipient) {
      setErrorMessage(
        "Enter the recipient account ID or username.",
      );
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setErrorMessage(
        "Enter a valid CCT amount greater than zero.",
      );
      return;
    }

    const availableBalance = toNumber(
      wallet?.available_balance,
    );

    if (numericAmount > availableBalance) {
      setErrorMessage(
        "Insufficient available CCT balance.",
      );
      return;
    }

    try {
      setSending(true);

      const supabase = createClient();

      const { data, error } =
        await supabase.rpc("send_cct", {
          p_recipient_identifier:
            cleanRecipient,
          p_amount: numericAmount,
          p_note: note.trim() || null,
        });

      if (error) {
        throw error;
      }

      if (
        data &&
        typeof data === "object" &&
        "success" in data &&
        data.success === false
      ) {
        throw new Error(
          "message" in data
            ? String(data.message)
            : "Transfer was not completed.",
        );
      }

      let resultMessage =
        "CCT transfer completed successfully.";

      if (
        data &&
        typeof data === "object" &&
        "message" in data &&
        data.message
      ) {
        resultMessage = String(
          data.message,
        );
      }

      setSuccessMessage(
        resultMessage,
      );

      setRecipient("");
      setAmount("");
      setNote("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const { data: refreshedWallet } =
          await supabase
            .from("cct_wallets")
            .select(
              `
                available_balance,
                locked_balance
              `,
            )
            .eq(
              "user_id",
              session.user.id,
            )
            .maybeSingle();

        if (refreshedWallet) {
          setWallet(
            refreshedWallet as Wallet,
          );
        }
      }
    } catch (error) {
      console.error(
        "CCT transfer error:",
        error,
      );

      setErrorMessage(
        extractRpcMessage(error),
      );
    } finally {
      setSending(false);
    }
  }

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
              className="sidebar-menu-item active"
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

              <span className="active-indicator" />
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

              <h1>Transfer CCT</h1>
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
              Loading your transfer wallet...
            </p>
          </div>
        ) : (
          <>
            <section className="welcome-row">
              <div className="welcome-content">
                <div className="welcome-tag">
                  <span />
                  INTERNAL CCT TRANSFER
                </div>

                <h2>
                  Send CCT securely
                </h2>

                <p>
                  Transfer CCT instantly to
                  another Crypto Com Exchange
                  account using their account ID
                  or username.
                </p>
              </div>

              <div className="account-status">
                <span className="status-dot" />

                <div>
                  <strong>
                    Wallet available
                  </strong>

                  <small>
                    {formatCct(
                      availableBalance,
                    )}{" "}
                    CCT
                  </small>
                </div>
              </div>
            </section>

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

            {successMessage && (
              <div
                style={{
                  marginBottom: "20px",
                  padding: "14px 18px",
                  border:
                    "1px solid rgba(70, 220, 145, 0.25)",
                  background:
                    "rgba(70, 220, 145, 0.08)",
                  color: "#7ae8ae",
                  borderRadius: "12px",
                  fontSize: "13px",
                }}
              >
                {successMessage}
              </div>
            )}

            <section
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(0, 1.5fr) minmax(280px, 0.8fr)",
                gap: "22px",
                marginBottom: "28px",
              }}
            >
              <form
                onSubmit={handleTransfer}
                style={{
                  padding: "28px",
                  border:
                    "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "20px",
                  background:
                    "linear-gradient(145deg, rgba(11,19,31,0.94), rgba(5,10,18,0.88))",
                  boxShadow:
                    "0 24px 70px rgba(0,0,0,0.22)",
                }}
              >
                <div
                  style={{
                    marginBottom: "24px",
                  }}
                >
                  <p
                    className="section-eyebrow"
                    style={{
                      marginBottom: "7px",
                    }}
                  >
                    NEW TRANSFER
                  </p>

                  <h2
                    style={{
                      margin: 0,
                      color: "#ffffff",
                      fontSize: "24px",
                    }}
                  >
                    Send CCT
                  </h2>
                </div>

                <div
                  style={{
                    marginBottom: "18px",
                  }}
                >
                  <label
                    htmlFor="recipient"
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      color:
                        "rgba(255,255,255,0.65)",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    Recipient account ID or
                    username
                  </label>

                  <input
                    id="recipient"
                    type="text"
                    value={recipient}
                    onChange={(event) =>
                      setRecipient(
                        event.target.value,
                      )
                    }
                    placeholder="e.g. CCT-ABC1234567 or username"
                    autoComplete="off"
                    disabled={sending}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding:
                        "14px 15px",
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

                <div
                  style={{
                    marginBottom: "18px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <label
                      htmlFor="amount"
                      style={{
                        color:
                          "rgba(255,255,255,0.65)",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      Amount
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setAmount(
                          availableBalance
                            .toString(),
                        )
                      }
                      disabled={
                        sending ||
                        availableBalance <=
                          0
                      }
                      style={{
                        border: "none",
                        background:
                          "transparent",
                        color: "#d4af37",
                        cursor: "pointer",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      Use available
                    </button>
                  </div>

                  <div
                    style={{
                      position: "relative",
                    }}
                  >
                    <input
                      id="amount"
                      type="number"
                      min="0"
                      step="0.00000001"
                      value={amount}
                      onChange={(event) =>
                        setAmount(
                          event.target.value,
                        )
                      }
                      placeholder="0.00"
                      disabled={sending}
                      style={{
                        width: "100%",
                        boxSizing:
                          "border-box",
                        padding:
                          "14px 65px 14px 15px",
                        borderRadius:
                          "12px",
                        border:
                          "1px solid rgba(255,255,255,0.09)",
                        background:
                          "rgba(255,255,255,0.035)",
                        color: "#ffffff",
                        outline: "none",
                        fontSize: "16px",
                        fontWeight: 700,
                      }}
                    />

                    <span
                      style={{
                        position:
                          "absolute",
                        right: "15px",
                        top: "50%",
                        transform:
                          "translateY(-50%)",
                        color:
                          "#d4af37",
                        fontSize: "12px",
                        fontWeight: 800,
                      }}
                    >
                      CCT
                    </span>
                  </div>

                  <p
                    style={{
                      margin:
                        "8px 0 0",
                      color:
                        "rgba(255,255,255,0.38)",
                      fontSize: "11px",
                    }}
                  >
                    Available:{" "}
                    {formatCct(
                      availableBalance,
                    )}{" "}
                    CCT
                  </p>
                </div>

                <div
                  style={{
                    marginBottom: "22px",
                  }}
                >
                  <label
                    htmlFor="note"
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      color:
                        "rgba(255,255,255,0.65)",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    Note
                    <span
                      style={{
                        color:
                          "rgba(255,255,255,0.3)",
                        fontWeight: 400,
                      }}
                    >
                      {" "}
                      (optional)
                    </span>
                  </label>

                  <textarea
                    id="note"
                    value={note}
                    onChange={(event) =>
                      setNote(
                        event.target.value,
                      )
                    }
                    placeholder="Add a note for this transfer..."
                    maxLength={250}
                    disabled={sending}
                    rows={4}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "14px 15px",
                      borderRadius: "12px",
                      border:
                        "1px solid rgba(255,255,255,0.09)",
                      background:
                        "rgba(255,255,255,0.035)",
                      color: "#ffffff",
                      outline: "none",
                      fontSize: "13px",
                      resize: "vertical",
                      fontFamily:
                        "inherit",
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    sending ||
                    availableBalance <= 0
                  }
                  style={{
                    width: "100%",
                    border: "1px solid rgba(212,175,55,0.55)",
                    borderRadius: "12px",
                    padding: "15px 18px",
                    background:
                      "linear-gradient(135deg, #d4af37, #a47b18)",
                    color: "#080b10",
                    cursor:
                      sending ||
                      availableBalance <= 0
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      sending ||
                      availableBalance <= 0
                        ? 0.55
                        : 1,
                    fontSize: "13px",
                    fontWeight: 900,
                    letterSpacing: "0.03em",
                    boxShadow:
                      "0 10px 30px rgba(212,175,55,0.12)",
                  }}
                >
                  {sending
                    ? "Processing transfer..."
                    : "Send CCT"}
                </button>
              </form>

              <div
                style={{
                  padding: "25px",
                  border:
                    "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "20px",
                  background:
                    "rgba(7,13,22,0.72)",
                  height: "fit-content",
                }}
              >
                <p className="section-eyebrow">
                  WALLET BALANCE
                </p>

                <div
                  style={{
                    marginTop: "12px",
                    marginBottom: "22px",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      color:
                        "rgba(255,255,255,0.45)",
                      fontSize: "11px",
                      marginBottom: "7px",
                    }}
                  >
                    Available CCT
                  </span>

                  <strong
                    style={{
                      display: "block",
                      color: "#ffffff",
                      fontSize: "30px",
                      letterSpacing:
                        "-0.03em",
                    }}
                  >
                    {formatCct(
                      availableBalance,
                    )}
                  </strong>

                  <span
                    style={{
                      display: "block",
                      marginTop: "4px",
                      color: "#d4af37",
                      fontSize: "12px",
                    }}
                  >
                    CCT available to send
                  </span>
                </div>

                <div
                  style={{
                    paddingTop: "18px",
                    borderTop:
                      "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      marginBottom: "12px",
                    }}
                  >
                    <span
                      style={{
                        color:
                          "rgba(255,255,255,0.48)",
                        fontSize: "11px",
                      }}
                    >
                      Locked
                    </span>

                    <strong
                      style={{
                        color:
                          "rgba(255,255,255,0.8)",
                        fontSize: "12px",
                      }}
                    >
                      {formatCct(
                        lockedBalance,
                      )}{" "}
                      CCT
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                    }}
                  >
                    <span
                      style={{
                        color:
                          "rgba(255,255,255,0.48)",
                        fontSize: "11px",
                      }}
                    >
                      Reference value
                    </span>

                    <strong
                      style={{
                        color:
                          "rgba(255,255,255,0.8)",
                        fontSize: "12px",
                      }}
                    >
                      1 CCT = $1.00
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "24px",
                    padding: "14px",
                    borderRadius: "12px",
                    border:
                      "1px solid rgba(70,210,140,0.16)",
                    background:
                      "rgba(70,210,140,0.045)",
                  }}
                >
                  <strong
                    style={{
                      display: "block",
                      color: "#72e4a9",
                      fontSize: "11px",
                      marginBottom: "5px",
                    }}
                  >
                    SECURE TRANSFER
                  </strong>

                  <span
                    style={{
                      display: "block",
                      color:
                        "rgba(255,255,255,0.42)",
                      fontSize: "10px",
                      lineHeight: 1.5,
                    }}
                  >
                    Transfers are processed
                    through the platform's
                    secure database operation.
                  </span>
                </div>
              </div>
            </section>

            <section className="security-panel">
              <div className="security-symbol">
                ↔
              </div>

              <div className="security-content">
                <p className="section-eyebrow">
                  INTERNAL TRANSFERS
                </p>

                <h2>
                  Send CCT to another account
                </h2>

                <p>
                  The recipient can be identified
                  by their CCT account ID or
                  registered username. Your wallet
                  balance is updated only after the
                  secure transfer operation
                  completes.
                </p>
              </div>

              <Link
                href="/dashboard/transactions"
                className="security-button"
              >
                View transactions
              </Link>
            </section>
          </>
        )}
      </section>

      <style jsx>{`
        @media (max-width: 900px) {
          section[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }

        input:focus,
        textarea:focus,
        select:focus {
          border-color: rgba(
            212,
            175,
            55,
            0.45
          ) !important;
          box-shadow:
            0 0 0 3px
            rgba(212, 175, 55, 0.07);
        }

        button:not(:disabled):hover {
          filter: brightness(1.08);
        }
      `}</style>
    </main>
  );
}
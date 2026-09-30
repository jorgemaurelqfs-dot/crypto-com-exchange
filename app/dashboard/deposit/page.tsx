"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import "../dashboard.css";
import BrandLogo from "../../../components/BrandLogo";
import { createClient } from "../../../lib/supabase/client";

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

type DepositWallet = {
  id: string;
  asset_symbol: string;
  asset_name: string;
  network: string;
  wallet_address: string | null;
  wallet_label: string | null;
  qr_code_url: string | null;
  instructions: string | null;
  deposit_tag: string | null;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  required_confirmations: number;
};

type Deposit = {
  id: string;
  reference: string;
  asset_symbol: string;
  network: string;
  amount: number | string;
  transaction_hash: string | null;
  status:
    | "pending"
    | "confirming"
    | "confirmed"
    | "rejected"
    | "cancelled";
  user_note: string | null;
  created_at: string;
};

type DepositRequestResponse = {
  success?: boolean;
  reference?: string;
  message?: string;
  deposit?: {
    id?: string;
    reference?: string;
  };
};

const supabase = createClient();

const REQUEST_TIMEOUT = 12000;

const ASSET_META: Record<
  string,
  {
    name: string;
    icon: string;
    description: string;
  }
> = {
  BTC: {
    name: "Bitcoin",
    icon: "₿",
    description: "Bitcoin network",
  },
  ETH: {
    name: "Ethereum",
    icon: "Ξ",
    description: "Ethereum network",
  },
  USDT: {
    name: "Tether USD",
    icon: "₮",
    description: "Stablecoin",
  },
  BNB: {
    name: "BNB",
    icon: "◆",
    description: "BNB Smart Chain",
  },
  SOL: {
    name: "Solana",
    icon: "S",
    description: "Solana network",
  },
  XRP: {
    name: "XRP",
    icon: "X",
    description: "XRP Ledger",
  },
  USDC: {
    name: "USD Coin",
    icon: "$",
    description: "Stablecoin",
  },
  ADA: {
    name: "Cardano",
    icon: "A",
    description: "Cardano network",
  },
  AADA: {
    name: "Cardano",
    icon: "A",
    description: "Cardano network",
  },
  DOGE: {
    name: "Dogecoin",
    icon: "Ð",
    description: "Dogecoin network",
  },
  AVAX: {
    name: "Avalanche",
    icon: "A",
    description: "Avalanche network",
  },
  AAVAX: {
    name: "Avalanche",
    icon: "A",
    description: "Avalanche network",
  },
};

function formatAmount(value: number | string) {
  const number = Number(value || 0);

  return number.toLocaleString(undefined, {
    maximumFractionDigits: 8,
  });
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortenAddress(address: string) {
  if (!address) {
    return "";
  }

  if (address.length <= 26) {
    return address;
  }

  return `${address.slice(0, 13)}...${address.slice(-10)}`;
}

function statusLabel(status: Deposit["status"]) {
  switch (status) {
    case "pending":
      return "Pending";

    case "confirming":
      return "Confirming";

    case "confirmed":
      return "Confirmed";

    case "rejected":
      return "Rejected";

    case "cancelled":
      return "Cancelled";

    default:
      return status;
  }
}

/**
 * Prevent Supabase requests from leaving the page
 * in a permanent loading/submitting state.
 */
async function withTimeout<T>(
  promise: PromiseLike<T>,
  timeout = REQUEST_TIMEOUT,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let finished = false;

    const timer = window.setTimeout(() => {
      if (finished) {
        return;
      }

      finished = true;

      reject(
        new Error(
          "The request took too long to complete. Please check your connection and try again.",
        ),
      );
    }, timeout);

    Promise.resolve(promise)
      .then((result) => {
        if (finished) {
          return;
        }

        finished = true;
        window.clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        if (finished) {
          return;
        }

        finished = true;
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export default function DepositPage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [wallets, setWallets] =
    useState<DepositWallet[]>([]);

  const [deposits, setDeposits] =
    useState<Deposit[]>([]);

  const [selectedAsset, setSelectedAsset] =
    useState("");

  const [selectedNetwork, setSelectedNetwork] =
    useState("");

  const [amount, setAmount] = useState("");

  const [transactionHash, setTransactionHash] =
    useState("");

  const [userNote, setUserNote] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const hasInitializedRef =
    useRef(false);

  const mountedRef =
    useRef(true);

  /*
   * Prevent stale copy timers from trying
   * to update the page after unmounting.
   */
  const copyTimerRef =
    useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    if (hasInitializedRef.current) {
      return;
    }

    hasInitializedRef.current = true;

    async function loadPage() {
      if (!mountedRef.current) {
        return;
      }

      setLoading(true);
      setError("");
      setSuccess("");

      try {
        /*
         * Get the authenticated session once.
         */
        const {
          data: { session },
          error: sessionError,
        } = await withTimeout(
          supabase.auth.getSession(),
        );

        if (sessionError) {
          throw new Error(
            sessionError.message,
          );
        }

        if (!session?.user) {
          if (mountedRef.current) {
            router.replace("/login");
          }

          return;
        }

        const userId =
          session.user.id;

        /*
         * Load the independent page data
         * in parallel.
         */
        const [
          profileResult,
          walletsResult,
          depositsResult,
        ] = await Promise.all([
          withTimeout(
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
          ),

          withTimeout(
            supabase.rpc(
              "get_user_deposit_wallets",
            ),
          ),

          withTimeout(
            supabase
              .from("deposits")
              .select(
                `
                  id,
                  reference,
                  asset_symbol,
                  network,
                  amount,
                  transaction_hash,
                  status,
                  user_note,
                  created_at
                `,
              )
              .eq(
                "user_id",
                userId,
              )
              .order(
                "created_at",
                {
                  ascending: false,
                },
              )
              .limit(20),
          ),
        ]);

        if (!mountedRef.current) {
          return;
        }

        if (profileResult.error) {
          throw new Error(
            `Unable to load your profile: ${profileResult.error.message}`,
          );
        }

        if (walletsResult.error) {
          throw new Error(
            `Unable to load deposit wallets: ${walletsResult.error.message}`,
          );
        }

        if (depositsResult.error) {
          throw new Error(
            `Unable to load deposit history: ${depositsResult.error.message}`,
          );
        }

        const loadedProfile =
          (profileResult.data as Profile | null) ||
          null;

        const loadedWallets =
          (walletsResult.data as DepositWallet[]) ||
          [];

        const loadedDeposits =
          (depositsResult.data as Deposit[]) ||
          [];

        setProfile(
          loadedProfile,
        );

        setWallets(
          loadedWallets,
        );

        setDeposits(
          loadedDeposits,
        );

        /*
         * Establish the initial asset/network only
         * once. Changing an asset later is handled
         * by handleAssetChange().
         */
        if (loadedWallets.length > 0) {
          const firstWallet =
            loadedWallets[0];

          setSelectedAsset(
            firstWallet.asset_symbol,
          );

          setSelectedNetwork(
            firstWallet.network,
          );
        } else {
          setSelectedAsset("");
          setSelectedNetwork("");
        }
      } catch (loadError) {
        if (!mountedRef.current) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : "Unable to load the deposit page.";

        setError(message);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    void loadPage();

    return () => {
      mountedRef.current = false;

      if (copyTimerRef.current !== null) {
        window.clearTimeout(
          copyTimerRef.current,
        );
      }
    };
  }, [router]);

  const availableAssets =
    useMemo(() => {
      return Array.from(
        new Set(
          wallets.map(
            (wallet) =>
              wallet.asset_symbol,
          ),
        ),
      );
    }, [wallets]);

  const availableNetworks =
    useMemo(() => {
      return wallets.filter(
        (wallet) =>
          wallet.asset_symbol ===
          selectedAsset,
      );
    }, [
      wallets,
      selectedAsset,
    ]);

  const selectedWallet =
    useMemo(() => {
      return (
        wallets.find(
          (wallet) =>
            wallet.asset_symbol ===
              selectedAsset &&
            wallet.network ===
              selectedNetwork,
        ) || null
      );
    }, [
      wallets,
      selectedAsset,
      selectedNetwork,
    ]);

  function handleAssetChange(
    asset: string,
  ) {
    if (asset === selectedAsset) {
      return;
    }

    const firstNetwork =
      wallets.find(
        (wallet) =>
          wallet.asset_symbol ===
          asset,
      )?.network || "";

    setSelectedAsset(asset);
    setSelectedNetwork(
      firstNetwork,
    );

    /*
     * Reset only the form fields that belong
     * to the previous deposit selection.
     */
    setAmount("");
    setTransactionHash("");
    setUserNote("");
    setCopied(false);
    setError("");
    setSuccess("");
  }

  function handleNetworkChange(
    network: string,
  ) {
    if (
      network ===
      selectedNetwork
    ) {
      return;
    }

    setSelectedNetwork(network);
    setCopied(false);
    setError("");
    setSuccess("");
  }

  async function copyAddress() {
    if (
      !selectedWallet?.wallet_address
    ) {
      return;
    }

    if (
      selectedWallet.maintenance_mode
    ) {
      setError(
        selectedWallet.maintenance_message ||
          "Deposits for this asset are temporarily unavailable.",
      );

      return;
    }

    if (
      selectedWallet.wallet_address ===
      "ADMIN_CONFIGURE"
    ) {
      setError(
        "This deposit wallet has not been configured by the administrator yet.",
      );

      return;
    }

    try {
      await navigator.clipboard.writeText(
        selectedWallet.wallet_address,
      );

      if (!mountedRef.current) {
        return;
      }

      setCopied(true);
      setError("");

      if (
        copyTimerRef.current !== null
      ) {
        window.clearTimeout(
          copyTimerRef.current,
        );
      }

      copyTimerRef.current =
        window.setTimeout(() => {
          if (
            mountedRef.current
          ) {
            setCopied(false);
          }
        }, 2200);
    } catch {
      if (!mountedRef.current) {
        return;
      }

      setError(
        "Unable to copy the wallet address. Please copy it manually.",
      );
    }
  }

  async function refreshDepositHistory(
    userId: string,
  ) {
    const {
      data,
      error: refreshError,
    } = await withTimeout(
      supabase
        .from("deposits")
        .select(
          `
            id,
            reference,
            asset_symbol,
            network,
            amount,
            transaction_hash,
            status,
            user_note,
            created_at
          `,
        )
        .eq(
          "user_id",
          userId,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        )
        .limit(20),
    );

    if (refreshError) {
      throw new Error(
        refreshError.message,
      );
    }

    if (mountedRef.current) {
      setDeposits(
        (data as Deposit[]) ||
          [],
      );
    }
  }

  async function submitDeposit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    /*
     * Hard guard against double clicks and
     * duplicate RPC calls.
     */
    if (submitting) {
      return;
    }

    setError("");
    setSuccess("");

    const cleanTransactionHash =
      transactionHash.trim();

    const cleanUserNote =
      userNote.trim();

    const numericAmount =
      Number(amount);

    /*
     * Client-side checks are only for immediate
     * user feedback. The database RPC remains
     * authoritative.
     */
    if (!selectedWallet) {
      setError(
        "Please select a supported asset and network.",
      );

      return;
    }

    if (
      selectedWallet.maintenance_mode
    ) {
      setError(
        selectedWallet.maintenance_message ||
          "Deposits for this asset are temporarily unavailable.",
      );

      return;
    }

    if (
      !selectedWallet.wallet_address ||
      selectedWallet.wallet_address ===
        "ADMIN_CONFIGURE"
    ) {
      setError(
        "This deposit wallet is not configured yet. Please contact support.",
      );

      return;
    }

    if (
      !Number.isFinite(
        numericAmount,
      ) ||
      numericAmount <= 0
    ) {
      setError(
        "Enter a valid deposit amount.",
      );

      return;
    }

    if (
      cleanTransactionHash.length <
      6
    ) {
      setError(
        "Enter the transaction hash/reference for your transfer.",
      );

      return;
    }

    setSubmitting(true);

    try {
      /*
       * Verify the session immediately before
       * creating the request.
       */
      const {
        data: { session },
        error: sessionError,
      } = await withTimeout(
        supabase.auth.getSession(),
      );

      if (sessionError) {
        throw new Error(
          sessionError.message,
        );
      }

      if (!session?.user) {
        router.replace("/login");

        return;
      }

      /*
       * IMPORTANT:
       *
       * Deposit creation is performed exclusively
       * through the database RPC.
       *
       * No direct INSERT into public.deposits is
       * performed from the browser.
       */
      const {
        data,
        error: rpcError,
      } = await withTimeout(
        supabase.rpc(
          "create_deposit_request",
          {
            p_asset_symbol:
              selectedAsset,

            p_network:
              selectedNetwork,

            p_amount:
              numericAmount,

            p_transaction_hash:
              cleanTransactionHash,

            p_user_note:
              cleanUserNote ||
              null,
          },
        ),
      );

      if (rpcError) {
        throw new Error(
          rpcError.message,
        );
      }

      const response =
        (data ||
          {}) as DepositRequestResponse;

      if (
        response.success !==
        true
      ) {
        throw new Error(
          response.message ||
            "The deposit request could not be created.",
        );
      }

      /*
       * Only refresh history after the RPC has
       * successfully created the request.
       */
      await refreshDepositHistory(
        session.user.id,
      );

      if (!mountedRef.current) {
        return;
      }

      setAmount("");
      setTransactionHash("");
      setUserNote("");
      setCopied(false);

      const returnedReference =
        response.reference ||
        response.deposit
          ?.reference ||
        "";

      if (returnedReference) {
        setSuccess(
          `Deposit request ${returnedReference} has been submitted and is pending review.`,
        );
      } else {
        setSuccess(
          "Your deposit request has been submitted and is pending review.",
        );
      }
    } catch (submitError) {
      if (!mountedRef.current) {
        return;
      }

      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit the deposit request.";

      setError(message);
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
    } finally {
      router.replace("/login");
    }
  }

  const displayName =
    profile?.full_name ||
    profile?.username ||
    "Account";

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
          aria-label="Close menu"
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
                "Loading account..."}
            </span>
          </div>

          <span className="online-indicator" />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">
            Platform
          </div>

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
                ◈
              </span>

              <span className="menu-label">
                Wallet
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
            </Link>

            <Link
              href="/dashboard/transfer"
              className="sidebar-menu-item"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ⇄
              </span>

              <span className="menu-label">
                Transfer
              </span>
            </Link>

            <Link
              href="/dashboard/deposit"
              className="sidebar-menu-item active"
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

              <span className="active-indicator" />
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
            </Link>

            <Link
              href="/dashboard/investments"
              className="sidebar-menu-item"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ◒
              </span>

              <span className="menu-label">
                Investments
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
                ⌁
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
                ⇅
              </span>

              <span className="menu-label">
                Swap
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
          </Link>

          <button
            type="button"
            className="sidebar-menu-item logout-button"
            onClick={handleSignOut}
          >
            <span className="menu-icon">
              ↪
            </span>

            <span className="menu-label">
              Sign out
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
              ☰
            </button>

            <div>
              <span className="header-eyebrow">
                CRYPTO COM EXCHANGE
              </span>

              <h1>
                Deposit Assets
              </h1>
            </div>
          </div>

          <div className="header-actions">
            <Link
              href="/dashboard/wallet"
              className="header-action-button"
            >
              Wallet
            </Link>

            <div className="header-account">
              <div className="account-info">
                <strong>
                  {displayName}
                </strong>

                <span>
                  {profile?.account_id ||
                    "Account"}
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
            <div className="large-spinner" />

            <p>
              Loading supported deposit
              wallets...
            </p>

            <small>
              Checking your account and
              available deposit networks.
            </small>
          </div>
        ) : (
          <>
            <div className="welcome-row deposit-welcome-row">
              <div className="welcome-content">
                <span className="welcome-tag">
                  EXTERNAL ASSET DEPOSIT
                </span>

                <h2>
                  Fund your account with
                  supported crypto assets.
                </h2>

                <p>
                  CCT is an internal
                  platform asset. You do
                  not deposit CCT directly.
                  Deposit a supported
                  external asset to the
                  wallet provided below,
                  then use the exchange to
                  swap it into CCT.
                </p>
              </div>

              <div className="account-status">
                <span className="status-dot" />

                {profile?.account_status ===
                "active"
                  ? "Account Active"
                  : "Account Restricted"}
              </div>
            </div>

            {error && (
              <div
                className="deposit-alert deposit-alert-error"
                role="alert"
              >
                <div className="deposit-alert-icon">
                  !
                </div>

                <div className="deposit-alert-content">
                  <strong>
                    Unable to continue
                  </strong>

                  <span>
                    {error}
                  </span>
                </div>

                <button
                  type="button"
                  className="deposit-alert-dismiss"
                  onClick={() =>
                    setError("")
                  }
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}

            {success && (
              <div
                className="deposit-alert deposit-alert-success"
                role="status"
              >
                <div className="deposit-alert-icon">
                  ✓
                </div>

                <div className="deposit-alert-content">
                  <strong>
                    Deposit request submitted
                  </strong>

                  <span>
                    {success}
                  </span>
                </div>

                <button
                  type="button"
                  className="deposit-alert-dismiss"
                  onClick={() =>
                    setSuccess("")
                  }
                  aria-label="Dismiss notification"
                >
                  ×
                </button>
              </div>
            )}

            <div className="deposit-layout">
              <section className="deposit-main-card">
                <div className="deposit-card-header">
                  <div>
                    <span className="section-eyebrow">
                      STEP 01
                    </span>

                    <h3>
                      Select deposit asset
                    </h3>
                  </div>

                  <div className="deposit-secure-badge">
                    Secure
                  </div>
                </div>

                {availableAssets.length ===
                0 ? (
                  <div className="deposit-empty-state deposit-wallet-unavailable">
                    <strong>
                      No deposit assets
                      configured
                    </strong>

                    <span>
                      The administrator has
                      not configured any
                      deposit wallets yet.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="asset-selector-grid">
                      {availableAssets.map(
                        (asset) => {
                          const meta =
                            ASSET_META[
                              asset
                            ];

                          const isSelected =
                            selectedAsset ===
                            asset;

                          return (
                            <button
                              type="button"
                              key={asset}
                              className={`deposit-asset-option ${
                                isSelected
                                  ? "selected"
                                  : ""
                              }`}
                              onClick={() =>
                                handleAssetChange(
                                  asset,
                                )
                              }
                            >
                              <span className="deposit-asset-icon">
                                {meta?.icon ||
                                  asset[0]}
                              </span>

                              <span>
                                <strong>
                                  {asset}
                                </strong>

                                <small>
                                  {meta?.name ||
                                    "Digital asset"}
                                </small>
                              </span>

                              {isSelected && (
                                <span className="deposit-selected-check">
                                  ✓
                                </span>
                              )}
                            </button>
                          );
                        },
                      )}
                    </div>

                    <div className="deposit-field-row">
                      <label className="deposit-field">
                        <span>
                          Network
                        </span>

                        <select
                          value={
                            selectedNetwork
                          }
                          onChange={(
                            event,
                          ) =>
                            handleNetworkChange(
                              event.target
                                .value,
                            )
                          }
                        >
                          {availableNetworks.length ===
                          0 ? (
                            <option value="">
                              No network
                              available
                            </option>
                          ) : (
                            availableNetworks.map(
                              (
                                wallet,
                              ) => (
                                <option
                                  key={
                                    wallet.id
                                  }
                                  value={
                                    wallet.network
                                  }
                                >
                                  {
                                    wallet.network
                                  }
                                </option>
                              ),
                            )
                          )}
                        </select>
                      </label>

                      <label className="deposit-field">
                        <span>
                          Deposit amount
                        </span>

                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          placeholder={`Enter ${
                            selectedAsset ||
                            "asset"
                          } amount`}
                          value={amount}
                          onChange={(
                            event,
                          ) =>
                            setAmount(
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>
                    </div>

                    <div className="deposit-address-panel">
                      <div className="deposit-address-heading">
                        <div>
                          <span className="section-eyebrow">
                            STEP 02
                          </span>

                          <h3>
                            Deposit address
                          </h3>
                        </div>

                        {selectedWallet && (
                          <span className="network-chip">
                            {
                              selectedWallet.network
                            }
                          </span>
                        )}
                      </div>

                      {!selectedWallet ? (
                        <div className="deposit-empty-state">
                          Select an asset and
                          network to view the
                          deposit wallet.
                        </div>
                      ) : selectedWallet.maintenance_mode ? (
                        <div className="deposit-empty-state deposit-wallet-unavailable">
                          <strong>
                            Deposits temporarily
                            unavailable
                          </strong>

                          <span>
                            {selectedWallet.maintenance_message ||
                              "Deposits for this asset/network are temporarily unavailable."}
                          </span>
                        </div>
                      ) : !selectedWallet.wallet_address ||
                        selectedWallet.wallet_address ===
                          "ADMIN_CONFIGURE" ? (
                        <div className="deposit-empty-state deposit-wallet-unavailable">
                          <strong>
                            Wallet not configured
                          </strong>

                          <span>
                            The administrator has
                            not configured a deposit
                            address for this
                            asset/network yet.
                          </span>
                        </div>
                      ) : (
                        <>
                          {selectedWallet.qr_code_url && (
                            <div className="deposit-qr-wrap">
                              <img
                                src={
                                  selectedWallet.qr_code_url
                                }
                                alt={`${selectedAsset} deposit QR code`}
                                className="deposit-qr"
                              />
                            </div>
                          )}

                          <div className="deposit-address-box">
                            <div>
                              <small>
                                SEND ONLY{" "}
                                {
                                  selectedAsset
                                }
                              </small>

                              <strong>
                                {shortenAddress(
                                  selectedWallet.wallet_address,
                                )}
                              </strong>
                            </div>

                            <button
                              type="button"
                              onClick={
                                copyAddress
                              }
                            >
                              {copied
                                ? "Copied"
                                : "Copy Address"}
                            </button>
                          </div>

                          <div className="deposit-full-address">
                            {
                              selectedWallet.wallet_address
                            }
                          </div>

                          {selectedWallet.deposit_tag && (
                            <div className="deposit-wallet-instructions">
                              <span>
                                !
                              </span>

                              <p>
                                <strong>
                                  Memo / Tag
                                  required:
                                </strong>{" "}
                                {
                                  selectedWallet.deposit_tag
                                }
                              </p>
                            </div>
                          )}

                          {selectedWallet.instructions && (
                            <div className="deposit-wallet-instructions">
                              <span>
                                i
                              </span>

                              <p>
                                {
                                  selectedWallet.instructions
                                }
                              </p>
                            </div>
                          )}

                          {selectedWallet.required_confirmations >
                            0 && (
                            <div className="deposit-confirmation-note">
                              <span>
                                ◌
                              </span>

                              <p>
                                This network requires{" "}
                                <strong>
                                  {
                                    selectedWallet.required_confirmations
                                  }
                                </strong>{" "}
                                confirmation
                                {selectedWallet.required_confirmations ===
                                1
                                  ? ""
                                  : "s"}{" "}
                                before a deposit can
                                be fully confirmed.
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <form
                      onSubmit={
                        submitDeposit
                      }
                      className="deposit-form"
                    >
                      <div className="deposit-form-heading">
                        <div>
                          <span className="section-eyebrow">
                            STEP 03
                          </span>

                          <h3>
                            Submit transfer
                            details
                          </h3>
                        </div>
                      </div>

                      <label className="deposit-field">
                        <span>
                          Transaction hash /
                          reference
                        </span>

                        <input
                          type="text"
                          placeholder="Paste the blockchain transaction hash"
                          value={
                            transactionHash
                          }
                          onChange={(
                            event,
                          ) =>
                            setTransactionHash(
                              event.target
                                .value,
                            )
                          }
                          autoComplete="off"
                          spellCheck={false}
                        />

                        <small>
                          This allows the
                          administrator to
                          identify and verify
                          your transfer.
                        </small>
                      </label>

                      <label className="deposit-field">
                        <span>
                          Additional note{" "}
                          <em>
                            Optional
                          </em>
                        </span>

                        <textarea
                          rows={4}
                          placeholder="Add any information relevant to this deposit..."
                          value={userNote}
                          onChange={(
                            event,
                          ) =>
                            setUserNote(
                              event.target
                                .value,
                            )
                          }
                        />
                      </label>

                      <button
                        type="submit"
                        className="deposit-submit-button"
                        disabled={
                          submitting ||
                          !selectedWallet ||
                          !selectedWallet.wallet_address ||
                          selectedWallet.wallet_address ===
                            "ADMIN_CONFIGURE" ||
                          selectedWallet.maintenance_mode
                        }
                      >
                        {submitting ? (
                          <>
                            <span className="button-spinner" />

                            Submitting
                            request...
                          </>
                        ) : (
                          <>
                            Submit Deposit
                            Request

                            <span>
                              →
                            </span>
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </section>

              <aside className="deposit-side-column">
                <div className="deposit-info-card">
                  <span className="section-eyebrow">
                    IMPORTANT
                  </span>

                  <h3>
                    Deposit safely
                  </h3>

                  <div className="deposit-warning-list">
                    <div>
                      <span>
                        01
                      </span>

                      <p>
                        Send only the
                        selected asset.
                      </p>
                    </div>

                    <div>
                      <span>
                        02
                      </span>

                      <p>
                        Use exactly the
                        selected network.
                      </p>
                    </div>

                    <div>
                      <span>
                        03
                      </span>

                      <p>
                        Sending another
                        asset or unsupported
                        network may result in
                        permanent loss.
                      </p>
                    </div>

                    <div>
                      <span>
                        04
                      </span>

                      <p>
                        Your CCT balance is not
                        credited simply because
                        a request was submitted.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="deposit-flow-card">
                  <span className="section-eyebrow">
                    HOW IT WORKS
                  </span>

                  <h3>
                    From external crypto to
                    CCT
                  </h3>

                  <div className="deposit-flow">
                    <div className="deposit-flow-step">
                      <span>
                        1
                      </span>

                      <div>
                        <strong>
                          Deposit asset
                        </strong>

                        <small>
                          Send supported crypto
                          to the assigned
                          wallet.
                        </small>
                      </div>
                    </div>

                    <div className="deposit-flow-line" />

                    <div className="deposit-flow-step">
                      <span>
                        2
                      </span>

                      <div>
                        <strong>
                          Verification
                        </strong>

                        <small>
                          Your transaction is
                          reviewed and
                          confirmed.
                        </small>
                      </div>
                    </div>

                    <div className="deposit-flow-line" />

                    <div className="deposit-flow-step">
                      <span>
                        3
                      </span>

                      <div>
                        <strong>
                          Swap to CCT
                        </strong>

                        <small>
                          Convert your
                          supported asset into
                          CCT through the
                          exchange.
                        </small>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <section className="deposit-history-section">
              <div className="section-heading">
                <div>
                  <span className="section-eyebrow">
                    ACTIVITY
                  </span>

                  <h2>
                    Deposit History
                  </h2>
                </div>

                <span className="history-count">
                  {deposits.length}{" "}
                  {deposits.length ===
                  1
                    ? "request"
                    : "requests"}
                </span>
              </div>

              {deposits.length ===
              0 ? (
                <div className="deposit-history-empty">
                  <div className="empty-history-icon">
                    ↓
                  </div>

                  <h3>
                    No deposit requests yet
                  </h3>

                  <p>
                    Your submitted deposit
                    requests will appear
                    here.
                  </p>
                </div>
              ) : (
                <div className="deposit-history-table">
                  <div className="deposit-history-header">
                    <span>
                      Reference
                    </span>

                    <span>
                      Asset
                    </span>

                    <span>
                      Network
                    </span>

                    <span>
                      Amount
                    </span>

                    <span>
                      Status
                    </span>

                    <span>
                      Date
                    </span>
                  </div>

                  {deposits.map(
                    (deposit) => (
                      <div
                        className="deposit-history-row"
                        key={
                          deposit.id
                        }
                      >
                        <span className="deposit-reference">
                          {
                            deposit.reference
                          }
                        </span>

                        <span className="deposit-history-asset">
                          <b>
                            {ASSET_META[
                              deposit
                                .asset_symbol
                            ]?.icon ||
                              deposit
                                .asset_symbol[0]}
                          </b>

                          {
                            deposit.asset_symbol
                          }
                        </span>

                        <span>
                          {
                            deposit.network
                          }
                        </span>

                        <strong>
                          {formatAmount(
                            deposit.amount,
                          )}
                        </strong>

                        <span
                          className={`deposit-status ${deposit.status}`}
                        >
                          <i />

                          {statusLabel(
                            deposit.status,
                          )}
                        </span>

                        <span className="deposit-date">
                          {formatDate(
                            deposit.created_at,
                          )}
                        </span>
                      </div>
                    ),
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
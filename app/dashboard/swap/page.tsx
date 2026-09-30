"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "../../../components/BrandLogo";
import { createClient } from "../../../lib/supabase/client";
import "../dashboard.css";

type Profile = {
  account_id: string;
  username: string | null;
  full_name: string | null;
  account_status: string;
  verification_status: string;
};

type MarketAsset = {
  id?: string;
  symbol: string;
  name: string;
  price: number | null;
  change24h?: number | null;
};

type MarketApiResponse = {
  success?: boolean;
  provider?: string;
  markets?: MarketAsset[];
  assets?: MarketAsset[];
  data?: MarketAsset[];
  error?: string;
  message?: string;
};

type AssetOption = {
  symbol: string;
  name: string;
  icon: string;
};

type QuoteResponse = {
  success?: boolean;
  quote_id?: string;
  id?: string;
  from_asset?: string;
  to_asset?: string;
  from_amount?: number | string;
  exchange_rate?: number | string;
  fee_rate?: number | string;
  fee_amount?: number | string;
  receive_amount?: number | string;
  expires_at?: string;
  error?: string;
  message?: string;
};

type ExecuteSwapResponse = {
  success?: boolean;
  swap_id?: string;
  reference?: string;
  from_asset?: string;
  to_asset?: string;
  from_amount?: number | string;
  exchange_rate?: number | string;
  fee_rate?: number | string;
  fee_amount?: number | string;
  receive_amount?: number | string;
  completed_at?: string;
  error?: string;
  message?: string;
};

const ASSETS: AssetOption[] = [
  {
    symbol: "CCT",
    name: "Crypto Com Token",
    icon: "C",
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    icon: "₿",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    icon: "Ξ",
  },
  {
    symbol: "USDT",
    name: "Tether",
    icon: "₮",
  },
  {
    symbol: "BNB",
    name: "BNB",
    icon: "◆",
  },
  {
    symbol: "SOL",
    name: "Solana",
    icon: "S",
  },
  {
    symbol: "XRP",
    name: "XRP",
    icon: "✕",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    icon: "$",
  },
  {
    symbol: "ADA",
    name: "Cardano",
    icon: "₳",
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    icon: "Ð",
  },
  {
    symbol: "AVAX",
    name: "Avalanche",
    icon: "A",
  },
];

const CCT_REFERENCE_PRICE = 1;
const DISPLAY_FEE_RATE = 0.005;

function formatPrice(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }

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

function formatAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0";
  }

  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      maximumFractionDigits: 6,
    });
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 8,
  });
}

function formatUsd(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "$0.00";
  }

  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getAsset(symbol: string) {
  const normalizedSymbol = symbol
    .trim()
    .toUpperCase();

  return ASSETS.find(
    (asset) =>
      asset.symbol.toUpperCase() ===
      normalizedSymbol
  );
}

/*
 * Normalizes a market symbol so that the
 * calculator can understand common formats:
 *
 * BTC
 * BTCUSDT
 * BTC/USDT
 * BTC-USDT
 * BTC/USD
 */
function normalizeMarketSymbol(
  symbol: string
): string {
  return symbol
    .trim()
    .toUpperCase()
    .replace("/", "")
    .replace("-", "")
    .replace("_", "");
}

function normalizePrice(
  symbol: string,
  price: unknown
): number {
  const normalizedSymbol =
    symbol.trim().toUpperCase();

  if (normalizedSymbol === "CCT") {
    return CCT_REFERENCE_PRICE;
  }

  const parsed = Number(price);

  if (
    Number.isFinite(parsed) &&
    parsed > 0
  ) {
    return parsed;
  }

  /*
   * Stablecoin fallback.
   *
   * USDT and USDC are treated as
   * approximately $1 when the external
   * provider temporarily omits their price.
   */
  if (
    normalizedSymbol === "USDT" ||
    normalizedSymbol === "USDC"
  ) {
    return 1;
  }

  return 0;
}

/*
 * Finds a usable USD market price for an asset.
 *
 * The market API may return:
 *
 * BTC
 * BTCUSDT
 * BTC/USDT
 * BTC-USDT
 * BTC/USD
 *
 * We accept all of these formats.
 */
function getMarketPrice(
  symbol: string,
  markets: MarketAsset[]
): number {
  const normalizedSymbol =
    symbol.trim().toUpperCase();

  if (normalizedSymbol === "CCT") {
    return CCT_REFERENCE_PRICE;
  }

  /*
   * Stablecoins always have a safe
   * informational fallback.
   */
  if (
    normalizedSymbol === "USDT" ||
    normalizedSymbol === "USDC"
  ) {
    const directStable = markets.find(
      (asset) =>
        asset.symbol
          .trim()
          .toUpperCase() ===
        normalizedSymbol
    );

    const stablePrice =
      normalizePrice(
        normalizedSymbol,
        directStable?.price
      );

    return stablePrice > 0
      ? stablePrice
      : 1;
  }

  const targetSymbol =
    normalizeMarketSymbol(
      normalizedSymbol
    );

  const market = markets.find(
    (asset) => {
      const marketSymbol =
        normalizeMarketSymbol(
          asset.symbol
        );

      return (
        marketSymbol ===
          targetSymbol ||
        marketSymbol ===
          `${targetSymbol}USDT` ||
        marketSymbol ===
          `${targetSymbol}USD`
      );
    }
  );

  const price = normalizePrice(
    normalizedSymbol,
    market?.price
  );

  return price > 0 ? price : 0;
}

function getErrorMessage(
  value: unknown,
  fallback: string
): string {
  if (
    value instanceof Error &&
    value.message
  ) {
    return value.message;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (
      value as {
        message?: unknown;
      }
    ).message === "string"
  ) {
    return (
      value as {
        message: string;
      }
    ).message;
  }

  return fallback;
}

function toPositiveNumber(
  value: unknown
): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : 0;
}

export default function SwapPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [fromAsset, setFromAsset] =
    useState("CCT");

  const [toAsset, setToAsset] =
    useState("USDT");

  const [fromAmount, setFromAmount] =
    useState("");

  const [markets, setMarkets] =
    useState<MarketAsset[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [marketLoading, setMarketLoading] =
    useState(true);

  const [marketError, setMarketError] =
    useState("");

  const [error, setError] =
    useState("");

  const [swapSuccess, setSwapSuccess] =
    useState("");

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [showFromAssets, setShowFromAssets] =
    useState(false);

  const [showToAssets, setShowToAssets] =
    useState(false);

  const [slippage, setSlippage] =
    useState("0.50");

  const [swapLoading, setSwapLoading] =
    useState(false);

  const [serverQuote, setServerQuote] =
    useState<QuoteResponse | null>(null);

  /*
   * --------------------------------------------------
   * PROFILE
   * --------------------------------------------------
   */

  const loadProfile = useCallback(
    async () => {
      try {
        const {
          data: { user },
        } =
          await supabase.auth.getUser();

        if (!user) {
          router.replace("/login");
          return;
        }

        const {
          data,
          error: profileError,
        } =
          await supabase
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
      } catch (profileLoadError) {
        setError(
          getErrorMessage(
            profileLoadError,
            "Unable to load your account."
          )
        );
      } finally {
        setLoading(false);
      }
    },
    [router, supabase]
  );

  /*
   * --------------------------------------------------
   * MARKET DATA
   * --------------------------------------------------
   */

  const loadMarkets = useCallback(
    async () => {
      setMarketLoading(true);
      setMarketError("");

      try {
        const response =
          await fetch(
            "/api/market",
            {
              method: "GET",
              cache: "no-store",
              headers: {
                Accept:
                  "application/json",
              },
            }
          );

        let payload:
          | MarketApiResponse
          | null = null;

        try {
          payload =
            (await response.json()) as MarketApiResponse;
        } catch {
          payload = null;
        }

        if (!response.ok) {
          throw new Error(
            payload?.message ||
              payload?.error ||
              "Unable to load current market prices."
          );
        }

        const received =
          payload?.markets ??
          payload?.assets ??
          payload?.data ??
          [];

        if (!Array.isArray(received)) {
          throw new Error(
            "Invalid market response."
          );
        }

        const normalized: MarketAsset[] =
          received
            .filter(
              (asset) =>
                asset &&
                typeof asset.symbol ===
                  "string"
            )
            .map((asset) => {
              const symbol =
                asset.symbol
                  .trim()
                  .toUpperCase();

              const price =
                normalizePrice(
                  symbol,
                  asset.price
                );

              const change =
                Number(
                  asset.change24h
                );

              return {
                id: asset.id,
                symbol,
                name:
                  asset.name ||
                  symbol,
                price:
                  price > 0
                    ? price
                    : null,
                change24h:
                  Number.isFinite(
                    change
                  )
                    ? change
                    : 0,
              };
            });

        /*
         * Always make CCT available.
         */
        const hasCct =
          normalized.some(
            (asset) =>
              asset.symbol === "CCT"
          );

        if (!hasCct) {
          normalized.unshift({
            id: "cct",
            symbol: "CCT",
            name:
              "Crypto Com Token",
            price: 1,
            change24h: 0,
          });
        }

        /*
         * Always make stablecoins available
         * as informational $1 assets if the
         * external market provider omitted them.
         */
        const hasUsdt =
          normalized.some(
            (asset) =>
              asset.symbol ===
              "USDT"
          );

        if (!hasUsdt) {
          normalized.push({
            id: "usdt-fallback",
            symbol: "USDT",
            name: "Tether",
            price: 1,
            change24h: 0,
          });
        }

        const hasUsdc =
          normalized.some(
            (asset) =>
              asset.symbol ===
              "USDC"
          );

        if (!hasUsdc) {
          normalized.push({
            id: "usdc-fallback",
            symbol: "USDC",
            name: "USD Coin",
            price: 1,
            change24h: 0,
          });
        }

        setMarkets(normalized);

        /*
         * Determine whether any real external
         * prices are available.
         */
        const externalPricesAvailable =
          normalized.some(
            (asset) =>
              asset.symbol !==
                "CCT" &&
              asset.symbol !==
                "USDT" &&
              asset.symbol !==
                "USDC" &&
              Number(asset.price) > 0
          );

        if (
          !externalPricesAvailable
        ) {
          setMarketError(
            "Live external market prices are temporarily unavailable."
          );
        }
      } catch (marketLoadError) {
        /*
         * Keep the calculator functional for
         * CCT and stablecoins if the market API
         * temporarily fails.
         */
        setMarkets([
          {
            id: "cct",
            symbol: "CCT",
            name:
              "Crypto Com Token",
            price: 1,
            change24h: 0,
          },
          {
            id: "usdt",
            symbol: "USDT",
            name: "Tether",
            price: 1,
            change24h: 0,
          },
          {
            id: "usdc",
            symbol: "USDC",
            name: "USD Coin",
            price: 1,
            change24h: 0,
          },
        ]);

        setMarketError(
          getErrorMessage(
            marketLoadError,
            "Unable to load live market prices."
          )
        );
      } finally {
        setMarketLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadProfile();
    void loadMarkets();

    const interval =
      window.setInterval(() => {
        void loadMarkets();
      }, 30_000);

    return () =>
      window.clearInterval(interval);
  }, [
    loadProfile,
    loadMarkets,
  ]);

  /*
   * --------------------------------------------------
   * AUTH
   * --------------------------------------------------
   */

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  /*
   * --------------------------------------------------
   * LIVE MARKET PRICES
   * --------------------------------------------------
   */

  const fromPrice = useMemo(
    () =>
      getMarketPrice(
        fromAsset,
        markets
      ),
    [fromAsset, markets]
  );

  const toPrice = useMemo(
    () =>
      getMarketPrice(
        toAsset,
        markets
      ),
    [toAsset, markets]
  );

  /*
   * --------------------------------------------------
   * LIVE CALCULATOR
   * --------------------------------------------------
   *
   * This calculator updates locally as the user
   * types.
   *
   * The server quote remains authoritative when
   * the user actually submits the swap.
   * --------------------------------------------------
   */

  const numericFromAmount =
    Number(fromAmount);

  const validInputAmount =
    Number.isFinite(
      numericFromAmount
    ) &&
    numericFromAmount > 0;

  /*
   * Conversion formula:
   *
   * 1 FROM =
   *
   * FROM USD PRICE
   * ----------------
   * TO USD PRICE
   *
   * Example:
   *
   * BTC = $83,000
   * ETH = $2,680
   *
   * 1 BTC =
   *
   * 83000 / 2680
   *
   * ETH
   */
  const liveExchangeRate =
    fromPrice > 0 &&
    toPrice > 0
      ? fromPrice / toPrice
      : 0;

  /*
   * Gross destination amount before
   * the platform fee.
   */
  const grossReceiveAmount =
    validInputAmount &&
    liveExchangeRate > 0
      ? numericFromAmount *
        liveExchangeRate
      : 0;

  /*
   * Estimated destination amount after
   * the 0.50% platform fee.
   */
  const calculatedReceiveAmount =
    grossReceiveAmount > 0
      ? grossReceiveAmount *
        (1 - DISPLAY_FEE_RATE)
      : 0;

  const estimatedReceive =
    calculatedReceiveAmount;

  /*
   * USD value of the source amount.
   */
  const estimatedValueUsd =
    validInputAmount &&
    fromPrice > 0
      ? numericFromAmount *
        fromPrice
      : 0;

  /*
   * Estimated platform fee in USD.
   */
  const estimatedFee =
    estimatedValueUsd > 0
      ? estimatedValueUsd *
        DISPLAY_FEE_RATE
      : 0;

  /*
   * USD value of the destination after fee.
   */
  const netValueUsd =
    estimatedValueUsd > 0
      ? Math.max(
          estimatedValueUsd -
            estimatedFee,
          0
        )
      : 0;

  /*
   * --------------------------------------------------
   * SELECTED ASSETS
   * --------------------------------------------------
   */

  const selectedFromAsset =
    getAsset(fromAsset);

  const selectedToAsset =
    getAsset(toAsset);

  const displayName =
    profile?.full_name ||
    profile?.username ||
    "Investor";

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map(
        (part) =>
          part[0]?.toUpperCase()
      )
      .join("") || "U";

  /*
   * --------------------------------------------------
   * ASSET SELECTION
   * --------------------------------------------------
   */

  const chooseFromAsset = (
    symbol: string
  ) => {
    if (symbol === toAsset) {
      setToAsset(fromAsset);
    }

    setFromAsset(symbol);
    setShowFromAssets(false);
    setServerQuote(null);
    setError("");
    setSwapSuccess("");
  };

  const chooseToAsset = (
    symbol: string
  ) => {
    if (symbol === fromAsset) {
      setFromAsset(toAsset);
    }

    setToAsset(symbol);
    setShowToAssets(false);
    setServerQuote(null);
    setError("");
    setSwapSuccess("");
  };

  const reverseAssets = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setServerQuote(null);
    setError("");
    setSwapSuccess("");
  };

  /*
   * --------------------------------------------------
   * AMOUNT INPUT
   * --------------------------------------------------
   *
   * This deliberately does NOT call the server.
   * The target amount is recalculated immediately
   * from the current local market prices.
   * --------------------------------------------------
   */

  const handleAmountChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value =
      event.target.value;

    /*
     * Allow:
     *
     * 1
     * 1.
     * 1.5
     * 0.25
     *
     * but reject letters and multiple dots.
     */
    if (
      value === "" ||
      /^\d*\.?\d*$/.test(value)
    ) {
      setFromAmount(value);

      /*
       * An old quote must never remain visible
       * after the user changes the amount.
       */
      setServerQuote(null);

      setError("");
      setSwapSuccess("");
    }
  };

  /*
   * --------------------------------------------------
   * EXECUTE SWAP
   * --------------------------------------------------
   */

  const handleSwap = async () => {
    setError("");
    setSwapSuccess("");
    setServerQuote(null);

    if (swapLoading) {
      return;
    }

    if (!fromAmount.trim()) {
      setError(
        "Enter an amount to swap."
      );
      return;
    }

    if (
      !Number.isFinite(
        numericFromAmount
      ) ||
      numericFromAmount <= 0
    ) {
      setError(
        "Enter a valid amount."
      );
      return;
    }

    if (numericFromAmount > 1e30) {
      setError(
        "The amount entered is too large."
      );
      return;
    }

    if (fromAsset === toAsset) {
      setError(
        "The source and destination assets must be different."
      );
      return;
    }

    setSwapLoading(true);

    try {
      const {
        data: {
          session,
        },
        error: sessionError,
      } =
        await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(
          `Unable to verify your session: ${sessionError.message}`
        );
      }

      if (
        !session?.access_token
      ) {
        router.replace("/login");
        return;
      }

      /*
       * The browser sends only the user's
       * requested swap.
       *
       * The server independently obtains
       * the authoritative market price.
       */
      const quoteResponse =
        await fetch(
          "/api/swap/quote",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              fromAsset:
                fromAsset.toUpperCase(),
              toAsset:
                toAsset.toUpperCase(),
              fromAmount:
                numericFromAmount,
              slippage:
                Number(slippage),
            }),
            cache: "no-store",
          }
        );

      let quotePayload:
        | QuoteResponse
        | null = null;

      try {
        quotePayload =
          (await quoteResponse.json()) as QuoteResponse;
      } catch {
        quotePayload = null;
      }

      if (!quoteResponse.ok) {
        throw new Error(
          quotePayload?.message ||
            quotePayload?.error ||
            "Unable to create a secure swap quote."
        );
      }

      if (
        quotePayload?.success === false
      ) {
        throw new Error(
          quotePayload.message ||
            quotePayload.error ||
            "The server rejected the swap quote."
        );
      }

      /*
       * The current create_swap_quote()
       * function returns quote_id.
       *
       * Keep id as a fallback for compatibility.
       */
      const quoteId =
        quotePayload?.quote_id ||
        quotePayload?.id;

      if (!quoteId) {
        throw new Error(
          "The server did not return a valid swap quote."
        );
      }

      setServerQuote(
        quotePayload
      );

      /*
       * Execute the protected server quote.
       */
      const {
        data: executionData,
        error: executionError,
      } =
        await supabase.rpc(
          "execute_swap",
          {
            p_quote_id:
              quoteId,
          }
        );

      if (executionError) {
        throw new Error(
          executionError.message ||
            "The swap could not be executed."
        );
      }

      let result:
        | ExecuteSwapResponse
        | null = null;

      if (
        Array.isArray(
          executionData
        )
      ) {
        result =
          (executionData[0] ||
            null) as
            | ExecuteSwapResponse
            | null;
      } else {
        result =
          executionData as
            | ExecuteSwapResponse
            | null;
      }

      if (!result?.success) {
        throw new Error(
          result?.message ||
            result?.error ||
            "The swap was not completed."
        );
      }

      const reference =
        result.reference ||
        result.swap_id ||
        quoteId;

      const executedReceive =
        toPositiveNumber(
          result.receive_amount
        );

      const executedFrom =
        toPositiveNumber(
          result.from_amount
        );

      const executedToAsset =
        result.to_asset ||
        toAsset;

      setSwapSuccess(
        `Swap completed successfully. ${formatAmount(
          executedFrom ||
            numericFromAmount
        )} ${
          result.from_asset ||
          fromAsset
        } → ${formatAmount(
          executedReceive
        )} ${executedToAsset}. Reference: ${reference}`
      );

      setFromAmount("");
      setServerQuote(null);

      await loadMarkets();
    } catch (swapError) {
      setServerQuote(null);

      setError(
        getErrorMessage(
          swapError,
          "The swap could not be completed."
        )
      );
    } finally {
      setSwapLoading(false);
    }
  };

  /*
   * --------------------------------------------------
   * AVAILABLE ASSETS
   * --------------------------------------------------
   */

  const availableFromAssets =
    ASSETS.filter(
      (asset) =>
        asset.symbol !== toAsset
    );

  const availableToAssets =
    ASSETS.filter(
      (asset) =>
        asset.symbol !== fromAsset
    );

  /*
   * --------------------------------------------------
   * SERVER QUOTE DISPLAY
   * --------------------------------------------------
   */

  const quoteExchangeRate =
    serverQuote
      ? toPositiveNumber(
          serverQuote.exchange_rate
        )
      : 0;

  const quoteReceiveAmount =
    serverQuote
      ? toPositiveNumber(
          serverQuote.receive_amount
        )
      : 0;

  const quoteFeeAmount =
    serverQuote
      ? Math.max(
          Number(
            serverQuote.fee_amount
          ) || 0,
          0
        )
      : 0;

  const quoteFromAmount =
    serverQuote
      ? toPositiveNumber(
          serverQuote.from_amount
        )
      : 0;

  /*
   * The local calculation remains visible
   * while typing.
   *
   * A valid server quote takes precedence
   * only after the server has returned one.
   */
  const displayedReceiveAmount =
    serverQuote &&
    quoteReceiveAmount > 0
      ? quoteReceiveAmount
      : estimatedReceive;

  const displayedExchangeRate =
    quoteExchangeRate > 0
      ? quoteExchangeRate
      : liveExchangeRate;

  const displayedFee =
    serverQuote
      ? quoteFeeAmount
      : estimatedFee;

  /*
   * --------------------------------------------------
   * LOADING SCREEN
   * --------------------------------------------------
   */

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

          <p>
            Loading your swap terminal...
          </p>
        </div>
      </main>
    );
  }

  /*
   * --------------------------------------------------
   * PAGE
   * --------------------------------------------------
   */

  return (
    <main className="dashboard-page swap-page">
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
          sidebarOpen
            ? "open"
            : ""
        }`}
      >
        <div className="sidebar-brand">
          <BrandLogo compact />

          <button
            type="button"
            className="sidebar-close"
            aria-label="Close navigation"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            ×
          </button>
        </div>

        <div className="account-mini-card">
          <div className="mini-avatar">
            {initials}
          </div>

          <div className="mini-account-info">
            <strong>
              {displayName}
            </strong>

            <span>
              {profile?.account_id ||
                "CCT Account"}
            </span>
          </div>

          <span className="online-indicator" />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">
            PLATFORM
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

              <span className="menu-arrow">
                ›
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
                ⇄
              </span>

              <span className="menu-label">
                Transactions
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
                ➤
              </span>

              <span className="menu-label">
                Transfer
              </span>

              <span className="menu-arrow">
                ›
              </span>
            </Link>

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
              href="/dashboard/investments"
              className="sidebar-menu-item"
              onClick={() =>
                setSidebarOpen(false)
              }
            >
              <span className="menu-icon">
                ◉
              </span>

              <span className="menu-label">
                Investments
              </span>

              <span className="menu-arrow">
                ›
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
                ▥
              </span>

              <span className="menu-label">
                Markets
              </span>

              <span className="menu-arrow">
                ›
              </span>
            </Link>

            <Link
              href="/dashboard/swap"
              className="sidebar-menu-item active"
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
            className="sidebar-menu-item logout-button"
            onClick={logout}
          >
            <span className="menu-icon">
              ↪
            </span>

            <span className="menu-label">
              Sign Out
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
              aria-label="Open navigation"
              onClick={() =>
                setSidebarOpen(true)
              }
            >
              <span />
              <span />
              <span />
            </button>

            <div>
              <div className="header-eyebrow">
                EXCHANGE TERMINAL
              </div>

              <h1>Swap</h1>
            </div>
          </div>

          <div className="header-actions">
            <Link
              href="/dashboard/markets"
              className="header-action-button"
            >
              <span>▥</span>
              <span>Markets</span>
            </Link>

            <div className="header-account">
              <div className="account-info">
                <strong>
                  {displayName}
                </strong>

                <span>
                  {profile?.account_id ||
                    "CCT Account"}
                </span>
              </div>

              <div className="account-avatar">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {error && (
          <div className="dashboard-alert error">
            <span>!</span>
            <p>{error}</p>
          </div>
        )}

        {swapSuccess && (
          <div className="dashboard-alert success">
            <span>✓</span>
            <p>{swapSuccess}</p>
          </div>
        )}

        <div className="swap-page-heading">
          <div>
            <span className="section-eyebrow">
              DIGITAL ASSET EXCHANGE
            </span>

            <h2>
              Swap assets instantly.
            </h2>

            <p>
              Exchange CCT and supported
              digital assets through the
              Crypto Com Exchange platform.
            </p>
          </div>

          <div className="swap-live-indicator">
            <span className="swap-live-dot" />

            <span>
              {marketLoading
                ? "Updating prices"
                : marketError
                ? "Market fallback active"
                : "Market prices live"}
            </span>
          </div>
        </div>

        <div className="swap-layout">
          <section className="swap-terminal-card">
            <div className="swap-terminal-header">
              <div>
                <span className="section-eyebrow">
                  SWAP TERMINAL
                </span>

                <h3>Exchange</h3>
              </div>

              <div className="swap-terminal-status">
                <span />
                Secure
              </div>
            </div>

            <div className="swap-form">

              {/* SEND */}

              <div className="swap-asset-block">
                <div className="swap-field-label">
                  <span>
                    YOU SEND
                  </span>

                  <span>
                    {fromPrice > 0
                      ? `1 ${fromAsset} = ${formatUsd(
                          fromPrice
                        )}`
                      : "Price unavailable"}
                  </span>
                </div>

                <div className="swap-input-panel">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={fromAmount}
                    onChange={
                      handleAmountChange
                    }
                    placeholder="0.00"
                    aria-label="Amount to send"
                    disabled={
                      swapLoading
                    }
                  />

                  <div className="swap-asset-selector-wrapper">
                    <button
                      type="button"
                      className="swap-asset-selector"
                      onClick={() =>
                        setShowFromAssets(
                          !showFromAssets
                        )
                      }
                      disabled={
                        swapLoading
                      }
                    >
                      <span
                        className={`swap-asset-icon swap-${fromAsset.toLowerCase()}`}
                      >
                        {
                          selectedFromAsset?.icon
                        }
                      </span>

                      <span className="swap-selected-asset">
                        <strong>
                          {fromAsset}
                        </strong>

                        <small>
                          {
                            selectedFromAsset?.name
                          }
                        </small>
                      </span>

                      <span className="swap-chevron">
                        ⌄
                      </span>
                    </button>

                    {showFromAssets && (
                      <div className="swap-asset-menu">
                        {availableFromAssets.map(
                          (asset) => (
                            <button
                              type="button"
                              key={
                                asset.symbol
                              }
                              onClick={() =>
                                chooseFromAsset(
                                  asset.symbol
                                )
                              }
                            >
                              <span
                                className={`swap-asset-icon swap-${asset.symbol.toLowerCase()}`}
                              >
                                {
                                  asset.icon
                                }
                              </span>

                              <span>
                                <strong>
                                  {
                                    asset.symbol
                                  }
                                </strong>

                                <small>
                                  {
                                    asset.name
                                  }
                                </small>
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="swap-field-footer">
                  <span>
                    Market value
                  </span>

                  <strong>
                    {formatUsd(
                      estimatedValueUsd
                    )}
                  </strong>
                </div>
              </div>

              {/* REVERSE */}

              <div className="swap-reverse-row">
                <div className="swap-line" />

                <button
                  type="button"
                  className="swap-reverse-button"
                  onClick={
                    reverseAssets
                  }
                  aria-label="Reverse swap assets"
                  disabled={
                    swapLoading
                  }
                >
                  ⇅
                </button>

                <div className="swap-line" />
              </div>

              {/* RECEIVE */}

              <div className="swap-asset-block">
                <div className="swap-field-label">
                  <span>
                    YOU RECEIVE
                  </span>

                  <span>
                    {toPrice > 0
                      ? `1 ${toAsset} = ${formatUsd(
                          toPrice
                        )}`
                      : "Price unavailable"}
                  </span>
                </div>

                <div className="swap-input-panel receive">
                  <div className="swap-receive-amount">
                    {displayedReceiveAmount >
                    0
                      ? formatAmount(
                          displayedReceiveAmount
                        )
                      : "0.00"}
                  </div>

                  <div className="swap-asset-selector-wrapper">
                    <button
                      type="button"
                      className="swap-asset-selector"
                      onClick={() =>
                        setShowToAssets(
                          !showToAssets
                        )
                      }
                      disabled={
                        swapLoading
                      }
                    >
                      <span
                        className={`swap-asset-icon swap-${toAsset.toLowerCase()}`}
                      >
                        {
                          selectedToAsset?.icon
                        }
                      </span>

                      <span className="swap-selected-asset">
                        <strong>
                          {toAsset}
                        </strong>

                        <small>
                          {
                            selectedToAsset?.name
                          }
                        </small>
                      </span>

                      <span className="swap-chevron">
                        ⌄
                      </span>
                    </button>

                    {showToAssets && (
                      <div className="swap-asset-menu">
                        {availableToAssets.map(
                          (asset) => (
                            <button
                              type="button"
                              key={
                                asset.symbol
                              }
                              onClick={() =>
                                chooseToAsset(
                                  asset.symbol
                                )
                              }
                            >
                              <span
                                className={`swap-asset-icon swap-${asset.symbol.toLowerCase()}`}
                              >
                                {
                                  asset.icon
                                }
                              </span>

                              <span>
                                <strong>
                                  {
                                    asset.symbol
                                  }
                                </strong>

                                <small>
                                  {
                                    asset.name
                                  }
                                </small>
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="swap-field-footer">
                  <span>
                    Estimated value
                  </span>

                  <strong>
                    {formatUsd(
                      netValueUsd
                    )}
                  </strong>
                </div>
              </div>

              {/* LIVE CALCULATION */}

              <div className="swap-live-calculation">
                <div>
                  <span>
                    LIVE RATE
                  </span>

                  <strong>
                    1 {fromAsset} ≈{" "}
                    {liveExchangeRate >
                    0
                      ? formatAmount(
                          liveExchangeRate
                        )
                      : "—"}{" "}
                    {toAsset}
                  </strong>
                </div>

                <div>
                  <span>
                    AFTER 0.50% FEE
                  </span>

                  <strong>
                    {estimatedReceive >
                    0
                      ? formatAmount(
                          estimatedReceive
                        )
                      : "—"}{" "}
                    {toAsset}
                  </strong>
                </div>
              </div>

              {marketError && (
                <div className="swap-market-warning">
                  <span>!</span>

                  <div>
                    <strong>
                      Market data notice
                    </strong>

                    <p>
                      {marketError}
                    </p>

                    <small>
                      The displayed price is
                      informational. Final
                      execution uses the
                      server-side quote.
                    </small>
                  </div>
                </div>
              )}

              {serverQuote && (
                <div className="swap-quote-preview">
                  <div>
                    <span>
                      SERVER QUOTE
                    </span>

                    <strong>
                      {quoteFromAmount > 0
                        ? formatAmount(
                            quoteFromAmount
                          )
                        : fromAmount}{" "}
                      {fromAsset}
                      {" → "}
                      {formatAmount(
                        quoteReceiveAmount
                      )}{" "}
                      {toAsset}
                    </strong>
                  </div>

                  <div>
                    <span>
                      RATE
                    </span>

                    <strong>
                      1 {fromAsset} ≈{" "}
                      {formatAmount(
                        quoteExchangeRate
                      )}{" "}
                      {toAsset}
                    </strong>
                  </div>

                  <div>
                    <span>
                      FEE
                    </span>

                    <strong>
                      {formatUsd(
                        quoteFeeAmount
                      )}
                    </strong>
                  </div>
                </div>
              )}

              {error && (
                <div className="swap-form-error">
                  <span>!</span>
                  <p>{error}</p>
                </div>
              )}

              {swapSuccess && (
                <div className="swap-form-success">
                  <span>✓</span>

                  <p>
                    {swapSuccess}
                  </p>
                </div>
              )}

              <button
                type="button"
                className="swap-submit"
                onClick={
                  handleSwap
                }
                disabled={
                  swapLoading ||
                  !fromAmount ||
                  !validInputAmount ||
                  fromAsset ===
                    toAsset
                }
              >
                {swapLoading ? (
                  <>
                    <span className="swap-button-loading">
                      <span className="swap-button-spinner" />

                      Getting secure quote...
                    </span>

                    <span>
                      ↻
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      Swap {fromAsset}{" "}
                      for {toAsset}
                    </span>

                    <span>
                      →
                    </span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* RIGHT COLUMN */}

          <aside className="swap-details-column">
            <section className="swap-summary-card">
              <div className="swap-card-heading">
                <div>
                  <span className="section-eyebrow">
                    QUOTE DETAILS
                  </span>

                  <h3>
                    Swap summary
                  </h3>
                </div>

                <span className="swap-summary-icon">
                  ◈
                </span>
              </div>

              <div className="swap-summary-rate">
                <span>
                  Exchange rate
                </span>

                <strong>
                  1 {fromAsset} ≈{" "}
                  {displayedExchangeRate >
                  0
                    ? formatAmount(
                        displayedExchangeRate
                      )
                    : "—"}{" "}
                  {toAsset}
                </strong>
              </div>

              <div className="swap-detail-list">
                <div>
                  <span>
                    Send asset price
                  </span>

                  <strong>
                    1 {fromAsset} ={" "}
                    {fromPrice > 0
                      ? `$${formatPrice(
                          fromPrice
                        )}`
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Receive asset price
                  </span>

                  <strong>
                    1 {toAsset} ={" "}
                    {toPrice > 0
                      ? `$${formatPrice(
                          toPrice
                        )}`
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>
                    Platform fee
                  </span>

                  <strong>
                    {serverQuote?.fee_rate !==
                    undefined
                      ? `${(
                          Number(
                            serverQuote.fee_rate
                          ) *
                          100
                        ).toFixed(2)}%`
                      : "0.50%"}
                  </strong>
                </div>

                <div>
                  <span>
                    Estimated fee
                  </span>

                  <strong>
                    {formatUsd(
                      displayedFee
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Slippage tolerance
                  </span>

                  <strong>
                    {slippage}%
                  </strong>
                </div>
              </div>
            </section>

            <section className="swap-settings-card">
              <div className="swap-card-heading">
                <div>
                  <span className="section-eyebrow">
                    EXECUTION SETTINGS
                  </span>

                  <h3>
                    Slippage
                  </h3>
                </div>

                <span className="swap-settings-icon">
                  ⚙
                </span>
              </div>

              <p>
                Maximum price movement accepted
                by the server-side quote process.
              </p>

              <div className="swap-slippage-options">
                {[
                  "0.10",
                  "0.50",
                  "1.00",
                ].map(
                  (value) => (
                    <button
                      type="button"
                      key={value}
                      className={
                        slippage ===
                        value
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setSlippage(
                          value
                        );

                        setServerQuote(
                          null
                        );
                      }}
                      disabled={
                        swapLoading
                      }
                    >
                      {value}%
                    </button>
                  )
                )}
              </div>

              <div className="swap-security-note">
                <span>✓</span>

                <p>
                  The browser displays a
                  live estimate. The server
                  independently calculates the
                  authoritative execution
                  quote before the transaction
                  is completed.
                </p>
              </div>
            </section>

            <section className="swap-cct-card">
              <div className="swap-cct-symbol">
                C
              </div>

              <div>
                <span className="section-eyebrow">
                  PLATFORM ASSET
                </span>

                <h3>
                  Crypto Com Token
                </h3>

                <p>
                  CCT reference value
                  <strong>
                    {" "}
                    $1.00
                  </strong>
                </p>
              </div>
            </section>
          </aside>
        </div>

        {/* SUPPORTED ASSETS */}

        <section className="swap-supported-section">
          <div className="swap-supported-heading">
            <div>
              <span className="section-eyebrow">
                SUPPORTED ASSETS
              </span>

              <h2>
                Available swap pairs
              </h2>
            </div>

            <Link href="/dashboard/markets">
              View Markets →
            </Link>
          </div>

          <div className="swap-pairs-grid">
            {ASSETS.filter(
              (asset) =>
                asset.symbol !==
                "CCT"
            ).map(
              (asset) => {
                const price =
                  getMarketPrice(
                    asset.symbol,
                    markets
                  );

                return (
                  <button
                    type="button"
                    className="swap-pair-card"
                    key={
                      asset.symbol
                    }
                    onClick={() => {
                      setFromAsset(
                        "CCT"
                      );

                      setToAsset(
                        asset.symbol
                      );

                      setFromAmount(
                        ""
                      );

                      setServerQuote(
                        null
                      );

                      setError("");
                      setSwapSuccess(
                        ""
                      );
                    }}
                    disabled={
                      swapLoading
                    }
                  >
                    <span
                      className={`swap-pair-icon swap-${asset.symbol.toLowerCase()}`}
                    >
                      {
                        asset.icon
                      }
                    </span>

                    <span className="swap-pair-info">
                      <strong>
                        {
                          asset.symbol
                        }
                      </strong>

                      <small>
                        {
                          asset.name
                        }
                      </small>
                    </span>

                    <span className="swap-pair-price">
                      {price > 0
                        ? `$${formatPrice(
                            price
                          )}`
                        : "—"}
                    </span>
                  </button>
                );
              }
            )}
          </div>
        </section>

        <section className="swap-bottom-notice">
          <div className="swap-bottom-icon">
            ✓
          </div>

          <div>
            <span className="section-eyebrow">
              SECURE EXCHANGE
            </span>

            <h3>
              Your balances are protected by
              server-side transaction controls.
            </h3>

            <p>
              Market prices displayed on this
              page are live informational
              estimates. When you submit a
              swap, the trusted server creates
              the authoritative short-lived
              quote. The protected Supabase
              function validates the quote,
              verifies your current balance,
              locks the relevant wallet rows,
              updates the balances and creates
              the appropriate ledger records
              atomically.
            </p>
          </div>
        </section>
      </section>
    </main>
  );
}

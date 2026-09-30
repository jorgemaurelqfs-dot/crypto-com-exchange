"use client";

import Link from "next/link";
import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import "../dashboard.css";
import BrandLogo from "../../../components/BrandLogo";
import { createClient } from "../../../lib/supabase/client";
import {
  getRuntimePlatformSettings,
  getSettingBoolean,
  getSettingNumber,
} from "../../../lib/platform-settings";

type Profile = {
  id: string;
  account_id: string;
  username: string | null;
  full_name: string | null;
  account_status: string;
  verification_status: string;
};

type Withdrawal = {
  id: string;
  reference: string;
  asset_symbol: string;
  network: string;
  amount: number | string;
  fee: number | string;
  destination_address: string;
  destination_tag: string | null;
  status: string;
  transaction_hash: string | null;
  user_note: string | null;
  admin_note: string | null;
  created_at: string;
};

type AssetOption = {
  symbol: string;
  name: string;
  networks: string[];
};

type WalletBalance = {
  symbol: string;
  name: string;
  available: number;
  locked: number;
};

type MarketPrice = {
  symbol: string;
  price: number;
};

type RuntimeSettings = Record<string, unknown>;

type PendingWithdrawal = {
  asset: string;
  network: string;
  amount: number;
  destination: string;
  destinationTag: string | null;
  userNote: string | null;
};

const ASSETS: AssetOption[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    networks: ["Bitcoin"],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    networks: ["Ethereum"],
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    networks: ["TRC20", "ERC20", "BEP20"],
  },
  {
    symbol: "BNB",
    name: "BNB",
    networks: ["BEP20"],
  },
  {
    symbol: "SOL",
    name: "Solana",
    networks: ["Solana"],
  },
  {
    symbol: "XRP",
    name: "XRP",
    networks: ["XRP"],
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    networks: ["ERC20", "BEP20", "Solana"],
  },
  {
    symbol: "ADA",
    name: "Cardano",
    networks: ["Cardano"],
  },
  {
    symbol: "DOGE",
    name: "Dogecoin",
    networks: ["Dogecoin"],
  },
  {
    symbol: "AVAX",
    name: "Avalanche",
    networks: ["Avalanche C-Chain"],
  },
];

const ALL_WALLETS: {
  symbol: string;
  name: string;
}[] = [
  {
    symbol: "CCT",
    name: "Platform Asset",
  },
  ...ASSETS.map((asset) => ({
    symbol: asset.symbol,
    name: asset.name,
  })),
];

function toNumber(
  value: number | string | null | undefined
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function formatAmount(
  value: number | string | null | undefined
): string {
  const amount = toNumber(value);

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(amount);
}

function formatUSD(
  value: number | string | null | undefined
): string {
  const amount = toNumber(value);

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPrice(value: number): string {
  if (value <= 0) {
    return "$0.00";
  }

  if (value < 0.01) {
    return `$${value.toFixed(8)}`;
  }

  if (value < 1) {
    return `$${value.toFixed(4)}`;
  }

  if (value < 100) {
    return `$${value.toFixed(2)}`;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortenAddress(
  value: string | null | undefined
): string {
  if (!value) {
    return "—";
  }

  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 9)}...${value.slice(-8)}`;
}

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function assetIcon(symbol: string): string {
  switch (symbol) {
    case "BTC":
      return "₿";

    case "ETH":
      return "Ξ";

    case "USDT":
      return "₮";

    case "BNB":
      return "◆";

    case "SOL":
      return "S";

    case "XRP":
      return "X";

    case "USDC":
      return "$";

    case "ADA":
      return "₳";

    case "DOGE":
      return "Ð";

    case "AVAX":
      return "A";

    case "CCT":
      return "C";

    default:
      return symbol.slice(0, 1);
  }
}

function normalizeMarketData(
  payload: unknown
): MarketPrice[] {
  if (!payload) {
    return [];
  }

  const raw = payload as any;

  const source =
    raw?.assets ??
    raw?.data ??
    raw?.prices ??
    raw?.markets ??
    raw;

  if (Array.isArray(source)) {
    return source
      .map((item: any) => {
        const symbol = String(
          item?.symbol ??
            item?.asset_symbol ??
            item?.asset ??
            item?.base ??
            ""
        )
          .toUpperCase()
          .replace(/-USD$/i, "")
          .replace(/\/USD$/i, "");

        const price = toNumber(
          item?.price ??
            item?.current_price ??
            item?.usd ??
            item?.price_usd ??
            item?.value
        );

        if (!symbol || price <= 0) {
          return null;
        }

        return {
          symbol,
          price,
        };
      })
      .filter(Boolean) as MarketPrice[];
  }

  if (
    typeof source === "object" &&
    source !== null
  ) {
    return Object.entries(source)
      .map(([key, value]: [string, any]) => {
        const symbol = key
          .toUpperCase()
          .replace(/-USD$/i, "")
          .replace(/\/USD$/i, "");

        const price =
          typeof value === "number"
            ? value
            : toNumber(
                value?.price ??
                  value?.current_price ??
                  value?.usd ??
                  value?.price_usd ??
                  value?.value
              );

        if (!symbol || price <= 0) {
          return null;
        }

        return {
          symbol,
          price,
        };
      })
      .filter(Boolean) as MarketPrice[];
  }

  return [];
}

function extractRpcReference(
  payload: unknown
): string | null {
  if (!payload) {
    return null;
  }

  if (
    typeof payload === "object" &&
    payload !== null
  ) {
    const value = payload as Record<
      string,
      unknown
    >;

    const directCandidates = [
      value.reference,
      value.withdrawal_reference,
      value.transaction_reference,
    ];

    for (const candidate of directCandidates) {
      if (
        typeof candidate === "string" &&
        candidate.trim()
      ) {
        return candidate;
      }
    }

    const nestedCandidates = [
      value.data,
      value.result,
      value.withdrawal,
    ];

    for (const nested of nestedCandidates) {
      const nestedReference =
        extractRpcReference(nested);

      if (nestedReference) {
        return nestedReference;
      }
    }
  }

  return null;
}

function extractRpcFee(
  payload: unknown
): number | null {
  if (!payload) {
    return null;
  }

  if (
    typeof payload === "object" &&
    payload !== null
  ) {
    const value = payload as Record<
      string,
      unknown
    >;

    const directCandidates = [
      value.fee,
      value.withdrawal_fee,
      value.asset_fee,
    ];

    for (const candidate of directCandidates) {
      if (
        candidate !== null &&
        candidate !== undefined &&
        Number.isFinite(Number(candidate))
      ) {
        return Number(candidate);
      }
    }

    const nestedCandidates = [
      value.data,
      value.result,
      value.withdrawal,
    ];

    for (const nested of nestedCandidates) {
      const nestedFee =
        extractRpcFee(nested);

      if (nestedFee !== null) {
        return nestedFee;
      }
    }
  }

  return null;
}

export default function WithdrawPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [withdrawals, setWithdrawals] =
    useState<Withdrawal[]>([]);

  const [walletBalances, setWalletBalances] =
    useState<WalletBalance[]>([]);

  const [marketPrices, setMarketPrices] =
    useState<Record<string, number>>({});

  const [runtimeSettings, setRuntimeSettings] =
    useState<RuntimeSettings>({});

  const [selectedAsset, setSelectedAsset] =
    useState("USDT");

  const [selectedNetwork, setSelectedNetwork] =
    useState("TRC20");

  const [amount, setAmount] =
    useState("");

  const [
    destinationAddress,
    setDestinationAddress,
  ] = useState("");

  const [destinationTag, setDestinationTag] =
    useState("");

  const [userNote, setUserNote] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [walletsLoading, setWalletsLoading] =
    useState(true);

  const [marketLoading, setMarketLoading] =
    useState(true);

  const [settingsLoading, setSettingsLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /*
   * Custom confirmation modal state.
   *
   * This completely replaces window.confirm(),
   * which was responsible for the native:
   *
   * "localhost:3000 says..."
   *
   * browser dialog.
   */
  const [
    confirmationOpen,
    setConfirmationOpen,
  ] = useState(false);

  const [
    pendingWithdrawal,
    setPendingWithdrawal,
  ] =
    useState<PendingWithdrawal | null>(
      null
    );

  const currentAsset = useMemo(
    () =>
      ASSETS.find(
        (asset) =>
          asset.symbol === selectedAsset
      ) ?? ASSETS[0],
    [selectedAsset]
  );

  const selectedWallet = useMemo(
    () =>
      walletBalances.find(
        (wallet) =>
          wallet.symbol === selectedAsset
      ) ?? null,
    [walletBalances, selectedAsset]
  );

  const selectedAvailableBalance =
    selectedWallet?.available ?? 0;

  const selectedLockedBalance =
    selectedWallet?.locked ?? 0;

  const selectedMarketPrice = useMemo(() => {
    if (selectedAsset === "CCT") {
      return 1;
    }

    if (
      selectedAsset === "USDT" ||
      selectedAsset === "USDC"
    ) {
      return (
        marketPrices[selectedAsset] || 1
      );
    }

    return (
      marketPrices[selectedAsset] || 0
    );
  }, [
    marketPrices,
    selectedAsset,
  ]);

  const selectedTotalUSD =
    selectedAvailableBalance *
    selectedMarketPrice;

  const totalPortfolioUSD = useMemo(() => {
    return walletBalances.reduce(
      (total, wallet) => {
        const price =
          wallet.symbol === "CCT"
            ? 1
            : marketPrices[
                wallet.symbol
              ] ??
              (wallet.symbol === "USDT" ||
              wallet.symbol === "USDC"
                ? 1
                : 0);

        return (
          total +
          wallet.available * price
        );
      },
      0
    );
  }, [
    walletBalances,
    marketPrices,
  ]);

  const withdrawalsEnabled =
    getSettingBoolean(
      runtimeSettings,
      "withdrawals.enabled",
      true
    );

  const maintenanceMode =
    getSettingBoolean(
      runtimeSettings,
      "operation.maintenance_mode",
      false
    );

  const readOnlyMode =
    getSettingBoolean(
      runtimeSettings,
      "operation.read_only_mode",
      false
    );

  const requireVerification =
    getSettingBoolean(
      runtimeSettings,
      "verification.require_before_withdrawal",
      false
    );

  const withdrawalConfirmation =
    getSettingBoolean(
      runtimeSettings,
      "security.withdrawal_confirmation",
      true
    );

  const manualReview =
    getSettingBoolean(
      runtimeSettings,
      "withdrawals.manual_review",
      true
    );

  const cooldownMinutes =
    getSettingNumber(
      runtimeSettings,
      "withdrawals.cooldown_minutes",
      0
    );

  const dailyLimit =
    getSettingNumber(
      runtimeSettings,
      "withdrawals.daily_limit",
      0
    );

  const monthlyLimit =
    getSettingNumber(
      runtimeSettings,
      "withdrawals.monthly_limit",
      0
    );

  const withdrawalDisabled =
    !withdrawalsEnabled ||
    maintenanceMode ||
    readOnlyMode;

  const verificationBlocked =
    requireVerification &&
    profile !== null &&
    profile.verification_status.toLowerCase() !==
      "verified";

  async function loadWalletBalances(
    userId: string
  ) {
    setWalletsLoading(true);

    try {
      const [
        cctResult,
        assetResult,
      ] = await Promise.all([
        supabase
          .from("cct_wallets")
          .select(
            "available_balance, locked_balance"
          )
          .eq("user_id", userId)
          .maybeSingle(),

        supabase
          .from("asset_wallets")
          .select(
            "asset_symbol, available_balance, locked_balance"
          )
          .eq("user_id", userId),
      ]);

      if (cctResult.error) {
        throw new Error(
          `Unable to load CCT wallet: ${cctResult.error.message}`
        );
      }

      if (assetResult.error) {
        throw new Error(
          `Unable to load asset wallets: ${assetResult.error.message}`
        );
      }

      const externalWalletMap =
        new Map<
          string,
          {
            available_balance:
              | number
              | string
              | null;
            locked_balance:
              | number
              | string
              | null;
          }
        >();

      for (
        const row of assetResult.data ?? []
      ) {
        externalWalletMap.set(
          String(
            row.asset_symbol
          ).toUpperCase(),
          {
            available_balance:
              row.available_balance,
            locked_balance:
              row.locked_balance,
          }
        );
      }

      const mergedWallets: WalletBalance[] =
        ALL_WALLETS.map((asset) => {
          if (asset.symbol === "CCT") {
            return {
              symbol: asset.symbol,
              name: asset.name,
              available: toNumber(
                cctResult.data
                  ?.available_balance
              ),
              locked: toNumber(
                cctResult.data
                  ?.locked_balance
              ),
            };
          }

          const row =
            externalWalletMap.get(
              asset.symbol
            );

          return {
            symbol: asset.symbol,
            name: asset.name,
            available: toNumber(
              row?.available_balance
            ),
            locked: toNumber(
              row?.locked_balance
            ),
          };
        });

      setWalletBalances(
        mergedWallets
      );
    } finally {
      setWalletsLoading(false);
    }
  }

  async function loadMarketPrices() {
    setMarketLoading(true);

    try {
      const response = await fetch(
        "/api/market",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Market price request failed."
        );
      }

      const payload =
        await response.json();

      const normalized =
        normalizeMarketData(
          payload
        );

      const prices: Record<
        string,
        number
      > = {};

      for (const item of normalized) {
        prices[item.symbol] =
          item.price;
      }

      prices.CCT = 1;

      if (!prices.USDT) {
        prices.USDT = 1;
      }

      if (!prices.USDC) {
        prices.USDC = 1;
      }

      setMarketPrices(prices);
    } catch (marketError) {
      console.error(
        "Market price error:",
        marketError
      );

      setMarketPrices({
        CCT: 1,
        USDT: 1,
        USDC: 1,
      });
    } finally {
      setMarketLoading(false);
    }
  }

  async function loadWithdrawals(
    userId: string
  ) {
    const {
      data,
      error: withdrawalError,
    } = await supabase
      .from("withdrawals")
      .select(
        `
          id,
          reference,
          asset_symbol,
          network,
          amount,
          fee,
          destination_address,
          destination_tag,
          status,
          transaction_hash,
          user_note,
          admin_note,
          created_at
        `
      )
      .eq(
        "user_id",
        userId
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (withdrawalError) {
      throw new Error(
        `Unable to load withdrawals: ${withdrawalError.message}`
      );
    }

    setWithdrawals(
      data ?? []
    );
  }

  async function loadRuntimeSettings() {
    setSettingsLoading(true);

    try {
      const settings =
        await getRuntimePlatformSettings();

      setRuntimeSettings(
        settings
      );
    } catch (settingsError) {
      console.error(
        "Platform settings error:",
        settingsError
      );

      setRuntimeSettings({});
    } finally {
      setSettingsLoading(false);
    }
  }

  async function refreshWalletsAndWithdrawals(
    userId: string
  ) {
    await Promise.all([
      loadWalletBalances(userId),
      loadWithdrawals(userId),
    ]);
  }

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      setLoading(true);
      setError("");

      try {
        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (!session?.user) {
          router.push("/login");
          return;
        }

        const [
          profileResult,
          withdrawalResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(
              "id, account_id, username, full_name, account_status, verification_status"
            )
            .eq(
              "id",
              session.user.id
            )
            .maybeSingle(),

          supabase
            .from("withdrawals")
            .select(
              `
                id,
                reference,
                asset_symbol,
                network,
                amount,
                fee,
                destination_address,
                destination_tag,
                status,
                transaction_hash,
                user_note,
                admin_note,
                created_at
              `
            )
            .eq(
              "user_id",
              session.user.id
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            ),
        ]);

        if (profileResult.error) {
          throw new Error(
            `Unable to load profile: ${profileResult.error.message}`
          );
        }

        if (withdrawalResult.error) {
          throw new Error(
            `Unable to load withdrawals: ${withdrawalResult.error.message}`
          );
        }

        if (!mounted) {
          return;
        }

        setProfile(
          profileResult.data
        );

        setWithdrawals(
          withdrawalResult.data ??
            []
        );

        await Promise.all([
          loadWalletBalances(
            session.user.id
          ),
          loadMarketPrices(),
          loadRuntimeSettings(),
        ]);
      } catch (loadError) {
        console.error(
          loadError
        );

        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the withdrawal page."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadPage();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          loadMarketPrices();
        },
        30_000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, []);

  useEffect(() => {
    if (!currentAsset) {
      return;
    }

    if (
      !currentAsset.networks.includes(
        selectedNetwork
      )
    ) {
      setSelectedNetwork(
        currentAsset.networks[0] ??
          ""
      );
    }
  }, [
    currentAsset,
    selectedNetwork,
  ]);

  function selectAsset(
    symbol: string
  ) {
    if (symbol === "CCT") {
      return;
    }

    const asset =
      ASSETS.find(
        (item) =>
          item.symbol === symbol
      );

    if (!asset) {
      return;
    }

    setSelectedAsset(
      symbol
    );

    setSelectedNetwork(
      asset.networks[0] ?? ""
    );

    setAmount("");
    setError("");
    setSuccess("");
  }

  function handleMaxAmount() {
    if (
      selectedAvailableBalance <=
      0
    ) {
      return;
    }

    setAmount(
      String(
        selectedAvailableBalance
      )
    );

    setError("");
  }

  /*
   * Performs the actual withdrawal RPC.
   *
   * This function is deliberately separate from
   * handleSubmit() so the custom confirmation modal
   * can call it only after the user explicitly confirms.
   */
  async function submitWithdrawal(
    withdrawal: PendingWithdrawal
  ) {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const {
        data: { session },
      } =
        await supabase.auth.getSession();

      if (!session?.user) {
        router.push("/login");
        return;
      }

      /*
       * IMPORTANT:
       *
       * This is the exact database RPC supplied
       * for the withdrawal system.
       *
       * There is intentionally NO direct
       * .from("withdrawals").insert(...) here.
       */
      const {
        data: withdrawalResult,
        error: withdrawalRpcError,
      } =
        await supabase.rpc(
          "create_withdrawal_request",
          {
            p_asset_symbol:
              withdrawal.asset,

            p_network:
              withdrawal.network,

            p_amount:
              withdrawal.amount,

            p_destination_address:
              withdrawal.destination,

            p_saved_address_id:
              null,

            p_destination_tag:
              withdrawal.destinationTag,

            p_user_note:
              withdrawal.userNote,
          }
        );

      if (
        withdrawalRpcError
      ) {
        throw new Error(
          withdrawalRpcError.message
        );
      }

      const reference =
        extractRpcReference(
          withdrawalResult
        );

      const returnedFee =
        extractRpcFee(
          withdrawalResult
        );

      const feeText =
        returnedFee !== null
          ? ` Fee: ${formatAmount(
              returnedFee
            )} ${withdrawal.asset}.`
          : "";

      setSuccess(
        `${formatAmount(
          withdrawal.amount
        )} ${withdrawal.asset} withdrawal request submitted.${feeText}${
          reference
            ? ` Reference: ${reference}.`
            : ""
        }${
          manualReview
            ? " Your request will be reviewed before processing."
            : ""
        }`
      );

      setAmount("");
      setDestinationAddress("");
      setDestinationTag("");
      setUserNote("");

      setConfirmationOpen(false);
      setPendingWithdrawal(null);

      await refreshWalletsAndWithdrawals(
        session.user.id
      );
    } catch (submitError) {
      console.error(
        "Withdrawal submission error:",
        submitError
      );

      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit your withdrawal request."
      );

      /*
       * Close the modal if the server rejected
       * the withdrawal. The error alert on the
       * page will display the actual reason.
       */
      setConfirmationOpen(false);
      setPendingWithdrawal(null);
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * This performs client-side UX validation and,
   * when confirmation is enabled, opens the custom
   * confirmation modal instead of window.confirm().
   */
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError("");
    setSuccess("");

    const cleanAmount =
      Number(amount);

    const cleanAddress =
      destinationAddress.trim();

    if (
      !Number.isFinite(
        cleanAmount
      ) ||
      cleanAmount <= 0
    ) {
      setError(
        "Enter a valid withdrawal amount."
      );
      return;
    }

    if (
      cleanAmount >
      selectedAvailableBalance
    ) {
      setError(
        `Insufficient ${selectedAsset} balance. Available: ${formatAmount(
          selectedAvailableBalance
        )} ${selectedAsset}.`
      );
      return;
    }

    if (!selectedNetwork) {
      setError(
        "Select a withdrawal network."
      );
      return;
    }

    if (!cleanAddress) {
      setError(
        "Enter the destination wallet address."
      );
      return;
    }

    if (
      selectedAsset ===
      "CCT"
    ) {
      setError(
        "CCT is an internal platform asset and cannot be withdrawn directly. Swap it to a supported external asset first."
      );
      return;
    }

    if (withdrawalDisabled) {
      if (maintenanceMode) {
        setError(
          "Withdrawals are temporarily unavailable while the platform is under maintenance."
        );
      } else if (readOnlyMode) {
        setError(
          "Withdrawals are temporarily unavailable because the platform is in read-only mode."
        );
      } else {
        setError(
          "Withdrawals are currently disabled by the platform administrator."
        );
      }

      return;
    }

    if (verificationBlocked) {
      setError(
        "Your account must be verified before withdrawals are permitted."
      );
      return;
    }

    if (
      dailyLimit > 0 &&
      cleanAmount >
        dailyLimit
    ) {
      setError(
        `This amount exceeds the platform daily withdrawal limit of ${formatAmount(
          dailyLimit
        )}.`
      );
      return;
    }

    if (
      monthlyLimit > 0 &&
      cleanAmount >
        monthlyLimit
    ) {
      setError(
        `This amount exceeds the platform monthly withdrawal limit of ${formatAmount(
          monthlyLimit
        )}.`
      );
      return;
    }

    const withdrawal: PendingWithdrawal =
      {
        asset: selectedAsset,
        network: selectedNetwork,
        amount: cleanAmount,
        destination: cleanAddress,
        destinationTag:
          destinationTag.trim() ||
          null,
        userNote:
          userNote.trim() ||
          null,
      };

    /*
     * If the administrator has enabled withdrawal
     * confirmation, display our custom modal.
     *
     * Otherwise submit directly.
     */
    if (
      withdrawalConfirmation
    ) {
      setPendingWithdrawal(
        withdrawal
      );

      setConfirmationOpen(
        true
      );

      return;
    }

    await submitWithdrawal(
      withdrawal
    );
  }

  function cancelConfirmation() {
    if (submitting) {
      return;
    }

    setConfirmationOpen(false);
    setPendingWithdrawal(null);
  }

  async function confirmWithdrawal() {
    if (
      !pendingWithdrawal ||
      submitting
    ) {
      return;
    }

    await submitWithdrawal(
      pendingWithdrawal
    );
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="dashboard-shell">
      <aside
        className={`dashboard-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="dashboard-sidebar-brand">
          <BrandLogo />
        </div>

        <nav className="dashboard-nav">
          <Link
            href="/dashboard"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <span>⌂</span>
            <span>Dashboard</span>
          </Link>

          <Link
            href="/dashboard/deposit"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <span>＋</span>
            <span>Deposit</span>
          </Link>

          <Link
            href="/dashboard/withdraw"
            className="active"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <span>↗</span>
            <span>Withdraw</span>
          </Link>

          <Link
            href="/dashboard/swap"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <span>⇄</span>
            <span>Swap</span>
          </Link>

          <Link
            href="/dashboard/investments"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <span>◈</span>
            <span>Investments</span>
          </Link>

          <Link
            href="/dashboard/transactions"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <span>≡</span>
            <span>Transactions</span>
          </Link>

          <Link
            href="/dashboard/settings"
            onClick={() =>
              setSidebarOpen(false)
            }
          >
            <span>⚙</span>
            <span>Settings</span>
          </Link>
        </nav>

        <div className="dashboard-sidebar-bottom">
          <button
            type="button"
            className="dashboard-signout"
            onClick={handleSignOut}
          >
            <span>↪</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="dashboard-sidebar-overlay"
          aria-label="Close navigation"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}

      <main className="dashboard-main">
        <header className="dashboard-header">
          <button
            type="button"
            className="dashboard-menu-button"
            onClick={() =>
              setSidebarOpen(
                (current) =>
                  !current
              )
            }
            aria-label="Open navigation"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="dashboard-header-copy">
            <span>
              Withdrawal Center
            </span>

            <strong>
              Move your assets securely
            </strong>
          </div>

          <div className="dashboard-header-account">
            <span>
              {profile?.username ||
                profile?.full_name ||
                profile?.account_id ||
                "Account"}
            </span>

            <div className="dashboard-account-avatar">
              {(
                profile?.username ||
                profile?.full_name ||
                "U"
              )[0].toUpperCase()}
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="dashboard-welcome-row">
            <div>
              <span className="dashboard-eyebrow">
                WITHDRAWAL
              </span>

              <h1>
                Withdraw assets
              </h1>

              <p>
                Select an asset, review its
                available balance and send it
                to your external wallet.
              </p>
            </div>

            <div className="withdraw-portfolio-total">
              <span>
                Total portfolio value
              </span>

              <strong>
                {formatUSD(
                  totalPortfolioUSD
                )}
              </strong>

              <small>
                {marketLoading
                  ? "Updating market prices..."
                  : "Based on current market prices"}
              </small>
            </div>
          </section>

          {!settingsLoading &&
            !withdrawalsEnabled && (
              <div
                className="withdraw-alert withdraw-alert-error"
                role="alert"
              >
                <div className="withdraw-alert-icon">
                  !
                </div>

                <div className="withdraw-alert-content">
                  <strong>
                    Withdrawals unavailable
                  </strong>

                  <span>
                    Withdrawals are currently
                    disabled by the platform
                    administrator.
                  </span>
                </div>
              </div>
            )}

          {!settingsLoading &&
            maintenanceMode && (
              <div
                className="withdraw-alert withdraw-alert-error"
                role="alert"
              >
                <div className="withdraw-alert-icon">
                  !
                </div>

                <div className="withdraw-alert-content">
                  <strong>
                    Maintenance mode
                  </strong>

                  <span>
                    Withdrawals are temporarily
                    unavailable while scheduled
                    maintenance is in progress.
                  </span>
                </div>
              </div>
            )}

          {!settingsLoading &&
            readOnlyMode && (
              <div
                className="withdraw-alert withdraw-alert-error"
                role="alert"
              >
                <div className="withdraw-alert-icon">
                  !
                </div>

                <div className="withdraw-alert-content">
                  <strong>
                    Read-only mode
                  </strong>

                  <span>
                    New withdrawal requests are
                    temporarily unavailable.
                  </span>
                </div>
              </div>
            )}

          {!settingsLoading &&
            verificationBlocked && (
              <div
                className="withdraw-alert withdraw-alert-error"
                role="alert"
              >
                <div className="withdraw-alert-icon">
                  !
                </div>

                <div className="withdraw-alert-content">
                  <strong>
                    Verification required
                  </strong>

                  <span>
                    Your account must be verified
                    before you can submit a
                    withdrawal.
                  </span>
                </div>
              </div>
            )}

          {error && (
            <div
              className="withdraw-alert withdraw-alert-error"
              role="alert"
            >
              <div className="withdraw-alert-icon">
                !
              </div>

              <div className="withdraw-alert-content">
                <strong>
                  Unable to continue
                </strong>

                <span>{error}</span>
              </div>

              <button
                type="button"
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
              className="withdraw-alert withdraw-alert-success"
              role="status"
            >
              <div className="withdraw-alert-icon">
                ✓
              </div>

              <div className="withdraw-alert-content">
                <strong>
                  Withdrawal request submitted
                </strong>

                <span>{success}</span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSuccess("")
                }
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}

          <section className="withdraw-wallets-card">
            <div className="withdraw-wallets-header">
              <div>
                <span className="dashboard-eyebrow">
                  YOUR WALLETS
                </span>

                <h2>
                  Assets & balances
                </h2>

                <p>
                  Your available and locked
                  balances with their current
                  USD market values.
                </p>
              </div>

              <div className="withdraw-market-status">
                <span
                  className={
                    marketLoading
                      ? "withdraw-market-dot loading"
                      : "withdraw-market-dot"
                  }
                />

                <span>
                  {marketLoading
                    ? "Updating prices"
                    : "Market prices live"}
                </span>
              </div>
            </div>

            {walletsLoading ? (
              <div className="withdraw-wallet-loading">
                <div className="withdraw-loading-spinner" />

                <span>
                  Loading your wallets...
                </span>
              </div>
            ) : (
              <div className="withdraw-wallet-grid">
                {walletBalances.map(
                  (wallet) => {
                    const isCct =
                      wallet.symbol ===
                      "CCT";

                    const isSelected =
                      selectedAsset ===
                      wallet.symbol;

                    const price =
                      wallet.symbol ===
                      "CCT"
                        ? 1
                        : marketPrices[
                            wallet.symbol
                          ] ??
                          (wallet.symbol ===
                            "USDT" ||
                          wallet.symbol ===
                            "USDC"
                            ? 1
                            : 0);

                    const totalUSD =
                      wallet.available *
                      price;

                    return (
                      <button
                        key={
                          wallet.symbol
                        }
                        type="button"
                        className={[
                          "withdraw-wallet-option",
                          isSelected
                            ? "selected"
                            : "",
                          isCct
                            ? "disabled"
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() =>
                          selectAsset(
                            wallet.symbol
                          )
                        }
                        disabled={isCct}
                      >
                        <div className="withdraw-wallet-top">
                          <div className="withdraw-wallet-icon">
                            {assetIcon(
                              wallet.symbol
                            )}
                          </div>

                          <div className="withdraw-wallet-meta">
                            <strong>
                              {
                                wallet.symbol
                              }
                            </strong>

                            <span>
                              {
                                wallet.name
                              }
                            </span>
                          </div>

                          {isSelected &&
                            !isCct && (
                              <div className="withdraw-wallet-selected">
                                ✓
                              </div>
                            )}
                        </div>

                        <div className="withdraw-wallet-value">
                          <span>
                            Total value
                          </span>

                          <strong>
                            {formatUSD(
                              totalUSD
                            )}
                          </strong>
                        </div>

                        <div className="withdraw-wallet-price">
                          <span>
                            Market price
                          </span>

                          <strong>
                            {price >
                            0
                              ? formatPrice(
                                  price
                                )
                              : "Unavailable"}
                          </strong>
                        </div>

                        <div className="withdraw-wallet-balances">
                          <div className="withdraw-wallet-balance-row">
                            <span>
                              Available
                            </span>

                            <strong>
                              {formatAmount(
                                wallet.available
                              )}{" "}
                              {
                                wallet.symbol
                              }
                            </strong>
                          </div>

                          <div className="withdraw-wallet-balance-row">
                            <span>
                              Locked
                            </span>

                            <span>
                              {formatAmount(
                                wallet.locked
                              )}{" "}
                              {
                                wallet.symbol
                              }
                            </span>
                          </div>
                        </div>

                        {isCct && (
                          <div className="withdraw-wallet-note">
                            Internal asset · Swap
                            before withdrawal
                          </div>
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            )}
          </section>

          <div className="withdraw-layout">
            <section className="withdraw-form-card">
              <div className="withdraw-card-heading">
                <div>
                  <span className="dashboard-eyebrow">
                    SEND ASSET
                  </span>

                  <h2>
                    Withdrawal details
                  </h2>
                </div>

                <div className="withdraw-selected-asset-badge">
                  {selectedAsset}
                </div>
              </div>

              <form
                onSubmit={
                  handleSubmit
                }
                className="withdraw-form"
              >
                <div className="withdraw-selected-balance">
                  <div>
                    <span>
                      AVAILABLE TO WITHDRAW
                    </span>

                    <strong>
                      {formatAmount(
                        selectedAvailableBalance
                      )}{" "}
                      {selectedAsset}
                    </strong>

                    <small>
                      ≈{" "}
                      {formatUSD(
                        selectedTotalUSD
                      )}{" "}
                      at{" "}
                      {formatPrice(
                        selectedMarketPrice
                      )}
                    </small>
                  </div>

                  <button
                    type="button"
                    className="withdraw-max-button"
                    onClick={
                      handleMaxAmount
                    }
                    disabled={
                      selectedAvailableBalance <=
                      0
                    }
                  >
                    MAX
                  </button>
                </div>

                {selectedAvailableBalance <=
                  0 && (
                  <div className="withdraw-balance-empty">
                    <span>ⓘ</span>

                    <div>
                      <strong>
                        No available balance
                      </strong>

                      <p>
                        You currently have no
                        available{" "}
                        {
                          selectedAsset
                        }{" "}
                        to withdraw.
                      </p>
                    </div>
                  </div>
                )}

                {selectedLockedBalance >
                  0 && (
                  <div className="withdraw-locked-notice">
                    <span>🔒</span>

                    <div>
                      <strong>
                        {formatAmount(
                          selectedLockedBalance
                        )}{" "}
                        {
                          selectedAsset
                        }{" "}
                        locked
                      </strong>

                      <p>
                        Locked funds cannot be
                        used for this withdrawal
                        until they are released.
                      </p>
                    </div>
                  </div>
                )}

                <div className="withdraw-field">
                  <label htmlFor="withdraw-amount">
                    Amount{" "}
                    <span>*</span>
                  </label>

                  <div className="withdraw-input-with-suffix">
                    <input
                      id="withdraw-amount"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={amount}
                      onChange={(event) => {
                        setAmount(
                          event.target.value
                        );
                        setError("");
                      }}
                      placeholder="0.00"
                      disabled={
                        submitting ||
                        selectedAvailableBalance <=
                          0 ||
                        withdrawalDisabled ||
                        verificationBlocked
                      }
                    />

                    <span>
                      {selectedAsset}
                    </span>
                  </div>
                </div>

                <div className="withdraw-field">
                  <label htmlFor="withdraw-network">
                    Network{" "}
                    <span>*</span>
                  </label>

                  <select
                    id="withdraw-network"
                    value={
                      selectedNetwork
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedNetwork(
                        event.target
                          .value
                      )
                    }
                    disabled={
                      submitting ||
                      withdrawalDisabled
                    }
                  >
                    {currentAsset.networks.map(
                      (network) => (
                        <option
                          key={
                            network
                          }
                          value={
                            network
                          }
                        >
                          {network}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="withdraw-field">
                  <label htmlFor="destination-address">
                    Destination wallet
                    address{" "}
                    <span>*</span>
                  </label>

                  <input
                    id="destination-address"
                    type="text"
                    value={
                      destinationAddress
                    }
                    onChange={(
                      event
                    ) =>
                      setDestinationAddress(
                        event.target
                          .value
                      )
                    }
                    placeholder="Enter destination wallet address"
                    autoComplete="off"
                    disabled={
                      submitting ||
                      withdrawalDisabled
                    }
                  />

                  <small>
                    Double-check the address
                    and network before
                    submitting.
                  </small>
                </div>

                {(
                  [
                    "XRP",
                    "XLM",
                    "EOS",
                  ] as string[]
                ).includes(
                  selectedAsset
                ) && (
                  <div className="withdraw-field">
                    <label htmlFor="destination-tag">
                      Destination tag / memo
                    </label>

                    <input
                      id="destination-tag"
                      type="text"
                      value={
                        destinationTag
                      }
                      onChange={(
                        event
                      ) =>
                        setDestinationTag(
                          event.target
                            .value
                        )
                      }
                      placeholder="Enter destination tag or memo"
                      disabled={
                        submitting ||
                        withdrawalDisabled
                      }
                    />
                  </div>
                )}

                <div className="withdraw-field">
                  <label htmlFor="withdraw-note">
                    Note
                  </label>

                  <textarea
                    id="withdraw-note"
                    value={userNote}
                    onChange={(
                      event
                    ) =>
                      setUserNote(
                        event.target
                          .value
                      )
                    }
                    placeholder="Optional note for the withdrawal request"
                    rows={4}
                    disabled={
                      submitting ||
                      withdrawalDisabled
                    }
                  />
                </div>

                <div className="withdraw-review">
                  <div>
                    <span>
                      Asset
                    </span>

                    <strong>
                      {
                        selectedAsset
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Network
                    </span>

                    <strong>
                      {
                        selectedNetwork ||
                        "—"
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Amount
                    </span>

                    <strong>
                      {amount
                        ? `${formatAmount(
                            amount
                          )} ${selectedAsset}`
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Estimated USD value
                    </span>

                    <strong>
                      {amount
                        ? formatUSD(
                            toNumber(
                              amount
                            ) *
                              selectedMarketPrice
                          )
                        : "$0.00"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Destination
                    </span>

                    <strong>
                      {destinationAddress
                        ? shortenAddress(
                            destinationAddress
                          )
                        : "—"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Platform fee
                    </span>

                    <strong>
                      Calculated at
                      submission
                    </strong>
                  </div>
                </div>

                {manualReview && (
                  <div className="withdraw-security-card">
                    <div className="withdraw-security-icon">
                      ✓
                    </div>

                    <div>
                      <strong>
                        Manual review enabled
                      </strong>

                      <p>
                        This withdrawal request
                        will enter the platform
                        review process before
                        final processing.
                      </p>
                    </div>
                  </div>
                )}

                {cooldownMinutes >
                  0 && (
                  <div className="withdraw-security-card">
                    <div className="withdraw-security-icon">
                      ◷
                    </div>

                    <div>
                      <strong>
                        Withdrawal cooldown
                      </strong>

                      <p>
                        A{" "}
                        {
                          cooldownMinutes
                        }
                        -minute cooldown may
                        apply after a withdrawal
                        request.
                      </p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="withdraw-submit-button"
                  disabled={
                    submitting ||
                    loading ||
                    settingsLoading ||
                    walletsLoading ||
                    selectedAvailableBalance <=
                      0 ||
                    withdrawalDisabled ||
                    verificationBlocked
                  }
                >
                  {submitting ? (
                    <>
                      <span className="withdraw-button-spinner" />
                      Submitting request...
                    </>
                  ) : verificationBlocked ? (
                    <>
                      Verification required
                    </>
                  ) : withdrawalDisabled ? (
                    <>
                      Withdrawals unavailable
                    </>
                  ) : (
                    <>
                      Submit withdrawal request
                    </>
                  )}
                </button>

                <p className="withdraw-form-disclaimer">
                  Withdrawal requests are
                  processed according to the
                  platform's configured account,
                  security, verification and
                  transaction rules. Always verify
                  the destination address and
                  network before submitting.
                </p>
              </form>
            </section>

            <aside className="withdraw-side-column">
              <div className="withdraw-info-card">
                <div className="withdraw-info-icon">
                  ↗
                </div>

                <h3>
                  Withdrawal flow
                </h3>

                <ol>
                  <li>
                    <span>1</span>

                    <div>
                      <strong>
                        Select asset
                      </strong>

                      <p>
                        Choose the wallet you
                        want to withdraw from.
                      </p>
                    </div>
                  </li>

                  <li>
                    <span>2</span>

                    <div>
                      <strong>
                        Enter destination
                      </strong>

                      <p>
                        Provide the external
                        wallet address and
                        correct network.
                      </p>
                    </div>
                  </li>

                  <li>
                    <span>3</span>

                    <div>
                      <strong>
                        Submit request
                      </strong>

                      <p>
                        Your request enters the
                        withdrawal review process.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>

              <div className="withdraw-security-card">
                <div className="withdraw-security-icon">
                  ✓
                </div>

                <div>
                  <strong>
                    Security reminder
                  </strong>

                  <p>
                    Never send assets to an
                    address without confirming
                    the network and destination
                    details first.
                  </p>
                </div>
              </div>

              <div className="withdraw-account-card">
                <span>
                  ACCOUNT
                </span>

                <strong>
                  {profile?.account_id ||
                    profile?.username ||
                    "Account information"}
                </strong>

                <small>
                  Status:{" "}
                  {profile?.account_status
                    ? statusLabel(
                        profile.account_status
                      )
                    : "Active"}
                </small>

                <small>
                  Verification:{" "}
                  {profile?.verification_status
                    ? statusLabel(
                        profile.verification_status
                      )
                    : "Unknown"}
                </small>
              </div>
            </aside>
          </div>

          <section className="withdraw-history-card">
            <div className="withdraw-history-header">
              <div>
                <span className="dashboard-eyebrow">
                  ACTIVITY
                </span>

                <h2>
                  Withdrawal history
                </h2>
              </div>

              <span className="withdraw-history-count">
                {
                  withdrawals.length
                }{" "}
                {withdrawals.length ===
                1
                  ? "request"
                  : "requests"}
              </span>
            </div>

            {withdrawals.length ===
            0 ? (
              <div className="withdraw-empty-history">
                <div>↗</div>

                <strong>
                  No withdrawals yet
                </strong>

                <p>
                  Your withdrawal requests
                  will appear here after you
                  submit one.
                </p>
              </div>
            ) : (
              <div className="withdraw-history-table-wrap">
                <table className="withdraw-history-table">
                  <thead>
                    <tr>
                      <th>
                        Reference
                      </th>

                      <th>
                        Asset
                      </th>

                      <th>
                        Amount
                      </th>

                      <th>
                        Network
                      </th>

                      <th>
                        Destination
                      </th>

                      <th>
                        Status
                      </th>

                      <th>
                        Date
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {withdrawals.map(
                      (
                        withdrawal
                      ) => (
                        <tr
                          key={
                            withdrawal.id
                          }
                        >
                          <td>
                            <strong>
                              {
                                withdrawal.reference
                              }
                            </strong>
                          </td>

                          <td>
                            <span className="withdraw-table-asset">
                              <span className="withdraw-table-asset-icon">
                                {assetIcon(
                                  withdrawal.asset_symbol
                                )}
                              </span>

                              {
                                withdrawal.asset_symbol
                              }
                            </span>
                          </td>

                          <td>
                            <strong>
                              {formatAmount(
                                withdrawal.amount
                              )}{" "}
                              {
                                withdrawal.asset_symbol
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              withdrawal.network
                            }
                          </td>

                          <td>
                            <span className="withdraw-destination">
                              {shortenAddress(
                                withdrawal.destination_address
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`withdraw-status status-${withdrawal.status.toLowerCase()}`}
                            >
                              {statusLabel(
                                withdrawal.status
                              )}
                            </span>
                          </td>

                          <td>
                            {formatDate(
                              withdrawal.created_at
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {/*
       * ============================================================
       * CUSTOM WITHDRAWAL CONFIRMATION MODAL
       * ============================================================
       *
       * This replaces window.confirm().
       *
       * It is rendered at the root of the dashboard shell so it can
       * overlay the entire dashboard regardless of the page layout.
       */}
      {confirmationOpen &&
        pendingWithdrawal && (
          <div
            className="withdraw-confirm-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                cancelConfirmation();
              }
            }}
          >
            <div
              className="withdraw-confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="withdraw-confirm-title"
              aria-describedby="withdraw-confirm-description"
            >
              <div className="withdraw-confirm-glow" />

              <div className="withdraw-confirm-header">
                <div className="withdraw-confirm-security-icon">
                  <span>!</span>
                </div>

                <div>
                  <span className="withdraw-confirm-eyebrow">
                    SECURITY CHECK
                  </span>

                  <h2 id="withdraw-confirm-title">
                    Confirm withdrawal
                  </h2>
                </div>

                <button
                  type="button"
                  className="withdraw-confirm-close"
                  onClick={
                    cancelConfirmation
                  }
                  disabled={submitting}
                  aria-label="Close confirmation"
                >
                  ×
                </button>
              </div>

              <div
                id="withdraw-confirm-description"
                className="withdraw-confirm-warning"
              >
                <span>◆</span>

                <p>
                  Please carefully verify the
                  destination address and network
                  before confirming. Cryptocurrency
                  withdrawals may not be reversible
                  once processed.
                </p>
              </div>

              <div className="withdraw-confirm-amount">
                <span>
                  YOU ARE WITHDRAWING
                </span>

                <strong>
                  {formatAmount(
                    pendingWithdrawal.amount
                  )}{" "}
                  {
                    pendingWithdrawal.asset
                  }
                </strong>

                <small>
                  ≈{" "}
                  {formatUSD(
                    pendingWithdrawal.amount *
                      selectedMarketPrice
                  )}
                </small>
              </div>

              <div className="withdraw-confirm-details">
                <div className="withdraw-confirm-detail">
                  <span>Asset</span>

                  <strong>
                    <span className="withdraw-confirm-asset-icon">
                      {assetIcon(
                        pendingWithdrawal.asset
                      )}
                    </span>

                    {
                      pendingWithdrawal.asset
                    }
                  </strong>
                </div>

                <div className="withdraw-confirm-detail">
                  <span>Network</span>

                  <strong>
                    {
                      pendingWithdrawal.network
                    }
                  </strong>
                </div>

                <div className="withdraw-confirm-detail withdraw-confirm-detail-wide">
                  <span>
                    Destination address
                  </span>

                  <strong className="withdraw-confirm-address">
                    {
                      pendingWithdrawal.destination
                    }
                  </strong>
                </div>

                {pendingWithdrawal.destinationTag && (
                  <div className="withdraw-confirm-detail">
                    <span>
                      Destination tag / memo
                    </span>

                    <strong>
                      {
                        pendingWithdrawal.destinationTag
                      }
                    </strong>
                  </div>
                )}

                <div className="withdraw-confirm-detail">
                  <span>
                    Platform fee
                  </span>

                  <strong>
                    Calculated by platform
                  </strong>
                </div>
              </div>

              <div className="withdraw-confirm-check">
                <span className="withdraw-confirm-check-icon">
                  ✓
                </span>

                <span>
                  I have verified that the
                  destination address and network
                  are correct.
                </span>
              </div>

              <div className="withdraw-confirm-actions">
                <button
                  type="button"
                  className="withdraw-confirm-cancel"
                  onClick={
                    cancelConfirmation
                  }
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="withdraw-confirm-submit"
                  onClick={
                    confirmWithdrawal
                  }
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="withdraw-button-spinner" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Confirm withdrawal
                      <span>↗</span>
                    </>
                  )}
                </button>
              </div>

              <div className="withdraw-confirm-footer">
                <span className="withdraw-confirm-live-dot" />

                SECURE TRANSACTION CHANNEL
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
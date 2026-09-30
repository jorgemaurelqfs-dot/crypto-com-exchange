"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminModule from "../AdminModule";
import { createClient } from "../../../lib/supabase/client";

type SwapAsset = {
  symbol: string;
  name: string;
  asset_type: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type SwapQuote = {
  id: string;
  user_id: string;
  from_asset: string;
  to_asset: string;
  from_amount: number | string;
  exchange_rate: number | string;
  fee_rate: number | string;
  fee_amount: number | string;
  receive_amount: number | string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

type Swap = {
  id: string;
  reference: string;
  user_id: string;
  quote_id: string | null;
  from_asset: string;
  to_asset: string;
  from_amount: number | string;
  exchange_rate: number | string;
  fee_rate: number | string;
  fee_amount: number | string;
  receive_amount: number | string;
  status: string;
  created_at: string;
  completed_at: string | null;
};

type Profile = {
  id: string;
  account_id: string | null;
  username: string | null;
  full_name: string | null;
  email: string | null;
};

type Tab = "swaps" | "quotes" | "assets";

const supabase = createClient();

function toNumber(value: number | string | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(
  value: number | string | null | undefined,
  maximumFractionDigits = 8
) {
  return toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatPercent(value: number | string | null | undefined) {
  return `${formatNumber(value, 4)}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(value: string | null | undefined) {
  if (!value) return "—";
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function getSwapStatus(swap: Swap) {
  const status = swap.status?.toLowerCase() || "unknown";

  if (status === "completed" || status === "complete") {
    return "completed";
  }

  if (status === "pending" || status === "processing") {
    return "pending";
  }

  if (
    status === "failed" ||
    status === "cancelled" ||
    status === "canceled" ||
    status === "rejected"
  ) {
    return "failed";
  }

  return "other";
}

function isQuoteExpired(quote: SwapQuote) {
  if (quote.consumed_at) return false;

  const expires = new Date(quote.expires_at).getTime();

  if (Number.isNaN(expires)) return false;

  return expires < Date.now();
}

export default function AdminSwapsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("swaps");

  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [quotes, setQuotes] = useState<SwapQuote[]>([]);
  const [assets, setAssets] = useState<SwapAsset[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [selectedSwap, setSelectedSwap] = useState<Swap | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<SwapQuote | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<SwapAsset | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [swapsResult, quotesResult, assetsResult] =
        await Promise.all([
          supabase
            .from("swaps")
            .select(
              `
                id,
                reference,
                user_id,
                quote_id,
                from_asset,
                to_asset,
                from_amount,
                exchange_rate,
                fee_rate,
                fee_amount,
                receive_amount,
                status,
                created_at,
                completed_at
              `
            )
            .order("created_at", { ascending: false }),

          supabase
            .from("swap_quotes")
            .select(
              `
                id,
                user_id,
                from_asset,
                to_asset,
                from_amount,
                exchange_rate,
                fee_rate,
                fee_amount,
                receive_amount,
                expires_at,
                consumed_at,
                created_at
              `
            )
            .order("created_at", { ascending: false }),

          supabase
            .from("swap_assets")
            .select(
              `
                symbol,
                name,
                asset_type,
                enabled,
                created_at,
                updated_at
              `
            )
            .order("symbol", { ascending: true }),
        ]);

      if (swapsResult.error) {
        throw new Error(`Swaps: ${swapsResult.error.message}`);
      }

      if (quotesResult.error) {
        throw new Error(`Quotes: ${quotesResult.error.message}`);
      }

      if (assetsResult.error) {
        throw new Error(`Assets: ${assetsResult.error.message}`);
      }

      const loadedSwaps = (swapsResult.data || []) as Swap[];
      const loadedQuotes = (quotesResult.data || []) as SwapQuote[];
      const loadedAssets = (assetsResult.data || []) as SwapAsset[];

      setSwaps(loadedSwaps);
      setQuotes(loadedQuotes);
      setAssets(loadedAssets);

      const userIds = Array.from(
        new Set([
          ...loadedSwaps.map((item) => item.user_id),
          ...loadedQuotes.map((item) => item.user_id),
        ])
      ).filter(Boolean);

      if (userIds.length > 0) {
        const profilesResult = await supabase
          .from("profiles")
          .select("id, account_id, username, full_name, email")
          .in("id", userIds);

        if (!profilesResult.error) {
          const profileMap: Record<string, Profile> = {};

          for (const profile of (profilesResult.data || []) as Profile[]) {
            profileMap[profile.id] = profile;
          }

          setProfiles(profileMap);
        }
      } else {
        setProfiles({});
      }
    } catch (err) {
      console.error("Admin swaps load error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load swap management data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const assetSymbols = useMemo(() => {
    const symbols = new Set<string>();

    swaps.forEach((swap) => {
      symbols.add(swap.from_asset);
      symbols.add(swap.to_asset);
    });

    quotes.forEach((quote) => {
      symbols.add(quote.from_asset);
      symbols.add(quote.to_asset);
    });

    assets.forEach((asset) => {
      symbols.add(asset.symbol);
    });

    return Array.from(symbols).sort();
  }, [swaps, quotes, assets]);

  const filteredSwaps = useMemo(() => {
    const query = search.trim().toLowerCase();

    return swaps.filter((swap) => {
      const profile = profiles[swap.user_id];

      const matchesSearch =
        !query ||
        swap.reference.toLowerCase().includes(query) ||
        swap.user_id.toLowerCase().includes(query) ||
        profile?.account_id?.toLowerCase().includes(query) ||
        profile?.username?.toLowerCase().includes(query) ||
        profile?.full_name?.toLowerCase().includes(query) ||
        profile?.email?.toLowerCase().includes(query) ||
        swap.from_asset.toLowerCase().includes(query) ||
        swap.to_asset.toLowerCase().includes(query);

      const matchesAsset =
        assetFilter === "all" ||
        swap.from_asset === assetFilter ||
        swap.to_asset === assetFilter;

      const normalizedStatus = getSwapStatus(swap);

      const matchesStatus =
        statusFilter === "all" || normalizedStatus === statusFilter;

      return matchesSearch && matchesAsset && matchesStatus;
    });
  }, [swaps, profiles, search, assetFilter, statusFilter]);

  const filteredQuotes = useMemo(() => {
    const query = search.trim().toLowerCase();

    return quotes.filter((quote) => {
      const profile = profiles[quote.user_id];

      const matchesSearch =
        !query ||
        quote.id.toLowerCase().includes(query) ||
        quote.user_id.toLowerCase().includes(query) ||
        profile?.account_id?.toLowerCase().includes(query) ||
        profile?.username?.toLowerCase().includes(query) ||
        profile?.full_name?.toLowerCase().includes(query) ||
        profile?.email?.toLowerCase().includes(query) ||
        quote.from_asset.toLowerCase().includes(query) ||
        quote.to_asset.toLowerCase().includes(query);

      const matchesAsset =
        assetFilter === "all" ||
        quote.from_asset === assetFilter ||
        quote.to_asset === assetFilter;

      let quoteStatus = "active";

      if (quote.consumed_at) {
        quoteStatus = "consumed";
      } else if (isQuoteExpired(quote)) {
        quoteStatus = "expired";
      }

      const matchesStatus =
        statusFilter === "all" || quoteStatus === statusFilter;

      return matchesSearch && matchesAsset && matchesStatus;
    });
  }, [quotes, profiles, search, assetFilter, statusFilter]);

  const totalSwapVolume = useMemo(
    () =>
      swaps.reduce(
        (total, swap) => total + toNumber(swap.from_amount),
        0
      ),
    [swaps]
  );

  const completedSwaps = useMemo(
    () =>
      swaps.filter(
        (swap) => getSwapStatus(swap) === "completed"
      ).length,
    [swaps]
  );

  const pendingSwaps = useMemo(
    () =>
      swaps.filter(
        (swap) => getSwapStatus(swap) === "pending"
      ).length,
    [swaps]
  );

  const failedSwaps = useMemo(
    () =>
      swaps.filter(
        (swap) => getSwapStatus(swap) === "failed"
      ).length,
    [swaps]
  );

  const activeQuotes = useMemo(
    () =>
      quotes.filter(
        (quote) => !quote.consumed_at && !isQuoteExpired(quote)
      ).length,
    [quotes]
  );

  const consumedQuotes = useMemo(
    () => quotes.filter((quote) => Boolean(quote.consumed_at)).length,
    [quotes]
  );

  const expiredQuotes = useMemo(
    () =>
      quotes.filter(
        (quote) => !quote.consumed_at && isQuoteExpired(quote)
      ).length,
    [quotes]
  );

  const enabledAssets = assets.filter((asset) => asset.enabled).length;

  function getProfileLabel(userId: string) {
    const profile = profiles[userId];

    if (!profile) {
      return shortId(userId);
    }

    return (
      profile.full_name ||
      profile.username ||
      profile.account_id ||
      profile.email ||
      shortId(userId)
    );
  }

  function getProfileSecondary(userId: string) {
    const profile = profiles[userId];

    if (!profile) {
      return shortId(userId);
    }

    return profile.account_id || profile.email || shortId(userId);
  }

  return (
    <AdminModule
      eyebrow="SWAP OPERATIONS"
      title="Swap Management"
      description="Monitor asset exchanges, quote activity, conversion flow and supported swap assets."
      icon="⇄"
    >
      <div className="swap-admin-page">
        <style jsx global>{`
          .swap-admin-page {
            --swap-bg: #030810;
            --swap-panel: rgba(6, 14, 25, 0.78);
            --swap-panel-strong: rgba(8, 18, 32, 0.92);
            --swap-border: rgba(74, 153, 255, 0.18);
            --swap-border-gold: rgba(212, 175, 55, 0.28);
            --swap-blue: #42a5ff;
            --swap-blue-soft: rgba(66, 165, 255, 0.12);
            --swap-gold: #d4af37;
            --swap-green: #45e0a1;
            --swap-red: #ff6b7d;
            --swap-text: #f4f8ff;
            --swap-muted: #7f94ad;

            position: relative;
            min-height: 760px;
            padding: 28px;
            overflow: hidden;
            color: var(--swap-text);
            background:
              radial-gradient(
                circle at 82% 12%,
                rgba(0, 153, 255, 0.09),
                transparent 26%
              ),
              radial-gradient(
                circle at 12% 90%,
                rgba(212, 175, 55, 0.045),
                transparent 28%
              ),
              linear-gradient(
                135deg,
                rgba(3, 8, 16, 0.98),
                rgba(4, 12, 23, 0.94)
              );
            border: 1px solid rgba(86, 158, 224, 0.12);
            border-radius: 24px;
            box-shadow:
              0 30px 90px rgba(0, 0, 0, 0.48),
              inset 0 1px 0 rgba(255, 255, 255, 0.025);
          }

          .swap-admin-page::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.3;
            background-image:
              linear-gradient(
                rgba(66, 165, 255, 0.025) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(66, 165, 255, 0.025) 1px,
                transparent 1px
              );
            background-size: 42px 42px;
          }

          .swap-admin-page::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            height: 1px;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(66, 165, 255, 0.75),
              rgba(212, 175, 55, 0.45),
              transparent
            );
            opacity: 0.7;
          }

          .swap-admin-content {
            position: relative;
            z-index: 2;
          }

          .swap-topbar {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 24px;
          }

          .swap-title-block {
            min-width: 0;
          }

          .swap-kicker {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            color: var(--swap-gold);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.22em;
            text-transform: uppercase;
          }

          .swap-kicker::before {
            content: "";
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--swap-green);
            box-shadow: 0 0 14px rgba(69, 224, 161, 0.85);
          }

          .swap-title {
            margin: 0;
            font-size: clamp(24px, 3vw, 34px);
            line-height: 1.05;
            letter-spacing: -0.035em;
            font-weight: 800;
          }

          .swap-subtitle {
            max-width: 700px;
            margin: 10px 0 0;
            color: var(--swap-muted);
            font-size: 13px;
            line-height: 1.7;
          }

          .swap-refresh {
            flex: 0 0 auto;
            min-height: 42px;
            padding: 0 16px;
            border: 1px solid rgba(66, 165, 255, 0.22);
            border-radius: 11px;
            background: rgba(8, 20, 35, 0.76);
            color: #dbeaff;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            cursor: pointer;
            transition: 180ms ease;
          }

          .swap-refresh:hover {
            border-color: rgba(66, 165, 255, 0.55);
            background: rgba(17, 37, 61, 0.88);
            box-shadow: 0 0 22px rgba(0, 153, 255, 0.12);
          }

          .swap-refresh:disabled {
            opacity: 0.55;
            cursor: wait;
          }

          .swap-stat-grid {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
          }

          .swap-stat {
            position: relative;
            min-height: 112px;
            padding: 17px;
            overflow: hidden;
            border: 1px solid var(--swap-border);
            border-radius: 16px;
            background: linear-gradient(
              145deg,
              rgba(9, 21, 37, 0.86),
              rgba(4, 12, 22, 0.72)
            );
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.025);
          }

          .swap-stat::after {
            content: "";
            position: absolute;
            right: -30px;
            bottom: -45px;
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: rgba(66, 165, 255, 0.08);
            filter: blur(4px);
          }

          .swap-stat-label {
            position: relative;
            z-index: 1;
            color: var(--swap-muted);
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.15em;
            text-transform: uppercase;
          }

          .swap-stat-value {
            position: relative;
            z-index: 1;
            margin-top: 12px;
            color: #f5f9ff;
            font-size: 25px;
            line-height: 1;
            font-weight: 800;
            letter-spacing: -0.03em;
          }

          .swap-stat-value.green {
            color: var(--swap-green);
          }

          .swap-stat-value.gold {
            color: var(--swap-gold);
          }

          .swap-stat-value.red {
            color: var(--swap-red);
          }

          .swap-stat-meta {
            position: relative;
            z-index: 1;
            margin-top: 8px;
            color: #61778f;
            font-size: 10px;
          }

          .swap-toolbar {
            display: grid;
            grid-template-columns: minmax(240px, 1fr) 180px 180px;
            gap: 10px;
            padding: 13px;
            margin-bottom: 14px;
            border: 1px solid var(--swap-border);
            border-radius: 16px;
            background: rgba(4, 12, 22, 0.72);
          }

          .swap-search,
          .swap-select {
            width: 100%;
            height: 42px;
            padding: 0 13px;
            border: 1px solid rgba(85, 150, 210, 0.16);
            border-radius: 10px;
            outline: none;
            background: rgba(1, 7, 14, 0.74);
            color: #e9f2ff;
            font: inherit;
            font-size: 12px;
            transition: 180ms ease;
          }

          .swap-search::placeholder {
            color: #526a83;
          }

          .swap-search:focus,
          .swap-select:focus {
            border-color: rgba(66, 165, 255, 0.55);
            box-shadow: 0 0 0 3px rgba(66, 165, 255, 0.07);
          }

          .swap-tabs {
            display: flex;
            gap: 7px;
            margin-bottom: 14px;
            padding: 6px;
            border: 1px solid var(--swap-border);
            border-radius: 13px;
            background: rgba(4, 12, 22, 0.72);
          }

          .swap-tab {
            min-height: 38px;
            padding: 0 15px;
            border: 1px solid transparent;
            border-radius: 9px;
            background: transparent;
            color: #7188a1;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            cursor: pointer;
            transition: 180ms ease;
          }

          .swap-tab:hover {
            color: #cfe3fb;
          }

          .swap-tab.active {
            border-color: rgba(66, 165, 255, 0.25);
            background: rgba(66, 165, 255, 0.1);
            color: #e5f2ff;
            box-shadow: 0 0 18px rgba(0, 153, 255, 0.08);
          }

          .swap-panel {
            overflow: hidden;
            border: 1px solid var(--swap-border);
            border-radius: 18px;
            background: rgba(4, 12, 22, 0.76);
            box-shadow:
              0 20px 50px rgba(0, 0, 0, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.02);
          }

          .swap-panel-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 16px 18px;
            border-bottom: 1px solid rgba(85, 150, 210, 0.1);
          }

          .swap-panel-title {
            margin: 0;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.04em;
          }

          .swap-panel-count {
            color: #647d96;
            font-size: 10px;
            font-weight: 700;
          }

          .swap-table-wrap {
            width: 100%;
            overflow-x: auto;
          }

          .swap-table {
            width: 100%;
            min-width: 1080px;
            border-collapse: collapse;
          }

          .swap-table th {
            padding: 12px 14px;
            border-bottom: 1px solid rgba(85, 150, 210, 0.1);
            color: #59718a;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.14em;
            text-align: left;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .swap-table td {
            padding: 14px;
            border-bottom: 1px solid rgba(85, 150, 210, 0.07);
            color: #d9e6f5;
            font-size: 11px;
            vertical-align: middle;
          }

          .swap-table tbody tr {
            transition: 160ms ease;
          }

          .swap-table tbody tr:hover {
            background: rgba(66, 165, 255, 0.035);
          }

          .swap-reference {
            color: #eaf4ff;
            font-size: 11px;
            font-weight: 800;
          }

          .swap-user {
            min-width: 150px;
          }

          .swap-user-name {
            color: #dce9f7;
            font-size: 11px;
            font-weight: 700;
          }

          .swap-user-id {
            margin-top: 3px;
            color: #526b84;
            font-size: 9px;
          }

          .swap-pair {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            white-space: nowrap;
          }

          .swap-asset-chip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 45px;
            min-height: 24px;
            padding: 0 7px;
            border: 1px solid rgba(66, 165, 255, 0.18);
            border-radius: 6px;
            background: rgba(66, 165, 255, 0.07);
            color: #bcdcff;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.06em;
          }

          .swap-arrow {
            color: #617a93;
          }

          .swap-number {
            color: #eaf4ff;
            font-weight: 700;
            white-space: nowrap;
          }

          .swap-muted {
            color: #657c94;
          }

          .swap-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-height: 24px;
            padding: 0 8px;
            border-radius: 7px;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .swap-status::before {
            content: "";
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: currentColor;
            box-shadow: 0 0 8px currentColor;
          }

          .swap-status.completed,
          .swap-status.active {
            color: var(--swap-green);
            background: rgba(69, 224, 161, 0.08);
            border: 1px solid rgba(69, 224, 161, 0.14);
          }

          .swap-status.pending {
            color: #ffd56a;
            background: rgba(212, 175, 55, 0.08);
            border: 1px solid rgba(212, 175, 55, 0.15);
          }

          .swap-status.failed,
          .swap-status.expired {
            color: var(--swap-red);
            background: rgba(255, 107, 125, 0.07);
            border: 1px solid rgba(255, 107, 125, 0.14);
          }

          .swap-status.consumed {
            color: #9bb7d5;
            background: rgba(125, 158, 194, 0.08);
            border: 1px solid rgba(125, 158, 194, 0.14);
          }

          .swap-view {
            min-height: 30px;
            padding: 0 9px;
            border: 1px solid rgba(66, 165, 255, 0.16);
            border-radius: 7px;
            background: rgba(66, 165, 255, 0.055);
            color: #a9d4ff;
            font-size: 9px;
            font-weight: 800;
            cursor: pointer;
          }

          .swap-view:hover {
            border-color: rgba(66, 165, 255, 0.48);
            background: rgba(66, 165, 255, 0.1);
          }

          .swap-empty,
          .swap-loading,
          .swap-error {
            padding: 60px 25px;
            text-align: center;
          }

          .swap-empty-icon,
          .swap-loading-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 54px;
            height: 54px;
            margin-bottom: 14px;
            border: 1px solid rgba(66, 165, 255, 0.16);
            border-radius: 15px;
            background: rgba(66, 165, 255, 0.06);
            color: #74baff;
            font-size: 22px;
          }

          .swap-empty h3,
          .swap-loading h3,
          .swap-error h3 {
            margin: 0 0 7px;
            color: #eaf3ff;
            font-size: 14px;
          }

          .swap-empty p,
          .swap-loading p,
          .swap-error p {
            max-width: 520px;
            margin: 0 auto;
            color: #647b93;
            font-size: 11px;
            line-height: 1.7;
          }

          .swap-error-icon {
            color: var(--swap-red);
            border-color: rgba(255, 107, 125, 0.2);
            background: rgba(255, 107, 125, 0.06);
          }

          .swap-retry {
            margin-top: 15px;
            min-height: 36px;
            padding: 0 13px;
            border: 1px solid rgba(255, 107, 125, 0.22);
            border-radius: 8px;
            background: rgba(255, 107, 125, 0.05);
            color: #ff9eac;
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
          }

          .swap-assets-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            padding: 15px;
          }

          .swap-asset-card {
            position: relative;
            padding: 18px;
            border: 1px solid rgba(85, 150, 210, 0.13);
            border-radius: 14px;
            background: rgba(3, 11, 20, 0.74);
            transition: 180ms ease;
          }

          .swap-asset-card:hover {
            border-color: rgba(66, 165, 255, 0.3);
            transform: translateY(-1px);
          }

          .swap-asset-card-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .swap-asset-symbol {
            color: #f2f8ff;
            font-size: 18px;
            font-weight: 900;
            letter-spacing: 0.04em;
          }

          .swap-asset-name {
            margin-top: 5px;
            color: #6e849c;
            font-size: 10px;
          }

          .swap-asset-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 17px;
          }

          .swap-asset-meta-box {
            padding: 9px;
            border: 1px solid rgba(85, 150, 210, 0.08);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.012);
          }

          .swap-asset-meta-label {
            color: #50677e;
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }

          .swap-asset-meta-value {
            margin-top: 4px;
            color: #c9dbed;
            font-size: 10px;
            font-weight: 700;
          }

          .swap-detail-overlay {
            position: fixed;
            z-index: 100;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(0, 3, 8, 0.78);
            backdrop-filter: blur(12px);
          }

          .swap-detail-modal {
            width: min(760px, 100%);
            max-height: 90vh;
            overflow-y: auto;
            border: 1px solid rgba(66, 165, 255, 0.22);
            border-radius: 20px;
            background:
              radial-gradient(
                circle at 90% 0%,
                rgba(0, 153, 255, 0.08),
                transparent 32%
              ),
              #050d17;
            box-shadow:
              0 40px 120px rgba(0, 0, 0, 0.7),
              0 0 50px rgba(0, 153, 255, 0.06);
          }

          .swap-detail-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 15px;
            padding: 20px;
            border-bottom: 1px solid rgba(85, 150, 210, 0.1);
          }

          .swap-detail-kicker {
            color: var(--swap-gold);
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          .swap-detail-title {
            margin: 7px 0 0;
            color: #f4f8ff;
            font-size: 19px;
            font-weight: 800;
          }

          .swap-close {
            width: 34px;
            height: 34px;
            border: 1px solid rgba(85, 150, 210, 0.15);
            border-radius: 9px;
            background: rgba(255, 255, 255, 0.025);
            color: #91a8c0;
            cursor: pointer;
          }

          .swap-detail-body {
            padding: 20px;
          }

          .swap-detail-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .swap-detail-item {
            padding: 12px;
            border: 1px solid rgba(85, 150, 210, 0.09);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.015);
          }

          .swap-detail-label {
            color: #526980;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .swap-detail-value {
            margin-top: 6px;
            color: #dce9f7;
            font-size: 11px;
            line-height: 1.45;
            word-break: break-word;
          }

          @media (max-width: 1150px) {
            .swap-stat-grid {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }

            .swap-assets-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 800px) {
            .swap-admin-page {
              padding: 17px;
              border-radius: 18px;
            }

            .swap-topbar {
              flex-direction: column;
            }

            .swap-refresh {
              width: 100%;
            }

            .swap-stat-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .swap-toolbar {
              grid-template-columns: 1fr;
            }

            .swap-tabs {
              overflow-x: auto;
            }

            .swap-tab {
              white-space: nowrap;
            }

            .swap-assets-grid {
              grid-template-columns: 1fr;
            }

            .swap-detail-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 500px) {
            .swap-stat-grid {
              grid-template-columns: 1fr;
            }

            .swap-stat {
              min-height: 95px;
            }
          }
        `}</style>

        <div className="swap-admin-content">
          <div className="swap-topbar">
            <div className="swap-title-block">
              <div className="swap-kicker">Exchange Operations</div>

              <h2 className="swap-title">Swap Control Center</h2>

              <p className="swap-subtitle">
                Monitor executed asset conversions, quote lifecycle activity
                and the assets currently available to the exchange engine.
              </p>
            </div>

            <button
              type="button"
              className="swap-refresh"
              onClick={() => void loadData(true)}
              disabled={loading || refreshing}
            >
              {refreshing ? "Refreshing…" : "↻ Refresh Data"}
            </button>
          </div>

          <div className="swap-stat-grid">
            <div className="swap-stat">
              <div className="swap-stat-label">Total Swaps</div>
              <div className="swap-stat-value">
                {swaps.length.toLocaleString()}
              </div>
              <div className="swap-stat-meta">
                Recorded exchange operations
              </div>
            </div>

            <div className="swap-stat">
              <div className="swap-stat-label">Completed</div>
              <div className="swap-stat-value green">
                {completedSwaps.toLocaleString()}
              </div>
              <div className="swap-stat-meta">
                Successfully completed swaps
              </div>
            </div>

            <div className="swap-stat">
              <div className="swap-stat-label">Pending</div>
              <div className="swap-stat-value gold">
                {pendingSwaps.toLocaleString()}
              </div>
              <div className="swap-stat-meta">
                Pending or processing
              </div>
            </div>

            <div className="swap-stat">
              <div className="swap-stat-label">Swap Volume</div>
              <div className="swap-stat-value">
                {formatNumber(totalSwapVolume, 4)}
              </div>
              <div className="swap-stat-meta">
                Source-asset volume
              </div>
            </div>

            <div className="swap-stat">
              <div className="swap-stat-label">Supported Assets</div>
              <div className="swap-stat-value gold">
                {enabledAssets.toLocaleString()}
              </div>
              <div className="swap-stat-meta">
                {assets.length} configured
              </div>
            </div>
          </div>

          {error ? (
            <div className="swap-error">
              <div className="swap-empty-icon swap-error-icon">!</div>
              <h3>Swap data could not be loaded</h3>
              <p>{error}</p>

              <button
                type="button"
                className="swap-retry"
                onClick={() => void loadData()}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="swap-tabs">
                <button
                  type="button"
                  className={`swap-tab ${
                    activeTab === "swaps" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("swaps")}
                >
                  Executed Swaps
                </button>

                <button
                  type="button"
                  className={`swap-tab ${
                    activeTab === "quotes" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("quotes")}
                >
                  Quote Activity
                </button>

                <button
                  type="button"
                  className={`swap-tab ${
                    activeTab === "assets" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("assets")}
                >
                  Swap Assets
                </button>
              </div>

              {activeTab !== "assets" && (
                <div className="swap-toolbar">
                  <input
                    className="swap-search"
                    type="search"
                    placeholder={
                      activeTab === "swaps"
                        ? "Search reference, user, account, email or asset…"
                        : "Search quote, user, account, email or asset…"
                    }
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />

                  <select
                    className="swap-select"
                    value={assetFilter}
                    onChange={(event) =>
                      setAssetFilter(event.target.value)
                    }
                  >
                    <option value="all">All Assets</option>

                    {assetSymbols.map((symbol) => (
                      <option key={symbol} value={symbol}>
                        {symbol}
                      </option>
                    ))}
                  </select>

                  <select
                    className="swap-select"
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value)
                    }
                  >
                    <option value="all">All Statuses</option>

                    {activeTab === "swaps" ? (
                      <>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                        <option value="other">Other</option>
                      </>
                    ) : (
                      <>
                        <option value="active">Active</option>
                        <option value="consumed">Consumed</option>
                        <option value="expired">Expired</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              {loading ? (
                <div className="swap-panel">
                  <div className="swap-loading">
                    <div className="swap-loading-icon">⇄</div>
                    <h3>Synchronizing swap engine</h3>
                    <p>
                      Loading swap operations, quote activity and supported
                      assets from Supabase.
                    </p>
                  </div>
                </div>
              ) : activeTab === "swaps" ? (
                <div className="swap-panel">
                  <div className="swap-panel-head">
                    <h3 className="swap-panel-title">
                      Executed Swap Ledger
                    </h3>

                    <span className="swap-panel-count">
                      {filteredSwaps.length.toLocaleString()} records
                    </span>
                  </div>

                  {filteredSwaps.length === 0 ? (
                    <div className="swap-empty">
                      <div className="swap-empty-icon">⇄</div>
                      <h3>No swap records found</h3>
                      <p>
                        There are no executed swaps matching the current
                        search and filter settings.
                      </p>
                    </div>
                  ) : (
                    <div className="swap-table-wrap">
                      <table className="swap-table">
                        <thead>
                          <tr>
                            <th>Reference</th>
                            <th>User</th>
                            <th>Pair</th>
                            <th>Source Amount</th>
                            <th>Receive</th>
                            <th>Rate</th>
                            <th>Fee</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th></th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredSwaps.map((swap) => {
                            const status = getSwapStatus(swap);

                            return (
                              <tr key={swap.id}>
                                <td>
                                  <div className="swap-reference">
                                    {swap.reference}
                                  </div>
                                </td>

                                <td>
                                  <div className="swap-user">
                                    <div className="swap-user-name">
                                      {getProfileLabel(swap.user_id)}
                                    </div>

                                    <div className="swap-user-id">
                                      {getProfileSecondary(swap.user_id)}
                                    </div>
                                  </div>
                                </td>

                                <td>
                                  <div className="swap-pair">
                                    <span className="swap-asset-chip">
                                      {swap.from_asset}
                                    </span>

                                    <span className="swap-arrow">→</span>

                                    <span className="swap-asset-chip">
                                      {swap.to_asset}
                                    </span>
                                  </div>
                                </td>

                                <td>
                                  <span className="swap-number">
                                    {formatNumber(swap.from_amount)}
                                  </span>
                                </td>

                                <td>
                                  <span className="swap-number">
                                    {formatNumber(swap.receive_amount)}
                                  </span>
                                </td>

                                <td>
                                  <span className="swap-muted">
                                    {formatNumber(swap.exchange_rate, 10)}
                                  </span>
                                </td>

                                <td>
                                  <span className="swap-muted">
                                    {formatNumber(swap.fee_amount)}
                                  </span>
                                  <br />
                                  <span className="swap-muted">
                                    {formatPercent(swap.fee_rate)}
                                  </span>
                                </td>

                                <td>
                                  <span
                                    className={`swap-status ${status}`}
                                  >
                                    {swap.status || "Unknown"}
                                  </span>
                                </td>

                                <td>
                                  <span className="swap-muted">
                                    {formatDate(swap.created_at)}
                                  </span>
                                </td>

                                <td>
                                  <button
                                    type="button"
                                    className="swap-view"
                                    onClick={() =>
                                      setSelectedSwap(swap)
                                    }
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : activeTab === "quotes" ? (
                <div className="swap-panel">
                  <div className="swap-panel-head">
                    <h3 className="swap-panel-title">
                      Swap Quote Activity
                    </h3>

                    <span className="swap-panel-count">
                      {filteredQuotes.length.toLocaleString()} records
                    </span>
                  </div>

                  {filteredQuotes.length === 0 ? (
                    <div className="swap-empty">
                      <div className="swap-empty-icon">◈</div>
                      <h3>No quote records found</h3>
                      <p>
                        There are no swap quotes matching the current search
                        and filter settings.
                      </p>
                    </div>
                  ) : (
                    <div className="swap-table-wrap">
                      <table className="swap-table">
                        <thead>
                          <tr>
                            <th>Quote ID</th>
                            <th>User</th>
                            <th>Pair</th>
                            <th>From Amount</th>
                            <th>Receive</th>
                            <th>Rate</th>
                            <th>Fee</th>
                            <th>Status</th>
                            <th>Expires</th>
                            <th></th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredQuotes.map((quote) => {
                            const quoteStatus = quote.consumed_at
                              ? "consumed"
                              : isQuoteExpired(quote)
                                ? "expired"
                                : "active";

                            return (
                              <tr key={quote.id}>
                                <td>
                                  <div className="swap-reference">
                                    {shortId(quote.id)}
                                  </div>
                                </td>

                                <td>
                                  <div className="swap-user">
                                    <div className="swap-user-name">
                                      {getProfileLabel(quote.user_id)}
                                    </div>

                                    <div className="swap-user-id">
                                      {getProfileSecondary(quote.user_id)}
                                    </div>
                                  </div>
                                </td>

                                <td>
                                  <div className="swap-pair">
                                    <span className="swap-asset-chip">
                                      {quote.from_asset}
                                    </span>

                                    <span className="swap-arrow">→</span>

                                    <span className="swap-asset-chip">
                                      {quote.to_asset}
                                    </span>
                                  </div>
                                </td>

                                <td>
                                  <span className="swap-number">
                                    {formatNumber(quote.from_amount)}
                                  </span>
                                </td>

                                <td>
                                  <span className="swap-number">
                                    {formatNumber(quote.receive_amount)}
                                  </span>
                                </td>

                                <td>
                                  <span className="swap-muted">
                                    {formatNumber(
                                      quote.exchange_rate,
                                      10
                                    )}
                                  </span>
                                </td>

                                <td>
                                  <span className="swap-muted">
                                    {formatNumber(quote.fee_amount)}
                                  </span>
                                  <br />
                                  <span className="swap-muted">
                                    {formatPercent(quote.fee_rate)}
                                  </span>
                                </td>

                                <td>
                                  <span
                                    className={`swap-status ${quoteStatus}`}
                                  >
                                    {quoteStatus}
                                  </span>
                                </td>

                                <td>
                                  <span className="swap-muted">
                                    {formatDate(quote.expires_at)}
                                  </span>
                                </td>

                                <td>
                                  <button
                                    type="button"
                                    className="swap-view"
                                    onClick={() =>
                                      setSelectedQuote(quote)
                                    }
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="swap-panel">
                  <div className="swap-panel-head">
                    <div>
                      <h3 className="swap-panel-title">
                        Supported Swap Assets
                      </h3>

                      <div
                        className="swap-panel-count"
                        style={{ marginTop: 4 }}
                      >
                        {enabledAssets} enabled · {assets.length} configured
                      </div>
                    </div>
                  </div>

                  {assets.length === 0 ? (
                    <div className="swap-empty">
                      <div className="swap-empty-icon">◇</div>
                      <h3>No swap assets configured</h3>
                      <p>
                        The swap engine currently has no entries in
                        swap_assets.
                      </p>
                    </div>
                  ) : (
                    <div className="swap-assets-grid">
                      {assets.map((asset) => (
                        <div
                          className="swap-asset-card"
                          key={asset.symbol}
                        >
                          <div className="swap-asset-card-top">
                            <div>
                              <div className="swap-asset-symbol">
                                {asset.symbol}
                              </div>

                              <div className="swap-asset-name">
                                {asset.name}
                              </div>
                            </div>

                            <span
                              className={`swap-status ${
                                asset.enabled ? "active" : "failed"
                              }`}
                            >
                              {asset.enabled ? "Enabled" : "Disabled"}
                            </span>
                          </div>

                          <div className="swap-asset-meta">
                            <div className="swap-asset-meta-box">
                              <div className="swap-asset-meta-label">
                                Type
                              </div>

                              <div className="swap-asset-meta-value">
                                {asset.asset_type}
                              </div>
                            </div>

                            <div className="swap-asset-meta-box">
                              <div className="swap-asset-meta-label">
                                Symbol
                              </div>

                              <div className="swap-asset-meta-value">
                                {asset.symbol}
                              </div>
                            </div>

                            <div className="swap-asset-meta-box">
                              <div className="swap-asset-meta-label">
                                Created
                              </div>

                              <div className="swap-asset-meta-value">
                                {formatDate(asset.created_at)}
                              </div>
                            </div>

                            <div className="swap-asset-meta-box">
                              <div className="swap-asset-meta-label">
                                Updated
                              </div>

                              <div className="swap-asset-meta-value">
                                {formatDate(asset.updated_at)}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="swap-view"
                            style={{ marginTop: 14 }}
                            onClick={() => setSelectedAsset(asset)}
                          >
                            Inspect Asset
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {selectedSwap && (
          <div
            className="swap-detail-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedSwap(null);
              }
            }}
          >
            <div className="swap-detail-modal">
              <div className="swap-detail-head">
                <div>
                  <div className="swap-detail-kicker">
                    Swap Transaction
                  </div>

                  <h3 className="swap-detail-title">
                    {selectedSwap.reference}
                  </h3>
                </div>

                <button
                  type="button"
                  className="swap-close"
                  onClick={() => setSelectedSwap(null)}
                >
                  ×
                </button>
              </div>

              <div className="swap-detail-body">
                <div className="swap-detail-grid">
                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Reference</div>
                    <div className="swap-detail-value">
                      {selectedSwap.reference}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Status</div>
                    <div className="swap-detail-value">
                      {selectedSwap.status}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">User ID</div>
                    <div className="swap-detail-value">
                      {selectedSwap.user_id}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Account</div>
                    <div className="swap-detail-value">
                      {getProfileSecondary(selectedSwap.user_id)}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Swap Pair</div>
                    <div className="swap-detail-value">
                      {selectedSwap.from_asset} →{" "}
                      {selectedSwap.to_asset}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">
                      Source Amount
                    </div>
                    <div className="swap-detail-value">
                      {formatNumber(selectedSwap.from_amount)}{" "}
                      {selectedSwap.from_asset}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">
                      Receive Amount
                    </div>
                    <div className="swap-detail-value">
                      {formatNumber(selectedSwap.receive_amount)}{" "}
                      {selectedSwap.to_asset}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">
                      Exchange Rate
                    </div>
                    <div className="swap-detail-value">
                      {formatNumber(
                        selectedSwap.exchange_rate,
                        12
                      )}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Fee Rate</div>
                    <div className="swap-detail-value">
                      {formatPercent(selectedSwap.fee_rate)}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Fee Amount</div>
                    <div className="swap-detail-value">
                      {formatNumber(selectedSwap.fee_amount)}{" "}
                      {selectedSwap.from_asset}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Quote ID</div>
                    <div className="swap-detail-value">
                      {selectedSwap.quote_id || "No linked quote"}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Created</div>
                    <div className="swap-detail-value">
                      {formatDate(selectedSwap.created_at)}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Completed</div>
                    <div className="swap-detail-value">
                      {formatDate(selectedSwap.completed_at)}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">
                      Internal Record
                    </div>
                    <div className="swap-detail-value">
                      {selectedSwap.id}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedQuote && (
          <div
            className="swap-detail-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedQuote(null);
              }
            }}
          >
            <div className="swap-detail-modal">
              <div className="swap-detail-head">
                <div>
                  <div className="swap-detail-kicker">
                    Swap Quote
                  </div>

                  <h3 className="swap-detail-title">
                    {shortId(selectedQuote.id)}
                  </h3>
                </div>

                <button
                  type="button"
                  className="swap-close"
                  onClick={() => setSelectedQuote(null)}
                >
                  ×
                </button>
              </div>

              <div className="swap-detail-body">
                <div className="swap-detail-grid">
                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Quote ID</div>
                    <div className="swap-detail-value">
                      {selectedQuote.id}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">User ID</div>
                    <div className="swap-detail-value">
                      {selectedQuote.user_id}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Pair</div>
                    <div className="swap-detail-value">
                      {selectedQuote.from_asset} →{" "}
                      {selectedQuote.to_asset}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">
                      Quote Status
                    </div>
                    <div className="swap-detail-value">
                      {selectedQuote.consumed_at
                        ? "Consumed"
                        : isQuoteExpired(selectedQuote)
                          ? "Expired"
                          : "Active"}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">
                      From Amount
                    </div>
                    <div className="swap-detail-value">
                      {formatNumber(selectedQuote.from_amount)}{" "}
                      {selectedQuote.from_asset}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">
                      Receive Amount
                    </div>
                    <div className="swap-detail-value">
                      {formatNumber(selectedQuote.receive_amount)}{" "}
                      {selectedQuote.to_asset}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">
                      Exchange Rate
                    </div>
                    <div className="swap-detail-value">
                      {formatNumber(
                        selectedQuote.exchange_rate,
                        12
                      )}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Fee Rate</div>
                    <div className="swap-detail-value">
                      {formatPercent(selectedQuote.fee_rate)}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Fee Amount</div>
                    <div className="swap-detail-value">
                      {formatNumber(selectedQuote.fee_amount)}{" "}
                      {selectedQuote.from_asset}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Created</div>
                    <div className="swap-detail-value">
                      {formatDate(selectedQuote.created_at)}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Expires</div>
                    <div className="swap-detail-value">
                      {formatDate(selectedQuote.expires_at)}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Consumed</div>
                    <div className="swap-detail-value">
                      {formatDate(selectedQuote.consumed_at)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedAsset && (
          <div
            className="swap-detail-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedAsset(null);
              }
            }}
          >
            <div className="swap-detail-modal">
              <div className="swap-detail-head">
                <div>
                  <div className="swap-detail-kicker">
                    Supported Asset
                  </div>

                  <h3 className="swap-detail-title">
                    {selectedAsset.symbol} · {selectedAsset.name}
                  </h3>
                </div>

                <button
                  type="button"
                  className="swap-close"
                  onClick={() => setSelectedAsset(null)}
                >
                  ×
                </button>
              </div>

              <div className="swap-detail-body">
                <div className="swap-detail-grid">
                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Symbol</div>
                    <div className="swap-detail-value">
                      {selectedAsset.symbol}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Name</div>
                    <div className="swap-detail-value">
                      {selectedAsset.name}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Asset Type</div>
                    <div className="swap-detail-value">
                      {selectedAsset.asset_type}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Status</div>
                    <div className="swap-detail-value">
                      {selectedAsset.enabled
                        ? "Enabled for swapping"
                        : "Disabled for swapping"}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Created</div>
                    <div className="swap-detail-value">
                      {formatDate(selectedAsset.created_at)}
                    </div>
                  </div>

                  <div className="swap-detail-item">
                    <div className="swap-detail-label">Last Updated</div>
                    <div className="swap-detail-value">
                      {formatDate(selectedAsset.updated_at)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminModule>
  );
}
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import AdminModule from "../AdminModule";
import { createClient } from "../../../lib/supabase/client";

type TransactionRow = {
  id: string;
  reference: string | null;
  user_id: string | null;
  asset_symbol: string | null;
  transaction_type: string | null;
  direction: string | null;
  amount: number | string | null;
  balance_before: number | string | null;
  balance_after: number | string | null;
  description: string | null;
  status: string | null;
  created_at: string | null;
  source_table: string | null;
};

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
};

const PAGE_SIZE = 25;

const supabase = createClient();

function stringValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(
  amount: number | string | null,
  asset: string | null
): string {
  if (amount === null || amount === undefined || amount === "") {
    return "—";
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount)) {
    return `${amount} ${asset ?? ""}`.trim();
  }

  return `${numericAmount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  })} ${asset ?? ""}`.trim();
}

function normalizeStatus(value: string | null): string {
  return stringValue(value).trim().toLowerCase();
}

function normalizeType(value: string | null): string {
  return stringValue(value).trim().toLowerCase();
}

function prettyLabel(value: string | null): string {
  if (!value) {
    return "Unknown";
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function shortHash(value: string | null, length = 14): string {
  if (!value) {
    return "—";
  }

  if (value.length <= length) {
    return value;
  }

  const side = Math.max(4, Math.floor((length - 3) / 2));

  return `${value.slice(0, side)}...${value.slice(-side)}`;
}

function statusClass(status: string | null): string {
  const normalized = normalizeStatus(status);

  if (
    normalized === "completed" ||
    normalized === "success" ||
    normalized === "confirmed"
  ) {
    return "tx-status tx-status-success";
  }

  if (
    normalized === "pending" ||
    normalized === "processing" ||
    normalized === "review"
  ) {
    return "tx-status tx-status-pending";
  }

  if (
    normalized === "failed" ||
    normalized === "rejected" ||
    normalized === "cancelled" ||
    normalized === "canceled"
  ) {
    return "tx-status tx-status-danger";
  }

  return "tx-status";
}

function directionClass(direction: string | null): string {
  return normalizeType(direction) === "credit"
    ? "tx-direction tx-credit"
    : "tx-direction tx-debit";
}

function assetClass(asset: string | null): string {
  const normalized = stringValue(asset).toUpperCase();

  if (normalized === "CCT") {
    return "tx-asset tx-asset-cct";
  }

  if (normalized === "BTC") {
    return "tx-asset tx-asset-btc";
  }

  if (normalized === "ETH") {
    return "tx-asset tx-asset-eth";
  }

  if (normalized === "USDT") {
    return "tx-asset tx-asset-usdt";
  }

  return "tx-asset";
}

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");

  const [page, setPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionRow | null>(null);

  const loadTransactions = useCallback(
    async (showRefreshState = false) => {
      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        /*
         * IMPORTANT:
         *
         * This now reads BOTH:
         *
         * public.transactions
         * public.asset_transactions
         *
         * through the admin-only RPC.
         */
        const { data, error: transactionError } =
          await supabase.rpc("admin_get_all_transactions");

        if (transactionError) {
          throw new Error(transactionError.message);
        }

        const rows = (data ?? []) as TransactionRow[];

        setTransactions(rows);

        /*
         * Load user profiles separately.
         */
        const userIds = Array.from(
          new Set(
            rows
              .map((row) => row.user_id)
              .filter(
                (id): id is string =>
                  typeof id === "string" && id.length > 0
              )
          )
        );

        if (userIds.length === 0) {
          setProfiles({});
        } else {
          const { data: profileData, error: profileError } =
            await supabase
              .from("profiles")
              .select("id,email,full_name,username")
              .in("id", userIds);

          if (profileError) {
            console.warn(
              "Could not load transaction profiles:",
              profileError.message
            );

            setProfiles({});
          } else {
            const profileMap: Record<string, ProfileRow> = {};

            for (const profile of (profileData ?? []) as ProfileRow[]) {
              profileMap[profile.id] = profile;
            }

            setProfiles(profileMap);
          }
        }

        setPage(1);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to load transactions.";

        setError(message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  /*
   * ----------------------------------------------------------
   * FILTER OPTIONS
   * ----------------------------------------------------------
   */

  const assets = useMemo(() => {
    const values = transactions
      .map((transaction) =>
        stringValue(transaction.asset_symbol).toUpperCase()
      )
      .filter(Boolean);

    return Array.from(new Set(values)).sort();
  }, [transactions]);

  const transactionTypes = useMemo(() => {
    const values = transactions
      .map((transaction) => normalizeType(transaction.transaction_type))
      .filter(Boolean);

    return Array.from(new Set(values)).sort();
  }, [transactions]);

  const statuses = useMemo(() => {
    const values = transactions
      .map((transaction) => normalizeStatus(transaction.status))
      .filter(Boolean);

    return Array.from(new Set(values)).sort();
  }, [transactions]);

  /*
   * ----------------------------------------------------------
   * FILTERED TRANSACTIONS
   * ----------------------------------------------------------
   */

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const profile = transaction.user_id
        ? profiles[transaction.user_id]
        : undefined;

      const searchable = [
        transaction.reference,
        transaction.asset_symbol,
        transaction.transaction_type,
        transaction.direction,
        transaction.description,
        transaction.status,
        transaction.user_id,
        profile?.email,
        profile?.full_name,
        profile?.username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (query && !searchable.includes(query)) {
        return false;
      }

      if (
        assetFilter !== "all" &&
        stringValue(transaction.asset_symbol).toUpperCase() !==
          assetFilter
      ) {
        return false;
      }

      if (
        statusFilter !== "all" &&
        normalizeStatus(transaction.status) !== statusFilter
      ) {
        return false;
      }

      if (
        typeFilter !== "all" &&
        normalizeType(transaction.transaction_type) !== typeFilter
      ) {
        return false;
      }

      if (
        directionFilter !== "all" &&
        normalizeType(transaction.direction) !== directionFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    transactions,
    profiles,
    search,
    assetFilter,
    statusFilter,
    typeFilter,
    directionFilter,
  ]);

  /*
   * ----------------------------------------------------------
   * SUMMARY
   * ----------------------------------------------------------
   */

  const summary = useMemo(() => {
    let credits = 0;
    let debits = 0;

    const uniqueUsers = new Set<string>();

    for (const transaction of filteredTransactions) {
      if (transaction.user_id) {
        uniqueUsers.add(transaction.user_id);
      }

      const amount = Number(transaction.amount ?? 0);

      if (normalizeType(transaction.direction) === "credit") {
        credits += Number.isFinite(amount) ? amount : 0;
      }

      if (normalizeType(transaction.direction) === "debit") {
        debits += Number.isFinite(amount) ? amount : 0;
      }
    }

    return {
      total: filteredTransactions.length,
      users: uniqueUsers.size,
      credits,
      debits,
    };
  }, [filteredTransactions]);

  /*
   * ----------------------------------------------------------
   * PAGINATION
   * ----------------------------------------------------------
   */

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTransactions.length / PAGE_SIZE)
  );

  const safePage = Math.min(page, totalPages);

  const paginatedTransactions = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;

    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, safePage]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  /*
   * ----------------------------------------------------------
   * RESET FILTERS
   * ----------------------------------------------------------
   */

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setAssetFilter("all");
    setDirectionFilter("all");
    setPage(1);
  }

  const selectedProfile = selectedTransaction?.user_id
    ? profiles[selectedTransaction.user_id]
    : undefined;

  return (
    <AdminModule
      eyebrow="FINANCIAL LEDGER"
      title="Transactions"
      description="Monitor, inspect and manage the platform's complete transaction history."
      icon="≡"
    >
      <div className="transactions-page">
        <style jsx global>{`
          .transactions-page {
            position: relative;
            width: 100%;
            color: #eef7ff;
          }

          .transactions-page * {
            box-sizing: border-box;
          }

          .transactions-page::before {
            content: "";
            position: fixed;
            inset: 0;
            pointer-events: none;
            background:
              radial-gradient(
                circle at 12% 20%,
                rgba(0, 153, 255, 0.08),
                transparent 28%
              ),
              radial-gradient(
                circle at 88% 72%,
                rgba(212, 175, 55, 0.055),
                transparent 28%
              );
            z-index: -1;
          }

          .tx-topline {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 18px;
            margin-bottom: 22px;
            padding: 18px 20px;
            border: 1px solid rgba(0, 153, 255, 0.18);
            border-radius: 18px;
            background:
              linear-gradient(
                135deg,
                rgba(5, 18, 31, 0.92),
                rgba(2, 8, 16, 0.96)
              );
            box-shadow:
              0 18px 55px rgba(0, 0, 0, 0.34),
              inset 0 1px 0 rgba(255, 255, 255, 0.025);
          }

          .tx-system {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .tx-system-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: #55ffae;
            box-shadow:
              0 0 8px rgba(85, 255, 174, 0.9),
              0 0 22px rgba(85, 255, 174, 0.42);
          }

          .tx-system-copy strong {
            display: block;
            color: #f5f9ff;
            font-size: 12px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          .tx-system-copy span {
            display: block;
            margin-top: 3px;
            color: rgba(205, 222, 239, 0.52);
            font-size: 11px;
          }

          .tx-refresh {
            border: 1px solid rgba(0, 153, 255, 0.26);
            background: rgba(0, 153, 255, 0.07);
            color: #9edcff;
            border-radius: 10px;
            padding: 10px 14px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            cursor: pointer;
            transition:
              transform 160ms ease,
              border-color 160ms ease,
              background 160ms ease;
          }

          .tx-refresh:hover {
            transform: translateY(-1px);
            border-color: rgba(0, 153, 255, 0.6);
            background: rgba(0, 153, 255, 0.13);
          }

          .tx-refresh:disabled {
            cursor: wait;
            opacity: 0.5;
          }

          .tx-summary-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 18px;
          }

          .tx-summary-card {
            position: relative;
            overflow: hidden;
            min-height: 112px;
            padding: 18px;
            border: 1px solid rgba(110, 155, 193, 0.14);
            border-radius: 16px;
            background:
              linear-gradient(
                145deg,
                rgba(8, 23, 38, 0.9),
                rgba(2, 8, 15, 0.95)
              );
            box-shadow:
              0 16px 40px rgba(0, 0, 0, 0.22),
              inset 0 1px 0 rgba(255, 255, 255, 0.025);
          }

          .tx-summary-card::after {
            content: "";
            position: absolute;
            width: 90px;
            height: 90px;
            right: -35px;
            bottom: -45px;
            border-radius: 50%;
            background: rgba(0, 153, 255, 0.07);
            filter: blur(3px);
          }

          .tx-summary-label {
            color: rgba(194, 216, 234, 0.53);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          .tx-summary-value {
            margin-top: 10px;
            color: #f4f9ff;
            font-size: 25px;
            font-weight: 800;
            letter-spacing: -0.04em;
          }

          .tx-summary-meta {
            margin-top: 4px;
            color: rgba(205, 221, 236, 0.42);
            font-size: 10px;
          }

          .tx-summary-card.gold .tx-summary-value {
            color: #f0d46b;
          }

          .tx-summary-card.green .tx-summary-value {
            color: #65e7a4;
          }

          .tx-summary-card.blue .tx-summary-value {
            color: #67c9ff;
          }

          .tx-filter-panel {
            margin-bottom: 18px;
            padding: 18px;
            border: 1px solid rgba(0, 153, 255, 0.13);
            border-radius: 18px;
            background: rgba(3, 12, 22, 0.88);
            box-shadow:
              0 18px 50px rgba(0, 0, 0, 0.25),
              inset 0 1px 0 rgba(255, 255, 255, 0.02);
          }

          .tx-filter-grid {
            display: grid;
            grid-template-columns: minmax(220px, 1.6fr) repeat(4, minmax(130px, 1fr));
            gap: 10px;
          }

          .tx-input,
          .tx-select {
            width: 100%;
            min-height: 44px;
            padding: 0 13px;
            border: 1px solid rgba(122, 164, 198, 0.15);
            border-radius: 11px;
            outline: none;
            color: #eaf6ff;
            background: rgba(0, 8, 17, 0.74);
            font: inherit;
            font-size: 12px;
            transition:
              border-color 160ms ease,
              box-shadow 160ms ease;
          }

          .tx-input::placeholder {
            color: rgba(194, 216, 234, 0.34);
          }

          .tx-input:focus,
          .tx-select:focus {
            border-color: rgba(0, 153, 255, 0.56);
            box-shadow: 0 0 0 3px rgba(0, 153, 255, 0.08);
          }

          .tx-select option {
            background: #07111d;
            color: #eef7ff;
          }

          .tx-table-shell {
            overflow: hidden;
            border: 1px solid rgba(0, 153, 255, 0.14);
            border-radius: 18px;
            background:
              linear-gradient(
                145deg,
                rgba(4, 15, 26, 0.96),
                rgba(2, 7, 13, 0.98)
              );
            box-shadow:
              0 25px 70px rgba(0, 0, 0, 0.32),
              inset 0 1px 0 rgba(255, 255, 255, 0.025);
          }

          .tx-table-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 15px;
            padding: 17px 19px;
            border-bottom: 1px solid rgba(118, 158, 190, 0.1);
            background: rgba(255, 255, 255, 0.012);
          }

          .tx-table-title {
            color: #edf7ff;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.13em;
            text-transform: uppercase;
          }

          .tx-table-count {
            color: rgba(197, 221, 241, 0.42);
            font-size: 11px;
          }

          .tx-table-scroll {
            overflow-x: auto;
          }

          .tx-table {
            width: 100%;
            min-width: 1050px;
            border-collapse: collapse;
          }

          .tx-table th {
            padding: 12px 15px;
            border-bottom: 1px solid rgba(118, 158, 190, 0.1);
            color: rgba(170, 201, 226, 0.46);
            background: rgba(0, 8, 16, 0.48);
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.13em;
            text-align: left;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .tx-table td {
            padding: 14px 15px;
            border-bottom: 1px solid rgba(118, 158, 190, 0.065);
            color: #dceaf5;
            font-size: 12px;
            vertical-align: middle;
          }

          .tx-table tbody tr {
            cursor: pointer;
            transition:
              background 150ms ease,
              box-shadow 150ms ease;
          }

          .tx-table tbody tr:hover {
            background: rgba(0, 153, 255, 0.045);
            box-shadow: inset 2px 0 0 rgba(0, 153, 255, 0.6);
          }

          .tx-asset {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 50px;
            padding: 6px 8px;
            border: 1px solid rgba(129, 165, 195, 0.18);
            border-radius: 7px;
            color: #dceeff;
            background: rgba(255, 255, 255, 0.035);
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.08em;
          }

          .tx-asset-cct {
            border-color: rgba(212, 175, 55, 0.35);
            color: #f0d46b;
            background: rgba(212, 175, 55, 0.07);
          }

          .tx-asset-btc {
            border-color: rgba(247, 147, 26, 0.28);
            color: #ffbd63;
            background: rgba(247, 147, 26, 0.06);
          }

          .tx-asset-eth {
            border-color: rgba(137, 130, 255, 0.28);
            color: #bcb8ff;
            background: rgba(137, 130, 255, 0.06);
          }

          .tx-asset-usdt {
            border-color: rgba(38, 194, 129, 0.28);
            color: #73e2ae;
            background: rgba(38, 194, 129, 0.06);
          }

          .tx-reference {
            color: #a9d9fa;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 10px;
          }

          .tx-user {
            max-width: 180px;
          }

          .tx-user-main {
            overflow: hidden;
            color: #e7f4ff;
            font-size: 11px;
            font-weight: 700;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .tx-user-sub {
            overflow: hidden;
            margin-top: 3px;
            color: rgba(191, 216, 237, 0.38);
            font-size: 9px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .tx-type {
            color: #c9dbea;
            font-size: 10px;
            font-weight: 700;
          }

          .tx-direction {
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.05em;
            text-transform: uppercase;
          }

          .tx-credit {
            color: #61e6a1;
          }

          .tx-debit {
            color: #ff8d8d;
          }

          .tx-amount {
            color: #f0f7ff;
            font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
          }

          .tx-status {
            display: inline-flex;
            align-items: center;
            min-width: 70px;
            justify-content: center;
            padding: 5px 8px;
            border: 1px solid rgba(140, 174, 201, 0.14);
            border-radius: 999px;
            color: #b8cce0;
            background: rgba(255, 255, 255, 0.025);
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }

          .tx-status-success {
            border-color: rgba(82, 230, 158, 0.24);
            color: #67e6a4;
            background: rgba(82, 230, 158, 0.055);
          }

          .tx-status-pending {
            border-color: rgba(240, 212, 107, 0.25);
            color: #f0d46b;
            background: rgba(240, 212, 107, 0.05);
          }

          .tx-status-danger {
            border-color: rgba(255, 104, 104, 0.25);
            color: #ff8f8f;
            background: rgba(255, 104, 104, 0.05);
          }

          .tx-date {
            color: rgba(203, 222, 238, 0.54);
            font-size: 10px;
            white-space: nowrap;
          }

          .tx-source {
            margin-top: 3px;
            color: rgba(139, 190, 226, 0.3);
            font-size: 8px;
            text-transform: uppercase;
          }

          .tx-empty {
            padding: 70px 25px;
            text-align: center;
          }

          .tx-empty-icon {
            display: grid;
            width: 54px;
            height: 54px;
            margin: 0 auto 16px;
            place-items: center;
            border: 1px solid rgba(0, 153, 255, 0.2);
            border-radius: 14px;
            color: #65caff;
            background: rgba(0, 153, 255, 0.055);
            font-size: 22px;
          }

          .tx-empty h3 {
            margin: 0;
            color: #edf7ff;
            font-size: 15px;
          }

          .tx-empty p {
            max-width: 450px;
            margin: 8px auto 0;
            color: rgba(190, 215, 234, 0.44);
            font-size: 11px;
            line-height: 1.7;
          }

          .tx-error {
            margin-bottom: 18px;
            padding: 14px 16px;
            border: 1px solid rgba(255, 100, 100, 0.2);
            border-radius: 12px;
            color: #ffaaaa;
            background: rgba(255, 70, 70, 0.045);
            font-size: 11px;
          }

          .tx-pagination {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 14px 17px;
            border-top: 1px solid rgba(118, 158, 190, 0.08);
          }

          .tx-page-info {
            color: rgba(192, 217, 237, 0.45);
            font-size: 10px;
          }

          .tx-page-actions {
            display: flex;
            gap: 7px;
          }

          .tx-page-button {
            min-width: 34px;
            height: 32px;
            padding: 0 9px;
            border: 1px solid rgba(111, 157, 193, 0.14);
            border-radius: 8px;
            color: #b9d6ec;
            background: rgba(255, 255, 255, 0.025);
            font-size: 10px;
            font-weight: 800;
            cursor: pointer;
          }

          .tx-page-button:hover:not(:disabled) {
            border-color: rgba(0, 153, 255, 0.4);
            background: rgba(0, 153, 255, 0.07);
          }

          .tx-page-button:disabled {
            cursor: not-allowed;
            opacity: 0.3;
          }

          .tx-modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 100;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(0, 3, 8, 0.82);
            backdrop-filter: blur(12px);
          }

          .tx-modal {
            width: min(720px, 100%);
            max-height: min(760px, calc(100vh - 40px));
            overflow-y: auto;
            border: 1px solid rgba(0, 153, 255, 0.23);
            border-radius: 20px;
            background:
              linear-gradient(
                145deg,
                rgba(7, 24, 40, 0.98),
                rgba(1, 7, 14, 0.99)
              );
            box-shadow:
              0 35px 100px rgba(0, 0, 0, 0.6),
              0 0 60px rgba(0, 153, 255, 0.07);
          }

          .tx-modal-header {
            display: flex;
            justify-content: space-between;
            gap: 15px;
            padding: 20px;
            border-bottom: 1px solid rgba(124, 164, 195, 0.1);
          }

          .tx-modal-eyebrow {
            color: #5fc8ff;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.18em;
            text-transform: uppercase;
          }

          .tx-modal-title {
            margin-top: 5px;
            color: #f0f8ff;
            font-size: 20px;
            font-weight: 800;
          }

          .tx-modal-close {
            width: 34px;
            height: 34px;
            border: 1px solid rgba(129, 168, 198, 0.15);
            border-radius: 9px;
            color: #bcd4e7;
            background: rgba(255, 255, 255, 0.03);
            cursor: pointer;
            font-size: 16px;
          }

          .tx-modal-body {
            padding: 20px;
          }

          .tx-detail-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .tx-detail {
            padding: 13px;
            border: 1px solid rgba(125, 164, 193, 0.1);
            border-radius: 11px;
            background: rgba(255, 255, 255, 0.018);
          }

          .tx-detail-label {
            color: rgba(181, 207, 229, 0.4);
            font-size: 8px;
            font-weight: 800;
            letter-spacing: 0.13em;
            text-transform: uppercase;
          }

          .tx-detail-value {
            margin-top: 6px;
            color: #e9f5ff;
            font-size: 11px;
            font-weight: 700;
            word-break: break-word;
          }

          .tx-description {
            margin-top: 10px;
            padding: 14px;
            border: 1px solid rgba(125, 164, 193, 0.1);
            border-radius: 11px;
            color: rgba(216, 232, 245, 0.72);
            background: rgba(255, 255, 255, 0.018);
            font-size: 11px;
            line-height: 1.7;
          }

          @media (max-width: 1100px) {
            .tx-summary-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .tx-filter-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 700px) {
            .tx-topline {
              align-items: flex-start;
              flex-direction: column;
            }

            .tx-summary-grid {
              grid-template-columns: 1fr;
            }

            .tx-filter-grid {
              grid-template-columns: 1fr;
            }

            .tx-pagination {
              align-items: flex-start;
              flex-direction: column;
            }

            .tx-detail-grid {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        {/* ====================================================
            SYSTEM BAR
            ==================================================== */}

        <div className="tx-topline">
          <div className="tx-system">
            <span className="tx-system-dot" />

            <div className="tx-system-copy">
              <strong>Unified Ledger Online</strong>
              <span>
                CCT + external asset transaction streams synchronized
              </span>
            </div>
          </div>

          <button
            type="button"
            className="tx-refresh"
            onClick={() => void loadTransactions(true)}
            disabled={loading || refreshing}
          >
            {refreshing ? "Synchronizing..." : "Refresh Ledger"}
          </button>
        </div>

        {/* ====================================================
            ERROR
            ==================================================== */}

        {error && (
          <div className="tx-error">
            <strong>Ledger error:</strong> {error}
          </div>
        )}

        {/* ====================================================
            SUMMARY
            ==================================================== */}

        <div className="tx-summary-grid">
          <div className="tx-summary-card blue">
            <div className="tx-summary-label">Transactions</div>
            <div className="tx-summary-value">
              {summary.total.toLocaleString()}
            </div>
            <div className="tx-summary-meta">
              Across all supported assets
            </div>
          </div>

          <div className="tx-summary-card">
            <div className="tx-summary-label">Users</div>
            <div className="tx-summary-value">
              {summary.users.toLocaleString()}
            </div>
            <div className="tx-summary-meta">
              Unique transaction participants
            </div>
          </div>

          <div className="tx-summary-card green">
            <div className="tx-summary-label">Credits</div>
            <div className="tx-summary-value">
              {summary.credits.toLocaleString(undefined, {
                maximumFractionDigits: 8,
              })}
            </div>
            <div className="tx-summary-meta">
              Filtered credit volume
            </div>
          </div>

          <div className="tx-summary-card gold">
            <div className="tx-summary-label">Debits</div>
            <div className="tx-summary-value">
              {summary.debits.toLocaleString(undefined, {
                maximumFractionDigits: 8,
              })}
            </div>
            <div className="tx-summary-meta">
              Filtered debit volume
            </div>
          </div>
        </div>

        {/* ====================================================
            FILTERS
            ==================================================== */}

        <div className="tx-filter-panel">
          <div className="tx-filter-grid">
            <input
              type="text"
              className="tx-input"
              placeholder="Search reference, user, email, asset, description..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />

            <select
              className="tx-select"
              value={assetFilter}
              onChange={(event) => {
                setAssetFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Assets</option>

              {assets.map((asset) => (
                <option key={asset} value={asset}>
                  {asset}
                </option>
              ))}
            </select>

            <select
              className="tx-select"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Types</option>

              {transactionTypes.map((type) => (
                <option key={type} value={type}>
                  {prettyLabel(type)}
                </option>
              ))}
            </select>

            <select
              className="tx-select"
              value={directionFilter}
              onChange={(event) => {
                setDirectionFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Directions</option>
              <option value="credit">Credit</option>
              <option value="debit">Debit</option>
            </select>

            <select
              className="tx-select"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All Statuses</option>

              {statuses.map((status) => (
                <option key={status} value={status}>
                  {prettyLabel(status)}
                </option>
              ))}
            </select>
          </div>

          {(search ||
            assetFilter !== "all" ||
            typeFilter !== "all" ||
            directionFilter !== "all" ||
            statusFilter !== "all") && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                marginTop: 10,
                border: "none",
                background: "transparent",
                color: "#69caff",
                fontSize: 10,
                fontWeight: 800,
                cursor: "pointer",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* ====================================================
            TABLE
            ==================================================== */}

        <div className="tx-table-shell">
          <div className="tx-table-head">
            <div className="tx-table-title">
              Complete Transaction Ledger
            </div>

            <div className="tx-table-count">
              {filteredTransactions.length.toLocaleString()} records
            </div>
          </div>

          {loading ? (
            <div className="tx-empty">
              <div className="tx-empty-icon">◌</div>
              <h3>Synchronizing ledger</h3>
              <p>
                Loading CCT and external asset transaction streams...
              </p>
            </div>
          ) : paginatedTransactions.length === 0 ? (
            <div className="tx-empty">
              <div className="tx-empty-icon">≡</div>
              <h3>No transactions found</h3>
              <p>
                No records match the current search and filter
                configuration.
              </p>
            </div>
          ) : (
            <>
              <div className="tx-table-scroll">
                <table className="tx-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Reference</th>
                      <th>User</th>
                      <th>Type</th>
                      <th>Direction</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedTransactions.map((transaction) => {
                      const profile = transaction.user_id
                        ? profiles[transaction.user_id]
                        : undefined;

                      const displayUser =
                        profile?.full_name ||
                        profile?.username ||
                        profile?.email ||
                        "Unknown user";

                      return (
                        <tr
                          key={`${transaction.source_table}-${transaction.id}`}
                          onClick={() =>
                            setSelectedTransaction(transaction)
                          }
                        >
                          <td>
                            <span
                              className={assetClass(
                                transaction.asset_symbol
                              )}
                            >
                              {stringValue(
                                transaction.asset_symbol
                              ).toUpperCase() || "—"}
                            </span>
                          </td>

                          <td>
                            <div className="tx-reference">
                              {shortHash(transaction.reference)}
                            </div>
                          </td>

                          <td>
                            <div className="tx-user">
                              <div className="tx-user-main">
                                {displayUser}
                              </div>

                              <div className="tx-user-sub">
                                {profile?.email ||
                                  transaction.user_id ||
                                  "No user identifier"}
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="tx-type">
                              {prettyLabel(
                                transaction.transaction_type
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={directionClass(
                                transaction.direction
                              )}
                            >
                              {stringValue(
                                transaction.direction
                              ).toUpperCase() || "—"}
                            </span>
                          </td>

                          <td>
                            <span className="tx-amount">
                              {formatAmount(
                                transaction.amount,
                                transaction.asset_symbol
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className={statusClass(
                                transaction.status
                              )}
                            >
                              {prettyLabel(transaction.status)}
                            </span>
                          </td>

                          <td>
                            <div className="tx-date">
                              {formatDate(transaction.created_at)}
                            </div>

                            <div className="tx-source">
                              {transaction.source_table ===
                              "asset_transactions"
                                ? "Asset Ledger"
                                : "CCT Ledger"}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="tx-pagination">
                <div className="tx-page-info">
                  Page {safePage} of {totalPages} · Showing{" "}
                  {paginatedTransactions.length} of{" "}
                  {filteredTransactions.length}
                </div>

                <div className="tx-page-actions">
                  <button
                    type="button"
                    className="tx-page-button"
                    disabled={safePage <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    className="tx-page-button"
                    disabled={safePage >= totalPages}
                    onClick={() =>
                      setPage((current) =>
                        Math.min(totalPages, current + 1)
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ====================================================
            TRANSACTION DETAIL MODAL
            ==================================================== */}

        {selectedTransaction && (
          <div
            className="tx-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedTransaction(null);
              }
            }}
          >
            <div className="tx-modal">
              <div className="tx-modal-header">
                <div>
                  <div className="tx-modal-eyebrow">
                    Transaction inspection
                  </div>

                  <div className="tx-modal-title">
                    {prettyLabel(
                      selectedTransaction.transaction_type
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="tx-modal-close"
                  onClick={() => setSelectedTransaction(null)}
                  aria-label="Close transaction details"
                >
                  ×
                </button>
              </div>

              <div className="tx-modal-body">
                <div className="tx-detail-grid">
                  <div className="tx-detail">
                    <div className="tx-detail-label">
                      Asset
                    </div>

                    <div className="tx-detail-value">
                      {stringValue(
                        selectedTransaction.asset_symbol
                      ).toUpperCase() || "—"}
                    </div>
                  </div>

                  <div className="tx-detail">
                    <div className="tx-detail-label">
                      Status
                    </div>

                    <div className="tx-detail-value">
                      {prettyLabel(selectedTransaction.status)}
                    </div>
                  </div>

                  <div className="tx-detail">
                    <div className="tx-detail-label">
                      Reference
                    </div>

                    <div className="tx-detail-value">
                      {selectedTransaction.reference || "—"}
                    </div>
                  </div>

                  <div className="tx-detail">
                    <div className="tx-detail-label">
                      Transaction ID
                    </div>

                    <div className="tx-detail-value">
                      {selectedTransaction.id}
                    </div>
                  </div>

                  <div className="tx-detail">
                    <div className="tx-detail-label">
                      User
                    </div>

                    <div className="tx-detail-value">
                      {selectedProfile?.full_name ||
                        selectedProfile?.username ||
                        selectedProfile?.email ||
                        selectedTransaction.user_id ||
                        "Unknown user"}
                    </div>
                  </div>

                  <div className="tx-detail">
                    <div className="tx-detail-label">
                      Direction
                    </div>

                    <div className="tx-detail-value">
                      {prettyLabel(
                        selectedTransaction.direction
                      )}
                    </div>
                  </div>

                  <div className="tx-detail">
                    <div className="tx-detail-label">
                      Amount
                    </div>

                    <div className="tx-detail-value">
                      {formatAmount(
                        selectedTransaction.amount,
                        selectedTransaction.asset_symbol
                      )}
                    </div>
                  </div>

                  <div className="tx-detail">
                    <div className="tx-detail-label">
                      Created
                    </div>

                    <div className="tx-detail-value">
                      {formatDate(selectedTransaction.created_at)}
                    </div>
                  </div>

                  <div className="tx-detail">
                    <div className="tx-detail-label">
                      Balance Before
                    </div>

                    <div className="tx-detail-value">
                      {formatAmount(
                        selectedTransaction.balance_before,
                        selectedTransaction.asset_symbol
                      )}
                    </div>
                  </div>

                  <div className="tx-detail">
                    <div className="tx-detail-label">
                      Balance After
                    </div>

                    <div className="tx-detail-value">
                      {formatAmount(
                        selectedTransaction.balance_after,
                        selectedTransaction.asset_symbol
                      )}
                    </div>
                  </div>

                  <div className="tx-detail">
                    <div className="tx-detail-label">
                      Ledger Source
                    </div>

                    <div className="tx-detail-value">
                      {selectedTransaction.source_table ===
                      "asset_transactions"
                        ? "External Asset Ledger"
                        : "CCT Ledger"}
                    </div>
                  </div>
                </div>

                {selectedTransaction.description && (
                  <div className="tx-description">
                    <strong>Description</strong>
                    <br />
                    {selectedTransaction.description}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminModule>
  );
}
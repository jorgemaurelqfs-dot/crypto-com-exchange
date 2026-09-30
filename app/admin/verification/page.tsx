"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminModule from "../AdminModule";
import { createClient } from "../../../lib/supabase/client";

type VerificationStatus = string;

type AdminUser = {
  user_id: string;
  email: string | null;
  account_id: string | null;
  username: string | null;
  full_name: string | null;
  account_status: string | null;
  verification_status: VerificationStatus | null;
  available_balance: number | null;
  locked_balance: number | null;
  created_at: string | null;
};

type StatusFilter = "all" | "verified" | "unverified" | "pending" | "rejected";

const PAGE_SIZE = 50;

export default function AdminVerificationsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  const [selectedUser, setSelectedUser] =
    useState<AdminUser | null>(null);

  const [pendingAction, setPendingAction] = useState<{
    user: AdminUser;
    status: string;
    label: string;
  } | null>(null);

  const normalizeStatus = (status: string | null | undefined) => {
    return String(status || "unverified").trim().toLowerCase();
  };

  const formatStatus = (status: string | null | undefined) => {
    const normalized = normalizeStatus(status);

    if (normalized === "verified") return "Verified";
    if (normalized === "pending") return "Pending";
    if (normalized === "rejected") return "Rejected";
    if (normalized === "unverified") return "Unverified";

    return normalized
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const statusClass = (status: string | null | undefined) => {
    const normalized = normalizeStatus(status);

    if (normalized === "verified") return "status-pill status-verified";
    if (normalized === "pending") return "status-pill status-pending";
    if (normalized === "rejected") return "status-pill status-rejected";

    return "status-pill status-unverified";
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "admin_get_users",
        {
          p_search: search.trim() || null,
          p_limit: PAGE_SIZE,
          p_offset: 0,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setUsers((data || []) as AdminUser[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load verification records."
      );
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [search, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadUsers();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    if (statusFilter === "all") {
      return users;
    }

    return users.filter(
      (user) => normalizeStatus(user.verification_status) === statusFilter
    );
  }, [users, statusFilter]);

  const statistics = useMemo(() => {
    const total = users.length;

    const verified = users.filter(
      (user) => normalizeStatus(user.verification_status) === "verified"
    ).length;

    const pending = users.filter(
      (user) => normalizeStatus(user.verification_status) === "pending"
    ).length;

    const rejected = users.filter(
      (user) => normalizeStatus(user.verification_status) === "rejected"
    ).length;

    const unverified = users.filter(
      (user) => normalizeStatus(user.verification_status) === "unverified"
    ).length;

    return {
      total,
      verified,
      pending,
      rejected,
      unverified,
    };
  }, [users]);

  const requestStatusChange = (
    user: AdminUser,
    status: string,
    label: string
  ) => {
    setNotice("");
    setError("");

    setPendingAction({
      user,
      status,
      label,
    });
  };

  const applyStatusChange = async () => {
    if (!pendingAction) return;

    setChanging(true);
    setError("");
    setNotice("");

    const { user, status } = pendingAction;

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "admin_set_verification_status",
        {
          p_user_id: user.user_id,
          p_status: status,
        }
      );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      /*
       * The RPC returns jsonb. We don't depend on a specific
       * response shape here because the database function may
       * evolve independently from the UI.
       */
      void data;

      setUsers((current) =>
        current.map((item) =>
          item.user_id === user.user_id
            ? {
                ...item,
                verification_status: status,
              }
            : item
        )
      );

      setSelectedUser((current) =>
        current && current.user_id === user.user_id
          ? {
              ...current,
              verification_status: status,
            }
          : current
      );

      setNotice(
        `${user.email || user.username || "User"} verification status updated to ${formatStatus(
          status
        )}.`
      );

      setPendingAction(null);

      /*
       * Refresh from Supabase so the UI reflects the authoritative
       * database state rather than relying only on local state.
       */
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update verification status."
      );
    } finally {
      setChanging(false);
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "—";

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
  };

  const formatAmount = (value: number | null) => {
    const amount = Number(value || 0);

    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <AdminModule
      eyebrow="IDENTITY CONTROL"
      title="Verifications"
      description="Review account verification states and control user verification status."
      icon="✓"
    >
      <div className="verification-page">
        <style jsx>{`
          .verification-page {
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 22px;
          }

          .verification-page::before {
            content: "";
            position: absolute;
            inset: -80px -120px auto;
            height: 240px;
            pointer-events: none;
            background:
              radial-gradient(
                circle at 20% 40%,
                rgba(0, 153, 255, 0.13),
                transparent 34%
              ),
              radial-gradient(
                circle at 80% 20%,
                rgba(212, 175, 55, 0.09),
                transparent 30%
              );
            filter: blur(18px);
          }

          .control-strip {
            position: relative;
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 12px;
          }

          .stat-card {
            position: relative;
            min-height: 118px;
            overflow: hidden;
            padding: 18px;
            border: 1px solid rgba(107, 157, 201, 0.16);
            border-radius: 16px;
            background:
              linear-gradient(
                145deg,
                rgba(11, 25, 40, 0.9),
                rgba(3, 8, 16, 0.96)
              );
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.025),
              0 14px 35px rgba(0, 0, 0, 0.24);
          }

          .stat-card::after {
            content: "";
            position: absolute;
            width: 90px;
            height: 90px;
            right: -35px;
            top: -40px;
            border-radius: 50%;
            background: rgba(0, 153, 255, 0.07);
            filter: blur(4px);
          }

          .stat-label {
            position: relative;
            z-index: 1;
            display: block;
            margin-bottom: 9px;
            color: #7791aa;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          .stat-value {
            position: relative;
            z-index: 1;
            color: #eef7ff;
            font-size: 28px;
            line-height: 1;
            font-weight: 800;
            letter-spacing: -0.04em;
          }

          .stat-sub {
            position: relative;
            z-index: 1;
            display: block;
            margin-top: 9px;
            color: #536b80;
            font-size: 11px;
          }

          .stat-card.verified {
            border-color: rgba(72, 220, 145, 0.18);
          }

          .stat-card.verified .stat-value {
            color: #65e3a2;
          }

          .stat-card.pending {
            border-color: rgba(240, 212, 107, 0.18);
          }

          .stat-card.pending .stat-value {
            color: #f0d46b;
          }

          .stat-card.rejected {
            border-color: rgba(255, 90, 100, 0.18);
          }

          .stat-card.rejected .stat-value {
            color: #ff7d86;
          }

          .control-panel {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            flex-wrap: wrap;
            padding: 16px;
            border: 1px solid rgba(91, 137, 176, 0.17);
            border-radius: 16px;
            background: rgba(4, 13, 23, 0.88);
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.025),
              0 16px 40px rgba(0, 0, 0, 0.18);
          }

          .search-box {
            position: relative;
            flex: 1;
            min-width: 260px;
          }

          .search-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: #4f7899;
            font-size: 15px;
            pointer-events: none;
          }

          .search-input {
            width: 100%;
            height: 44px;
            padding: 0 15px 0 39px;
            outline: none;
            border: 1px solid rgba(87, 135, 177, 0.2);
            border-radius: 10px;
            background: rgba(2, 8, 15, 0.88);
            color: #eaf5ff;
            font-size: 13px;
            transition:
              border-color 0.2s ease,
              box-shadow 0.2s ease;
          }

          .search-input::placeholder {
            color: #486178;
          }

          .search-input:focus {
            border-color: rgba(0, 153, 255, 0.55);
            box-shadow: 0 0 0 3px rgba(0, 153, 255, 0.08);
          }

          .filter-group {
            display: flex;
            align-items: center;
            gap: 5px;
            flex-wrap: wrap;
          }

          .filter-button {
            height: 36px;
            padding: 0 11px;
            border: 1px solid rgba(82, 127, 166, 0.17);
            border-radius: 8px;
            background: rgba(7, 18, 29, 0.72);
            color: #7891a6;
            cursor: pointer;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            transition:
              background 0.2s ease,
              border-color 0.2s ease,
              color 0.2s ease;
          }

          .filter-button:hover {
            border-color: rgba(0, 153, 255, 0.32);
            color: #c9e8ff;
          }

          .filter-button.active {
            border-color: rgba(0, 153, 255, 0.45);
            background: rgba(0, 153, 255, 0.1);
            color: #6ec8ff;
          }

          .notice {
            padding: 12px 15px;
            border: 1px solid rgba(70, 219, 145, 0.22);
            border-radius: 10px;
            background: rgba(35, 180, 112, 0.06);
            color: #72e7aa;
            font-size: 12px;
          }

          .error {
            padding: 12px 15px;
            border: 1px solid rgba(255, 84, 96, 0.22);
            border-radius: 10px;
            background: rgba(255, 70, 80, 0.055);
            color: #ff9299;
            font-size: 12px;
          }

          .table-shell {
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(91, 137, 176, 0.17);
            border-radius: 17px;
            background:
              linear-gradient(
                145deg,
                rgba(7, 18, 30, 0.96),
                rgba(2, 8, 15, 0.98)
              );
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.025),
              0 20px 50px rgba(0, 0, 0, 0.22);
          }

          .table-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 17px 18px;
            border-bottom: 1px solid rgba(91, 137, 176, 0.12);
          }

          .table-title {
            margin: 0;
            color: #e7f3fc;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.02em;
          }

          .table-count {
            color: #536c81;
            font-size: 11px;
          }

          .table-scroll {
            width: 100%;
            overflow-x: auto;
          }

          table {
            width: 100%;
            min-width: 980px;
            border-collapse: collapse;
          }

          th {
            padding: 12px 15px;
            border-bottom: 1px solid rgba(91, 137, 176, 0.12);
            color: #4e687f;
            background: rgba(2, 8, 15, 0.55);
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.12em;
            text-align: left;
            text-transform: uppercase;
            white-space: nowrap;
          }

          td {
            padding: 14px 15px;
            border-bottom: 1px solid rgba(91, 137, 176, 0.08);
            color: #a8bac9;
            font-size: 12px;
            vertical-align: middle;
          }

          tbody tr {
            transition: background 0.18s ease;
          }

          tbody tr:hover {
            background: rgba(0, 153, 255, 0.035);
          }

          tbody tr:last-child td {
            border-bottom: 0;
          }

          .user-cell {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }

          .user-name {
            color: #e4f1fa;
            font-weight: 750;
          }

          .user-email {
            color: #4f718c;
            font-size: 10px;
          }

          .account-id {
            color: #6ba8d2;
            font-family: monospace;
            font-size: 11px;
          }

          .account-status {
            color: #8197aa;
            font-size: 11px;
          }

          .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            min-height: 25px;
            padding: 0 9px;
            border-radius: 999px;
            font-size: 9px;
            font-weight: 850;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            white-space: nowrap;
          }

          .status-pill::before {
            content: "";
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: currentColor;
            box-shadow: 0 0 8px currentColor;
          }

          .status-verified {
            color: #5fe19d;
            border: 1px solid rgba(95, 225, 157, 0.2);
            background: rgba(95, 225, 157, 0.07);
          }

          .status-pending {
            color: #f0d46b;
            border: 1px solid rgba(240, 212, 107, 0.2);
            background: rgba(240, 212, 107, 0.07);
          }

          .status-rejected {
            color: #ff7e88;
            border: 1px solid rgba(255, 126, 136, 0.2);
            background: rgba(255, 126, 136, 0.07);
          }

          .status-unverified {
            color: #8ca1b3;
            border: 1px solid rgba(140, 161, 179, 0.16);
            background: rgba(140, 161, 179, 0.05);
          }

          .date {
            color: #71879a;
            white-space: nowrap;
            font-size: 10px;
          }

          .action-cell {
            white-space: nowrap;
          }

          .view-button {
            height: 30px;
            padding: 0 11px;
            border: 1px solid rgba(0, 153, 255, 0.23);
            border-radius: 7px;
            background: rgba(0, 153, 255, 0.055);
            color: #62bdf2;
            cursor: pointer;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .view-button:hover {
            border-color: rgba(0, 153, 255, 0.5);
            background: rgba(0, 153, 255, 0.11);
          }

          .empty-state,
          .loading-state {
            padding: 60px 20px;
            text-align: center;
          }

          .empty-icon,
          .loading-icon {
            display: grid;
            width: 52px;
            height: 52px;
            margin: 0 auto 15px;
            place-items: center;
            border: 1px solid rgba(0, 153, 255, 0.18);
            border-radius: 50%;
            background: rgba(0, 153, 255, 0.05);
            color: #4e9fd0;
            font-size: 19px;
          }

          .loading-icon {
            animation: pulse 1.4s ease-in-out infinite;
          }

          .empty-state h3,
          .loading-state h3 {
            margin: 0 0 7px;
            color: #d9e8f2;
            font-size: 14px;
          }

          .empty-state p,
          .loading-state p {
            margin: 0;
            color: #516a7e;
            font-size: 11px;
          }

          .modal-backdrop {
            position: fixed;
            z-index: 100;
            inset: 0;
            display: grid;
            padding: 22px;
            place-items: center;
            background: rgba(0, 3, 8, 0.76);
            backdrop-filter: blur(12px);
          }

          .modal {
            position: relative;
            width: min(650px, 100%);
            max-height: calc(100vh - 44px);
            overflow-y: auto;
            border: 1px solid rgba(0, 153, 255, 0.24);
            border-radius: 18px;
            background:
              linear-gradient(
                145deg,
                rgba(8, 21, 35, 0.98),
                rgba(2, 7, 14, 0.99)
              );
            box-shadow:
              0 35px 100px rgba(0, 0, 0, 0.58),
              0 0 70px rgba(0, 153, 255, 0.08);
          }

          .modal-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 15px;
            padding: 20px;
            border-bottom: 1px solid rgba(91, 137, 176, 0.12);
          }

          .modal-eyebrow {
            display: block;
            margin-bottom: 6px;
            color: #4f9fd0;
            font-size: 9px;
            font-weight: 850;
            letter-spacing: 0.16em;
            text-transform: uppercase;
          }

          .modal-header h2 {
            margin: 0;
            color: #ecf7ff;
            font-size: 20px;
            letter-spacing: -0.025em;
          }

          .close-button {
            display: grid;
            width: 32px;
            height: 32px;
            flex: 0 0 auto;
            place-items: center;
            border: 1px solid rgba(91, 137, 176, 0.18);
            border-radius: 8px;
            background: rgba(7, 18, 29, 0.75);
            color: #7891a6;
            cursor: pointer;
            font-size: 17px;
          }

          .close-button:hover {
            color: #d8ecfa;
            border-color: rgba(0, 153, 255, 0.3);
          }

          .modal-body {
            display: grid;
            gap: 18px;
            padding: 20px;
          }

          .identity-card {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 15px;
            border: 1px solid rgba(91, 137, 176, 0.13);
            border-radius: 12px;
            background: rgba(2, 8, 15, 0.55);
          }

          .avatar {
            display: grid;
            width: 48px;
            height: 48px;
            flex: 0 0 auto;
            place-items: center;
            border: 1px solid rgba(0, 153, 255, 0.2);
            border-radius: 50%;
            background:
              linear-gradient(
                145deg,
                rgba(0, 153, 255, 0.13),
                rgba(212, 175, 55, 0.08)
              );
            color: #76c9f7;
            font-size: 17px;
            font-weight: 850;
          }

          .identity-copy {
            min-width: 0;
          }

          .identity-name {
            margin-bottom: 4px;
            color: #e9f5fc;
            font-size: 14px;
            font-weight: 800;
          }

          .identity-email {
            overflow: hidden;
            color: #5e7890;
            font-size: 11px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .detail-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          .detail {
            padding: 13px;
            border: 1px solid rgba(91, 137, 176, 0.11);
            border-radius: 10px;
            background: rgba(6, 16, 26, 0.7);
          }

          .detail-label {
            display: block;
            margin-bottom: 6px;
            color: #4d667b;
            font-size: 8px;
            font-weight: 850;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .detail-value {
            color: #bcd0de;
            font-size: 11px;
            word-break: break-word;
          }

          .verification-control {
            padding: 15px;
            border: 1px solid rgba(0, 153, 255, 0.13);
            border-radius: 12px;
            background: rgba(0, 153, 255, 0.025);
          }

          .verification-control-title {
            margin: 0 0 12px;
            color: #d9e9f4;
            font-size: 11px;
            font-weight: 800;
          }

          .action-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
          }

          .action-button {
            min-height: 40px;
            padding: 0 10px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 9px;
            font-weight: 850;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .action-button:disabled {
            opacity: 0.45;
            cursor: not-allowed;
          }

          .approve-button {
            border: 1px solid rgba(75, 219, 143, 0.25);
            background: rgba(75, 219, 143, 0.07);
            color: #63e2a0;
          }

          .approve-button:hover:not(:disabled) {
            background: rgba(75, 219, 143, 0.13);
          }

          .reject-button {
            border: 1px solid rgba(255, 87, 99, 0.25);
            background: rgba(255, 87, 99, 0.07);
            color: #ff858c;
          }

          .reject-button:hover:not(:disabled) {
            background: rgba(255, 87, 99, 0.13);
          }

          .reset-button {
            border: 1px solid rgba(240, 212, 107, 0.23);
            background: rgba(240, 212, 107, 0.055);
            color: #e9cf6d;
          }

          .reset-button:hover:not(:disabled) {
            background: rgba(240, 212, 107, 0.1);
          }

          .confirmation-copy {
            color: #8da3b4;
            font-size: 12px;
            line-height: 1.6;
          }

          .confirmation-copy strong {
            color: #e7f2f9;
          }

          .confirmation-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 4px;
          }

          .cancel-button,
          .confirm-button {
            min-height: 38px;
            padding: 0 14px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 9px;
            font-weight: 850;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .cancel-button {
            border: 1px solid rgba(91, 137, 176, 0.17);
            background: rgba(7, 18, 29, 0.75);
            color: #7891a6;
          }

          .confirm-button {
            border: 1px solid rgba(0, 153, 255, 0.35);
            background: rgba(0, 153, 255, 0.1);
            color: #72c9fb;
          }

          .confirm-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          @keyframes pulse {
            0%,
            100% {
              opacity: 0.45;
              transform: scale(0.96);
            }

            50% {
              opacity: 1;
              transform: scale(1);
            }
          }

          @media (max-width: 1050px) {
            .control-strip {
              grid-template-columns: repeat(3, minmax(0, 1fr));
            }
          }

          @media (max-width: 720px) {
            .control-strip {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .control-panel {
              align-items: stretch;
            }

            .search-box {
              min-width: 100%;
            }

            .filter-group {
              width: 100%;
            }

            .filter-button {
              flex: 1;
            }

            .detail-grid {
              grid-template-columns: 1fr;
            }

            .action-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 470px) {
            .control-strip {
              grid-template-columns: 1fr;
            }

            .stat-card {
              min-height: 95px;
            }

            .modal-backdrop {
              padding: 10px;
            }

            .modal {
              max-height: calc(100vh - 20px);
            }
          }
        `}</style>

        <div className="control-strip">
          <div className="stat-card">
            <span className="stat-label">Records Loaded</span>
            <strong className="stat-value">{statistics.total}</strong>
            <span className="stat-sub">Current administrator result set</span>
          </div>

          <div className="stat-card verified">
            <span className="stat-label">Verified</span>
            <strong className="stat-value">{statistics.verified}</strong>
            <span className="stat-sub">Approved verification status</span>
          </div>

          <div className="stat-card pending">
            <span className="stat-label">Pending</span>
            <strong className="stat-value">{statistics.pending}</strong>
            <span className="stat-sub">Awaiting verification review</span>
          </div>

          <div className="stat-card rejected">
            <span className="stat-label">Rejected</span>
            <strong className="stat-value">{statistics.rejected}</strong>
            <span className="stat-sub">Rejected verification status</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Unverified</span>
            <strong className="stat-value">{statistics.unverified}</strong>
            <span className="stat-sub">No verified state assigned</span>
          </div>
        </div>

        <div className="control-panel">
          <div className="search-box">
            <span className="search-icon">⌕</span>

            <input
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search email, account ID, username or name..."
              type="search"
            />
          </div>

          <div className="filter-group">
            {(
              [
                ["all", "All"],
                ["verified", "Verified"],
                ["pending", "Pending"],
                ["rejected", "Rejected"],
                ["unverified", "Unverified"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`filter-button ${
                  statusFilter === value ? "active" : ""
                }`}
                onClick={() => setStatusFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {notice && <div className="notice">{notice}</div>}

        {error && <div className="error">{error}</div>}

        <section className="table-shell">
          <div className="table-top">
            <div>
              <h2 className="table-title">Verification Records</h2>
            </div>

            <span className="table-count">
              {filteredUsers.length} record
              {filteredUsers.length === 1 ? "" : "s"}
            </span>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="loading-icon">◌</div>
              <h3>Loading verification records</h3>
              <p>
                Secure administrator query is retrieving account data.
              </p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✓</div>
              <h3>No verification records found</h3>
              <p>
                Try another search term or change the verification filter.
              </p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Account ID</th>
                    <th>Account Status</th>
                    <th>Verification</th>
                    <th>Available Balance</th>
                    <th>Created</th>
                    <th>Control</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.user_id}>
                      <td>
                        <div className="user-cell">
                          <span className="user-name">
                            {user.full_name ||
                              user.username ||
                              "Unnamed User"}
                          </span>

                          <span className="user-email">
                            {user.email || "No email"}
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="account-id">
                          {user.account_id || "—"}
                        </span>
                      </td>

                      <td>
                        <span className="account-status">
                          {user.account_status || "—"}
                        </span>
                      </td>

                      <td>
                        <span className={statusClass(user.verification_status)}>
                          {formatStatus(user.verification_status)}
                        </span>
                      </td>

                      <td>
                        {formatAmount(user.available_balance)} CCT
                      </td>

                      <td>
                        <span className="date">
                          {formatDate(user.created_at)}
                        </span>
                      </td>

                      <td className="action-cell">
                        <button
                          type="button"
                          className="view-button"
                          onClick={() => {
                            setNotice("");
                            setError("");
                            setSelectedUser(user);
                          }}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {selectedUser && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedUser(null);
              }
            }}
          >
            <div className="modal">
              <div className="modal-header">
                <div>
                  <span className="modal-eyebrow">
                    Verification Review
                  </span>

                  <h2>
                    {selectedUser.full_name ||
                      selectedUser.username ||
                      "User Account"}
                  </h2>
                </div>

                <button
                  type="button"
                  className="close-button"
                  onClick={() => setSelectedUser(null)}
                  aria-label="Close verification review"
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="identity-card">
                  <div className="avatar">
                    {(
                      selectedUser.full_name ||
                      selectedUser.username ||
                      selectedUser.email ||
                      "U"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="identity-copy">
                    <div className="identity-name">
                      {selectedUser.full_name ||
                        selectedUser.username ||
                        "Unnamed User"}
                    </div>

                    <div className="identity-email">
                      {selectedUser.email || "No email address"}
                    </div>
                  </div>

                  <span
                    className={statusClass(
                      selectedUser.verification_status
                    )}
                  >
                    {formatStatus(selectedUser.verification_status)}
                  </span>
                </div>

                <div className="detail-grid">
                  <div className="detail">
                    <span className="detail-label">User ID</span>
                    <span className="detail-value">
                      {selectedUser.user_id}
                    </span>
                  </div>

                  <div className="detail">
                    <span className="detail-label">Account ID</span>
                    <span className="detail-value">
                      {selectedUser.account_id || "—"}
                    </span>
                  </div>

                  <div className="detail">
                    <span className="detail-label">Username</span>
                    <span className="detail-value">
                      {selectedUser.username || "—"}
                    </span>
                  </div>

                  <div className="detail">
                    <span className="detail-label">Account Status</span>
                    <span className="detail-value">
                      {selectedUser.account_status || "—"}
                    </span>
                  </div>

                  <div className="detail">
                    <span className="detail-label">
                      Available Balance
                    </span>
                    <span className="detail-value">
                      {formatAmount(selectedUser.available_balance)} CCT
                    </span>
                  </div>

                  <div className="detail">
                    <span className="detail-label">
                      Locked Balance
                    </span>
                    <span className="detail-value">
                      {formatAmount(selectedUser.locked_balance)} CCT
                    </span>
                  </div>

                  <div className="detail">
                    <span className="detail-label">Created</span>
                    <span className="detail-value">
                      {formatDate(selectedUser.created_at)}
                    </span>
                  </div>

                  <div className="detail">
                    <span className="detail-label">
                      Current Verification
                    </span>
                    <span className="detail-value">
                      {formatStatus(selectedUser.verification_status)}
                    </span>
                  </div>
                </div>

                <div className="verification-control">
                  <h3 className="verification-control-title">
                    Verification Status Control
                  </h3>

                  <div className="action-grid">
                    <button
                      type="button"
                      className="action-button approve-button"
                      disabled={
                        changing ||
                        normalizeStatus(
                          selectedUser.verification_status
                        ) === "verified"
                      }
                      onClick={() =>
                        requestStatusChange(
                          selectedUser,
                          "verified",
                          "Approve verification"
                        )
                      }
                    >
                      Approve
                    </button>

                    <button
                      type="button"
                      className="action-button reject-button"
                      disabled={
                        changing ||
                        normalizeStatus(
                          selectedUser.verification_status
                        ) === "rejected"
                      }
                      onClick={() =>
                        requestStatusChange(
                          selectedUser,
                          "rejected",
                          "Reject verification"
                        )
                      }
                    >
                      Reject
                    </button>

                    <button
                      type="button"
                      className="action-button reset-button"
                      disabled={
                        changing ||
                        normalizeStatus(
                          selectedUser.verification_status
                        ) === "unverified"
                      }
                      onClick={() =>
                        requestStatusChange(
                          selectedUser,
                          "unverified",
                          "Reset verification"
                        )
                      }
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {pendingAction && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !changing) {
                setPendingAction(null);
              }
            }}
          >
            <div className="modal">
              <div className="modal-header">
                <div>
                  <span className="modal-eyebrow">
                    Administrator Confirmation
                  </span>

                  <h2>{pendingAction.label}</h2>
                </div>

                <button
                  type="button"
                  className="close-button"
                  disabled={changing}
                  onClick={() => setPendingAction(null)}
                  aria-label="Close confirmation"
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <p className="confirmation-copy">
                  You are about to change the verification status for{" "}
                  <strong>
                    {pendingAction.user.email ||
                      pendingAction.user.username ||
                      pendingAction.user.user_id}
                  </strong>{" "}
                  to{" "}
                  <strong>
                    {formatStatus(pendingAction.status)}
                  </strong>
                  .
                </p>

                <p className="confirmation-copy">
                  This action will update the authoritative profile
                  verification status through the administrator RPC.
                </p>

                <div className="confirmation-actions">
                  <button
                    type="button"
                    className="cancel-button"
                    disabled={changing}
                    onClick={() => setPendingAction(null)}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="confirm-button"
                    disabled={changing}
                    onClick={applyStatusChange}
                  >
                    {changing ? "Updating..." : "Confirm Change"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminModule>
  );
}
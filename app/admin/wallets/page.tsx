"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import "./wallets.css";

type WalletConfiguration = {
  id: string;
  asset_symbol: string;
  asset_name: string;
  network: string;
  deposit_address: string | null;
  deposit_tag: string | null;
  icon_url: string | null;
  description: string | null;
  is_active: boolean;
  deposits_enabled: boolean;
  withdrawals_enabled: boolean;
  swaps_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  minimum_withdrawal: number | string;
  maximum_withdrawal: number | string | null;
  withdrawal_fee: number | string;
  required_confirmations: number;
  display_order: number;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

type WalletForm = {
  asset_symbol: string;
  asset_name: string;
  network: string;
  deposit_address: string;
  deposit_tag: string;
  icon_url: string;
  description: string;
  is_active: boolean;
  deposits_enabled: boolean;
  withdrawals_enabled: boolean;
  swaps_enabled: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
  minimum_withdrawal: string;
  maximum_withdrawal: string;
  withdrawal_fee: string;
  required_confirmations: string;
  display_order: string;
  admin_notes: string;
};

const EMPTY_FORM: WalletForm = {
  asset_symbol: "",
  asset_name: "",
  network: "",
  deposit_address: "",
  deposit_tag: "",
  icon_url: "",
  description: "",
  is_active: true,
  deposits_enabled: true,
  withdrawals_enabled: true,
  swaps_enabled: true,
  maintenance_mode: false,
  maintenance_message: "",
  minimum_withdrawal: "0",
  maximum_withdrawal: "",
  withdrawal_fee: "0",
  required_confirmations: "1",
  display_order: "0",
  admin_notes: "",
};

const NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: "⌂" },
  { label: "Users", href: "/admin/users", icon: "◉" },
  { label: "Deposits", href: "/admin/deposits", icon: "↓" },
  { label: "Withdrawals", href: "/admin/withdrawals", icon: "↑" },
  { label: "Transactions", href: "/admin/transactions", icon: "↔" },
  { label: "Investments", href: "/admin/investments", icon: "◈" },
  { label: "Verifications", href: "/admin/verifications", icon: "✓" },
  { label: "Wallets", href: "/admin/wallets", icon: "◇" },
  { label: "Audit Log", href: "/admin/audit-log", icon: "≡" },
  { label: "Settings", href: "/admin/settings", icon: "⚙" },
];

function formatNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
  }

  return number.toLocaleString("en-US", {
    maximumFractionDigits: 12,
  });
}

function shortAddress(address: string | null) {
  if (!address) return "Not configured";

  if (address.length <= 24) {
    return address;
  }

  return `${address.slice(0, 12)}...${address.slice(-10)}`;
}

function formFromWallet(wallet: WalletConfiguration): WalletForm {
  return {
    asset_symbol: wallet.asset_symbol,
    asset_name: wallet.asset_name,
    network: wallet.network,
    deposit_address: wallet.deposit_address ?? "",
    deposit_tag: wallet.deposit_tag ?? "",
    icon_url: wallet.icon_url ?? "",
    description: wallet.description ?? "",
    is_active: wallet.is_active,
    deposits_enabled: wallet.deposits_enabled,
    withdrawals_enabled: wallet.withdrawals_enabled,
    swaps_enabled: wallet.swaps_enabled,
    maintenance_mode: wallet.maintenance_mode,
    maintenance_message: wallet.maintenance_message ?? "",
    minimum_withdrawal: String(wallet.minimum_withdrawal ?? "0"),
    maximum_withdrawal:
      wallet.maximum_withdrawal === null ||
      wallet.maximum_withdrawal === undefined
        ? ""
        : String(wallet.maximum_withdrawal),
    withdrawal_fee: String(wallet.withdrawal_fee ?? "0"),
    required_confirmations: String(wallet.required_confirmations ?? 1),
    display_order: String(wallet.display_order ?? 0),
    admin_notes: wallet.admin_notes ?? "",
  };
}

export default function AdminWalletsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [wallets, setWallets] = useState<WalletConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");

  const [selectedWallet, setSelectedWallet] =
    useState<WalletConfiguration | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [walletToDelete, setWalletToDelete] =
    useState<WalletConfiguration | null>(null);

  const [form, setForm] = useState<WalletForm>(EMPTY_FORM);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadWallets = async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("wallet_configurations")
      .select("*")
      .order("display_order", { ascending: true })
      .order("asset_symbol", { ascending: true })
      .order("network", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setWallets((data ?? []) as WalletConfiguration[]);
    setLoading(false);
  };

  useEffect(() => {
    loadWallets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const networks = useMemo(() => {
    const values = wallets
      .map((wallet) => wallet.network)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    return Array.from(new Set(values));
  }, [wallets]);

  const filteredWallets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return wallets.filter((wallet) => {
      const matchesSearch =
        !query ||
        wallet.asset_symbol.toLowerCase().includes(query) ||
        wallet.asset_name.toLowerCase().includes(query) ||
        wallet.network.toLowerCase().includes(query) ||
        (wallet.deposit_address ?? "").toLowerCase().includes(query);

      const matchesNetwork =
        networkFilter === "all" ||
        wallet.network.toLowerCase() === networkFilter.toLowerCase();

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && wallet.is_active) ||
        (statusFilter === "inactive" && !wallet.is_active) ||
        (statusFilter === "maintenance" && wallet.maintenance_mode);

      return matchesSearch && matchesNetwork && matchesStatus;
    });
  }, [wallets, search, networkFilter, statusFilter]);

  const activeCount = wallets.filter((wallet) => wallet.is_active).length;
  const depositCount = wallets.filter(
    (wallet) => wallet.is_active && wallet.deposits_enabled,
  ).length;
  const withdrawalCount = wallets.filter(
    (wallet) => wallet.is_active && wallet.withdrawals_enabled,
  ).length;
  const maintenanceCount = wallets.filter(
    (wallet) => wallet.maintenance_mode,
  ).length;

  const updateForm = <K extends keyof WalletForm>(
    field: K,
    value: WalletForm[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openCreateModal = () => {
    setModalMode("create");
    setSelectedWallet(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const openEditModal = (wallet: WalletConfiguration) => {
    setModalMode("edit");
    setSelectedWallet(wallet);
    setForm(formFromWallet(wallet));
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setSelectedWallet(null);
    setForm(EMPTY_FORM);
  };

  const validateForm = () => {
    if (!form.asset_symbol.trim()) {
      return "Asset symbol is required.";
    }

    if (!form.asset_name.trim()) {
      return "Asset name is required.";
    }

    if (!form.network.trim()) {
      return "Network is required.";
    }

    const minimum = Number(form.minimum_withdrawal || 0);
    const maximum =
      form.maximum_withdrawal.trim() === ""
        ? null
        : Number(form.maximum_withdrawal);

    const fee = Number(form.withdrawal_fee || 0);
    const confirmations = Number(form.required_confirmations || 0);
    const displayOrder = Number(form.display_order || 0);

    if (!Number.isFinite(minimum) || minimum < 0) {
      return "Minimum withdrawal must be a valid non-negative number.";
    }

    if (
      maximum !== null &&
      (!Number.isFinite(maximum) || maximum < minimum)
    ) {
      return "Maximum withdrawal must be greater than or equal to the minimum withdrawal.";
    }

    if (!Number.isFinite(fee) || fee < 0) {
      return "Withdrawal fee must be a valid non-negative number.";
    }

    if (!Number.isInteger(confirmations) || confirmations < 0) {
      return "Required confirmations must be a whole number of 0 or greater.";
    }

    if (!Number.isInteger(displayOrder)) {
      return "Display order must be a whole number.";
    }

    if (form.deposits_enabled && !form.deposit_address.trim()) {
      return "A deposit address is required when deposits are enabled.";
    }

    if (form.maintenance_mode && !form.maintenance_message.trim()) {
      return "Enter a maintenance message when maintenance mode is enabled.";
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    const commonPayload = {
      p_asset_symbol: form.asset_symbol.trim().toUpperCase(),
      p_asset_name: form.asset_name.trim(),
      p_network: form.network.trim(),
      p_deposit_address: form.deposit_address.trim() || null,
      p_deposit_tag: form.deposit_tag.trim() || null,
      p_icon_url: form.icon_url.trim() || null,
      p_description: form.description.trim() || null,
      p_is_active: form.is_active,
      p_deposits_enabled: form.deposits_enabled,
      p_withdrawals_enabled: form.withdrawals_enabled,
      p_swaps_enabled: form.swaps_enabled,
      p_maintenance_mode: form.maintenance_mode,
      p_maintenance_message: form.maintenance_message.trim() || null,
      p_minimum_withdrawal: Number(form.minimum_withdrawal || 0),
      p_maximum_withdrawal:
        form.maximum_withdrawal.trim() === ""
          ? null
          : Number(form.maximum_withdrawal),
      p_withdrawal_fee: Number(form.withdrawal_fee || 0),
      p_required_confirmations: Number(form.required_confirmations || 0),
      p_display_order: Number(form.display_order || 0),
      p_admin_notes: form.admin_notes.trim() || null,
    };

    if (modalMode === "create") {
      const { error: rpcError } = await supabase.rpc(
        "admin_create_wallet_configuration",
        commonPayload,
      );

      if (rpcError) {
        setError(rpcError.message);
        setSaving(false);
        return;
      }

      setSuccess("Wallet configuration created successfully.");
    } else {
      if (!selectedWallet) {
        setError("No wallet configuration was selected.");
        setSaving(false);
        return;
      }

      const { error: rpcError } = await supabase.rpc(
        "admin_update_wallet_configuration",
        {
          p_id: selectedWallet.id,
          ...commonPayload,
        },
      );

      if (rpcError) {
        setError(rpcError.message);
        setSaving(false);
        return;
      }

      setSuccess("Wallet configuration updated successfully.");
    }

    await loadWallets();

    setSaving(false);
    setModalOpen(false);
    setSelectedWallet(null);
    setForm(EMPTY_FORM);
  };

  const confirmDelete = (wallet: WalletConfiguration) => {
    setWalletToDelete(wallet);
    setDeleteModalOpen(true);
    setError("");
    setSuccess("");
  };

  const handleDelete = async () => {
    if (!walletToDelete) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "admin_delete_wallet_configuration",
      {
        p_id: walletToDelete.id,
      },
    );

    if (rpcError) {
      setError(rpcError.message);
      setDeleting(false);
      return;
    }

    setWallets((current) =>
      current.filter((wallet) => wallet.id !== walletToDelete.id),
    );

    setSuccess(
      `${walletToDelete.asset_symbol} / ${walletToDelete.network} configuration deleted.`,
    );

    setDeleting(false);
    setDeleteModalOpen(false);
    setWalletToDelete(null);
  };

  const toggleQuickActive = async (wallet: WalletConfiguration) => {
    setError("");
    setSuccess("");

    const { error: rpcError } = await supabase.rpc(
      "admin_update_wallet_configuration",
      {
        p_id: wallet.id,
        p_asset_symbol: wallet.asset_symbol,
        p_asset_name: wallet.asset_name,
        p_network: wallet.network,
        p_deposit_address: wallet.deposit_address,
        p_deposit_tag: wallet.deposit_tag,
        p_icon_url: wallet.icon_url,
        p_description: wallet.description,
        p_is_active: !wallet.is_active,
        p_deposits_enabled: wallet.deposits_enabled,
        p_withdrawals_enabled: wallet.withdrawals_enabled,
        p_swaps_enabled: wallet.swaps_enabled,
        p_maintenance_mode: wallet.maintenance_mode,
        p_maintenance_message: wallet.maintenance_message,
        p_minimum_withdrawal: Number(wallet.minimum_withdrawal || 0),
        p_maximum_withdrawal:
          wallet.maximum_withdrawal === null
            ? null
            : Number(wallet.maximum_withdrawal),
        p_withdrawal_fee: Number(wallet.withdrawal_fee || 0),
        p_required_confirmations: wallet.required_confirmations,
        p_display_order: wallet.display_order,
        p_admin_notes: wallet.admin_notes,
      },
    );

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setWallets((current) =>
      current.map((item) =>
        item.id === wallet.id
          ? { ...item, is_active: !wallet.is_active }
          : item,
      ),
    );

    setSuccess(
      `${wallet.asset_symbol} / ${wallet.network} is now ${
        !wallet.is_active ? "active" : "inactive"
      }.`,
    );
  };

  const handleRefresh = async () => {
    setSuccess("");
    await loadWallets();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="dashboard-shell admin-wallets-app">
      <div
        className={`dashboard-sidebar-overlay ${
          sidebarOpen ? "visible" : ""
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`dashboard-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="dashboard-sidebar-brand">
          <Link href="/admin" className="admin-wallets-brand">
            <span className="admin-wallets-brand-mark">
              <span />
              <span />
              <span />
            </span>

            <span className="admin-wallets-brand-text">
              <strong>CRYPTO</strong>
              <small>COM EXCHANGE</small>
            </span>
          </Link>
        </div>

        <div className="admin-wallets-sidebar-label">
          ADMIN CONSOLE
        </div>

        <nav className="dashboard-nav">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/admin/wallets";

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`dashboard-nav-link ${
                  active ? "active" : ""
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="dashboard-nav-icon">
                  {item.icon}
                </span>

                <span>{item.label}</span>

                {active && (
                  <span className="admin-wallets-nav-glow" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="admin-wallets-sidebar-footer">
          <button
            type="button"
            className="admin-wallets-signout"
            onClick={signOut}
          >
            <span>↪</span>
            Sign out
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header admin-wallets-header">
          <button
            type="button"
            className="dashboard-mobile-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open admin navigation"
          >
            <span />
            <span />
            <span />
          </button>

          <div className="admin-wallets-header-copy">
            <div className="admin-wallets-eyebrow">
              ADMIN / WALLET INFRASTRUCTURE
            </div>

            <h1>Wallet Configuration</h1>

            <p>
              Manage supported assets, networks, deposit destinations,
              withdrawals and swap availability.
            </p>
          </div>

          <div className="admin-wallets-header-actions">
            <button
              type="button"
              className="admin-wallets-refresh"
              onClick={handleRefresh}
              disabled={loading}
            >
              <span className={loading ? "spinning" : ""}>↻</span>
              Refresh
            </button>

            <button
              type="button"
              className="admin-wallets-primary"
              onClick={openCreateModal}
            >
              <span>＋</span>
              Add Wallet
            </button>
          </div>
        </header>

        <div className="dashboard-content admin-wallets-content">
          {error && (
            <div className="admin-wallets-alert error">
              <span className="admin-wallets-alert-icon">!</span>
              <div>
                <strong>Configuration error</strong>
                <p>{error}</p>
              </div>

              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {success && (
            <div className="admin-wallets-alert success">
              <span className="admin-wallets-alert-icon">✓</span>
              <div>
                <strong>Success</strong>
                <p>{success}</p>
              </div>

              <button
                type="button"
                onClick={() => setSuccess("")}
                aria-label="Dismiss success"
              >
                ×
              </button>
            </div>
          )}

          <section className="admin-wallets-stat-grid">
            <div className="admin-wallets-stat-card">
              <div className="admin-wallets-stat-icon">◇</div>
              <div>
                <span>Total Configurations</span>
                <strong>{wallets.length}</strong>
              </div>
              <small>Asset / network pairs</small>
            </div>

            <div className="admin-wallets-stat-card">
              <div className="admin-wallets-stat-icon blue">●</div>
              <div>
                <span>Active Assets</span>
                <strong>{activeCount}</strong>
              </div>
              <small>Visible to users</small>
            </div>

            <div className="admin-wallets-stat-card">
              <div className="admin-wallets-stat-icon green">↓</div>
              <div>
                <span>Deposit Enabled</span>
                <strong>{depositCount}</strong>
              </div>
              <small>Accepting deposits</small>
            </div>

            <div className="admin-wallets-stat-card">
              <div className="admin-wallets-stat-icon gold">⚠</div>
              <div>
                <span>Maintenance</span>
                <strong>{maintenanceCount}</strong>
              </div>
              <small>Currently restricted</small>
            </div>
          </section>

          <section className="admin-wallets-toolbar-card">
            <div className="admin-wallets-search-wrap">
              <span className="admin-wallets-search-icon">⌕</span>

              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search asset, network or wallet address..."
                className="admin-wallets-search"
              />

              {search && (
                <button
                  type="button"
                  className="admin-wallets-clear-search"
                  onClick={() => setSearch("")}
                >
                  ×
                </button>
              )}
            </div>

            <select
              className="admin-wallets-filter"
              value={networkFilter}
              onChange={(event) =>
                setNetworkFilter(event.target.value)
              }
            >
              <option value="all">All Networks</option>

              {networks.map((network) => (
                <option key={network} value={network}>
                  {network}
                </option>
              ))}
            </select>

            <select
              className="admin-wallets-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="maintenance">Maintenance</option>
            </select>

            <div className="admin-wallets-result-count">
              <strong>{filteredWallets.length}</strong>
              <span>
                of {wallets.length} configurations
              </span>
            </div>
          </section>

          <section className="admin-wallets-table-card">
            <div className="admin-wallets-table-heading">
              <div>
                <span className="admin-wallets-section-kicker">
                  CONFIGURED INFRASTRUCTURE
                </span>

                <h2>Supported Wallets</h2>

                <p>
                  Each configuration represents one asset and
                  blockchain network combination.
                </p>
              </div>

              <div className="admin-wallets-withdraw-count">
                <span>Withdrawals enabled</span>
                <strong>{withdrawalCount}</strong>
              </div>
            </div>

            <div className="admin-wallets-table-wrap">
              {loading ? (
                <div className="admin-wallets-loading">
                  <div className="admin-wallets-spinner" />
                  <span>Loading wallet configurations...</span>
                </div>
              ) : filteredWallets.length === 0 ? (
                <div className="admin-wallets-empty">
                  <div className="admin-wallets-empty-icon">
                    ◇
                  </div>

                  <h3>
                    {wallets.length === 0
                      ? "No wallets configured"
                      : "No matching configurations"}
                  </h3>

                  <p>
                    {wallets.length === 0
                      ? "Add your first supported asset and network to begin configuring the exchange."
                      : "Try changing the search or filter settings."}
                  </p>

                  {wallets.length === 0 && (
                    <button
                      type="button"
                      className="admin-wallets-primary"
                      onClick={openCreateModal}
                    >
                      ＋ Add First Wallet
                    </button>
                  )}
                </div>
              ) : (
                <table className="admin-wallets-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Network</th>
                      <th>Deposit Destination</th>
                      <th>Capabilities</th>
                      <th>Withdrawal Rules</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredWallets.map((wallet) => (
                      <tr key={wallet.id}>
                        <td>
                          <div className="admin-wallet-asset">
                            <div className="admin-wallet-asset-icon">
                              {wallet.icon_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={wallet.icon_url}
                                  alt=""
                                />
                              ) : (
                                wallet.asset_symbol
                                  .slice(0, 1)
                                  .toUpperCase()
                              )}
                            </div>

                            <div>
                              <strong>
                                {wallet.asset_symbol}
                              </strong>
                              <span>
                                {wallet.asset_name}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className="admin-wallet-network">
                            {wallet.network}
                          </span>
                        </td>

                        <td>
                          <div className="admin-wallet-address">
                            <strong
                              title={
                                wallet.deposit_address ??
                                undefined
                              }
                            >
                              {shortAddress(
                                wallet.deposit_address,
                              )}
                            </strong>

                            {wallet.deposit_tag && (
                              <span>
                                Tag / Memo:{" "}
                                {wallet.deposit_tag}
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="admin-wallet-capabilities">
                            <span
                              className={
                                wallet.deposits_enabled
                                  ? "enabled"
                                  : "disabled"
                              }
                            >
                              ↓ Deposit
                            </span>

                            <span
                              className={
                                wallet.withdrawals_enabled
                                  ? "enabled"
                                  : "disabled"
                              }
                            >
                              ↑ Withdraw
                            </span>

                            <span
                              className={
                                wallet.swaps_enabled
                                  ? "enabled"
                                  : "disabled"
                              }
                            >
                              ↔ Swap
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="admin-wallet-rules">
                            <span>
                              Min{" "}
                              {formatNumber(
                                wallet.minimum_withdrawal,
                              )}
                            </span>

                            <span>
                              Fee{" "}
                              {formatNumber(
                                wallet.withdrawal_fee,
                              )}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="admin-wallet-statuses">
                            <button
                              type="button"
                              className={`admin-wallet-status-pill ${
                                wallet.is_active
                                  ? "active"
                                  : "inactive"
                              }`}
                              onClick={() =>
                                toggleQuickActive(wallet)
                              }
                            >
                              <i />
                              {wallet.is_active
                                ? "Active"
                                : "Inactive"}
                            </button>

                            {wallet.maintenance_mode && (
                              <span className="admin-wallet-maintenance-pill">
                                Maintenance
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <div className="admin-wallet-actions">
                            <button
                              type="button"
                              className="admin-wallet-edit"
                              onClick={() =>
                                openEditModal(wallet)
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="admin-wallet-delete"
                              onClick={() =>
                                confirmDelete(wallet)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="admin-wallets-security-note">
            <div className="admin-wallets-security-icon">
              ⛨
            </div>

            <div>
              <strong>Wallet security boundary</strong>

              <p>
                Only public blockchain destination addresses
                belong in this configuration. Never store private
                keys, seed phrases, signing secrets or exchange API
                credentials here.
              </p>
            </div>
          </section>
        </div>
      </main>

      {modalOpen && (
        <div
          className="admin-wallet-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            className="admin-wallet-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-modal-title"
          >
            <div className="admin-wallet-modal-header">
              <div>
                <span className="admin-wallet-modal-kicker">
                  {modalMode === "create"
                    ? "NEW CONFIGURATION"
                    : "EDIT CONFIGURATION"}
                </span>

                <h2 id="wallet-modal-title">
                  {modalMode === "create"
                    ? "Add Wallet"
                    : "Edit Wallet"}
                </h2>

                <p>
                  Configure the asset, network and user-facing
                  wallet behaviour.
                </p>
              </div>

              <button
                type="button"
                className="admin-wallet-modal-close"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              className="admin-wallet-form"
              onSubmit={handleSubmit}
            >
              <div className="admin-wallet-form-section">
                <div className="admin-wallet-form-section-title">
                  <span>01</span>
                  <div>
                    <strong>Asset Identity</strong>
                    <small>
                      Identify the supported cryptocurrency.
                    </small>
                  </div>
                </div>

                <div className="admin-wallet-form-grid three">
                  <label>
                    <span>Asset Symbol *</span>
                    <input
                      value={form.asset_symbol}
                      onChange={(event) =>
                        updateForm(
                          "asset_symbol",
                          event.target.value.toUpperCase(),
                        )
                      }
                      placeholder="BTC"
                      maxLength={20}
                    />
                  </label>

                  <label>
                    <span>Asset Name *</span>
                    <input
                      value={form.asset_name}
                      onChange={(event) =>
                        updateForm(
                          "asset_name",
                          event.target.value,
                        )
                      }
                      placeholder="Bitcoin"
                    />
                  </label>

                  <label>
                    <span>Network *</span>
                    <input
                      value={form.network}
                      onChange={(event) =>
                        updateForm(
                          "network",
                          event.target.value,
                        )
                      }
                      placeholder="Bitcoin"
                    />
                  </label>
                </div>

                <div className="admin-wallet-form-grid two">
                  <label>
                    <span>Icon URL</span>
                    <input
                      value={form.icon_url}
                      onChange={(event) =>
                        updateForm(
                          "icon_url",
                          event.target.value,
                        )
                      }
                      placeholder="https://..."
                    />
                  </label>

                  <label>
                    <span>Display Order</span>
                    <input
                      type="number"
                      step="1"
                      value={form.display_order}
                      onChange={(event) =>
                        updateForm(
                          "display_order",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>

                <label>
                  <span>Description</span>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      updateForm(
                        "description",
                        event.target.value,
                      )
                    }
                    placeholder="Short description shown to users..."
                    rows={3}
                  />
                </label>
              </div>

              <div className="admin-wallet-form-section">
                <div className="admin-wallet-form-section-title">
                  <span>02</span>
                  <div>
                    <strong>Deposit Destination</strong>
                    <small>
                      Public address users will send deposits
                      to.
                    </small>
                  </div>
                </div>

                <label>
                  <span>Deposit Address</span>
                  <textarea
                    value={form.deposit_address}
                    onChange={(event) =>
                      updateForm(
                        "deposit_address",
                        event.target.value,
                      )
                    }
                    placeholder="Enter the public deposit wallet address..."
                    rows={3}
                  />
                </label>

                <div className="admin-wallet-form-grid two">
                  <label>
                    <span>Memo / Tag</span>
                    <input
                      value={form.deposit_tag}
                      onChange={(event) =>
                        updateForm(
                          "deposit_tag",
                          event.target.value,
                        )
                      }
                      placeholder="Optional"
                    />
                  </label>

                  <label>
                    <span>Required Confirmations</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.required_confirmations}
                      onChange={(event) =>
                        updateForm(
                          "required_confirmations",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="admin-wallet-form-section">
                <div className="admin-wallet-form-section-title">
                  <span>03</span>
                  <div>
                    <strong>Withdrawal Rules</strong>
                    <small>
                      Define the limits and fee displayed to the
                      withdrawal system.
                    </small>
                  </div>
                </div>

                <div className="admin-wallet-form-grid three">
                  <label>
                    <span>Minimum Withdrawal</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.minimum_withdrawal}
                      onChange={(event) =>
                        updateForm(
                          "minimum_withdrawal",
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label>
                    <span>Maximum Withdrawal</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.maximum_withdrawal}
                      onChange={(event) =>
                        updateForm(
                          "maximum_withdrawal",
                          event.target.value,
                        )
                      }
                      placeholder="No limit"
                    />
                  </label>

                  <label>
                    <span>Withdrawal Fee</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.withdrawal_fee}
                      onChange={(event) =>
                        updateForm(
                          "withdrawal_fee",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="admin-wallet-form-section">
                <div className="admin-wallet-form-section-title">
                  <span>04</span>
                  <div>
                    <strong>Capabilities</strong>
                    <small>
                      Control which exchange operations are
                      available.
                    </small>
                  </div>
                </div>

                <div className="admin-wallet-switch-grid">
                  <label className="admin-wallet-switch">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) =>
                        updateForm(
                          "is_active",
                          event.target.checked,
                        )
                      }
                    />

                    <span className="admin-wallet-switch-ui" />

                    <span>
                      <strong>Active</strong>
                      <small>
                        Make this configuration available.
                      </small>
                    </span>
                  </label>

                  <label className="admin-wallet-switch">
                    <input
                      type="checkbox"
                      checked={form.deposits_enabled}
                      onChange={(event) =>
                        updateForm(
                          "deposits_enabled",
                          event.target.checked,
                        )
                      }
                    />

                    <span className="admin-wallet-switch-ui" />

                    <span>
                      <strong>Deposits</strong>
                      <small>
                        Allow users to deposit this asset.
                      </small>
                    </span>
                  </label>

                  <label className="admin-wallet-switch">
                    <input
                      type="checkbox"
                      checked={form.withdrawals_enabled}
                      onChange={(event) =>
                        updateForm(
                          "withdrawals_enabled",
                          event.target.checked,
                        )
                      }
                    />

                    <span className="admin-wallet-switch-ui" />

                    <span>
                      <strong>Withdrawals</strong>
                      <small>
                        Allow users to withdraw this asset.
                      </small>
                    </span>
                  </label>

                  <label className="admin-wallet-switch">
                    <input
                      type="checkbox"
                      checked={form.swaps_enabled}
                      onChange={(event) =>
                        updateForm(
                          "swaps_enabled",
                          event.target.checked,
                        )
                      }
                    />

                    <span className="admin-wallet-switch-ui" />

                    <span>
                      <strong>Swaps</strong>
                      <small>
                        Allow this asset in the swap system.
                      </small>
                    </span>
                  </label>

                  <label className="admin-wallet-switch warning">
                    <input
                      type="checkbox"
                      checked={form.maintenance_mode}
                      onChange={(event) =>
                        updateForm(
                          "maintenance_mode",
                          event.target.checked,
                        )
                      }
                    />

                    <span className="admin-wallet-switch-ui" />

                    <span>
                      <strong>Maintenance Mode</strong>
                      <small>
                        Temporarily restrict normal use.
                      </small>
                    </span>
                  </label>
                </div>

                {form.maintenance_mode && (
                  <label className="admin-wallet-maintenance-field">
                    <span>Maintenance Message *</span>
                    <textarea
                      value={form.maintenance_message}
                      onChange={(event) =>
                        updateForm(
                          "maintenance_message",
                          event.target.value,
                        )
                      }
                      placeholder="Explain why this asset is temporarily unavailable..."
                      rows={3}
                    />
                  </label>
                )}
              </div>

              <div className="admin-wallet-form-section">
                <div className="admin-wallet-form-section-title">
                  <span>05</span>
                  <div>
                    <strong>Administration</strong>
                    <small>
                      Internal notes are not displayed to users.
                    </small>
                  </div>
                </div>

                <label>
                  <span>Admin Notes</span>
                  <textarea
                    value={form.admin_notes}
                    onChange={(event) =>
                      updateForm(
                        "admin_notes",
                        event.target.value,
                      )
                    }
                    placeholder="Internal notes about this wallet configuration..."
                    rows={3}
                  />
                </label>
              </div>

              {error && (
                <div className="admin-wallet-form-error">
                  <strong>Unable to save</strong>
                  <span>{error}</span>
                </div>
              )}

              <div className="admin-wallet-modal-footer">
                <button
                  type="button"
                  className="admin-wallet-secondary-button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-wallet-primary-button"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <span className="button-spinner" />
                      Saving...
                    </>
                  ) : modalMode === "create" ? (
                    "Create Configuration"
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModalOpen && walletToDelete && (
        <div
          className="admin-wallet-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleting) {
              setDeleteModalOpen(false);
              setWalletToDelete(null);
            }
          }}
        >
          <div
            className="admin-wallet-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-wallet-title"
          >
            <div className="admin-wallet-delete-icon">
              !
            </div>

            <span className="admin-wallet-modal-kicker">
              DELETE CONFIGURATION
            </span>

            <h2 id="delete-wallet-title">
              Remove {walletToDelete.asset_symbol}?
            </h2>

            <p>
              You are about to delete the{" "}
              <strong>{walletToDelete.network}</strong>{" "}
              configuration for{" "}
              <strong>{walletToDelete.asset_symbol}</strong>.
              This removes this configuration from the admin
              wallet registry.
            </p>

            <div className="admin-wallet-delete-summary">
              <span>Asset</span>
              <strong>
                {walletToDelete.asset_symbol} —{" "}
                {walletToDelete.asset_name}
              </strong>

              <span>Network</span>
              <strong>{walletToDelete.network}</strong>

              <span>Deposit address</span>
              <strong>
                {shortAddress(walletToDelete.deposit_address)}
              </strong>
            </div>

            <div className="admin-wallet-delete-actions">
              <button
                type="button"
                className="admin-wallet-secondary-button"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setWalletToDelete(null);
                }}
                disabled={deleting}
              >
                Cancel
              </button>

              <button
                type="button"
                className="admin-wallet-danger-button"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <span className="button-spinner" />
                    Deleting...
                  </>
                ) : (
                  "Delete Configuration"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
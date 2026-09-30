"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminModule from "../AdminModule";
import { createClient } from "../../../lib/supabase/client";

type Setting = {
  id: string;
  setting_key: string;
  category: string;
  setting_type:
    | "text"
    | "textarea"
    | "boolean"
    | "integer"
    | "decimal"
    | "select";
  label: string;
  description: string | null;
  value: unknown;
  default_value: unknown;
  options: unknown;
  sensitive: boolean;
  requires_confirmation: boolean;
  enabled: boolean;
  display_order: number;
  created_at?: string;
  updated_at?: string;
};

type AuditRecord = {
  id: string;
  setting_id: string | null;
  setting_key: string;
  admin_id: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
  admin_email: string | null;
};

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
  minimum_withdrawal: number;
  maximum_withdrawal: number | null;
  withdrawal_fee: number;
  required_confirmations: number;
  display_order: number;
  admin_notes: string | null;
};

type TabKey =
  | "general"
  | "operation"
  | "accounts"
  | "security"
  | "verification"
  | "deposits"
  | "withdrawals"
  | "swaps"
  | "investments"
  | "fees"
  | "notifications"
  | "email"
  | "assets"
  | "system"
  | "audit";

const supabase = createClient();

const CATEGORY_META: Record<
  TabKey,
  {
    label: string;
    eyebrow: string;
    description: string;
    icon: string;
  }
> = {
  general: {
    label: "General",
    eyebrow: "PLATFORM IDENTITY",
    description:
      "Core branding, contact information, regional defaults and public platform identity.",
    icon: "◈",
  },
  operation: {
    label: "Operation",
    eyebrow: "PLATFORM CONTROL",
    description:
      "Control maintenance, read-only mode, registration and login availability.",
    icon: "◉",
  },
  accounts: {
    label: "Accounts",
    eyebrow: "ACCOUNT POLICY",
    description:
      "Registration requirements, verification, password policy and session controls.",
    icon: "◎",
  },
  security: {
    label: "Security",
    eyebrow: "SECURITY CONTROL",
    description:
      "Authentication, withdrawal protection, alerts and device-security settings.",
    icon: "◆",
  },
  verification: {
    label: "Verification",
    eyebrow: "COMPLIANCE CONTROL",
    description:
      "Configure when account verification is required throughout the platform.",
    icon: "✓",
  },
  deposits: {
    label: "Deposits",
    eyebrow: "FUNDING CONTROL",
    description:
      "Configure deposit availability, transaction-hash requirements and review policy.",
    icon: "↓",
  },
  withdrawals: {
    label: "Withdrawals",
    eyebrow: "PAYOUT CONTROL",
    description:
      "Configure withdrawal availability, review, cooldowns and limits.",
    icon: "↑",
  },
  swaps: {
    label: "Swaps",
    eyebrow: "EXCHANGE CONTROL",
    description:
      "Configure swap limits, fees and quote validity.",
    icon: "⇄",
  },
  investments: {
    label: "Investments",
    eyebrow: "INVESTMENT CONTROL",
    description:
      "Configure investment availability, approvals and reinvestment behavior.",
    icon: "◇",
  },
  fees: {
    label: "Fees",
    eyebrow: "REVENUE CONTROL",
    description:
      "Configure platform-level transaction and service fees.",
    icon: "%",
  },
  notifications: {
    label: "Notifications",
    eyebrow: "COMMUNICATION CONTROL",
    description:
      "Configure email communication and event notifications.",
    icon: "✦",
  },
  email: {
    label: "Email",
    eyebrow: "EMAIL CONFIGURATION",
    description:
      "Configure sender identity and reply routing.",
    icon: "@",
  },
  assets: {
    label: "Assets & Wallets",
    eyebrow: "ASSET INFRASTRUCTURE",
    description:
      "Manage the existing wallet configuration system for supported assets and networks.",
    icon: "₿",
  },
  system: {
    label: "System",
    eyebrow: "SYSTEM CONTROL",
    description:
      "Configure auditing, background processing and system error notifications.",
    icon: "⌘",
  },
  audit: {
    label: "Audit",
    eyebrow: "ADMIN HISTORY",
    description:
      "Review changes made to platform configuration by administrators.",
    icon: "≡",
  },
};

const CATEGORY_ORDER: TabKey[] = [
  "general",
  "operation",
  "accounts",
  "security",
  "verification",
  "deposits",
  "withdrawals",
  "swaps",
  "investments",
  "fees",
  "notifications",
  "email",
  "assets",
  "system",
  "audit",
];

function normalizeValue(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "value" in value
  ) {
    return (value as { value: unknown }).value;
  }

  return value;
}

function displayValue(value: unknown): string {
  const normalized = normalizeValue(value);

  if (normalized === null || normalized === undefined) {
    return "";
  }

  if (typeof normalized === "boolean") {
    return normalized ? "Enabled" : "Disabled";
  }

  if (typeof normalized === "object") {
    return JSON.stringify(normalized);
  }

  return String(normalized);
}

function parseBoolean(value: unknown): boolean {
  const normalized = normalizeValue(value);

  if (typeof normalized === "boolean") {
    return normalized;
  }

  if (typeof normalized === "string") {
    return normalized.toLowerCase() === "true";
  }

  return Boolean(normalized);
}

function parseNumber(value: unknown): number {
  const normalized = normalizeValue(value);

  if (typeof normalized === "number") {
    return normalized;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOptions(value: unknown): Array<{ value: string; label: string }> {
  const normalized = normalizeValue(value);

  if (!Array.isArray(normalized)) {
    return [];
  }

  return normalized
    .map((option) => {
      if (typeof option === "string") {
        return {
          value: option,
          label: option,
        };
      }

      if (
        option &&
        typeof option === "object" &&
        "value" in option
      ) {
        const item = option as {
          value: unknown;
          label?: unknown;
        };

        return {
          value: String(item.value),
          label:
            item.label !== undefined
              ? String(item.label)
              : String(item.value),
        };
      }

      return null;
    })
    .filter(
      (option): option is { value: string; label: string } =>
        option !== null
    );
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatJson(value: unknown): string {
  const normalized = normalizeValue(value);

  if (normalized === null || normalized === undefined) {
    return "—";
  }

  if (typeof normalized === "string") {
    return normalized;
  }

  return JSON.stringify(normalized, null, 2);
}

function settingMatchesCategory(
  setting: Setting,
  category: TabKey
): boolean {
  return setting.category.toLowerCase() === category.toLowerCase();
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("general");

  const [settings, setSettings] = useState<Setting[]>([]);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [wallets, setWallets] = useState<WalletConfiguration[]>([]);

  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [loadingWallets, setLoadingWallets] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [draftValues, setDraftValues] = useState<
    Record<string, unknown>
  >({});

  const [confirmDialog, setConfirmDialog] = useState<{
    setting: Setting;
    value: unknown;
  } | null>(null);

  const [walletDialog, setWalletDialog] = useState<
    WalletConfiguration | null | "new"
  >(null);

  const [walletSaving, setWalletSaving] = useState(false);

  const [walletDraft, setWalletDraft] = useState({
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
    minimum_withdrawal: 0,
    maximum_withdrawal: "",
    withdrawal_fee: 0,
    required_confirmations: 1,
    display_order: 0,
    admin_notes: "",
  });

  const [walletDeleteDialog, setWalletDeleteDialog] =
    useState<WalletConfiguration | null>(null);

  const showMessage = useCallback(
    (type: "success" | "error", text: string) => {
      setMessage({ type, text });

      window.setTimeout(() => {
        setMessage(null);
      }, 4500);
    },
    []
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase.rpc(
      "admin_get_platform_settings"
    );

    if (error) {
      console.error(error);
      showMessage(
        "error",
        error.message || "Unable to load platform settings."
      );
      setLoading(false);
      return;
    }

    const loadedSettings = Array.isArray(data)
      ? (data as Setting[])
      : [];

    setSettings(loadedSettings);

    const drafts: Record<string, unknown> = {};

    loadedSettings.forEach((setting) => {
      drafts[setting.setting_key] = normalizeValue(setting.value);
    });

    setDraftValues(drafts);
    setLoading(false);
  }, [showMessage]);

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);

    const { data, error } = await supabase.rpc(
      "admin_get_platform_setting_audit",
      {
        p_limit: 100,
        p_offset: 0,
      }
    );

    if (error) {
      console.error(error);
      showMessage(
        "error",
        error.message || "Unable to load settings audit history."
      );
      setLoadingAudit(false);
      return;
    }

    setAuditRecords(
      Array.isArray(data) ? (data as AuditRecord[]) : []
    );

    setLoadingAudit(false);
  }, [showMessage]);

  const loadWallets = useCallback(async () => {
    setLoadingWallets(true);

    const { data, error } = await supabase
      .from("wallet_configurations")
      .select(
        `
        id,
        asset_symbol,
        asset_name,
        network,
        deposit_address,
        deposit_tag,
        icon_url,
        description,
        is_active,
        deposits_enabled,
        withdrawals_enabled,
        swaps_enabled,
        maintenance_mode,
        maintenance_message,
        minimum_withdrawal,
        maximum_withdrawal,
        withdrawal_fee,
        required_confirmations,
        display_order,
        admin_notes
      `
      )
      .order("display_order", { ascending: true })
      .order("asset_symbol", { ascending: true });

    if (error) {
      console.error(error);
      showMessage(
        "error",
        error.message || "Unable to load wallet configurations."
      );
      setLoadingWallets(false);
      return;
    }

    setWallets(
      Array.isArray(data)
        ? (data as WalletConfiguration[])
        : []
    );

    setLoadingWallets(false);
  }, [showMessage]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (activeTab === "audit") {
      void loadAudit();
    }

    if (activeTab === "assets") {
      void loadWallets();
    }
  }, [activeTab, loadAudit, loadWallets]);

  const categorySettings = useMemo(() => {
    return settings
      .filter((setting) =>
        settingMatchesCategory(setting, activeTab)
      )
      .sort((a, b) => a.display_order - b.display_order);
  }, [settings, activeTab]);

  const stats = useMemo(() => {
    const enabled = settings.filter((setting) => setting.enabled).length;

    const booleans = settings.filter(
      (setting) => setting.setting_type === "boolean"
    );

    const activeControls = booleans.filter((setting) =>
      parseBoolean(draftValues[setting.setting_key])
    ).length;

    const sensitive = settings.filter(
      (setting) => setting.sensitive
    ).length;

    return {
      total: settings.length,
      enabled,
      activeControls,
      sensitive,
    };
  }, [settings, draftValues]);

  function updateDraft(setting: Setting, value: unknown) {
    setDraftValues((current) => ({
      ...current,
      [setting.setting_key]: value,
    }));
  }

  function requestSave(setting: Setting) {
    const value = draftValues[setting.setting_key];

    if (setting.requires_confirmation) {
      setConfirmDialog({
        setting,
        value,
      });
      return;
    }

    void saveSetting(setting, value);
  }

  async function saveSetting(setting: Setting, value: unknown) {
    setSavingKey(setting.setting_key);
    setMessage(null);

    const { data, error } = await supabase.rpc(
      "admin_update_platform_setting",
      {
        p_setting_key: setting.setting_key,
        p_value: value,
      }
    );

    if (error) {
      console.error(error);

      showMessage(
        "error",
        error.message ||
          `Unable to save ${setting.label}.`
      );

      setSavingKey(null);
      return;
    }

    const returnedValue =
      data &&
      typeof data === "object" &&
      "value" in data
        ? (data as { value: unknown }).value
        : value;

    setDraftValues((current) => ({
      ...current,
      [setting.setting_key]: normalizeValue(returnedValue),
    }));

    setSettings((current) =>
      current.map((item) =>
        item.setting_key === setting.setting_key
          ? {
              ...item,
              value: returnedValue,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );

    showMessage(
      "success",
      `${setting.label} has been saved successfully.`
    );

    setSavingKey(null);

    if (activeTab === "audit") {
      void loadAudit();
    }
  }

  async function resetSetting(setting: Setting) {
    if (
      !window.confirm(
        `Reset "${setting.label}" to its default value?`
      )
    ) {
      return;
    }

    setSavingKey(setting.setting_key);

    const { data, error } = await supabase.rpc(
      "admin_reset_platform_setting",
      {
        p_setting_key: setting.setting_key,
      }
    );

    if (error) {
      console.error(error);

      showMessage(
        "error",
        error.message ||
          `Unable to reset ${setting.label}.`
      );

      setSavingKey(null);
      return;
    }

    const returnedValue =
      data &&
      typeof data === "object" &&
      "value" in data
        ? (data as { value: unknown }).value
        : setting.default_value;

    setDraftValues((current) => ({
      ...current,
      [setting.setting_key]: normalizeValue(returnedValue),
    }));

    setSettings((current) =>
      current.map((item) =>
        item.setting_key === setting.setting_key
          ? {
              ...item,
              value: returnedValue,
              updated_at: new Date().toISOString(),
            }
          : item
      )
    );

    showMessage(
      "success",
      `${setting.label} has been restored to its default value.`
    );

    setSavingKey(null);
  }

  function openNewWallet() {
    setWalletDraft({
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
      minimum_withdrawal: 0,
      maximum_withdrawal: "",
      withdrawal_fee: 0,
      required_confirmations: 1,
      display_order: wallets.length,
      admin_notes: "",
    });

    setWalletDialog("new");
  }

  function openEditWallet(wallet: WalletConfiguration) {
    setWalletDraft({
      asset_symbol: wallet.asset_symbol,
      asset_name: wallet.asset_name,
      network: wallet.network,
      deposit_address: wallet.deposit_address || "",
      deposit_tag: wallet.deposit_tag || "",
      icon_url: wallet.icon_url || "",
      description: wallet.description || "",
      is_active: wallet.is_active,
      deposits_enabled: wallet.deposits_enabled,
      withdrawals_enabled: wallet.withdrawals_enabled,
      swaps_enabled: wallet.swaps_enabled,
      maintenance_mode: wallet.maintenance_mode,
      maintenance_message: wallet.maintenance_message || "",
      minimum_withdrawal: wallet.minimum_withdrawal ?? 0,
      maximum_withdrawal:
        wallet.maximum_withdrawal !== null
          ? String(wallet.maximum_withdrawal)
          : "",
      withdrawal_fee: wallet.withdrawal_fee ?? 0,
      required_confirmations:
        wallet.required_confirmations ?? 1,
      display_order: wallet.display_order ?? 0,
      admin_notes: wallet.admin_notes || "",
    });

    setWalletDialog(wallet);
  }

  async function saveWallet() {
    if (
      !walletDraft.asset_symbol.trim() ||
      !walletDraft.asset_name.trim() ||
      !walletDraft.network.trim()
    ) {
      showMessage(
        "error",
        "Asset symbol, asset name and network are required."
      );
      return;
    }

    setWalletSaving(true);

    const commonPayload = {
      p_asset_symbol:
        walletDraft.asset_symbol.trim().toUpperCase(),
      p_asset_name: walletDraft.asset_name.trim(),
      p_network: walletDraft.network.trim(),
      p_deposit_address:
        walletDraft.deposit_address.trim() || null,
      p_deposit_tag:
        walletDraft.deposit_tag.trim() || null,
      p_icon_url:
        walletDraft.icon_url.trim() || null,
      p_description:
        walletDraft.description.trim() || null,
      p_is_active: walletDraft.is_active,
      p_deposits_enabled: walletDraft.deposits_enabled,
      p_withdrawals_enabled:
        walletDraft.withdrawals_enabled,
      p_swaps_enabled: walletDraft.swaps_enabled,
      p_maintenance_mode: walletDraft.maintenance_mode,
      p_maintenance_message:
        walletDraft.maintenance_message.trim() || null,
      p_minimum_withdrawal:
        Number(walletDraft.minimum_withdrawal) || 0,
      p_maximum_withdrawal:
        walletDraft.maximum_withdrawal === ""
          ? null
          : Number(walletDraft.maximum_withdrawal),
      p_withdrawal_fee:
        Number(walletDraft.withdrawal_fee) || 0,
      p_required_confirmations:
        Number(walletDraft.required_confirmations) || 1,
      p_display_order:
        Number(walletDraft.display_order) || 0,
      p_admin_notes:
        walletDraft.admin_notes.trim() || null,
    };

    let error = null;

    if (walletDialog === "new") {
      const result = await supabase.rpc(
        "admin_create_wallet_configuration",
        commonPayload
      );

      error = result.error;
    } else if (walletDialog) {
      const result = await supabase.rpc(
        "admin_update_wallet_configuration",
        {
          p_id: walletDialog.id,
          ...commonPayload,
        }
      );

      error = result.error;
    }

    if (error) {
      console.error(error);

      showMessage(
        "error",
        error.message || "Unable to save wallet configuration."
      );

      setWalletSaving(false);
      return;
    }

    showMessage(
      "success",
      walletDialog === "new"
        ? "Wallet configuration created successfully."
        : "Wallet configuration updated successfully."
    );

    setWalletDialog(null);
    setWalletSaving(false);

    await loadWallets();
  }

  async function deleteWallet() {
    if (!walletDeleteDialog) {
      return;
    }

    setWalletSaving(true);

    const { error } = await supabase.rpc(
      "admin_delete_wallet_configuration",
      {
        p_id: walletDeleteDialog.id,
      }
    );

    if (error) {
      console.error(error);

      showMessage(
        "error",
        error.message ||
          "Unable to delete wallet configuration."
      );

      setWalletSaving(false);
      return;
    }

    showMessage(
      "success",
      `${walletDeleteDialog.asset_symbol} wallet configuration deleted.`
    );

    setWalletDeleteDialog(null);
    setWalletSaving(false);

    await loadWallets();
  }

  function renderSettingInput(setting: Setting) {
    const value = draftValues[setting.setting_key];

    if (setting.setting_type === "boolean") {
      const enabled = parseBoolean(value);

      return (
        <button
          type="button"
          className={`settings-toggle ${
            enabled ? "is-on" : ""
          }`}
          onClick={() =>
            updateDraft(setting, !enabled)
          }
          aria-pressed={enabled}
        >
          <span className="toggle-track">
            <span className="toggle-thumb" />
          </span>

          <span className="toggle-label">
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </button>
      );
    }

    if (setting.setting_type === "textarea") {
      return (
        <textarea
          className="settings-input settings-textarea"
          value={displayValue(value)}
          onChange={(event) =>
            updateDraft(setting, event.target.value)
          }
          rows={4}
        />
      );
    }

    if (setting.setting_type === "select") {
      const options = parseOptions(setting.options);

      return (
        <select
          className="settings-input"
          value={displayValue(value)}
          onChange={(event) =>
            updateDraft(setting, event.target.value)
          }
        >
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (
      setting.setting_type === "integer" ||
      setting.setting_type === "decimal"
    ) {
      return (
        <input
          className="settings-input"
          type="number"
          step={
            setting.setting_type === "decimal"
              ? "0.00000001"
              : "1"
          }
          value={parseNumber(value)}
          onChange={(event) => {
            const nextValue =
              setting.setting_type === "integer"
                ? parseInt(event.target.value, 10)
                : parseFloat(event.target.value);

            updateDraft(
              setting,
              Number.isFinite(nextValue)
                ? nextValue
                : 0
            );
          }}
        />
      );
    }

    return (
      <input
        className="settings-input"
        type={setting.sensitive ? "password" : "text"}
        value={displayValue(value)}
        onChange={(event) =>
          updateDraft(setting, event.target.value)
        }
      />
    );
  }

  function renderSettingsPanel() {
    if (loading) {
      return (
        <div className="settings-loading">
          <div className="settings-loader" />
          <span>Loading platform configuration...</span>
        </div>
      );
    }

    if (categorySettings.length === 0) {
      return (
        <div className="settings-empty">
          <div className="settings-empty-icon">
            {CATEGORY_META[activeTab].icon}
          </div>

          <h3>No configuration records</h3>

          <p>
            There are currently no settings assigned to this
            section.
          </p>
        </div>
      );
    }

    return (
      <div className="settings-grid">
        {categorySettings.map((setting) => {
          const isSaving =
            savingKey === setting.setting_key;

          return (
            <div
              className={`setting-card ${
                setting.sensitive
                  ? "setting-sensitive"
                  : ""
              }`}
              key={setting.setting_key}
            >
              <div className="setting-card-top">
                <div>
                  <div className="setting-key">
                    {setting.setting_key}
                  </div>

                  <h3>{setting.label}</h3>
                </div>

                <div className="setting-badges">
                  {setting.sensitive && (
                    <span className="setting-badge sensitive">
                      SENSITIVE
                    </span>
                  )}

                  {setting.requires_confirmation && (
                    <span className="setting-badge warning">
                      CONFIRM
                    </span>
                  )}
                </div>
              </div>

              {setting.description && (
                <p className="setting-description">
                  {setting.description}
                </p>
              )}

              <div className="setting-control">
                {renderSettingInput(setting)}
              </div>

              <div className="setting-card-footer">
                <span className="setting-default">
                  Default:{" "}
                  <strong>
                    {displayValue(
                      setting.default_value
                    ) || "—"}
                  </strong>
                </span>

                <div className="setting-actions">
                  <button
                    type="button"
                    className="setting-reset"
                    disabled={isSaving}
                    onClick={() =>
                      void resetSetting(setting)
                    }
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    className="setting-save"
                    disabled={isSaving}
                    onClick={() =>
                      requestSave(setting)
                    }
                  >
                    {isSaving
                      ? "Saving..."
                      : "Save"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderAssetsPanel() {
    return (
      <div className="assets-panel">
        <div className="assets-toolbar">
          <div>
            <div className="assets-eyebrow">
              WALLET CONFIGURATION ENGINE
            </div>

            <h2>Supported Assets & Networks</h2>

            <p>
              Configure deposit wallets, withdrawal rules,
              swap availability and maintenance state for
              each supported asset.
            </p>
          </div>

          <button
            type="button"
            className="primary-admin-button"
            onClick={openNewWallet}
          >
            <span>+</span>
            Add Asset
          </button>
        </div>

        {loadingWallets ? (
          <div className="settings-loading">
            <div className="settings-loader" />
            <span>
              Loading wallet configurations...
            </span>
          </div>
        ) : wallets.length === 0 ? (
          <div className="settings-empty">
            <div className="settings-empty-icon">
              ₿
            </div>

            <h3>No wallet configurations</h3>

            <p>
              Create the first supported asset and network
              configuration.
            </p>
          </div>
        ) : (
          <div className="wallet-table-wrap">
            <table className="wallet-table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Network</th>
                  <th>Status</th>
                  <th>Funding</th>
                  <th>Withdrawals</th>
                  <th>Swaps</th>
                  <th>Limits</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {wallets.map((wallet) => (
                  <tr key={wallet.id}>
                    <td>
                      <div className="wallet-asset">
                        {wallet.icon_url ? (
                          <img
                            src={wallet.icon_url}
                            alt=""
                          />
                        ) : (
                          <span className="wallet-icon">
                            {wallet.asset_symbol
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>
                        )}

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
                      <span className="network-chip">
                        {wallet.network}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`status-chip ${
                          wallet.is_active
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {wallet.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>

                      {wallet.maintenance_mode && (
                        <span className="maintenance-chip">
                          Maintenance
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className={
                          wallet.deposits_enabled
                            ? "enabled-text"
                            : "disabled-text"
                        }
                      >
                        {wallet.deposits_enabled
                          ? "Enabled"
                          : "Disabled"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          wallet.withdrawals_enabled
                            ? "enabled-text"
                            : "disabled-text"
                        }
                      >
                        {wallet.withdrawals_enabled
                          ? "Enabled"
                          : "Disabled"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={
                          wallet.swaps_enabled
                            ? "enabled-text"
                            : "disabled-text"
                        }
                      >
                        {wallet.swaps_enabled
                          ? "Enabled"
                          : "Disabled"}
                      </span>
                    </td>

                    <td>
                      <div className="limit-cell">
                        <span>
                          Min{" "}
                          {wallet.minimum_withdrawal}
                        </span>

                        <span>
                          Max{" "}
                          {wallet.maximum_withdrawal ??
                            "Unlimited"}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          onClick={() =>
                            openEditWallet(wallet)
                          }
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="danger-action"
                          onClick={() =>
                            setWalletDeleteDialog(
                              wallet
                            )
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
          </div>
        )}
      </div>
    );
  }

  function renderAuditPanel() {
    return (
      <div className="audit-panel">
        <div className="audit-header">
          <div>
            <div className="assets-eyebrow">
              CONFIGURATION HISTORY
            </div>

            <h2>Platform Settings Audit</h2>

            <p>
              Every setting change made through the platform
              settings engine is recorded here.
            </p>
          </div>

          <button
            type="button"
            className="secondary-admin-button"
            onClick={() => void loadAudit()}
            disabled={loadingAudit}
          >
            {loadingAudit ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {loadingAudit ? (
          <div className="settings-loading">
            <div className="settings-loader" />
            <span>Loading audit history...</span>
          </div>
        ) : auditRecords.length === 0 ? (
          <div className="settings-empty">
            <div className="settings-empty-icon">
              ≡
            </div>

            <h3>No audit records</h3>

            <p>
              No platform configuration changes have been
              recorded yet.
            </p>
          </div>
        ) : (
          <div className="audit-list">
            {auditRecords.map((record) => (
              <div
                className="audit-record"
                key={record.id}
              >
                <div className="audit-record-main">
                  <div className="audit-icon">↻</div>

                  <div>
                    <div className="audit-key">
                      {record.setting_key}
                    </div>

                    <div className="audit-admin">
                      {record.admin_email ||
                        "Administrator"}{" "}
                      <span>•</span>{" "}
                      {formatDate(record.created_at)}
                    </div>
                  </div>
                </div>

                <div className="audit-values">
                  <div>
                    <span>Previous</span>

                    <pre>
                      {formatJson(record.old_value)}
                    </pre>
                  </div>

                  <div className="audit-arrow">
                    →
                  </div>

                  <div>
                    <span>New</span>

                    <pre>
                      {formatJson(record.new_value)}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <AdminModule
      eyebrow="PLATFORM CONTROL"
      title="Settings"
      description="Configure the operational, security, financial and system behavior of CRYPTO COM EXCHANGE."
      icon="⚙"
    >
      <div className="settings-shell">
        <style jsx global>{`
          .settings-shell {
            position: relative;
            min-height: 700px;
            color: #eef7ff;
          }

          .settings-shell::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(
                rgba(0, 153, 255, 0.025) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(0, 153, 255, 0.025) 1px,
                transparent 1px
              );
            background-size: 42px 42px;
            mask-image: linear-gradient(
              to bottom,
              black,
              transparent 85%
            );
          }

          .settings-overview {
            position: relative;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
            margin-bottom: 18px;
          }

          .overview-card {
            position: relative;
            overflow: hidden;
            padding: 18px;
            border: 1px solid rgba(0, 153, 255, 0.16);
            border-radius: 14px;
            background:
              linear-gradient(
                145deg,
                rgba(5, 18, 31, 0.95),
                rgba(2, 8, 16, 0.92)
              );
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.035),
              0 18px 50px rgba(0, 0, 0, 0.25);
          }

          .overview-card::after {
            content: "";
            position: absolute;
            width: 120px;
            height: 120px;
            right: -70px;
            top: -70px;
            border-radius: 50%;
            background: rgba(0, 153, 255, 0.12);
            filter: blur(20px);
          }

          .overview-label {
            color: #6d8da6;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.14em;
            text-transform: uppercase;
          }

          .overview-value {
            margin-top: 8px;
            color: #f5fbff;
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.04em;
          }

          .overview-sub {
            margin-top: 3px;
            color: #557188;
            font-size: 11px;
          }

          .settings-layout {
            position: relative;
            display: grid;
            grid-template-columns: 235px minmax(0, 1fr);
            gap: 16px;
            align-items: start;
          }

          .settings-sidebar {
            position: sticky;
            top: 18px;
            overflow: hidden;
            border: 1px solid rgba(0, 153, 255, 0.14);
            border-radius: 16px;
            background:
              linear-gradient(
                160deg,
                rgba(5, 17, 29, 0.96),
                rgba(2, 7, 14, 0.96)
              );
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.03),
              0 20px 60px rgba(0, 0, 0, 0.3);
          }

          .sidebar-top {
            padding: 18px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }

          .sidebar-status {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #72e6a4;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.12em;
          }

          .sidebar-status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #72e6a4;
            box-shadow: 0 0 12px rgba(114, 230, 164, 0.8);
          }

          .sidebar-title {
            margin-top: 9px;
            color: #dcecff;
            font-size: 13px;
            font-weight: 800;
          }

          .sidebar-subtitle {
            margin-top: 4px;
            color: #547087;
            font-size: 10px;
            line-height: 1.5;
          }

          .settings-nav {
            padding: 9px;
          }

          .settings-nav-button {
            position: relative;
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 9px 10px;
            margin-bottom: 2px;
            border: 1px solid transparent;
            border-radius: 9px;
            background: transparent;
            color: #6d8ba0;
            cursor: pointer;
            font-size: 11px;
            font-weight: 700;
            text-align: left;
            transition:
              color 160ms ease,
              background 160ms ease,
              border-color 160ms ease,
              transform 160ms ease;
          }

          .settings-nav-button:hover {
            color: #d9f1ff;
            background: rgba(0, 153, 255, 0.055);
            border-color: rgba(0, 153, 255, 0.08);
            transform: translateX(2px);
          }

          .settings-nav-button.active {
            color: #e8f7ff;
            background:
              linear-gradient(
                90deg,
                rgba(0, 153, 255, 0.13),
                rgba(0, 153, 255, 0.025)
              );
            border-color: rgba(0, 153, 255, 0.18);
            box-shadow:
              inset 3px 0 0 #0099ff,
              0 0 24px rgba(0, 153, 255, 0.05);
          }

          .settings-nav-icon {
            display: grid;
            place-items: center;
            width: 24px;
            height: 24px;
            border: 1px solid rgba(0, 153, 255, 0.12);
            border-radius: 7px;
            color: #6faed4;
            font-size: 11px;
            background: rgba(0, 153, 255, 0.025);
          }

          .settings-nav-button.active .settings-nav-icon {
            color: #70cfff;
            border-color: rgba(0, 153, 255, 0.28);
            background: rgba(0, 153, 255, 0.08);
          }

          .settings-content {
            min-width: 0;
          }

          .settings-content-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 18px;
            margin-bottom: 16px;
            padding: 21px;
            border: 1px solid rgba(0, 153, 255, 0.14);
            border-radius: 16px;
            background:
              radial-gradient(
                circle at 100% 0%,
                rgba(0, 153, 255, 0.1),
                transparent 35%
              ),
              linear-gradient(
                145deg,
                rgba(5, 18, 31, 0.96),
                rgba(2, 7, 14, 0.95)
              );
          }

          .content-eyebrow,
          .assets-eyebrow {
            color: #5ca9d7;
            font-size: 9px;
            font-weight: 900;
            letter-spacing: 0.16em;
          }

          .settings-content-header h2,
          .assets-toolbar h2,
          .audit-header h2 {
            margin: 6px 0 0;
            color: #f2faff;
            font-size: 20px;
            letter-spacing: -0.025em;
          }

          .settings-content-header p,
          .assets-toolbar p,
          .audit-header p {
            max-width: 720px;
            margin: 7px 0 0;
            color: #617c91;
            font-size: 11px;
            line-height: 1.6;
          }

          .section-icon {
            display: grid;
            flex: 0 0 auto;
            place-items: center;
            width: 48px;
            height: 48px;
            border: 1px solid rgba(0, 153, 255, 0.22);
            border-radius: 12px;
            color: #68caff;
            font-size: 20px;
            background:
              linear-gradient(
                145deg,
                rgba(0, 153, 255, 0.12),
                rgba(0, 153, 255, 0.025)
              );
            box-shadow: 0 0 30px rgba(0, 153, 255, 0.06);
          }

          .settings-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 13px;
          }

          .setting-card {
            position: relative;
            display: flex;
            flex-direction: column;
            min-width: 0;
            min-height: 205px;
            padding: 17px;
            border: 1px solid rgba(0, 153, 255, 0.12);
            border-radius: 14px;
            background:
              linear-gradient(
                145deg,
                rgba(5, 17, 29, 0.93),
                rgba(2, 8, 15, 0.95)
              );
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.025),
              0 15px 45px rgba(0, 0, 0, 0.18);
          }

          .setting-card:hover {
            border-color: rgba(0, 153, 255, 0.21);
          }

          .setting-sensitive {
            border-color: rgba(212, 175, 55, 0.16);
          }

          .setting-card-top {
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }

          .setting-key {
            margin-bottom: 5px;
            color: #436276;
            font-family: monospace;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .setting-card h3 {
            margin: 0;
            color: #eaf7ff;
            font-size: 13px;
            font-weight: 800;
          }

          .setting-badges {
            display: flex;
            flex-wrap: wrap;
            justify-content: flex-end;
            gap: 5px;
          }

          .setting-badge {
            height: fit-content;
            padding: 4px 6px;
            border-radius: 4px;
            font-size: 7px;
            font-weight: 900;
            letter-spacing: 0.08em;
          }

          .setting-badge.sensitive {
            color: #e9d890;
            border: 1px solid rgba(212, 175, 55, 0.2);
            background: rgba(212, 175, 55, 0.06);
          }

          .setting-badge.warning {
            color: #ffbd70;
            border: 1px solid rgba(255, 166, 76, 0.2);
            background: rgba(255, 166, 76, 0.06);
          }

          .setting-description {
            min-height: 34px;
            margin: 9px 0 12px;
            color: #607b90;
            font-size: 10px;
            line-height: 1.55;
          }

          .setting-control {
            margin-top: auto;
          }

          .settings-input {
            width: 100%;
            min-height: 39px;
            padding: 9px 11px;
            outline: none;
            border: 1px solid rgba(0, 153, 255, 0.14);
            border-radius: 8px;
            background: rgba(1, 7, 13, 0.85);
            color: #dcefff;
            font-family: inherit;
            font-size: 11px;
            transition:
              border-color 160ms ease,
              box-shadow 160ms ease;
          }

          .settings-input:focus {
            border-color: rgba(0, 153, 255, 0.45);
            box-shadow: 0 0 0 3px rgba(0, 153, 255, 0.055);
          }

          .settings-textarea {
            resize: vertical;
            min-height: 82px;
          }

          .settings-input option {
            background: #07111c;
            color: #e8f6ff;
          }

          .settings-toggle {
            display: flex;
            align-items: center;
            gap: 10px;
            width: fit-content;
            min-height: 39px;
            padding: 5px 10px 5px 5px;
            border: 1px solid rgba(0, 153, 255, 0.12);
            border-radius: 20px;
            background: rgba(1, 7, 13, 0.75);
            color: #70899b;
            cursor: pointer;
          }

          .settings-toggle.is-on {
            border-color: rgba(0, 153, 255, 0.28);
            color: #81d3ff;
            background: rgba(0, 153, 255, 0.055);
          }

          .toggle-track {
            display: flex;
            align-items: center;
            width: 31px;
            height: 18px;
            padding: 2px;
            border-radius: 12px;
            background: #172734;
            transition: background 160ms ease;
          }

          .settings-toggle.is-on .toggle-track {
            background: #007ecf;
          }

          .toggle-thumb {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #718697;
            transition: transform 160ms ease;
          }

          .settings-toggle.is-on .toggle-thumb {
            background: #fff;
            transform: translateX(13px);
          }

          .toggle-label {
            font-size: 10px;
            font-weight: 800;
          }

          .setting-card-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-top: 15px;
            padding-top: 11px;
            border-top: 1px solid rgba(255, 255, 255, 0.045);
          }

          .setting-default {
            min-width: 0;
            overflow: hidden;
            color: #40596b;
            font-size: 8px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .setting-default strong {
            color: #688295;
            font-weight: 700;
          }

          .setting-actions {
            display: flex;
            gap: 6px;
          }

          .setting-reset,
          .setting-save,
          .secondary-admin-button,
          .primary-admin-button {
            min-height: 30px;
            padding: 0 11px;
            border-radius: 7px;
            cursor: pointer;
            font-size: 9px;
            font-weight: 800;
            transition:
              opacity 160ms ease,
              transform 160ms ease,
              border-color 160ms ease;
          }

          .setting-reset {
            border: 1px solid rgba(255, 255, 255, 0.07);
            background: rgba(255, 255, 255, 0.025);
            color: #617b8e;
          }

          .setting-save {
            border: 1px solid rgba(0, 153, 255, 0.3);
            background: rgba(0, 153, 255, 0.1);
            color: #8bd8ff;
          }

          .setting-reset:hover,
          .setting-save:hover,
          .secondary-admin-button:hover,
          .primary-admin-button:hover {
            transform: translateY(-1px);
          }

          button:disabled {
            cursor: not-allowed !important;
            opacity: 0.5;
          }

          .settings-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            min-height: 260px;
            border: 1px solid rgba(0, 153, 255, 0.12);
            border-radius: 14px;
            background: rgba(2, 9, 16, 0.72);
            color: #658094;
            font-size: 11px;
          }

          .settings-loader {
            width: 18px;
            height: 18px;
            border: 2px solid rgba(0, 153, 255, 0.16);
            border-top-color: #0099ff;
            border-radius: 50%;
            animation: settings-spin 0.8s linear infinite;
          }

          @keyframes settings-spin {
            to {
              transform: rotate(360deg);
            }
          }

          .settings-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 280px;
            padding: 30px;
            border: 1px dashed rgba(0, 153, 255, 0.14);
            border-radius: 14px;
            text-align: center;
          }

          .settings-empty-icon {
            display: grid;
            place-items: center;
            width: 52px;
            height: 52px;
            margin-bottom: 12px;
            border: 1px solid rgba(0, 153, 255, 0.16);
            border-radius: 13px;
            color: #65c9ff;
            background: rgba(0, 153, 255, 0.04);
            font-size: 20px;
          }

          .settings-empty h3 {
            margin: 0;
            color: #dceeff;
            font-size: 14px;
          }

          .settings-empty p {
            max-width: 430px;
            margin: 7px 0 0;
            color: #536e81;
            font-size: 10px;
            line-height: 1.5;
          }

          .settings-message {
            position: fixed;
            right: 24px;
            bottom: 24px;
            z-index: 1000;
            max-width: 390px;
            padding: 13px 16px;
            border: 1px solid rgba(0, 153, 255, 0.25);
            border-radius: 10px;
            background: rgba(4, 15, 25, 0.96);
            box-shadow:
              0 20px 70px rgba(0, 0, 0, 0.5),
              0 0 30px rgba(0, 153, 255, 0.06);
            color: #cdeeff;
            font-size: 11px;
            font-weight: 700;
          }

          .settings-message.success {
            border-color: rgba(64, 221, 139, 0.28);
          }

          .settings-message.error {
            border-color: rgba(255, 92, 92, 0.3);
            color: #ffb6b6;
          }

          .assets-panel,
          .audit-panel {
            overflow: hidden;
            border: 1px solid rgba(0, 153, 255, 0.13);
            border-radius: 16px;
            background:
              linear-gradient(
                145deg,
                rgba(5, 17, 29, 0.94),
                rgba(2, 8, 15, 0.96)
              );
          }

          .assets-toolbar,
          .audit-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 18px;
            padding: 21px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }

          .primary-admin-button {
            display: flex;
            align-items: center;
            gap: 7px;
            border: 1px solid rgba(0, 153, 255, 0.3);
            background: rgba(0, 153, 255, 0.1);
            color: #8ad9ff;
          }

          .primary-admin-button span {
            font-size: 15px;
          }

          .secondary-admin-button {
            border: 1px solid rgba(0, 153, 255, 0.18);
            background: rgba(0, 153, 255, 0.055);
            color: #79c9ee;
          }

          .wallet-table-wrap {
            overflow-x: auto;
          }

          .wallet-table {
            width: 100%;
            border-collapse: collapse;
            min-width: 980px;
          }

          .wallet-table th {
            padding: 11px 13px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.055);
            color: #496477;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.1em;
            text-align: left;
            text-transform: uppercase;
          }

          .wallet-table td {
            padding: 13px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.035);
            color: #8aa1b2;
            font-size: 10px;
            vertical-align: middle;
          }

          .wallet-table tbody tr:hover {
            background: rgba(0, 153, 255, 0.025);
          }

          .wallet-asset {
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .wallet-asset img,
          .wallet-icon {
            display: grid;
            place-items: center;
            width: 31px;
            height: 31px;
            border-radius: 8px;
            object-fit: cover;
            background: rgba(0, 153, 255, 0.06);
            border: 1px solid rgba(0, 153, 255, 0.13);
          }

          .wallet-icon {
            color: #71caff;
            font-size: 11px;
            font-weight: 900;
          }

          .wallet-asset div {
            display: flex;
            flex-direction: column;
            gap: 2px;
          }

          .wallet-asset strong {
            color: #dceeff;
            font-size: 11px;
          }

          .wallet-asset span {
            color: #526d80;
            font-size: 9px;
          }

          .network-chip,
          .status-chip,
          .maintenance-chip {
            display: inline-block;
            padding: 4px 7px;
            border-radius: 5px;
            font-size: 8px;
            font-weight: 800;
          }

          .network-chip {
            color: #78c8ed;
            border: 1px solid rgba(0, 153, 255, 0.14);
            background: rgba(0, 153, 255, 0.04);
          }

          .status-chip.active {
            color: #78e6a5;
            background: rgba(70, 218, 137, 0.07);
            border: 1px solid rgba(70, 218, 137, 0.15);
          }

          .status-chip.inactive {
            color: #7b8b97;
            background: rgba(255, 255, 255, 0.035);
            border: 1px solid rgba(255, 255, 255, 0.06);
          }

          .maintenance-chip {
            margin-left: 5px;
            color: #e7ca70;
            background: rgba(212, 175, 55, 0.06);
            border: 1px solid rgba(212, 175, 55, 0.13);
          }

          .enabled-text {
            color: #70dda0;
          }

          .disabled-text {
            color: #596b77;
          }

          .limit-cell {
            display: flex;
            flex-direction: column;
            gap: 3px;
            color: #607c8e;
            font-size: 8px;
          }

          .table-actions {
            display: flex;
            gap: 5px;
          }

          .table-actions button {
            padding: 6px 8px;
            border: 1px solid rgba(0, 153, 255, 0.12);
            border-radius: 5px;
            background: rgba(0, 153, 255, 0.035);
            color: #71b9dc;
            cursor: pointer;
            font-size: 8px;
            font-weight: 800;
          }

          .table-actions button.danger-action {
            border-color: rgba(255, 88, 88, 0.12);
            color: #d77d7d;
            background: rgba(255, 88, 88, 0.025);
          }

          .audit-list {
            display: flex;
            flex-direction: column;
          }

          .audit-record {
            padding: 17px 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.045);
          }

          .audit-record:last-child {
            border-bottom: 0;
          }

          .audit-record-main {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .audit-icon {
            display: grid;
            place-items: center;
            width: 32px;
            height: 32px;
            border: 1px solid rgba(0, 153, 255, 0.15);
            border-radius: 8px;
            color: #6dcaff;
            background: rgba(0, 153, 255, 0.04);
          }

          .audit-key {
            color: #cde9f8;
            font-family: monospace;
            font-size: 10px;
            font-weight: 700;
          }

          .audit-admin {
            margin-top: 3px;
            color: #506b7d;
            font-size: 8px;
          }

          .audit-admin span {
            margin: 0 4px;
            color: #2d4657;
          }

          .audit-values {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 30px minmax(0, 1fr);
            gap: 10px;
            align-items: center;
            margin-top: 13px;
          }

          .audit-values > div:not(.audit-arrow) {
            min-width: 0;
          }

          .audit-values span {
            display: block;
            margin-bottom: 5px;
            color: #456174;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .audit-values pre {
            overflow: auto;
            max-height: 120px;
            margin: 0;
            padding: 9px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 7px;
            background: rgba(0, 0, 0, 0.18);
            color: #7f9bac;
            font-family: monospace;
            font-size: 8px;
            white-space: pre-wrap;
            word-break: break-word;
          }

          .audit-arrow {
            color: #3d6780;
            text-align: center;
          }

          .modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background: rgba(0, 4, 9, 0.78);
            backdrop-filter: blur(10px);
          }

          .admin-modal {
            width: min(620px, 100%);
            max-height: calc(100vh - 40px);
            overflow: auto;
            border: 1px solid rgba(0, 153, 255, 0.22);
            border-radius: 16px;
            background:
              radial-gradient(
                circle at 100% 0%,
                rgba(0, 153, 255, 0.1),
                transparent 35%
              ),
              #06111c;
            box-shadow:
              0 30px 100px rgba(0, 0, 0, 0.65),
              0 0 50px rgba(0, 153, 255, 0.08);
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 15px;
            padding: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          }

          .modal-eyebrow {
            color: #5faed8;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.14em;
          }

          .modal-header h3 {
            margin: 5px 0 0;
            color: #effaff;
            font-size: 17px;
          }

          .modal-close {
            width: 31px;
            height: 31px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 7px;
            background: rgba(255, 255, 255, 0.025);
            color: #708999;
            cursor: pointer;
          }

          .modal-body {
            padding: 20px;
          }

          .modal-body p {
            margin: 0;
            color: #7590a2;
            font-size: 10px;
            line-height: 1.6;
          }

          .confirmation-value {
            overflow: auto;
            margin: 14px 0 0;
            padding: 11px;
            border: 1px solid rgba(255, 166, 76, 0.12);
            border-radius: 8px;
            background: rgba(255, 166, 76, 0.035);
            color: #d9bd76;
            font-family: monospace;
            font-size: 9px;
            white-space: pre-wrap;
            word-break: break-word;
          }

          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            padding: 15px 20px 20px;
          }

          .modal-button {
            min-height: 35px;
            padding: 0 13px;
            border-radius: 7px;
            cursor: pointer;
            font-size: 9px;
            font-weight: 800;
          }

          .modal-button.cancel {
            border: 1px solid rgba(255, 255, 255, 0.07);
            background: rgba(255, 255, 255, 0.025);
            color: #71899a;
          }

          .modal-button.confirm {
            border: 1px solid rgba(0, 153, 255, 0.25);
            background: rgba(0, 153, 255, 0.1);
            color: #8ad9ff;
          }

          .wallet-form {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .wallet-form-group {
            min-width: 0;
          }

          .wallet-form-group.full {
            grid-column: 1 / -1;
          }

          .wallet-form-group label {
            display: block;
            margin-bottom: 6px;
            color: #587386;
            font-size: 8px;
            font-weight: 900;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .wallet-form-group textarea {
            resize: vertical;
            min-height: 70px;
          }

          .wallet-checks {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-top: 4px;
          }

          .wallet-check {
            display: flex;
            align-items: center;
            gap: 8px;
            min-height: 36px;
            padding: 8px;
            border: 1px solid rgba(255, 255, 255, 0.055);
            border-radius: 7px;
            background: rgba(255, 255, 255, 0.018);
            color: #7a94a5;
            font-size: 9px;
            cursor: pointer;
          }

          .wallet-check input {
            accent-color: #0099ff;
          }

          @media (max-width: 1100px) {
            .settings-layout {
              grid-template-columns: 205px minmax(0, 1fr);
            }

            .settings-grid {
              grid-template-columns: 1fr;
            }

            .settings-overview {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 760px) {
            .settings-overview {
              grid-template-columns: 1fr 1fr;
            }

            .settings-layout {
              grid-template-columns: 1fr;
            }

            .settings-sidebar {
              position: static;
            }

            .settings-nav {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 4px;
            }

            .settings-nav-button {
              margin: 0;
            }

            .settings-content-header {
              padding: 16px;
            }

            .assets-toolbar,
            .audit-header {
              flex-direction: column;
            }

            .audit-values {
              grid-template-columns: 1fr;
            }

            .audit-arrow {
              transform: rotate(90deg);
            }

            .wallet-form {
              grid-template-columns: 1fr;
            }

            .wallet-form-group.full {
              grid-column: auto;
            }
          }

          @media (max-width: 480px) {
            .settings-overview {
              grid-template-columns: 1fr;
            }

            .settings-nav {
              grid-template-columns: 1fr;
            }

            .setting-card-footer {
              align-items: flex-start;
              flex-direction: column;
            }

            .setting-actions {
              width: 100%;
            }

            .setting-reset,
            .setting-save {
              flex: 1;
            }

            .settings-message {
              right: 12px;
              bottom: 12px;
              left: 12px;
              max-width: none;
            }

            .wallet-checks {
              grid-template-columns: 1fr;
            }
          }
        `}</style>

        <div className="settings-overview">
          <div className="overview-card">
            <div className="overview-label">
              Configuration Records
            </div>

            <div className="overview-value">
              {stats.total}
            </div>

            <div className="overview-sub">
              Registered platform controls
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-label">
              Active Controls
            </div>

            <div className="overview-value">
              {stats.activeControls}
            </div>

            <div className="overview-sub">
              Currently enabled boolean controls
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-label">
              Configuration State
            </div>

            <div className="overview-value">
              {stats.enabled}
            </div>

            <div className="overview-sub">
              Enabled setting records
            </div>
          </div>

          <div className="overview-card">
            <div className="overview-label">
              Protected Controls
            </div>

            <div className="overview-value">
              {stats.sensitive}
            </div>

            <div className="overview-sub">
              Sensitive configuration records
            </div>
          </div>
        </div>

        <div className="settings-layout">
          <aside className="settings-sidebar">
            <div className="sidebar-top">
              <div className="sidebar-status">
                <span className="sidebar-status-dot" />
                CONFIGURATION ONLINE
              </div>

              <div className="sidebar-title">
                Platform Control
              </div>

              <div className="sidebar-subtitle">
                Central administration interface for
                exchange operations.
              </div>
            </div>

            <nav className="settings-nav">
              {CATEGORY_ORDER.map((category) => {
                const meta = CATEGORY_META[category];

                return (
                  <button
                    key={category}
                    type="button"
                    className={`settings-nav-button ${
                      activeTab === category
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setActiveTab(category)
                    }
                  >
                    <span className="settings-nav-icon">
                      {meta.icon}
                    </span>

                    <span>{meta.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="settings-content">
            {activeTab !== "assets" &&
            activeTab !== "audit" ? (
              <>
                <div className="settings-content-header">
                  <div>
                    <div className="content-eyebrow">
                      {CATEGORY_META[activeTab].eyebrow}
                    </div>

                    <h2>
                      {CATEGORY_META[activeTab].label}
                    </h2>

                    <p>
                      {
                        CATEGORY_META[activeTab]
                          .description
                      }
                    </p>
                  </div>

                  <div className="section-icon">
                    {CATEGORY_META[activeTab].icon}
                  </div>
                </div>

                {renderSettingsPanel()}
              </>
            ) : activeTab === "assets" ? (
              renderAssetsPanel()
            ) : (
              renderAuditPanel()
            )}
          </section>
        </div>

        {message && (
          <div
            className={`settings-message ${message.type}`}
          >
            {message.text}
          </div>
        )}

        {confirmDialog && (
          <div className="modal-backdrop">
            <div className="admin-modal">
              <div className="modal-header">
                <div>
                  <div className="modal-eyebrow">
                    ADMINISTRATOR CONFIRMATION
                  </div>

                  <h3>
                    Confirm Configuration Change
                  </h3>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() =>
                    setConfirmDialog(null)
                  }
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <p>
                  You are about to change the protected
                  platform setting{" "}
                  <strong>
                    {confirmDialog.setting.label}
                  </strong>
                  .
                </p>

                <div className="confirmation-value">
                  {formatJson(confirmDialog.value)}
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-button cancel"
                  onClick={() =>
                    setConfirmDialog(null)
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="modal-button confirm"
                  onClick={() => {
                    const dialog = confirmDialog;

                    setConfirmDialog(null);

                    void saveSetting(
                      dialog.setting,
                      dialog.value
                    );
                  }}
                >
                  Confirm Change
                </button>
              </div>
            </div>
          </div>
        )}

        {walletDialog && (
          <div className="modal-backdrop">
            <div className="admin-modal">
              <div className="modal-header">
                <div>
                  <div className="modal-eyebrow">
                    ASSET INFRASTRUCTURE
                  </div>

                  <h3>
                    {walletDialog === "new"
                      ? "Create Wallet Configuration"
                      : "Edit Wallet Configuration"}
                  </h3>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() =>
                    setWalletDialog(null)
                  }
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="wallet-form">
                  <div className="wallet-form-group">
                    <label>Asset Symbol</label>

                    <input
                      className="settings-input"
                      value={walletDraft.asset_symbol}
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          asset_symbol:
                            event.target.value,
                        }))
                      }
                      placeholder="BTC"
                    />
                  </div>

                  <div className="wallet-form-group">
                    <label>Asset Name</label>

                    <input
                      className="settings-input"
                      value={walletDraft.asset_name}
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          asset_name:
                            event.target.value,
                        }))
                      }
                      placeholder="Bitcoin"
                    />
                  </div>

                  <div className="wallet-form-group">
                    <label>Network</label>

                    <input
                      className="settings-input"
                      value={walletDraft.network}
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          network:
                            event.target.value,
                        }))
                      }
                      placeholder="Bitcoin"
                    />
                  </div>

                  <div className="wallet-form-group">
                    <label>Display Order</label>

                    <input
                      className="settings-input"
                      type="number"
                      value={walletDraft.display_order}
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          display_order:
                            Number(
                              event.target.value
                            ) || 0,
                        }))
                      }
                    />
                  </div>

                  <div className="wallet-form-group full">
                    <label>Deposit Address</label>

                    <input
                      className="settings-input"
                      value={walletDraft.deposit_address}
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          deposit_address:
                            event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="wallet-form-group">
                    <label>Deposit Tag / Memo</label>

                    <input
                      className="settings-input"
                      value={walletDraft.deposit_tag}
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          deposit_tag:
                            event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="wallet-form-group">
                    <label>Icon URL</label>

                    <input
                      className="settings-input"
                      value={walletDraft.icon_url}
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          icon_url:
                            event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="wallet-form-group full">
                    <label>Description</label>

                    <textarea
                      className="settings-input"
                      value={walletDraft.description}
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          description:
                            event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="wallet-form-group">
                    <label>Minimum Withdrawal</label>

                    <input
                      className="settings-input"
                      type="number"
                      step="any"
                      value={
                        walletDraft.minimum_withdrawal
                      }
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          minimum_withdrawal:
                            Number(
                              event.target.value
                            ) || 0,
                        }))
                      }
                    />
                  </div>

                  <div className="wallet-form-group">
                    <label>Maximum Withdrawal</label>

                    <input
                      className="settings-input"
                      type="number"
                      step="any"
                      value={
                        walletDraft.maximum_withdrawal
                      }
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          maximum_withdrawal:
                            event.target.value,
                        }))
                      }
                      placeholder="Unlimited"
                    />
                  </div>

                  <div className="wallet-form-group">
                    <label>Withdrawal Fee</label>

                    <input
                      className="settings-input"
                      type="number"
                      step="any"
                      value={
                        walletDraft.withdrawal_fee
                      }
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          withdrawal_fee:
                            Number(
                              event.target.value
                            ) || 0,
                        }))
                      }
                    />
                  </div>

                  <div className="wallet-form-group">
                    <label>
                      Required Confirmations
                    </label>

                    <input
                      className="settings-input"
                      type="number"
                      min="1"
                      value={
                        walletDraft.required_confirmations
                      }
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          required_confirmations:
                            Number(
                              event.target.value
                            ) || 1,
                        }))
                      }
                    />
                  </div>

                  <div className="wallet-form-group full">
                    <label>Maintenance Message</label>

                    <textarea
                      className="settings-input"
                      value={
                        walletDraft.maintenance_message
                      }
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          maintenance_message:
                            event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="wallet-form-group full">
                    <label>Administrator Notes</label>

                    <textarea
                      className="settings-input"
                      value={
                        walletDraft.admin_notes
                      }
                      onChange={(event) =>
                        setWalletDraft((current) => ({
                          ...current,
                          admin_notes:
                            event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="wallet-form-group full">
                    <div className="wallet-checks">
                      <label className="wallet-check">
                        <input
                          type="checkbox"
                          checked={
                            walletDraft.is_active
                          }
                          onChange={(event) =>
                            setWalletDraft(
                              (current) => ({
                                ...current,
                                is_active:
                                  event.target
                                    .checked,
                              })
                            )
                          }
                        />
                        Active
                      </label>

                      <label className="wallet-check">
                        <input
                          type="checkbox"
                          checked={
                            walletDraft.deposits_enabled
                          }
                          onChange={(event) =>
                            setWalletDraft(
                              (current) => ({
                                ...current,
                                deposits_enabled:
                                  event.target
                                    .checked,
                              })
                            )
                          }
                        />
                        Deposits Enabled
                      </label>

                      <label className="wallet-check">
                        <input
                          type="checkbox"
                          checked={
                            walletDraft.withdrawals_enabled
                          }
                          onChange={(event) =>
                            setWalletDraft(
                              (current) => ({
                                ...current,
                                withdrawals_enabled:
                                  event.target
                                    .checked,
                              })
                            )
                          }
                        />
                        Withdrawals Enabled
                      </label>

                      <label className="wallet-check">
                        <input
                          type="checkbox"
                          checked={
                            walletDraft.swaps_enabled
                          }
                          onChange={(event) =>
                            setWalletDraft(
                              (current) => ({
                                ...current,
                                swaps_enabled:
                                  event.target
                                    .checked,
                              })
                            )
                          }
                        />
                        Swaps Enabled
                      </label>

                      <label className="wallet-check">
                        <input
                          type="checkbox"
                          checked={
                            walletDraft.maintenance_mode
                          }
                          onChange={(event) =>
                            setWalletDraft(
                              (current) => ({
                                ...current,
                                maintenance_mode:
                                  event.target
                                    .checked,
                              })
                            )
                          }
                        />
                        Maintenance Mode
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-button cancel"
                  onClick={() =>
                    setWalletDialog(null)
                  }
                  disabled={walletSaving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="modal-button confirm"
                  onClick={() =>
                    void saveWallet()
                  }
                  disabled={walletSaving}
                >
                  {walletSaving
                    ? "Saving..."
                    : walletDialog === "new"
                    ? "Create Configuration"
                    : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {walletDeleteDialog && (
          <div className="modal-backdrop">
            <div className="admin-modal">
              <div className="modal-header">
                <div>
                  <div className="modal-eyebrow">
                    DESTRUCTIVE ACTION
                  </div>

                  <h3>
                    Delete Wallet Configuration
                  </h3>
                </div>

                <button
                  type="button"
                  className="modal-close"
                  onClick={() =>
                    setWalletDeleteDialog(null)
                  }
                >
                  ×
                </button>
              </div>

              <div className="modal-body">
                <p>
                  You are about to delete the wallet
                  configuration for{" "}
                  <strong>
                    {walletDeleteDialog.asset_symbol}
                  </strong>{" "}
                  on{" "}
                  <strong>
                    {walletDeleteDialog.network}
                  </strong>
                  .
                </p>

                <div className="confirmation-value">
                  This removes the configuration record. It
                  does not delete historical transaction
                  records.
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="modal-button cancel"
                  onClick={() =>
                    setWalletDeleteDialog(null)
                  }
                  disabled={walletSaving}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="modal-button confirm"
                  onClick={() =>
                    void deleteWallet()
                  }
                  disabled={walletSaving}
                >
                  {walletSaving
                    ? "Deleting..."
                    : "Delete Configuration"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminModule>
  );
}

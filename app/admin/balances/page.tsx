"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import "./balances.css";

type UserRecord = {
  user_id: string;
  email: string | null;
  account_id: string | null;
  username: string | null;
  full_name: string | null;
  account_status: string;
  verification_status: string;
  available_balance: number | null;
  locked_balance: number | null;
  created_at: string;
};

type AuditRecord = {
  id: string;
  user_id: string;
  admin_id: string;
  action: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reason: string;
  audit_at: string;
  transaction_id: string | null;
  created_at: string;

  user_account_id: string | null;
  user_username: string | null;
  user_full_name: string | null;
  user_email: string | null;

  admin_email: string | null;
};

const PAGE_SIZE = 25;

const navigation = [
  {
    title: "Dashboard",
    description: "Overview & activity",
    href: "/admin",
    icon: "▦",
  },
  {
    title: "Users",
    description: "Manage accounts",
    href: "/admin/users",
    icon: "◉",
  },
  {
    title: "Balance Management",
    description: "Add, subtract & bonus",
    href: "/admin/balances",
    icon: "◆",
  },
  {
    title: "Deposits",
    description: "Review deposits",
    href: "/admin/deposits",
    icon: "↓",
  },
  {
    title: "Withdrawals",
    description: "Process withdrawals",
    href: "/admin/withdrawals",
    icon: "↑",
  },
  {
    title: "Wallet Configuration",
    description: "Deposit addresses",
    href: "/admin/wallets",
    icon: "▣",
  },
  {
    title: "Investments",
    description: "User investments",
    href: "/admin/investments",
    icon: "◈",
  },
  {
    title: "Investment Plans",
    description: "Manage plans",
    href: "/admin/investment-plans",
    icon: "◇",
  },
  {
    title: "Swap Management",
    description: "Swap activity",
    href: "/admin/swaps",
    icon: "⇄",
  },
  {
    title: "Transactions",
    description: "Ledger & history",
    href: "/admin/transactions",
    icon: "≡",
  },
  {
    title: "Verification",
    description: "Account verification",
    href: "/admin/verification",
    icon: "✓",
  },
  {
    title: "Platform Settings",
    description: "System configuration",
    href: "/admin/settings",
    icon: "⚙",
  },
];

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(Number(value || 0));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getLocalDateTimeValue() {
  const now = new Date();

  const offset = now.getTimezoneOffset();
  const local = new Date(
    now.getTime() - offset * 60 * 1000
  );

  return local.toISOString().slice(0, 16);
}

function getUserName(user: UserRecord) {
  return (
    user.full_name ||
    user.username ||
    user.email ||
    user.account_id ||
    "Unnamed user"
  );
}

function getAuditUserName(audit: AuditRecord) {
  return (
    audit.user_full_name ||
    audit.user_username ||
    audit.user_email ||
    audit.user_account_id ||
    "Unknown user"
  );
}

function getInitials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return value.slice(0, 2).toUpperCase();
}

export default function AdminBalancesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [selectedUser, setSelectedUser] =
    useState<UserRecord | null>(null);

  const [userSearch, setUserSearch] = useState("");
  const [userSearchLoading, setUserSearchLoading] =
    useState(false);

  const [action, setAction] = useState<
    "add" | "subtract" | "bonus"
  >("add");

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const [useCustomDate, setUseCustomDate] =
    useState(false);

  const [auditDate, setAuditDate] = useState(
    getLocalDateTimeValue()
  );

  const [saving, setSaving] = useState(false);

  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [auditLoading, setAuditLoading] =
    useState(true);

  const [auditSearch, setAuditSearch] =
    useState("");

  const [auditStart, setAuditStart] =
    useState("");

  const [auditEnd, setAuditEnd] =
    useState("");

  const [auditPage, setAuditPage] = useState(0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedAudit, setSelectedAudit] =
    useState<AuditRecord | null>(null);

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const verifyAdmin = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return false;
    }

    const { data, error: adminError } =
      await supabase.rpc("is_admin");

    if (adminError) {
      throw new Error(adminError.message);
    }

    if (!data) {
      router.replace("/dashboard");
      return false;
    }

    return true;
  }, [router, supabase]);

  const searchUsers = async () => {
    const search = userSearch.trim();

    if (!search) {
      setUsers([]);
      return;
    }

    setUserSearchLoading(true);

    try {
      const { data, error: rpcError } =
        await supabase.rpc("admin_get_users", {
          p_search: search,
          p_limit: 10,
          p_offset: 0,
        });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setUsers((data || []) as UserRecord[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to search users."
      );
    } finally {
      setUserSearchLoading(false);
    }
  };

  const loadAudits = useCallback(async () => {
    setAuditLoading(true);

    try {
      const isAdmin = await verifyAdmin();

      if (!isAdmin) {
        return;
      }

      let startAt: string | null = null;
      let endAt: string | null = null;

      if (auditStart) {
        startAt = new Date(
          `${auditStart}T00:00:00`
        ).toISOString();
      }

      if (auditEnd) {
        endAt = new Date(
          `${auditEnd}T23:59:59.999`
        ).toISOString();
      }

      const { data, error: rpcError } =
        await supabase.rpc(
          "admin_get_balance_adjustments",
          {
            p_user_id: null,
            p_limit: PAGE_SIZE,
            p_offset: auditPage * PAGE_SIZE,
            p_start_at: startAt,
            p_end_at: endAt,
          }
        );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setAudits((data || []) as AuditRecord[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load balance audit history."
      );
    } finally {
      setAuditLoading(false);
    }
  }, [
    auditEnd,
    auditPage,
    auditStart,
    supabase,
    verifyAdmin,
  ]);

  useEffect(() => {
    loadAudits();
  }, [loadAudits]);

  const filteredAudits = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();

    if (!query) {
      return audits;
    }

    return audits.filter((audit) => {
      const values = [
        audit.user_account_id,
        audit.user_username,
        audit.user_full_name,
        audit.user_email,
        audit.admin_email,
        audit.action,
        audit.reason,
        audit.transaction_id,
      ];

      return values.some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [auditSearch, audits]);

  const selectUser = (user: UserRecord) => {
    setSelectedUser(user);
    setUsers([]);
    setUserSearch("");
    clearMessages();
  };

  const resetForm = () => {
    setAction("add");
    setAmount("");
    setReason("");
    setUseCustomDate(false);
    setAuditDate(getLocalDateTimeValue());
  };

  const submitAdjustment = async () => {
    clearMessages();

    if (!selectedUser) {
      setError("Select a user before making a balance adjustment.");
      return;
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }

    if (!reason.trim()) {
      setError("A reason is required for every adjustment.");
      return;
    }

    if (
      action === "subtract" &&
      numericAmount >
        Number(selectedUser.available_balance || 0)
    ) {
      setError(
        "The subtraction amount exceeds the user's available CCT balance."
      );
      return;
    }

    if (
      useCustomDate &&
      !auditDate
    ) {
      setError("Select an audit date.");
      return;
    }

    const actionLabel =
      action === "add"
        ? "add"
        : action === "bonus"
        ? "bonus"
        : "subtract";

    const customDateText = useCustomDate
      ? formatDate(new Date(auditDate).toISOString())
      : "current time";

    const confirmed = window.confirm(
      [
        `Confirm ${actionLabel} adjustment`,
        "",
        `User: ${getUserName(selectedUser)}`,
        `Amount: ${formatNumber(numericAmount)} CCT`,
        `Reason: ${reason.trim()}`,
        `Audit date: ${customDateText}`,
        "",
        "This will update the user's CCT balance and create a transaction ledger entry.",
      ].join("\n")
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    try {
      const auditAt = useCustomDate
        ? new Date(auditDate).toISOString()
        : null;

      const { data, error: rpcError } =
        await supabase.rpc("admin_adjust_cct_balance", {
          p_user_id: selectedUser.user_id,
          p_action: action,
          p_amount: numericAmount,
          p_reason: reason.trim(),
          p_audit_at: auditAt,
        });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "The balance adjustment could not be completed."
        );
      }

      setSuccess(
        `${actionLabel.toUpperCase()} completed successfully. ${formatNumber(
          numericAmount
        )} CCT was applied to ${getUserName(selectedUser)}.`
      );

      setSelectedUser({
        ...selectedUser,
        available_balance: Number(
          data.balance_after
        ),
      });

      resetForm();

      await loadAudits();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to complete balance adjustment."
      );
    } finally {
      setSaving(false);
    }
  };

  const clearAuditFilters = () => {
    setAuditSearch("");
    setAuditStart("");
    setAuditEnd("");
    setAuditPage(0);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  return (
    <main className="admin-balances-app">
      {/* SIDEBAR */}

      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="admin-logo-mark">C</div>

          <div>
            <strong>CRYPTO-COM</strong>
            <span>ADMIN CENTER</span>
          </div>
        </div>

        <div className="admin-menu-label">
          MAIN MENU
        </div>

        <nav className="admin-navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`admin-nav-link ${
                pathname === item.href ? "active" : ""
              }`}
            >
              <span className="admin-nav-icon">
                {item.icon}
              </span>

              <span className="admin-nav-copy">
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-security-status">
            <span className="security-indicator" />

            <div>
              <strong>SECURE SESSION</strong>
              <small>Administrator authenticated</small>
            </div>
          </div>

          <button
            type="button"
            className="admin-signout"
            onClick={logout}
          >
            <span>↪</span>
            Sign out
          </button>
        </div>
      </aside>

      {/* MAIN */}

      <section className="admin-balances-main">
        <header className="balances-topbar">
          <div>
            <span className="balances-breadcrumb">
              ADMINISTRATION / BALANCE MANAGEMENT
            </span>

            <h1>Balance Management</h1>

            <p>
              Manage CCT balances with a complete,
              traceable accounting audit trail.
            </p>
          </div>

          <button
            type="button"
            className="balances-refresh"
            onClick={loadAudits}
            disabled={auditLoading}
          >
            ↻ {auditLoading ? "Refreshing..." : "Refresh Audit"}
          </button>
        </header>

        {/* ALERTS */}

        {error && (
          <div className="balances-alert error">
            <span>!</span>

            <div>
              <strong>Action failed</strong>
              <p>{error}</p>
            </div>

            <button
              type="button"
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="balances-alert success">
            <span>✓</span>

            <div>
              <strong>Balance updated</strong>
              <p>{success}</p>
            </div>

            <button
              type="button"
              onClick={() => setSuccess("")}
            >
              ×
            </button>
          </div>
        )}

        {/* ADJUSTMENT WORKSPACE */}

        <section className="balance-workspace">
          <div className="adjustment-card">
            <div className="section-heading">
              <div>
                <span>ACCOUNT CONTROL</span>
                <h2>Balance Adjustment</h2>
                <p>
                  Select an account and create a fully
                  documented CCT balance adjustment.
                </p>
              </div>

              <div className="audit-badge">
                <span />
                AUDIT ENABLED
              </div>
            </div>

            {/* USER SEARCH */}

            <div className="form-section">
              <label>SELECT USER</label>

              {!selectedUser ? (
                <>
                  <div className="user-search-box">
                    <span>⌕</span>

                    <input
                      value={userSearch}
                      onChange={(event) =>
                        setUserSearch(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          searchUsers();
                        }
                      }}
                      placeholder="Search account ID, username, name or email..."
                    />

                    <button
                      type="button"
                      onClick={searchUsers}
                      disabled={userSearchLoading}
                    >
                      {userSearchLoading
                        ? "Searching..."
                        : "Search"}
                    </button>
                  </div>

                  {users.length > 0 && (
                    <div className="user-results">
                      {users.map((user) => (
                        <button
                          type="button"
                          key={user.user_id}
                          className="user-result"
                          onClick={() =>
                            selectUser(user)
                          }
                        >
                          <span className="result-avatar">
                            {getInitials(
                              getUserName(user)
                            )}
                          </span>

                          <span className="result-copy">
                            <strong>
                              {getUserName(user)}
                            </strong>

                            <small>
                              {user.account_id ||
                                "No account ID"}{" "}
                              ·{" "}
                              {user.email ||
                                "No email"}
                            </small>
                          </span>

                          <span className="result-balance">
                            {formatNumber(
                              user.available_balance
                            )}{" "}
                            CCT
                          </span>

                          <span className="result-arrow">
                            →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="selected-user">
                  <div className="selected-user-avatar">
                    {getInitials(
                      getUserName(selectedUser)
                    )}
                  </div>

                  <div className="selected-user-copy">
                    <strong>
                      {getUserName(selectedUser)}
                    </strong>

                    <small>
                      {selectedUser.email ||
                        "No email"}
                    </small>

                    <span>
                      Account ID:{" "}
                      {selectedUser.account_id ||
                        "—"}
                    </span>
                  </div>

                  <div className="selected-balance">
                    <span>AVAILABLE CCT</span>
                    <strong>
                      {formatNumber(
                        selectedUser.available_balance
                      )}
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedUser(null)
                    }
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* ACTION */}

            <div className="form-section">
              <label>ADJUSTMENT TYPE</label>

              <div className="action-selector">
                <button
                  type="button"
                  className={
                    action === "add"
                      ? "selected add"
                      : ""
                  }
                  onClick={() => setAction("add")}
                >
                  <span>+</span>
                  <strong>Add Funds</strong>
                  <small>
                    Increase available CCT
                  </small>
                </button>

                <button
                  type="button"
                  className={
                    action === "bonus"
                      ? "selected bonus"
                      : ""
                  }
                  onClick={() => setAction("bonus")}
                >
                  <span>◆</span>
                  <strong>Bonus</strong>
                  <small>
                    Issue promotional CCT
                  </small>
                </button>

                <button
                  type="button"
                  className={
                    action === "subtract"
                      ? "selected subtract"
                      : ""
                  }
                  onClick={() =>
                    setAction("subtract")
                  }
                >
                  <span>−</span>
                  <strong>Subtract</strong>
                  <small>
                    Reduce available CCT
                  </small>
                </button>
              </div>
            </div>

            {/* AMOUNT */}

            <div className="form-grid">
              <div className="form-section">
                <label>AMOUNT</label>

                <div className="amount-input">
                  <input
                    type="number"
                    min="0"
                    step="0.00000001"
                    value={amount}
                    onChange={(event) =>
                      setAmount(event.target.value)
                    }
                    placeholder="0.00"
                  />

                  <span>CCT</span>
                </div>
              </div>

              <div className="form-section">
                <label>
                  RESULTING BALANCE
                </label>

                <div className="calculated-balance">
                  <span>
                    {selectedUser
                      ? formatNumber(
                          Number(
                            selectedUser.available_balance ||
                              0
                          ) +
                            (action === "subtract"
                              ? -Number(
                                  amount || 0
                                )
                              : Number(
                                  amount || 0
                                ))
                        )
                      : "0.00"}
                  </span>

                  <small>CCT</small>
                </div>
              </div>
            </div>

            {/* REASON */}

            <div className="form-section">
              <label>ADJUSTMENT REASON</label>

              <textarea
                value={reason}
                onChange={(event) =>
                  setReason(event.target.value)
                }
                placeholder="Enter the reason for this adjustment. This will be permanently recorded in the audit trail."
                rows={4}
              />

              <small className="field-hint">
                A clear reason is required for every
                adjustment.
              </small>
            </div>

            {/* CUSTOM DATE */}

            <div className="audit-date-section">
              <div className="audit-date-header">
                <div>
                  <label>
                    AUDIT / TRANSACTION DATE
                  </label>

                  <p>
                    Choose a historical date when this
                    adjustment should appear in the
                    user's transaction history.
                  </p>
                </div>

                <label className="date-toggle">
                  <input
                    type="checkbox"
                    checked={useCustomDate}
                    onChange={(event) =>
                      setUseCustomDate(
                        event.target.checked
                      )
                    }
                  />

                  <span className="toggle-track">
                    <span />
                  </span>

                  <strong>
                    Custom date
                  </strong>
                </label>
              </div>

              {useCustomDate && (
                <div className="custom-date-input">
                  <span>◷</span>

                  <input
                    type="datetime-local"
                    value={auditDate}
                    onChange={(event) =>
                      setAuditDate(
                        event.target.value
                      )
                    }
                  />
                </div>
              )}

              {!useCustomDate && (
                <div className="automatic-date">
                  <span>◷</span>
                  <div>
                    <strong>
                      Current server time
                    </strong>

                    <small>
                      The system will timestamp the
                      audit and transaction automatically.
                    </small>
                  </div>
                </div>
              )}
            </div>

            {/* SUBMIT */}

            <div className="adjustment-footer">
              <div className="ledger-notice">
                <span>◆</span>

                <div>
                  <strong>
                    Dual-record audit
                  </strong>

                  <small>
                    This adjustment updates the CCT
                    wallet, admin audit trail and user
                    transaction ledger atomically.
                  </small>
                </div>
              </div>

              <button
                type="button"
                className={`submit-adjustment ${action}`}
                onClick={submitAdjustment}
                disabled={
                  saving ||
                  !selectedUser ||
                  !amount ||
                  !reason.trim()
                }
              >
                {saving ? (
                  <>
                    <span className="button-spinner" />
                    Processing...
                  </>
                ) : (
                  <>
                    {action === "subtract"
                      ? "−"
                      : action === "bonus"
                      ? "◆"
                      : "+"}{" "}
                    {action === "subtract"
                      ? "Subtract"
                      : action === "bonus"
                      ? "Issue Bonus"
                      : "Add Funds"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SELECTED ACCOUNT SUMMARY */}

          <aside className="balance-summary-card">
            <div className="summary-label">
              ACCOUNT SNAPSHOT
            </div>

            {selectedUser ? (
              <>
                <div className="summary-user">
                  <div className="summary-avatar">
                    {getInitials(
                      getUserName(selectedUser)
                    )}
                  </div>

                  <div>
                    <strong>
                      {getUserName(selectedUser)}
                    </strong>

                    <span>
                      {selectedUser.account_id ||
                        "No account ID"}
                    </span>
                  </div>
                </div>

                <div className="summary-balance">
                  <span>AVAILABLE CCT</span>

                  <strong>
                    {formatNumber(
                      selectedUser.available_balance
                    )}
                  </strong>

                  <small>
                    Locked:{" "}
                    {formatNumber(
                      selectedUser.locked_balance
                    )}{" "}
                    CCT
                  </small>
                </div>

                <div className="summary-details">
                  <div>
                    <span>ACCOUNT STATUS</span>
                    <strong>
                      {selectedUser.account_status}
                    </strong>
                  </div>

                  <div>
                    <span>VERIFICATION</span>
                    <strong>
                      {
                        selectedUser.verification_status
                      }
                    </strong>
                  </div>

                  <div>
                    <span>REGISTERED</span>
                    <strong>
                      {formatDate(
                        selectedUser.created_at
                      )}
                    </strong>
                  </div>
                </div>
              </>
            ) : (
              <div className="summary-empty">
                <div>◆</div>

                <h3>No account selected</h3>

                <p>
                  Search for a user above to inspect
                  their balance before making an
                  adjustment.
                </p>
              </div>
            )}
          </aside>
        </section>

        {/* AUDIT HISTORY */}

        <section className="audit-panel">
          <div className="audit-panel-header">
            <div>
              <span>ACCOUNTING RECORD</span>
              <h2>Balance Audit History</h2>
              <p>
                Every administrator balance adjustment
                recorded with its historical transaction
                date.
              </p>
            </div>

            <div className="audit-integrity">
              <span />
              LEDGER LINKED
            </div>
          </div>

          {/* FILTERS */}

          <div className="audit-filters">
            <div className="audit-search">
              <span>⌕</span>

              <input
                value={auditSearch}
                onChange={(event) =>
                  setAuditSearch(event.target.value)
                }
                placeholder="Filter current audit results..."
              />
            </div>

            <div className="date-filter">
              <label>FROM</label>

              <input
                type="date"
                value={auditStart}
                onChange={(event) => {
                  setAuditStart(event.target.value);
                  setAuditPage(0);
                }}
              />
            </div>

            <div className="date-filter">
              <label>TO</label>

              <input
                type="date"
                value={auditEnd}
                onChange={(event) => {
                  setAuditEnd(event.target.value);
                  setAuditPage(0);
                }}
              />
            </div>

            {(auditSearch ||
              auditStart ||
              auditEnd) && (
              <button
                type="button"
                className="clear-filters"
                onClick={clearAuditFilters}
              >
                Clear
              </button>
            )}
          </div>

          <div className="audit-table-wrap">
            {auditLoading ? (
              <div className="audit-loading">
                <div className="users-loader" />
                <span>
                  Loading audit records...
                </span>
              </div>
            ) : filteredAudits.length === 0 ? (
              <div className="audit-empty">
                <div>◆</div>

                <h3>No balance adjustments found</h3>

                <p>
                  No audit records match the current
                  filters.
                </p>
              </div>
            ) : (
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>USER</th>
                    <th>ACTION</th>
                    <th>AMOUNT</th>
                    <th>BALANCE CHANGE</th>
                    <th>REASON</th>
                    <th>ADMIN</th>
                    <th>TRANSACTION</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAudits.map((audit) => (
                    <tr key={audit.id}>
                      <td>
                        <div className="audit-date-cell">
                          <strong>
                            {formatDate(
                              audit.audit_at
                            )}
                          </strong>

                          <small>
                            Recorded{" "}
                            {formatDate(
                              audit.created_at
                            )}
                          </small>
                        </div>
                      </td>

                      <td>
                        <div className="audit-user">
                          <span>
                            {getInitials(
                              getAuditUserName(
                                audit
                              )
                            )}
                          </span>

                          <div>
                            <strong>
                              {getAuditUserName(
                                audit
                              )}
                            </strong>

                            <small>
                              {audit.user_account_id ||
                                audit.user_email ||
                                "—"}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`audit-action ${audit.action}`}
                        >
                          {audit.action ===
                          "add"
                            ? "+"
                            : audit.action ===
                              "subtract"
                            ? "−"
                            : "◆"}{" "}
                          {audit.action}
                        </span>
                      </td>

                      <td>
                        <strong className="audit-amount">
                          {formatNumber(
                            audit.amount
                          )}{" "}
                          CCT
                        </strong>
                      </td>

                      <td>
                        <div className="balance-change">
                          <span>
                            {formatNumber(
                              audit.balance_before
                            )}
                          </span>

                          <b>→</b>

                          <strong>
                            {formatNumber(
                              audit.balance_after
                            )}
                          </strong>
                        </div>
                      </td>

                      <td>
                        <span className="audit-reason">
                          {audit.reason}
                        </span>
                      </td>

                      <td>
                        <span className="audit-admin">
                          {audit.admin_email ||
                            "Administrator"}
                        </span>
                      </td>

                      <td>
                        {audit.transaction_id ? (
                          <button
                            type="button"
                            className="transaction-link"
                            onClick={() =>
                              setSelectedAudit(
                                audit
                              )
                            }
                          >
                            View
                            <span>→</span>
                          </button>
                        ) : (
                          <span className="no-transaction">
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="audit-pagination">
            <span>
              Page <strong>{auditPage + 1}</strong>
            </span>

            <div>
              <button
                type="button"
                disabled={
                  auditPage === 0 ||
                  auditLoading
                }
                onClick={() =>
                  setAuditPage((current) =>
                    Math.max(0, current - 1)
                  )
                }
              >
                ← Previous
              </button>

              <button
                type="button"
                disabled={
                  audits.length < PAGE_SIZE ||
                  auditLoading
                }
                onClick={() =>
                  setAuditPage((current) =>
                    current + 1
                  )
                }
              >
                Next →
              </button>
            </div>
          </div>
        </section>
      </section>

      {/* TRANSACTION AUDIT DRAWER */}

      {selectedAudit && (
        <>
          <button
            type="button"
            className="audit-drawer-overlay"
            aria-label="Close audit details"
            onClick={() =>
              setSelectedAudit(null)
            }
          />

          <aside className="audit-drawer">
            <div className="drawer-header">
              <div>
                <span>LEDGER AUDIT</span>
                <h2>Adjustment Record</h2>
              </div>

              <button
                type="button"
                className="drawer-close"
                onClick={() =>
                  setSelectedAudit(null)
                }
              >
                ×
              </button>
            </div>

            <div className="drawer-reference">
              <span>AUDIT ID</span>

              <strong>
                {selectedAudit.id}
              </strong>
            </div>

            <div className="drawer-reference">
              <span>TRANSACTION ID</span>

              <strong>
                {selectedAudit.transaction_id ||
                  "—"}
              </strong>
            </div>

            <div className="drawer-balance-highlight">
              <span>
                {selectedAudit.action.toUpperCase()}
              </span>

              <strong>
                {selectedAudit.action ===
                "subtract"
                  ? "−"
                  : "+"}
                {formatNumber(
                  selectedAudit.amount
                )}{" "}
                CCT
              </strong>
            </div>

            <div className="drawer-audit-list">
              <div>
                <span>User</span>

                <strong>
                  {getAuditUserName(
                    selectedAudit
                  )}
                </strong>
              </div>

              <div>
                <span>Account ID</span>

                <strong>
                  {selectedAudit.user_account_id ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Previous balance</span>

                <strong>
                  {formatNumber(
                    selectedAudit.balance_before
                  )}{" "}
                  CCT
                </strong>
              </div>

              <div>
                <span>New balance</span>

                <strong>
                  {formatNumber(
                    selectedAudit.balance_after
                  )}{" "}
                  CCT
                </strong>
              </div>

              <div>
                <span>Audit date</span>

                <strong>
                  {formatDate(
                    selectedAudit.audit_at
                  )}
                </strong>
              </div>

              <div>
                <span>Recorded at</span>

                <strong>
                  {formatDate(
                    selectedAudit.created_at
                  )}
                </strong>
              </div>

              <div>
                <span>Administrator</span>

                <strong>
                  {selectedAudit.admin_email ||
                    "Administrator"}
                </strong>
              </div>
            </div>

            <div className="drawer-reason">
              <span>REASON</span>

              <p>
                {selectedAudit.reason}
              </p>
            </div>

            <div className="drawer-ledger-status">
              <span>✓</span>

              <div>
                <strong>
                  Transaction ledger linked
                </strong>

                <small>
                  The balance adjustment is linked
                  to the user's transaction history.
                </small>
              </div>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
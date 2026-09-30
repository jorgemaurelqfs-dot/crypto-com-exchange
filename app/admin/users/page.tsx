"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../../lib/supabase/client";
import "./users.css";

type UserRecord = {
  user_id: string;
  email: string | null;
  account_id: string | null;
  username: string | null;
  full_name: string | null;
  account_status: "active" | "suspended" | "closed" | string;
  verification_status:
    | "unverified"
    | "pending"
    | "verified"
    | "rejected"
    | string;
  available_balance: number | null;
  locked_balance: number | null;
  created_at: string;
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

function formatBalance(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(Number(value || 0));
}

function formatDate(value: string) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitials(user: UserRecord) {
  const source =
    user.full_name?.trim() ||
    user.username?.trim() ||
    user.email?.trim() ||
    "U";

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function displayName(user: UserRecord) {
  return (
    user.full_name ||
    user.username ||
    user.email ||
    user.account_id ||
    "Unnamed user"
  );
}

function accountStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    case "closed":
      return "Closed";
    default:
      return status || "Unknown";
  }
}

function verificationStatusLabel(status: string) {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending":
      return "Pending";
    case "rejected":
      return "Rejected";
    case "unverified":
      return "Unverified";
    default:
      return status || "Unknown";
  }
}

export default function AdminUsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [selectedUser, setSelectedUser] =
    useState<UserRecord | null>(null);

  const [statusMenuUser, setStatusMenuUser] =
    useState<string | null>(null);

  const [verificationMenuUser, setVerificationMenuUser] =
    useState<string | null>(null);

  const totalPages = Math.max(
    1,
    Math.ceil(totalUsers / PAGE_SIZE)
  );

  const pageStart = page * PAGE_SIZE + 1;
  const pageEnd = Math.min(
    (page + 1) * PAGE_SIZE,
    totalUsers
  );

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

  const loadUsers = useCallback(async () => {
    setLoading(true);
    clearMessages();

    try {
      const isAdmin = await verifyAdmin();

      if (!isAdmin) {
        return;
      }

      const offset = page * PAGE_SIZE;

      const [
        { data: userData, error: userError },
        { data: countData, error: countError },
      ] = await Promise.all([
        supabase.rpc("admin_get_users", {
          p_search: search || null,
          p_limit: PAGE_SIZE,
          p_offset: offset,
        }),
        supabase.rpc("admin_count_users", {
          p_search: search || null,
        }),
      ]);

      if (userError) {
        throw new Error(userError.message);
      }

      if (countError) {
        throw new Error(countError.message);
      }

      setUsers((userData || []) as UserRecord[]);
      setTotalUsers(Number(countData || 0));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load administrator users."
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, supabase, verifyAdmin]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const submitSearch = () => {
    setPage(0);
    setSearch(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput("");
    setSearch("");
    setPage(0);
  };

  const updateAccountStatus = async (
    user: UserRecord,
    status: "active" | "suspended" | "closed"
  ) => {
    if (
      status === "closed" &&
      !window.confirm(
        `Close the account for ${
          displayName(user)
        }?\n\nThis action changes the account status to closed.`
      )
    ) {
      return;
    }

    setActionLoading(true);
    clearMessages();

    try {
      const { data, error: rpcError } =
        await supabase.rpc("admin_set_account_status", {
          p_user_id: user.user_id,
          p_status: status,
        });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (!data?.success) {
        throw new Error(
          data?.message || "Unable to update account status."
        );
      }

      setSuccess(
        `Account status updated to ${accountStatusLabel(status)}.`
      );

      setStatusMenuUser(null);

      await loadUsers();

      setSelectedUser((current) => {
        if (!current || current.user_id !== user.user_id) {
          return current;
        }

        return {
          ...current,
          account_status: status,
        };
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update account status."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const updateVerificationStatus = async (
    user: UserRecord,
    status:
      | "unverified"
      | "pending"
      | "verified"
      | "rejected"
  ) => {
    setActionLoading(true);
    clearMessages();

    try {
      const { data, error: rpcError } =
        await supabase.rpc("admin_set_verification_status", {
          p_user_id: user.user_id,
          p_status: status,
        });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (!data?.success) {
        throw new Error(
          data?.message ||
            "Unable to update verification status."
        );
      }

      setSuccess(
        `Verification status updated to ${verificationStatusLabel(
          status
        )}.`
      );

      setVerificationMenuUser(null);

      await loadUsers();

      setSelectedUser((current) => {
        if (!current || current.user_id !== user.user_id) {
          return current;
        }

        return {
          ...current,
          verification_status: status,
        };
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update verification status."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const statistics = useMemo(() => {
    const active = users.filter(
      (user) => user.account_status === "active"
    ).length;

    const suspended = users.filter(
      (user) => user.account_status === "suspended"
    ).length;

    const verified = users.filter(
      (user) => user.verification_status === "verified"
    ).length;

    const pending = users.filter(
      (user) => user.verification_status === "pending"
    ).length;

    return {
      active,
      suspended,
      verified,
      pending,
    };
  }, [users]);

  const goToPreviousPage = () => {
    setPage((current) => Math.max(0, current - 1));
  };

  const goToNextPage = () => {
    setPage((current) =>
      Math.min(totalPages - 1, current + 1)
    );
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading && users.length === 0) {
    return (
      <main className="users-loading-screen">
        <div className="users-loader" />
        <p>Loading administrator users...</p>
      </main>
    );
  }

  return (
    <main className="admin-users-app">
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

      <section className="admin-users-main">
        <header className="users-topbar">
          <div>
            <span className="users-breadcrumb">
              ADMINISTRATION / USERS
            </span>

            <h1>User Management</h1>

            <p>
              Search, review and manage registered exchange
              accounts.
            </p>
          </div>

          <div className="users-topbar-actions">
            <button
              type="button"
              className="users-refresh"
              onClick={loadUsers}
              disabled={loading}
            >
              ↻ {loading ? "Refreshing..." : "Refresh"}
            </button>

            <div className="users-admin-profile">
              <div className="users-admin-avatar">
                A
              </div>

              <div>
                <strong>Administrator</strong>
                <span>System Admin</span>
              </div>
            </div>
          </div>
        </header>

        {/* MESSAGES */}

        {error && (
          <div className="users-alert users-alert-error">
            <span className="alert-icon">!</span>

            <div>
              <strong>Action failed</strong>
              <span>{error}</span>
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
          <div className="users-alert users-alert-success">
            <span className="alert-icon">✓</span>

            <div>
              <strong>Action completed</strong>
              <span>{success}</span>
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

        {/* STATISTICS */}

        <section className="users-stat-grid">
          <div className="users-stat-card">
            <div className="users-stat-icon">◉</div>

            <div>
              <span>ALL USERS</span>
              <strong>{totalUsers}</strong>
              <small>Registered accounts</small>
            </div>
          </div>

          <div className="users-stat-card">
            <div className="users-stat-icon success">
              ✓
            </div>

            <div>
              <span>ACTIVE ON PAGE</span>
              <strong>{statistics.active}</strong>
              <small>Currently active</small>
            </div>
          </div>

          <div className="users-stat-card">
            <div className="users-stat-icon warning">
              ◌
            </div>

            <div>
              <span>PENDING VERIFICATION</span>
              <strong>{statistics.pending}</strong>
              <small>On current page</small>
            </div>
          </div>

          <div className="users-stat-card">
            <div className="users-stat-icon gold">
              ✓
            </div>

            <div>
              <span>VERIFIED ON PAGE</span>
              <strong>{statistics.verified}</strong>
              <small>Verified accounts</small>
            </div>
          </div>
        </section>

        {/* SEARCH */}

        <section className="users-toolbar">
          <div className="users-search-area">
            <span className="users-search-icon">
              ⌕
            </span>

            <input
              type="text"
              value={searchInput}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitSearch();
                }
              }}
              placeholder="Search account ID, username, name or email..."
            />

            {searchInput && (
              <button
                type="button"
                className="search-clear"
                onClick={clearSearch}
              >
                ×
              </button>
            )}

            <button
              type="button"
              className="users-search-button"
              onClick={submitSearch}
            >
              Search
            </button>
          </div>

          {search && (
            <div className="active-search">
              <span>
                Searching for <strong>"{search}"</strong>
              </span>

              <button
                type="button"
                onClick={clearSearch}
              >
                Clear
              </button>
            </div>
          )}
        </section>

        {/* TABLE PANEL */}

        <section className="users-panel">
          <div className="users-panel-header">
            <div>
              <span>ACCOUNT DIRECTORY</span>

              <h2>Registered Users</h2>

              <p>
                Administrative account management and status
                controls.
              </p>
            </div>

            <div className="users-result-count">
              {totalUsers === 0
                ? "No users"
                : `${pageStart}–${pageEnd} of ${totalUsers}`}
            </div>
          </div>

          <div className="users-table-wrap">
            {users.length === 0 ? (
              <div className="users-empty">
                <div className="empty-icon">◉</div>

                <h3>
                  {search
                    ? "No matching users"
                    : "No registered users"}
                </h3>

                <p>
                  {search
                    ? "Try a different search term or clear the search."
                    : "User accounts will appear here once they are registered."}
                </p>

                {search && (
                  <button
                    type="button"
                    onClick={clearSearch}
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <table className="users-table">
                <thead>
                  <tr>
                    <th>USER</th>
                    <th>ACCOUNT ID</th>
                    <th>STATUS</th>
                    <th>VERIFICATION</th>
                    <th>CCT BALANCE</th>
                    <th>REGISTERED</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr key={user.user_id}>
                      {/* USER */}

                      <td>
                        <button
                          type="button"
                          className="user-identity"
                          onClick={() =>
                            setSelectedUser(user)
                          }
                        >
                          <span className="user-avatar">
                            {getInitials(user)}
                          </span>

                          <span className="user-identity-copy">
                            <strong>
                              {displayName(user)}
                            </strong>

                            <small>
                              {user.email || "No email"}
                            </small>
                          </span>
                        </button>
                      </td>

                      {/* ACCOUNT ID */}

                      <td>
                        <span className="account-id">
                          {user.account_id || "—"}
                        </span>
                      </td>

                      {/* STATUS */}

                      <td>
                        <div className="status-control">
                          <button
                            type="button"
                            className={`status-pill account-status-${user.account_status}`}
                            onClick={() =>
                              setStatusMenuUser(
                                statusMenuUser ===
                                  user.user_id
                                  ? null
                                  : user.user_id
                              )
                            }
                          >
                            <span />
                            {accountStatusLabel(
                              user.account_status
                            )}
                            <b>⌄</b>
                          </button>

                          {statusMenuUser ===
                            user.user_id && (
                            <div className="status-menu">
                              <button
                                type="button"
                                onClick={() =>
                                  updateAccountStatus(
                                    user,
                                    "active"
                                  )
                                }
                                disabled={actionLoading}
                              >
                                <span className="menu-dot active" />
                                Activate account
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateAccountStatus(
                                    user,
                                    "suspended"
                                  )
                                }
                                disabled={actionLoading}
                              >
                                <span className="menu-dot suspended" />
                                Suspend account
                              </button>

                              <button
                                type="button"
                                className="danger"
                                onClick={() =>
                                  updateAccountStatus(
                                    user,
                                    "closed"
                                  )
                                }
                                disabled={actionLoading}
                              >
                                <span className="menu-dot closed" />
                                Close account
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* VERIFICATION */}

                      <td>
                        <div className="status-control">
                          <button
                            type="button"
                            className={`verification-pill verification-${user.verification_status}`}
                            onClick={() =>
                              setVerificationMenuUser(
                                verificationMenuUser ===
                                  user.user_id
                                  ? null
                                  : user.user_id
                              )
                            }
                          >
                            <span>
                              {user.verification_status ===
                              "verified"
                                ? "✓"
                                : user.verification_status ===
                                  "pending"
                                ? "◌"
                                : user.verification_status ===
                                  "rejected"
                                ? "!"
                                : "○"}
                            </span>

                            {verificationStatusLabel(
                              user.verification_status
                            )}

                            <b>⌄</b>
                          </button>

                          {verificationMenuUser ===
                            user.user_id && (
                            <div className="status-menu verification-menu">
                              <button
                                type="button"
                                onClick={() =>
                                  updateVerificationStatus(
                                    user,
                                    "unverified"
                                  )
                                }
                                disabled={actionLoading}
                              >
                                ○ Mark unverified
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateVerificationStatus(
                                    user,
                                    "pending"
                                  )
                                }
                                disabled={actionLoading}
                              >
                                ◌ Mark pending
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  updateVerificationStatus(
                                    user,
                                    "verified"
                                  )
                                }
                                disabled={actionLoading}
                              >
                                ✓ Mark verified
                              </button>

                              <button
                                type="button"
                                className="danger"
                                onClick={() =>
                                  updateVerificationStatus(
                                    user,
                                    "rejected"
                                  )
                                }
                                disabled={actionLoading}
                              >
                                ! Mark rejected
                              </button>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* BALANCE */}

                      <td>
                        <div className="balance-cell">
                          <strong>
                            {formatBalance(
                              user.available_balance
                            )}{" "}
                            CCT
                          </strong>

                          <small>
                            Locked:{" "}
                            {formatBalance(
                              user.locked_balance
                            )}
                          </small>
                        </div>
                      </td>

                      {/* CREATED */}

                      <td>
                        <span className="created-date">
                          {formatDate(user.created_at)}
                        </span>
                      </td>

                      {/* ACTIONS */}

                      <td>
                        <button
                          type="button"
                          className="view-user-button"
                          onClick={() =>
                            setSelectedUser(user)
                          }
                        >
                          View
                          <span>→</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* PAGINATION */}

          {totalUsers > 0 && (
            <div className="users-pagination">
              <span>
                Showing{" "}
                <strong>
                  {pageStart}–{pageEnd}
                </strong>{" "}
                of <strong>{totalUsers}</strong> users
              </span>

              <div className="pagination-controls">
                <button
                  type="button"
                  onClick={goToPreviousPage}
                  disabled={page === 0 || loading}
                >
                  ← Previous
                </button>

                <div className="page-indicator">
                  <span>PAGE</span>
                  <strong>{page + 1}</strong>
                  <small>OF {totalPages}</small>
                </div>

                <button
                  type="button"
                  onClick={goToNextPage}
                  disabled={
                    page >= totalPages - 1 || loading
                  }
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </section>
      </section>

      {/* USER DETAILS DRAWER */}

      {selectedUser && (
        <>
          <button
            type="button"
            className="user-drawer-overlay"
            aria-label="Close user details"
            onClick={() => setSelectedUser(null)}
          />

          <aside className="user-drawer">
            <div className="drawer-header">
              <div>
                <span>USER PROFILE</span>
                <h2>Account Details</h2>
              </div>

              <button
                type="button"
                className="drawer-close"
                onClick={() => setSelectedUser(null)}
              >
                ×
              </button>
            </div>

            <div className="drawer-user">
              <div className="drawer-avatar">
                {getInitials(selectedUser)}
              </div>

              <div>
                <h3>{displayName(selectedUser)}</h3>
                <p>
                  {selectedUser.email || "No email address"}
                </p>
              </div>
            </div>

            <div className="drawer-status-row">
              <span
                className={`status-pill account-status-${selectedUser.account_status}`}
              >
                <span />
                {accountStatusLabel(
                  selectedUser.account_status
                )}
              </span>

              <span
                className={`verification-pill verification-${selectedUser.verification_status}`}
              >
                {selectedUser.verification_status ===
                "verified"
                  ? "✓"
                  : selectedUser.verification_status ===
                    "pending"
                  ? "◌"
                  : selectedUser.verification_status ===
                    "rejected"
                  ? "!"
                  : "○"}{" "}
                {verificationStatusLabel(
                  selectedUser.verification_status
                )}
              </span>
            </div>

            <div className="drawer-section">
              <span className="drawer-section-label">
                ACCOUNT INFORMATION
              </span>

              <div className="drawer-info-list">
                <div>
                  <span>Account ID</span>
                  <strong>
                    {selectedUser.account_id || "—"}
                  </strong>
                </div>

                <div>
                  <span>User ID</span>
                  <strong className="drawer-mono">
                    {selectedUser.user_id}
                  </strong>
                </div>

                <div>
                  <span>Username</span>
                  <strong>
                    {selectedUser.username || "—"}
                  </strong>
                </div>

                <div>
                  <span>Full name</span>
                  <strong>
                    {selectedUser.full_name || "—"}
                  </strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>
                    {selectedUser.email || "—"}
                  </strong>
                </div>

                <div>
                  <span>Registered</span>
                  <strong>
                    {formatDate(selectedUser.created_at)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="drawer-section">
              <span className="drawer-section-label">
                CCT WALLET
              </span>

              <div className="drawer-balance-grid">
                <div>
                  <span>AVAILABLE</span>
                  <strong>
                    {formatBalance(
                      selectedUser.available_balance
                    )}
                  </strong>
                  <small>CCT</small>
                </div>

                <div>
                  <span>LOCKED</span>
                  <strong>
                    {formatBalance(
                      selectedUser.locked_balance
                    )}
                  </strong>
                  <small>CCT</small>
                </div>
              </div>
            </div>

            <div className="drawer-section">
              <span className="drawer-section-label">
                ACCOUNT ACTIONS
              </span>

              <div className="drawer-actions">
                <button
                  type="button"
                  className="drawer-action blue"
                  onClick={() =>
                    updateAccountStatus(
                      selectedUser,
                      "active"
                    )
                  }
                  disabled={actionLoading}
                >
                  <span>✓</span>
                  Activate account
                </button>

                <button
                  type="button"
                  className="drawer-action warning"
                  onClick={() =>
                    updateAccountStatus(
                      selectedUser,
                      "suspended"
                    )
                  }
                  disabled={actionLoading}
                >
                  <span>◌</span>
                  Suspend account
                </button>

                <button
                  type="button"
                  className="drawer-action gold"
                  onClick={() =>
                    updateVerificationStatus(
                      selectedUser,
                      "verified"
                    )
                  }
                  disabled={actionLoading}
                >
                  <span>✓</span>
                  Mark verified
                </button>

                <button
                  type="button"
                  className="drawer-action danger"
                  onClick={() =>
                    updateAccountStatus(
                      selectedUser,
                      "closed"
                    )
                  }
                  disabled={actionLoading}
                >
                  <span>×</span>
                  Close account
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </main>
  );
}
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import "./admin.css";

type Dashboard = {
  total_users: number;
  verified_users: number;
  pending_verifications: number;
  suspended_users: number;
  pending_deposits: number;
  pending_withdrawals: number;
  total_cct_available: number;
  total_cct_locked: number;
  active_investments: number;
};

const emptyDashboard: Dashboard = {
  total_users: 0,
  verified_users: 0,
  pending_verifications: 0,
  suspended_users: 0,
  pending_deposits: 0,
  pending_withdrawals: 0,
  total_cct_available: 0,
  total_cct_locked: 0,
  active_investments: 0,
};

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

const quickActions = [
  {
    title: "Manage Users",
    description: "Search accounts, suspend users and manage verification.",
    href: "/admin/users",
    icon: "◉",
  },
  {
    title: "Balance Management",
    description: "Add funds, subtract funds or issue user bonuses.",
    href: "/admin/balances",
    icon: "◆",
  },
  {
    title: "Deposit Management",
    description: "Review incoming deposit requests.",
    href: "/admin/deposits",
    icon: "↓",
  },
  {
    title: "Withdrawal Management",
    description: "Review and process withdrawal requests.",
    href: "/admin/withdrawals",
    icon: "↑",
  },
  {
    title: "Wallet Configuration",
    description: "Configure supported deposit wallets and networks.",
    href: "/admin/wallets",
    icon: "▣",
  },
  {
    title: "Transaction Ledger",
    description: "Inspect financial activity across the platform.",
    href: "/admin/transactions",
    icon: "≡",
  },
];

export default function AdminPage() {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const [dashboard, setDashboard] =
    useState<Dashboard>(emptyDashboard);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatNumber = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(Number(value || 0));

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: isAdmin, error: adminError } =
        await supabase.rpc("is_admin");

      if (adminError) {
        throw new Error(adminError.message);
      }

      if (!isAdmin) {
        router.replace("/dashboard");
        return;
      }

      const { data, error: dashboardError } =
        await supabase.rpc("get_admin_dashboard");

      if (dashboardError) {
        throw new Error(dashboardError.message);
      }

      setDashboard(data || emptyDashboard);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load administrator dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <main className="admin-loading-screen">
        <div className="admin-loader" />
        <p>Loading administrator console...</p>
      </main>
    );
  }

  return (
    <main className="admin-app">

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


      {/* MAIN CONTENT */}

      <section className="admin-main">

        <header className="admin-topbar">

          <div>
            <span className="admin-breadcrumb">
              ADMINISTRATION / DASHBOARD
            </span>

            <h1>Control Center</h1>

            <p>
              Monitor and manage the Crypto-Com Exchange platform.
            </p>
          </div>

          <div className="admin-topbar-actions">

            <button
              type="button"
              className="admin-refresh"
              onClick={loadDashboard}
            >
              ↻ Refresh
            </button>

            <div className="admin-profile">
              <div className="admin-profile-avatar">
                A
              </div>

              <div>
                <strong>Administrator</strong>
                <span>System Admin</span>
              </div>
            </div>

          </div>

        </header>


        {error && (
          <div className="admin-error">
            <strong>Dashboard Error</strong>
            <span>{error}</span>
          </div>
        )}


        {/* OVERVIEW */}

        <section className="admin-overview">

          <div className="admin-stat-card">

            <div className="stat-card-top">
              <span>TOTAL USERS</span>
              <div className="stat-icon">◉</div>
            </div>

            <strong>{dashboard.total_users}</strong>

            <p>
              Registered platform accounts
            </p>

            <Link href="/admin/users">
              View users →
            </Link>

          </div>


          <div className="admin-stat-card">

            <div className="stat-card-top">
              <span>VERIFIED USERS</span>
              <div className="stat-icon">✓</div>
            </div>

            <strong>{dashboard.verified_users}</strong>

            <p>
              Verified accounts
            </p>

            <Link href="/admin/verification">
              Review verification →
            </Link>

          </div>


          <div className="admin-stat-card">

            <div className="stat-card-top">
              <span>PENDING DEPOSITS</span>
              <div className="stat-icon">↓</div>
            </div>

            <strong>{dashboard.pending_deposits}</strong>

            <p>
              Deposit requests awaiting action
            </p>

            <Link href="/admin/deposits">
              Manage deposits →
            </Link>

          </div>


          <div className="admin-stat-card">

            <div className="stat-card-top">
              <span>PENDING WITHDRAWALS</span>
              <div className="stat-icon">↑</div>
            </div>

            <strong>{dashboard.pending_withdrawals}</strong>

            <p>
              Withdrawal requests awaiting action
            </p>

            <Link href="/admin/withdrawals">
              Manage withdrawals →
            </Link>

          </div>


          <div className="admin-stat-card featured">

            <div className="stat-card-top">
              <span>AVAILABLE CCT</span>
              <div className="stat-icon">C</div>
            </div>

            <strong>
              {formatNumber(dashboard.total_cct_available)}
            </strong>

            <p>
              Total available user balance
            </p>

            <Link href="/admin/balances">
              Manage balances →
            </Link>

          </div>


          <div className="admin-stat-card">

            <div className="stat-card-top">
              <span>LOCKED CCT</span>
              <div className="stat-icon">◆</div>
            </div>

            <strong>
              {formatNumber(dashboard.total_cct_locked)}
            </strong>

            <p>
              Funds currently locked
            </p>

            <Link href="/admin/transactions">
              View ledger →
            </Link>

          </div>

        </section>


        {/* QUICK ACTIONS */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>
              <span>ADMINISTRATION</span>
              <h2>Management Modules</h2>
              <p>
                Select a module to manage that area of the exchange.
              </p>
            </div>

          </div>


          <div className="admin-module-grid">

            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="admin-module-card"
              >

                <div className="module-icon">
                  {action.icon}
                </div>

                <div className="module-content">
                  <h3>{action.title}</h3>
                  <p>{action.description}</p>
                </div>

                <span className="module-arrow">
                  →
                </span>

              </Link>
            ))}

          </div>

        </section>


        {/* PLATFORM SUMMARY */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>
              <span>PLATFORM</span>
              <h2>System Summary</h2>
              <p>
                High-level information about the current platform state.
              </p>
            </div>

          </div>


          <div className="system-summary-grid">

            <Link
              href="/admin/investments"
              className="system-summary-card"
            >
              <div>
                <span>ACTIVE INVESTMENTS</span>
                <strong>
                  {dashboard.active_investments}
                </strong>
              </div>

              <span>Manage →</span>
            </Link>


            <Link
              href="/admin/verification"
              className="system-summary-card"
            >
              <div>
                <span>PENDING VERIFICATION</span>
                <strong>
                  {dashboard.pending_verifications}
                </strong>
              </div>

              <span>Review →</span>
            </Link>


            <Link
              href="/admin/users"
              className="system-summary-card"
            >
              <div>
                <span>SUSPENDED ACCOUNTS</span>
                <strong>
                  {dashboard.suspended_users}
                </strong>
              </div>

              <span>Manage →</span>
            </Link>

          </div>

        </section>


        {/* DEDICATED MODULE DIRECTORY */}

        <section className="admin-section">

          <div className="admin-section-header">

            <div>
              <span>ALL MODULES</span>
              <h2>Administration Directory</h2>
              <p>
                Every administrative function has its own dedicated
                workspace.
              </p>
            </div>

          </div>


          <div className="admin-directory">

            {navigation
              .filter((item) => item.href !== "/admin")
              .map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  className="directory-item"
                >

                  <span className="directory-icon">
                    {item.icon}
                  </span>

                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </div>

                  <span className="directory-arrow">
                    →
                  </span>

                </Link>
              ))}

          </div>

        </section>

      </section>

    </main>
  );
}
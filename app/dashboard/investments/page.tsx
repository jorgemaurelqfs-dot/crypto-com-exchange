"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "../dashboard.css";
import BrandLogo from "../../../components/BrandLogo";
import { createClient } from "../../../lib/supabase/client";

type Profile = {
  id: string;
  account_id: string;
  username: string | null;
  full_name: string | null;
  account_status: string;
  verification_status: string;
};

type Wallet = {
  available_balance: number | string;
  locked_balance: number | string;
};

type InvestmentPlan = {
  id: string;
  name: string;
  description: string | null;
  asset_symbol: string;
  minimum_amount: number | string;
  maximum_amount: number | string | null;
  duration_days: number;
  profit_rate: number | string;
  enabled: boolean;
};

type Investment = {
  id: string;
  reference: string;
  plan_id: string;
  asset_symbol: string;
  principal_amount: number | string;
  profit_rate: number | string;
  expected_profit: number | string;
  earned_profit: number | string;
  status: string;
  started_at: string | null;
  maturity_at: string | null;
  completed_at: string | null;
  created_at: string;

  // Supabase returns the related investment plan
  // as an array for this relationship.
  investment_plans?: {
    name: string;
    duration_days: number;
  }[] | null;
};

function formatAmount(value: number | string | null | undefined) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(amount);
}

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "$0.00";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Pending";

    case "active":
      return "Active";

    case "completed":
      return "Completed";

    case "cancelled":
      return "Cancelled";

    default:
      return status;
  }
}

function statusClass(status: string) {
  switch (status) {
    case "active":
      return "investment-status-active";

    case "completed":
      return "investment-status-completed";

    case "pending":
      return "investment-status-pending";

    case "cancelled":
      return "investment-status-cancelled";

    default:
      return "";
  }
}

function calculateProgress(
  startedAt: string | null,
  maturityAt: string | null,
) {
  if (!startedAt || !maturityAt) {
    return 0;
  }

  const start = new Date(startedAt).getTime();
  const maturity = new Date(maturityAt).getTime();
  const now = Date.now();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(maturity) ||
    maturity <= start
  ) {
    return 0;
  }

  if (now <= start) {
    return 0;
  }

  if (now >= maturity) {
    return 100;
  }

  return Math.min(
    100,
    Math.max(
      0,
      ((now - start) / (maturity - start)) * 100,
    ),
  );
}

export default function InvestmentsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [plans, setPlans] = useState<InvestmentPlan[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [amount, setAmount] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedPlan = useMemo(() => {
    return (
      plans.find((plan) => plan.id === selectedPlanId) ?? null
    );
  }, [plans, selectedPlanId]);

  const availableBalance = Number(
    wallet?.available_balance ?? 0,
  );

  const lockedBalance = Number(
    wallet?.locked_balance ?? 0,
  );

  const enteredAmount = Number(amount);

  const expectedProfit =
    selectedPlan &&
    Number.isFinite(enteredAmount) &&
    enteredAmount > 0
      ? (enteredAmount *
          Number(selectedPlan.profit_rate)) /
        100
      : 0;

  const projectedTotal =
    Number.isFinite(enteredAmount) && enteredAmount > 0
      ? enteredAmount + expectedProfit
      : 0;

  const activeInvestments = investments.filter(
    (investment) => investment.status === "active",
  );

  const totalInvested = investments.reduce(
    (total, investment) =>
      total + Number(investment.principal_amount || 0),
    0,
  );

  async function loadDashboard() {
    setLoading(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    const [
      profileResult,
      walletResult,
      plansResult,
      investmentsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          `
            id,
            account_id,
            username,
            full_name,
            account_status,
            verification_status
          `,
        )
        .eq("id", session.user.id)
        .single(),

      supabase
        .from("cct_wallets")
        .select(
          `
            available_balance,
            locked_balance
          `,
        )
        .eq("user_id", session.user.id)
        .single(),

      supabase
        .from("investment_plans")
        .select(
          `
            id,
            name,
            description,
            asset_symbol,
            minimum_amount,
            maximum_amount,
            duration_days,
            profit_rate,
            enabled
          `,
        )
        .eq("enabled", true)
        .order("duration_days", {
          ascending: true,
        }),

      supabase
        .from("investments")
        .select(
          `
            id,
            reference,
            plan_id,
            asset_symbol,
            principal_amount,
            profit_rate,
            expected_profit,
            earned_profit,
            status,
            started_at,
            maturity_at,
            completed_at,
            created_at,
            investment_plans (
              name,
              duration_days
            )
          `,
        )
        .eq("user_id", session.user.id)
        .order("created_at", {
          ascending: false,
        }),
    ]);

    if (profileResult.error) {
      setError(profileResult.error.message);
    } else {
      setProfile(profileResult.data as Profile);
    }

    if (walletResult.error) {
      setError(walletResult.error.message);
    } else {
      setWallet(walletResult.data as Wallet);
    }

    if (plansResult.error) {
      setError(plansResult.error.message);
    } else {
      const availablePlans =
        (plansResult.data ?? []) as InvestmentPlan[];

      setPlans(availablePlans);

      if (
        availablePlans.length > 0 &&
        !availablePlans.some(
          (plan) => plan.id === selectedPlanId,
        )
      ) {
        setSelectedPlanId(availablePlans[0].id);
      }
    }

    if (investmentsResult.error) {
      setError(investmentsResult.error.message);
    } else {
      setInvestments(
        (investmentsResult.data ?? []) as Investment[],
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleInvest(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setError("");
    setSuccess("");

    if (!selectedPlan) {
      setError("Please select an investment plan.");
      return;
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setError("Enter a valid investment amount.");
      return;
    }

    const minimum = Number(
      selectedPlan.minimum_amount,
    );

    const maximum =
      selectedPlan.maximum_amount === null ||
      selectedPlan.maximum_amount === undefined ||
      selectedPlan.maximum_amount === ""
        ? null
        : Number(selectedPlan.maximum_amount);

    if (numericAmount < minimum) {
      setError(
        "The minimum amount for " +
          selectedPlan.name +
          " is " +
          formatAmount(minimum) +
          " CCT.",
      );
      return;
    }

    if (
      maximum !== null &&
      Number.isFinite(maximum) &&
      numericAmount > maximum
    ) {
      setError(
        "The maximum amount for " +
          selectedPlan.name +
          " is " +
          formatAmount(maximum) +
          " CCT.",
      );
      return;
    }

    if (numericAmount > availableBalance) {
      setError(
        "Insufficient available CCT balance. You currently have " +
          formatAmount(availableBalance) +
          " CCT available.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data, error: rpcError } =
        await supabase.rpc("invest_cct", {
          p_plan_id: selectedPlan.id,
          p_amount: numericAmount,
        });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      if (
        data &&
        typeof data === "object" &&
        "success" in data &&
        data.success === false
      ) {
        const message =
          "message" in data
            ? String(data.message)
            : "Investment could not be created.";

        throw new Error(message);
      }

      setAmount("");

      setSuccess(
        "Your CCT investment has been created successfully.",
      );

      await loadDashboard();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to create investment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function useMaximumAmount() {
    if (!selectedPlan) {
      return;
    }

    const planMaximum =
      selectedPlan.maximum_amount === null ||
      selectedPlan.maximum_amount === undefined
        ? null
        : Number(selectedPlan.maximum_amount);

    const usableMaximum =
      planMaximum === null
        ? availableBalance
        : Math.min(
            availableBalance,
            planMaximum,
          );

    if (usableMaximum > 0) {
      setAmount(String(usableMaximum));
    }
  }

  function selectPlan(planId: string) {
    setSelectedPlanId(planId);
    setError("");
    setSuccess("");
    setAmount("");
  }

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
          <p>Loading investment center...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
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
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`dashboard-sidebar ${
          sidebarOpen ? "open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <BrandLogo compact />

          <button
            type="button"
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            ×
          </button>
        </div>

        <div className="account-mini-card">
          <div className="mini-avatar">
            {(
              profile?.full_name?.charAt(0) ||
              profile?.username?.charAt(0) ||
              "U"
            ).toUpperCase()}
          </div>

          <div className="mini-account-info">
            <strong>
              {profile?.full_name ||
                profile?.username ||
                "Account Holder"}
            </strong>

            <span>
              {profile?.account_id || "CCT Account"}
            </span>
          </div>

          <span className="online-indicator" />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Platform</div>

          <nav className="sidebar-menu">
            <Link
              href="/dashboard"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">⌂</span>
              <span className="menu-label">Overview</span>
            </Link>

            <Link
              href="/dashboard/wallet"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">◈</span>
              <span className="menu-label">Wallet</span>
            </Link>

            <Link
              href="/dashboard/transactions"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">▤</span>
              <span className="menu-label">Transactions</span>
            </Link>

            <Link
              href="/dashboard/transfer"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">⇄</span>
              <span className="menu-label">Transfer</span>
            </Link>

            <Link
              href="/dashboard/deposit"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">↓</span>
              <span className="menu-label">Deposit</span>
            </Link>

            <Link
              href="/dashboard/withdraw"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">↑</span>
              <span className="menu-label">Withdraw</span>
            </Link>

            <Link
              href="/dashboard/investments"
              className="sidebar-menu-item active"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">◒</span>
              <span className="menu-label">
                Investments
              </span>
              <span className="active-indicator" />
            </Link>

            <Link
              href="/dashboard/markets"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">⌁</span>
              <span className="menu-label">Markets</span>
            </Link>

            <Link
              href="/dashboard/swap"
              className="sidebar-menu-item"
              onClick={() => setSidebarOpen(false)}
            >
              <span className="menu-icon">⇄</span>
              <span className="menu-label">Swap</span>
            </Link>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <Link
            href="/dashboard/settings"
            className="sidebar-menu-item settings-item"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="menu-icon">⚙</span>
            <span className="menu-label">Settings</span>
          </Link>

          <button
            type="button"
            className="sidebar-menu-item logout-button"
            onClick={signOut}
          >
            <span className="menu-icon">↪</span>
            <span className="menu-label">Sign out</span>
          </button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <button
              type="button"
              className="mobile-menu"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <span />
              <span />
              <span />
            </button>

            <div>
              <div className="header-eyebrow">
                CCT WEALTH MANAGEMENT
              </div>

              <h1>Investments</h1>
            </div>
          </div>

          <div className="header-actions">
            <div className="header-account">
              <div className="account-info">
                <strong>
                  {profile?.full_name ||
                    profile?.username ||
                    "Account Holder"}
                </strong>

                <span>{profile?.account_id}</span>
              </div>

              <div className="account-avatar">
                {(
                  profile?.full_name?.charAt(0) ||
                  profile?.username?.charAt(0) ||
                  "U"
                ).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="investment-welcome">
            <div className="investment-welcome-content">
              <span className="welcome-tag">
                CCT INVESTMENT CENTER
              </span>

              <h2>Put your CCT to work.</h2>

              <p>
                Choose an available investment plan and
                allocate CCT from your available balance.
                Your investment remains protected by the
                platform&apos;s secure accounting workflow.
              </p>
            </div>

            <div className="investment-balance-card">
              <span>AVAILABLE CCT</span>

              <strong>
                {formatAmount(availableBalance)}
              </strong>

              <small>
                Reference value{" "}
                {formatCurrency(availableBalance)}
              </small>
            </div>
          </section>

          {(error || success) && (
            <div
              className={`deposit-alert ${
                error ? "error" : "success"
              }`}
              role="alert"
            >
              <strong>
                {error
                  ? "Unable to continue"
                  : "Investment created"}
              </strong>

              <span>{error || success}</span>
            </div>
          )}

          <section className="investment-stats-grid">
            <div className="investment-stat-card">
              <span className="investment-stat-icon">
                ◈
              </span>

              <div>
                <small>Available balance</small>

                <strong>
                  {formatAmount(availableBalance)} CCT
                </strong>
              </div>
            </div>

            <div className="investment-stat-card">
              <span className="investment-stat-icon">
                ◒
              </span>

              <div>
                <small>Locked balance</small>

                <strong>
                  {formatAmount(lockedBalance)} CCT
                </strong>
              </div>
            </div>

            <div className="investment-stat-card">
              <span className="investment-stat-icon">
                ↗
              </span>

              <div>
                <small>Total invested</small>

                <strong>
                  {formatAmount(totalInvested)} CCT
                </strong>
              </div>
            </div>

            <div className="investment-stat-card">
              <span className="investment-stat-icon">
                ●
              </span>

              <div>
                <small>Active investments</small>

                <strong>
                  {activeInvestments.length}
                </strong>
              </div>
            </div>
          </section>

          <div className="investment-workspace">
            <section className="investment-plans-card">
              <div className="investment-section-heading">
                <div>
                  <span className="section-eyebrow">
                    AVAILABLE PLANS
                  </span>

                  <h3>Choose an investment plan</h3>
                </div>

                <span className="plan-count">
                  {plans.length} available
                </span>
              </div>

              {plans.length === 0 ? (
                <div className="investment-empty">
                  <div>◒</div>

                  <h4>No investment plans available</h4>

                  <p>
                    Investment plans will appear here when
                    they are enabled.
                  </p>
                </div>
              ) : (
                <div className="investment-plan-grid">
                  {plans.map((plan) => {
                    const isSelected =
                      selectedPlanId === plan.id;

                    const planMaximum =
                      plan.maximum_amount === null ||
                      plan.maximum_amount === undefined
                        ? null
                        : Number(
                            plan.maximum_amount,
                          );

                    return (
                      <button
                        type="button"
                        key={plan.id}
                        className={`investment-plan-card ${
                          isSelected ? "selected" : ""
                        }`}
                        onClick={() =>
                          selectPlan(plan.id)
                        }
                      >
                        <div className="investment-plan-top">
                          <span className="investment-plan-icon">
                            ◒
                          </span>

                          {isSelected && (
                            <span className="investment-plan-check">
                              ✓
                            </span>
                          )}
                        </div>

                        <h4>{plan.name}</h4>

                        <p>
                          {plan.description ||
                            "A structured CCT investment plan."}
                        </p>

                        <div className="investment-plan-highlight">
                          <span>
                            {plan.duration_days} days
                          </span>

                          <strong>
                            {formatAmount(
                              plan.profit_rate,
                            )}
                            %
                          </strong>
                        </div>

                        <div className="investment-plan-details">
                          <div>
                            <span>Minimum</span>

                            <strong>
                              {formatAmount(
                                plan.minimum_amount,
                              )}{" "}
                              CCT
                            </strong>
                          </div>

                          <div>
                            <span>Maximum</span>

                            <strong>
                              {planMaximum === null
                                ? "No limit"
                                : `${formatAmount(
                                    planMaximum,
                                  )} CCT`}
                            </strong>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="investment-create-card">
              <div className="investment-section-heading compact">
                <div>
                  <span className="section-eyebrow">
                    CREATE INVESTMENT
                  </span>

                  <h3>Allocate CCT</h3>
                </div>

                <span className="investment-secure-badge">
                  ● Secure
                </span>
              </div>

              {selectedPlan ? (
                <>
                  <div className="selected-plan-summary">
                    <div className="selected-plan-symbol">
                      ◒
                    </div>

                    <div>
                      <strong>
                        {selectedPlan.name}
                      </strong>

                      <span>
                        {selectedPlan.duration_days} day
                        term
                      </span>
                    </div>
                  </div>

                  <form
                    className="investment-form"
                    onSubmit={handleInvest}
                  >
                    <div className="investment-field">
                      <div className="investment-field-heading">
                        <label htmlFor="investment-amount">
                          Investment amount
                        </label>

                        <button
                          type="button"
                          onClick={useMaximumAmount}
                        >
                          Use maximum
                        </button>
                      </div>

                      <div className="investment-amount-input">
                        <input
                          id="investment-amount"
                          type="number"
                          inputMode="decimal"
                          min={Number(
                            selectedPlan.minimum_amount,
                          )}
                          max={
                            selectedPlan.maximum_amount ===
                            null
                              ? undefined
                              : Number(
                                  selectedPlan.maximum_amount,
                                )
                          }
                          step="any"
                          placeholder="0.00"
                          value={amount}
                          onChange={(event) =>
                            setAmount(
                              event.target.value,
                            )
                          }
                        />

                        <span>CCT</span>
                      </div>

                      <div className="investment-range">
                        <span>
                          Min{" "}
                          {formatAmount(
                            selectedPlan.minimum_amount,
                          )}
                        </span>

                        <span>
                          Max{" "}
                          {selectedPlan.maximum_amount ===
                          null
                            ? "No limit"
                            : formatAmount(
                                selectedPlan.maximum_amount,
                              )}
                        </span>
                      </div>
                    </div>

                    <div className="investment-preview">
                      <div>
                        <span>Principal</span>

                        <strong>
                          {formatAmount(
                            enteredAmount,
                          )}{" "}
                          CCT
                        </strong>
                      </div>

                      <div>
                        <span>Profit rate</span>

                        <strong>
                          {formatAmount(
                            selectedPlan.profit_rate,
                          )}
                          %
                        </strong>
                      </div>

                      <div>
                        <span>Expected profit</span>

                        <strong className="profit-value">
                          +
                          {formatAmount(
                            expectedProfit,
                          )}{" "}
                          CCT
                        </strong>
                      </div>

                      <div className="investment-preview-total">
                        <span>Projected total</span>

                        <strong>
                          {formatAmount(
                            projectedTotal,
                          )}{" "}
                          CCT
                        </strong>
                      </div>
                    </div>

                    <div className="investment-note">
                      <span>i</span>

                      <p>
                        Your CCT will move from available
                        balance into locked investment
                        balance when the investment is
                        successfully created.
                      </p>
                    </div>

                    <button
                      type="submit"
                      className="investment-submit"
                      disabled={
                        submitting ||
                        !selectedPlan ||
                        enteredAmount <= 0
                      }
                    >
                      {submitting ? (
                        <>
                          <span className="button-spinner" />
                          Creating investment...
                        </>
                      ) : (
                        <>
                          Invest CCT
                          <span>→</span>
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="investment-create-empty">
                  <span>◒</span>

                  <p>
                    Select an investment plan to
                    continue.
                  </p>
                </div>
              )}
            </aside>
          </div>

          <section className="investment-history-section">
            <div className="investment-section-heading">
              <div>
                <span className="section-eyebrow">
                  INVESTMENT PORTFOLIO
                </span>

                <h3>Your investments</h3>
              </div>

              <span className="plan-count">
                {investments.length} investment
                {investments.length === 1 ? "" : "s"}
              </span>
            </div>

            {investments.length === 0 ? (
              <div className="investment-empty large">
                <div>◒</div>

                <h4>
                  Your investment portfolio is empty
                </h4>

                <p>
                  Select an investment plan above to
                  create your first CCT investment.
                </p>
              </div>
            ) : (
              <div className="investment-history-grid">
                {investments.map((investment) => {
                  const progress = calculateProgress(
                    investment.started_at,
                    investment.maturity_at,
                  );

                  const planName =
                    investment.investment_plans?.[0]?.name ||
                    "CCT Investment";

                  return (
                    <article
                      className="investment-history-card"
                      key={investment.id}
                    >
                      <div className="investment-history-top">
                        <div>
                          <span className="investment-reference">
                            {investment.reference}
                          </span>

                          <h4>{planName}</h4>
                        </div>

                        <span
                          className={`investment-status ${statusClass(
                            investment.status,
                          )}`}
                        >
                          {statusLabel(
                            investment.status,
                          )}
                        </span>
                      </div>

                      <div className="investment-history-amount">
                        <span>Principal</span>

                        <strong>
                          {formatAmount(
                            investment.principal_amount,
                          )}{" "}
                          {investment.asset_symbol}
                        </strong>
                      </div>

                      <div className="investment-history-metrics">
                        <div>
                          <span>Profit rate</span>

                          <strong>
                            {formatAmount(
                              investment.profit_rate,
                            )}
                            %
                          </strong>
                        </div>

                        <div>
                          <span>Expected profit</span>

                          <strong className="profit-value">
                            +
                            {formatAmount(
                              investment.expected_profit,
                            )}{" "}
                            CCT
                          </strong>
                        </div>

                        <div>
                          <span>Earned</span>

                          <strong>
                            {formatAmount(
                              investment.earned_profit,
                            )}{" "}
                            CCT
                          </strong>
                        </div>
                      </div>

                      <div className="investment-progress">
                        <div className="investment-progress-heading">
                          <span>
                            Investment progress
                          </span>

                          <strong>
                            {Math.round(progress)}%
                          </strong>
                        </div>

                        <div className="investment-progress-track">
                          <div
                            className="investment-progress-bar"
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="investment-history-dates">
                        <div>
                          <span>Started</span>

                          <strong>
                            {formatDate(
                              investment.started_at,
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>Maturity</span>

                          <strong>
                            {formatDate(
                              investment.maturity_at,
                            )}
                          </strong>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="investment-security-panel">
            <div className="investment-security-icon">
              ◆
            </div>

            <div>
              <span>SECURE CCT ACCOUNTING</span>

              <h3>
                Your investment is recorded on the
                platform ledger.
              </h3>

              <p>
                Investment creation is processed through
                the secure database function. The frontend
                does not directly modify your CCT wallet
                balance.
              </p>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

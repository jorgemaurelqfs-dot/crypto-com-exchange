"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AdminModule from "../AdminModule";
import { createClient } from "../../../lib/supabase/client";

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
  created_at: string;
  updated_at: string;
  investment_count: number | string;
  active_investment_count: number | string;
  total_principal: number | string;
};

type Investment = {
  id: string;
  reference: string;
  user_id: string;
  account_id: string | null;
  username: string | null;
  full_name: string | null;
  plan_id: string;
  plan_name: string | null;
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
  updated_at: string;
};

type PlanForm = {
  name: string;
  description: string;
  asset_symbol: string;
  minimum_amount: string;
  maximum_amount: string;
  duration_days: string;
  profit_rate: string;
  enabled: boolean;
};

const emptyPlanForm: PlanForm = {
  name: "",
  description: "",
  asset_symbol: "CCT",
  minimum_amount: "",
  maximum_amount: "",
  duration_days: "",
  profit_rate: "",
  enabled: true,
};

function formatAmount(
  value: number | string | null | undefined,
) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(amount);
}

function formatDate(value: string | null | undefined) {
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

function statusClass(status: string) {
  switch (status) {
    case "active":
      return "investment-admin-status active";

    case "completed":
      return "investment-admin-status completed";

    case "pending":
      return "investment-admin-status pending";

    case "cancelled":
      return "investment-admin-status cancelled";

    default:
      return "investment-admin-status";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "active":
      return "Active";

    case "completed":
      return "Completed";

    case "pending":
      return "Pending";

    case "cancelled":
      return "Cancelled";

    default:
      return status;
  }
}

function customerName(investment: Investment) {
  return (
    investment.full_name ||
    investment.username ||
    investment.account_id ||
    "Unknown customer"
  );
}

export default function AdminInvestmentsPage() {
  const supabase = createClient();

  const [plans, setPlans] = useState<InvestmentPlan[]>([]);
  const [investments, setInvestments] = useState<Investment[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [activeTab, setActiveTab] = useState<
    "plans" | "investments"
  >("plans");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] =
    useState<InvestmentPlan | null>(null);

  const [planForm, setPlanForm] =
    useState<PlanForm>(emptyPlanForm);

  const [savingPlan, setSavingPlan] = useState(false);

  const [selectedInvestment, setSelectedInvestment] =
    useState<Investment | null>(null);

  const [togglingPlanId, setTogglingPlanId] =
    useState<string | null>(null);

  async function loadData(showSpinner = true) {
    if (showSpinner) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError("");

    try {
      const [plansResult, investmentsResult] =
        await Promise.all([
          supabase.rpc("admin_get_investment_plans"),

          supabase.rpc("admin_get_investments"),
        ]);

      if (plansResult.error) {
        throw new Error(
          `Investment plans: ${plansResult.error.message}`,
        );
      }

      if (investmentsResult.error) {
        throw new Error(
          `Investments: ${investmentsResult.error.message}`,
        );
      }

      setPlans(
        (plansResult.data ?? []) as InvestmentPlan[],
      );

      setInvestments(
        (investmentsResult.data ?? []) as Investment[],
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load investment administration data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const enabledPlans = useMemo(
    () => plans.filter((plan) => plan.enabled),
    [plans],
  );

  const activeInvestments = useMemo(
    () =>
      investments.filter(
        (investment) => investment.status === "active",
      ),
    [investments],
  );

  const totalPrincipal = useMemo(
    () =>
      investments.reduce(
        (total, investment) =>
          total +
          Number(investment.principal_amount || 0),
        0,
      ),
    [investments],
  );

  const totalExpectedProfit = useMemo(
    () =>
      investments.reduce(
        (total, investment) =>
          total +
          Number(investment.expected_profit || 0),
        0,
      ),
    [investments],
  );

  const assets = useMemo(() => {
    return Array.from(
      new Set(
        investments
          .map((investment) => investment.asset_symbol)
          .filter(Boolean),
      ),
    ).sort();
  }, [investments]);

  const filteredInvestments = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return investments.filter((investment) => {
      const matchesSearch =
        !normalizedSearch ||
        investment.reference
          .toLowerCase()
          .includes(normalizedSearch) ||
        customerName(investment)
          .toLowerCase()
          .includes(normalizedSearch) ||
        (investment.account_id ?? "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (investment.username ?? "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        (investment.plan_name ?? "")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        investment.status === statusFilter;

      const matchesAsset =
        assetFilter === "all" ||
        investment.asset_symbol === assetFilter;

      const matchesPlan =
        planFilter === "all" ||
        investment.plan_id === planFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesAsset &&
        matchesPlan
      );
    });
  }, [
    investments,
    search,
    statusFilter,
    assetFilter,
    planFilter,
  ]);

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanForm(emptyPlanForm);
    setError("");
    setSuccess("");
    setShowPlanModal(true);
  }

  function openEditPlan(plan: InvestmentPlan) {
    setEditingPlan(plan);

    setPlanForm({
      name: plan.name,
      description: plan.description ?? "",
      asset_symbol: plan.asset_symbol,
      minimum_amount: String(plan.minimum_amount),
      maximum_amount:
        plan.maximum_amount === null
          ? ""
          : String(plan.maximum_amount),
      duration_days: String(plan.duration_days),
      profit_rate: String(plan.profit_rate),
      enabled: plan.enabled,
    });

    setError("");
    setSuccess("");
    setShowPlanModal(true);
  }

  function closePlanModal() {
    if (savingPlan) {
      return;
    }

    setShowPlanModal(false);
    setEditingPlan(null);
    setPlanForm(emptyPlanForm);
  }

  async function handlePlanSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const name = planForm.name.trim();
    const description =
      planForm.description.trim();

    const assetSymbol =
      planForm.asset_symbol.trim().toUpperCase();

    const minimumAmount = Number(
      planForm.minimum_amount,
    );

    const maximumAmount =
      planForm.maximum_amount.trim() === ""
        ? null
        : Number(planForm.maximum_amount);

    const durationDays = Number(
      planForm.duration_days,
    );

    const profitRate = Number(
      planForm.profit_rate,
    );

    if (!name) {
      setError("Plan name is required.");
      return;
    }

    if (!assetSymbol) {
      setError("Asset symbol is required.");
      return;
    }

    if (
      !Number.isFinite(minimumAmount) ||
      minimumAmount <= 0
    ) {
      setError(
        "Minimum amount must be greater than zero.",
      );
      return;
    }

    if (
      maximumAmount !== null &&
      (!Number.isFinite(maximumAmount) ||
        maximumAmount < minimumAmount)
    ) {
      setError(
        "Maximum amount must be greater than or equal to the minimum amount.",
      );
      return;
    }

    if (
      !Number.isFinite(durationDays) ||
      durationDays <= 0
    ) {
      setError(
        "Duration must be greater than zero.",
      );
      return;
    }

    if (
      !Number.isFinite(profitRate) ||
      profitRate < 0
    ) {
      setError(
        "Profit rate cannot be negative.",
      );
      return;
    }

    setSavingPlan(true);

    try {
      if (editingPlan) {
        const { error: rpcError } =
          await supabase.rpc(
            "admin_update_investment_plan",
            {
              p_plan_id: editingPlan.id,
              p_name: name,
              p_description: description,
              p_asset_symbol: assetSymbol,
              p_minimum_amount: minimumAmount,
              p_maximum_amount: maximumAmount,
              p_duration_days: durationDays,
              p_profit_rate: profitRate,
              p_enabled: planForm.enabled,
            },
          );

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        setSuccess(
          `${name} has been updated successfully.`,
        );
      } else {
        const { error: rpcError } =
          await supabase.rpc(
            "admin_create_investment_plan",
            {
              p_name: name,
              p_description: description,
              p_asset_symbol: assetSymbol,
              p_minimum_amount: minimumAmount,
              p_maximum_amount: maximumAmount,
              p_duration_days: durationDays,
              p_profit_rate: profitRate,
              p_enabled: planForm.enabled,
            },
          );

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        setSuccess(
          `${name} has been created successfully.`,
        );
      }

      setShowPlanModal(false);
      setEditingPlan(null);
      setPlanForm(emptyPlanForm);

      await loadData(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save investment plan.",
      );
    } finally {
      setSavingPlan(false);
    }
  }

  async function togglePlan(plan: InvestmentPlan) {
    setError("");
    setSuccess("");
    setTogglingPlanId(plan.id);

    try {
      const { error: rpcError } =
        await supabase.rpc(
          "admin_set_investment_plan_status",
          {
            p_plan_id: plan.id,
            p_enabled: !plan.enabled,
          },
        );

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      setSuccess(
        `${plan.name} is now ${
          !plan.enabled ? "enabled" : "disabled"
        }.`,
      );

      await loadData(false);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Unable to update investment plan status.",
      );
    } finally {
      setTogglingPlanId(null);
    }
  }

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setAssetFilter("all");
    setPlanFilter("all");
  }

  if (loading) {
    return (
      <AdminModule
        eyebrow="INVESTMENT CONTROL"
        title="Investments"
        description="Manage investment plans and monitor customer investment activity."
        icon="◒"
      >
        <div className="investment-admin-loading">
          <div className="investment-admin-spinner" />
          <span>
            Loading investment control center...
          </span>
        </div>

        <style jsx global>{`
          .investment-admin-loading {
            min-height: 420px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
            gap: 18px;
            color: rgba(214, 228, 245, 0.62);
            background:
              linear-gradient(
                135deg,
                rgba(5, 15, 28, 0.96),
                rgba(2, 8, 18, 0.98)
              );
            border: 1px solid rgba(56, 151, 255, 0.14);
            border-radius: 24px;
          }

          .investment-admin-spinner {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            border: 2px solid rgba(58, 154, 255, 0.18);
            border-top-color: #3ea1ff;
            animation: investment-admin-spin 0.8s linear infinite;
          }

          @keyframes investment-admin-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </AdminModule>
    );
  }

  return (
    <AdminModule
      eyebrow="INVESTMENT CONTROL"
      title="Investments"
      description="Manage investment plans and monitor customer investment activity."
      icon="◒"
    >
      <div className="investment-admin-page">
        <div className="investment-admin-topline">
          <div>
            <span className="investment-admin-kicker">
              CAPITAL MANAGEMENT SYSTEM
            </span>

            <h2>Investment Control Center</h2>

            <p>
              Configure available investment products
              and monitor the customer investment
              portfolio from one secure administrative
              workspace.
            </p>
          </div>

          <button
            type="button"
            className="investment-admin-refresh"
            onClick={() => loadData(false)}
            disabled={refreshing}
          >
            <span
              className={
                refreshing
                  ? "refresh-icon spinning"
                  : "refresh-icon"
              }
            >
              ↻
            </span>

            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {(error || success) && (
          <div
            className={`investment-admin-alert ${
              error ? "error" : "success"
            }`}
          >
            <div className="alert-mark">
              {error ? "!" : "✓"}
            </div>

            <div>
              <strong>
                {error
                  ? "System message"
                  : "Operation completed"}
              </strong>

              <span>{error || success}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        )}

        <section className="investment-admin-stats">
          <div className="investment-admin-stat">
            <div className="admin-stat-icon blue">
              ◒
            </div>

            <div>
              <span>Investment plans</span>
              <strong>{plans.length}</strong>
              <small>
                {enabledPlans.length} currently enabled
              </small>
            </div>
          </div>

          <div className="investment-admin-stat">
            <div className="admin-stat-icon green">
              ●
            </div>

            <div>
              <span>Active investments</span>
              <strong>
                {activeInvestments.length}
              </strong>
              <small>
                {investments.length} total records
              </small>
            </div>
          </div>

          <div className="investment-admin-stat">
            <div className="admin-stat-icon gold">
              ◈
            </div>

            <div>
              <span>Total principal</span>
              <strong>
                {formatAmount(totalPrincipal)}
              </strong>
              <small>CCT across investments</small>
            </div>
          </div>

          <div className="investment-admin-stat">
            <div className="admin-stat-icon violet">
              ↗
            </div>

            <div>
              <span>Expected profit</span>
              <strong>
                {formatAmount(totalExpectedProfit)}
              </strong>
              <small>Projected CCT profit</small>
            </div>
          </div>
        </section>

        <div className="investment-admin-tabs">
          <button
            type="button"
            className={
              activeTab === "plans" ? "active" : ""
            }
            onClick={() => setActiveTab("plans")}
          >
            <span>◒</span>
            Investment Plans
            <b>{plans.length}</b>
          </button>

          <button
            type="button"
            className={
              activeTab === "investments"
                ? "active"
                : ""
            }
            onClick={() =>
              setActiveTab("investments")
            }
          >
            <span>▤</span>
            Customer Investments
            <b>{investments.length}</b>
          </button>
        </div>

        {activeTab === "plans" && (
          <section className="investment-admin-section">
            <div className="investment-admin-section-header">
              <div>
                <span className="investment-admin-section-eyebrow">
                  PRODUCT CONFIGURATION
                </span>

                <h3>Investment Plans</h3>

                <p>
                  Create and configure the investment
                  products available to customers.
                </p>
              </div>

              <button
                type="button"
                className="investment-admin-primary"
                onClick={openCreatePlan}
              >
                <span>+</span>
                Create Investment Plan
              </button>
            </div>

            {plans.length === 0 ? (
              <div className="investment-admin-empty">
                <div className="empty-icon">◒</div>

                <h4>No investment plans</h4>

                <p>
                  Create the first investment plan to
                  make an investment product available
                  to customers.
                </p>

                <button
                  type="button"
                  onClick={openCreatePlan}
                >
                  Create First Plan
                </button>
              </div>
            ) : (
              <div className="investment-plan-admin-grid">
                {plans.map((plan) => (
                  <article
                    className={`investment-plan-admin-card ${
                      plan.enabled ? "" : "disabled"
                    }`}
                    key={plan.id}
                  >
                    <div className="plan-admin-card-top">
                      <div className="plan-admin-symbol">
                        ◒
                      </div>

                      <div className="plan-admin-status">
                        <span
                          className={
                            plan.enabled
                              ? "status-dot enabled"
                              : "status-dot disabled"
                          }
                        />

                        {plan.enabled
                          ? "Enabled"
                          : "Disabled"}
                      </div>
                    </div>

                    <div className="plan-admin-title">
                      <div>
                        <span>
                          {plan.asset_symbol}
                        </span>

                        <h4>{plan.name}</h4>
                      </div>

                      <strong>
                        {formatAmount(
                          plan.profit_rate,
                        )}
                        %
                      </strong>
                    </div>

                    <p className="plan-admin-description">
                      {plan.description ||
                        "No plan description has been configured."}
                    </p>

                    <div className="plan-admin-details">
                      <div>
                        <span>Duration</span>
                        <strong>
                          {plan.duration_days} days
                        </strong>
                      </div>

                      <div>
                        <span>Minimum</span>
                        <strong>
                          {formatAmount(
                            plan.minimum_amount,
                          )}{" "}
                          {plan.asset_symbol}
                        </strong>
                      </div>

                      <div>
                        <span>Maximum</span>
                        <strong>
                          {plan.maximum_amount === null
                            ? "No limit"
                            : `${formatAmount(
                                plan.maximum_amount,
                              )} ${
                                plan.asset_symbol
                              }`}
                        </strong>
                      </div>
                    </div>

                    <div className="plan-admin-metrics">
                      <div>
                        <span>Total investments</span>
                        <strong>
                          {formatAmount(
                            plan.investment_count,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Active</span>
                        <strong>
                          {formatAmount(
                            plan.active_investment_count,
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Principal</span>
                        <strong>
                          {formatAmount(
                            plan.total_principal,
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="plan-admin-actions">
                      <button
                        type="button"
                        className="plan-edit-button"
                        onClick={() =>
                          openEditPlan(plan)
                        }
                      >
                        Edit Plan
                      </button>

                      <button
                        type="button"
                        className={`plan-toggle-button ${
                          plan.enabled
                            ? "disable"
                            : "enable"
                        }`}
                        onClick={() =>
                          togglePlan(plan)
                        }
                        disabled={
                          togglingPlanId === plan.id
                        }
                      >
                        {togglingPlanId === plan.id
                          ? "Updating..."
                          : plan.enabled
                            ? "Disable"
                            : "Enable"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === "investments" && (
          <section className="investment-admin-section">
            <div className="investment-admin-section-header">
              <div>
                <span className="investment-admin-section-eyebrow">
                  CUSTOMER PORTFOLIO
                </span>

                <h3>Customer Investments</h3>

                <p>
                  Inspect customer investment positions,
                  terms, returns and maturity information.
                </p>
              </div>
            </div>

            <div className="investment-admin-filters">
              <div className="investment-admin-search">
                <span>⌕</span>

                <input
                  type="search"
                  placeholder="Search reference, customer, account or plan..."
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
              >
                <option value="all">
                  All statuses
                </option>
                <option value="active">
                  Active
                </option>
                <option value="pending">
                  Pending
                </option>
                <option value="completed">
                  Completed
                </option>
                <option value="cancelled">
                  Cancelled
                </option>
              </select>

              <select
                value={assetFilter}
                onChange={(event) =>
                  setAssetFilter(event.target.value)
                }
              >
                <option value="all">
                  All assets
                </option>

                {assets.map((asset) => (
                  <option
                    value={asset}
                    key={asset}
                  >
                    {asset}
                  </option>
                ))}
              </select>

              <select
                value={planFilter}
                onChange={(event) =>
                  setPlanFilter(event.target.value)
                }
              >
                <option value="all">
                  All plans
                </option>

                {plans.map((plan) => (
                  <option
                    value={plan.id}
                    key={plan.id}
                  >
                    {plan.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="clear-filters"
                onClick={resetFilters}
              >
                Clear
              </button>
            </div>

            <div className="investment-result-line">
              <span>
                Showing{" "}
                <strong>
                  {filteredInvestments.length}
                </strong>{" "}
                of{" "}
                <strong>{investments.length}</strong>{" "}
                investments
              </span>

              {search ||
              statusFilter !== "all" ||
              assetFilter !== "all" ||
              planFilter !== "all" ? (
                <span className="filter-active">
                  Filters active
                </span>
              ) : (
                <span>
                  Live investment ledger
                </span>
              )}
            </div>

            {filteredInvestments.length === 0 ? (
              <div className="investment-admin-empty">
                <div className="empty-icon">▤</div>

                <h4>
                  No matching investments
                </h4>

                <p>
                  No customer investment records match
                  the current search and filters.
                </p>

                <button
                  type="button"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="investment-table-wrapper">
                <table className="investment-admin-table">
                  <thead>
                    <tr>
                      <th>Investment</th>
                      <th>Customer</th>
                      <th>Plan</th>
                      <th>Principal</th>
                      <th>Profit</th>
                      <th>Term</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th />
                    </tr>
                  </thead>

                  <tbody>
                    {filteredInvestments.map(
                      (investment) => {
                        const plan = plans.find(
                          (item) =>
                            item.id ===
                            investment.plan_id,
                        );

                        return (
                          <tr key={investment.id}>
                            <td>
                              <div className="investment-reference-cell">
                                <strong>
                                  {investment.reference}
                                </strong>

                                <span>
                                  {investment.asset_symbol}
                                </span>
                              </div>
                            </td>

                            <td>
                              <div className="investment-customer-cell">
                                <div className="customer-avatar">
                                  {(
                                    customerName(
                                      investment,
                                    ).charAt(0) ||
                                    "U"
                                  ).toUpperCase()}
                                </div>

                                <div>
                                  <strong>
                                    {customerName(
                                      investment,
                                    )}
                                  </strong>

                                  <span>
                                    {investment.account_id ||
                                      investment.username ||
                                      investment.user_id.slice(
                                        0,
                                        12,
                                      )}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="investment-plan-cell">
                                <strong>
                                  {investment.plan_name ||
                                    plan?.name ||
                                    "Unknown plan"}
                                </strong>

                                <span>
                                  {plan
                                    ? `${plan.duration_days} days`
                                    : "—"}
                                </span>
                              </div>
                            </td>

                            <td>
                              <strong className="amount-main">
                                {formatAmount(
                                  investment.principal_amount,
                                )}
                              </strong>

                              <span className="amount-sub">
                                {investment.asset_symbol}
                              </span>
                            </td>

                            <td>
                              <strong className="profit-main">
                                +
                                {formatAmount(
                                  investment.expected_profit,
                                )}
                              </strong>

                              <span className="amount-sub">
                                {formatAmount(
                                  investment.profit_rate,
                                )}
                                %
                              </span>
                            </td>

                            <td>
                              <div className="investment-date-cell">
                                <strong>
                                  {formatDate(
                                    investment.maturity_at,
                                  )}
                                </strong>

                                <span>
                                  Maturity
                                </span>
                              </div>
                            </td>

                            <td>
                              <span
                                className={statusClass(
                                  investment.status,
                                )}
                              >
                                <span />
                                {statusLabel(
                                  investment.status,
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="investment-date-cell">
                                <strong>
                                  {formatDate(
                                    investment.created_at,
                                  )}
                                </strong>

                                <span>
                                  Created
                                </span>
                              </div>
                            </td>

                            <td>
                              <button
                                type="button"
                                className="investment-view-button"
                                onClick={() =>
                                  setSelectedInvestment(
                                    investment,
                                  )
                                }
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <section className="investment-admin-security">
          <div className="security-orb">
            ◆
          </div>

          <div>
            <span>
              SECURE INVESTMENT ACCOUNTING
            </span>

            <h3>
              Administrative controls are
              database-protected.
            </h3>

            <p>
              Investment creation remains controlled
              through the platform investment workflow.
              Plan configuration and administrative
              actions are executed through protected
              PostgreSQL functions rather than direct
              browser-side financial updates.
            </p>
          </div>

          <div className="security-status">
            <span />
            ADMIN RPC
            <strong>ONLINE</strong>
          </div>
        </section>
      </div>

      {showPlanModal && (
        <div
          className="investment-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              closePlanModal();
            }
          }}
        >
          <div className="investment-plan-modal">
            <div className="investment-modal-header">
              <div>
                <span>
                  {editingPlan
                    ? "PLAN CONFIGURATION"
                    : "NEW INVESTMENT PRODUCT"}
                </span>

                <h3>
                  {editingPlan
                    ? "Edit Investment Plan"
                    : "Create Investment Plan"}
                </h3>
              </div>

              <button
                type="button"
                onClick={closePlanModal}
                disabled={savingPlan}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              className="investment-plan-form"
              onSubmit={handlePlanSubmit}
            >
              <div className="form-grid-two">
                <label>
                  <span>Plan name</span>

                  <input
                    type="text"
                    value={planForm.name}
                    placeholder="CCT Starter"
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    disabled={savingPlan}
                  />
                </label>

                <label>
                  <span>Asset symbol</span>

                  <input
                    type="text"
                    value={planForm.asset_symbol}
                    placeholder="CCT"
                    onChange={(event) =>
                      setPlanForm((current) => ({
                        ...current,
                        asset_symbol:
                          event.target.value.toUpperCase(),
                      }))
                    }
                    disabled={savingPlan}
                  />
                </label>
              </div>

              <label>
                <span>Description</span>

                <textarea
                  rows={4}
                  value={planForm.description}
                  placeholder="Describe the investment plan..."
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      description:
                        event.target.value,
                    }))
                  }
                  disabled={savingPlan}
                />
              </label>

              <div className="form-grid-two">
                <label>
                  <span>Minimum amount</span>

                  <div className="admin-input-unit">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={planForm.minimum_amount}
                      placeholder="100"
                      onChange={(event) =>
                        setPlanForm((current) => ({
                          ...current,
                          minimum_amount:
                            event.target.value,
                        }))
                      }
                      disabled={savingPlan}
                    />

                    <b>
                      {planForm.asset_symbol ||
                        "CCT"}
                    </b>
                  </div>
                </label>

                <label>
                  <span>Maximum amount</span>

                  <div className="admin-input-unit">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={planForm.maximum_amount}
                      placeholder="No limit"
                      onChange={(event) =>
                        setPlanForm((current) => ({
                          ...current,
                          maximum_amount:
                            event.target.value,
                        }))
                      }
                      disabled={savingPlan}
                    />

                    <b>
                      {planForm.asset_symbol ||
                        "CCT"}
                    </b>
                  </div>

                  <small>
                    Leave empty for no maximum.
                  </small>
                </label>
              </div>

              <div className="form-grid-two">
                <label>
                  <span>Duration</span>

                  <div className="admin-input-unit">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={planForm.duration_days}
                      placeholder="30"
                      onChange={(event) =>
                        setPlanForm((current) => ({
                          ...current,
                          duration_days:
                            event.target.value,
                        }))
                      }
                      disabled={savingPlan}
                    />

                    <b>DAYS</b>
                  </div>
                </label>

                <label>
                  <span>Profit rate</span>

                  <div className="admin-input-unit">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={planForm.profit_rate}
                      placeholder="5"
                      onChange={(event) =>
                        setPlanForm((current) => ({
                          ...current,
                          profit_rate:
                            event.target.value,
                        }))
                      }
                      disabled={savingPlan}
                    />

                    <b>%</b>
                  </div>
                </label>
              </div>

              <label className="plan-enabled-toggle">
                <input
                  type="checkbox"
                  checked={planForm.enabled}
                  onChange={(event) =>
                    setPlanForm((current) => ({
                      ...current,
                      enabled:
                        event.target.checked,
                    }))
                  }
                  disabled={savingPlan}
                />

                <span className="toggle-visual">
                  <span />
                </span>

                <div>
                  <strong>
                    Make plan available
                  </strong>

                  <small>
                    Customers can select this plan
                    when enabled.
                  </small>
                </div>
              </label>

              <div className="investment-modal-actions">
                <button
                  type="button"
                  className="modal-cancel"
                  onClick={closePlanModal}
                  disabled={savingPlan}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="modal-save"
                  disabled={savingPlan}
                >
                  {savingPlan ? (
                    <>
                      <span className="modal-spinner" />
                      Saving...
                    </>
                  ) : (
                    <>
                      {editingPlan
                        ? "Save Changes"
                        : "Create Plan"}
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedInvestment && (
        <div
          className="investment-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setSelectedInvestment(null);
            }
          }}
        >
          <div className="investment-detail-modal">
            <div className="investment-modal-header">
              <div>
                <span>INVESTMENT RECORD</span>

                <h3>
                  {selectedInvestment.reference}
                </h3>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedInvestment(null)
                }
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="detail-status-row">
              <span
                className={statusClass(
                  selectedInvestment.status,
                )}
              >
                <span />
                {statusLabel(
                  selectedInvestment.status,
                )}
              </span>

              <span className="detail-asset">
                {selectedInvestment.asset_symbol}
              </span>
            </div>

            <div className="detail-primary">
              <span>Principal amount</span>

              <strong>
                {formatAmount(
                  selectedInvestment.principal_amount,
                )}{" "}
                {selectedInvestment.asset_symbol}
              </strong>

              <small>
                {selectedInvestment.plan_name ||
                  "Investment plan"}
              </small>
            </div>

            <div className="detail-grid">
              <div>
                <span>Customer</span>

                <strong>
                  {customerName(
                    selectedInvestment,
                  )}
                </strong>
              </div>

              <div>
                <span>Account ID</span>

                <strong>
                  {selectedInvestment.account_id ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Plan</span>

                <strong>
                  {selectedInvestment.plan_name ||
                    "—"}
                </strong>
              </div>

              <div>
                <span>Profit rate</span>

                <strong>
                  {formatAmount(
                    selectedInvestment.profit_rate,
                  )}
                  %
                </strong>
              </div>

              <div>
                <span>Expected profit</span>

                <strong className="detail-profit">
                  +
                  {formatAmount(
                    selectedInvestment.expected_profit,
                  )}{" "}
                  {selectedInvestment.asset_symbol}
                </strong>
              </div>

              <div>
                <span>Earned profit</span>

                <strong>
                  {formatAmount(
                    selectedInvestment.earned_profit,
                  )}{" "}
                  {selectedInvestment.asset_symbol}
                </strong>
              </div>

              <div>
                <span>Started</span>

                <strong>
                  {formatDate(
                    selectedInvestment.started_at,
                  )}
                </strong>
              </div>

              <div>
                <span>Maturity</span>

                <strong>
                  {formatDate(
                    selectedInvestment.maturity_at,
                  )}
                </strong>
              </div>

              <div>
                <span>Completed</span>

                <strong>
                  {formatDate(
                    selectedInvestment.completed_at,
                  )}
                </strong>
              </div>

              <div>
                <span>Created</span>

                <strong>
                  {formatDate(
                    selectedInvestment.created_at,
                  )}
                </strong>
              </div>
            </div>

            <div className="detail-security-note">
              <span>◆</span>

              <p>
                This investment is displayed from the
                protected investment ledger. Financial
                balances should not be modified directly
                from the browser.
              </p>
            </div>

            <button
              type="button"
              className="detail-close-button"
              onClick={() =>
                setSelectedInvestment(null)
              }
            >
              Close Investment Record
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .investment-admin-page {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 22px;
          color: #dce9f8;
        }

        .investment-admin-topline {
          position: relative;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          padding: 8px 2px 4px;
        }

        .investment-admin-topline::before {
          content: "";
          position: absolute;
          left: 0;
          top: -10px;
          width: 160px;
          height: 1px;
          background: linear-gradient(
            90deg,
            rgba(45, 157, 255, 0.8),
            transparent
          );
          box-shadow: 0 0 18px rgba(45, 157, 255, 0.5);
        }

        .investment-admin-kicker,
        .investment-admin-section-eyebrow {
          display: block;
          color: #48a9ff;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.22em;
          text-transform: uppercase;
        }

        .investment-admin-topline h2 {
          margin: 6px 0 5px;
          color: #f2f8ff;
          font-size: clamp(24px, 3vw, 34px);
          font-weight: 800;
          letter-spacing: -0.04em;
        }

        .investment-admin-topline p {
          max-width: 720px;
          margin: 0;
          color: rgba(207, 222, 239, 0.58);
          font-size: 13px;
          line-height: 1.7;
        }

        .investment-admin-refresh {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          min-height: 42px;
          padding: 0 15px;
          border: 1px solid rgba(58, 157, 255, 0.2);
          border-radius: 11px;
          background: rgba(8, 22, 39, 0.75);
          color: #a9d7ff;
          cursor: pointer;
          font-size: 12px;
          font-weight: 700;
          transition:
            border-color 0.2s ease,
            background 0.2s ease,
            transform 0.2s ease;
        }

        .investment-admin-refresh:hover:not(:disabled) {
          border-color: rgba(70, 166, 255, 0.5);
          background: rgba(12, 34, 57, 0.9);
          transform: translateY(-1px);
        }

        .investment-admin-refresh:disabled {
          opacity: 0.65;
          cursor: default;
        }

        .refresh-icon {
          font-size: 17px;
        }

        .refresh-icon.spinning {
          animation: admin-refresh-spin 0.8s linear infinite;
        }

        @keyframes admin-refresh-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .investment-admin-alert {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px 15px;
          border-radius: 13px;
          border: 1px solid rgba(70, 163, 255, 0.15);
          background: rgba(7, 19, 33, 0.82);
        }

        .investment-admin-alert.error {
          border-color: rgba(255, 80, 95, 0.24);
          background: rgba(48, 11, 19, 0.42);
        }

        .investment-admin-alert.success {
          border-color: rgba(57, 225, 147, 0.22);
          background: rgba(6, 39, 29, 0.4);
        }

        .alert-mark {
          display: grid;
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          place-items: center;
          border-radius: 9px;
          background: rgba(55, 159, 255, 0.1);
          color: #54adff;
          font-size: 13px;
          font-weight: 900;
        }

        .error .alert-mark {
          background: rgba(255, 70, 90, 0.12);
          color: #ff7887;
        }

        .success .alert-mark {
          background: rgba(54, 218, 141, 0.11);
          color: #4be59b;
        }

        .investment-admin-alert div:nth-child(2) {
          min-width: 0;
          flex: 1;
        }

        .investment-admin-alert strong,
        .investment-admin-alert span {
          display: block;
        }

        .investment-admin-alert strong {
          margin-bottom: 2px;
          color: #edf6ff;
          font-size: 12px;
        }

        .investment-admin-alert div:nth-child(2) span {
          color: rgba(204, 220, 237, 0.6);
          font-size: 11px;
          line-height: 1.5;
        }

        .investment-admin-alert > button {
          border: 0;
          background: transparent;
          color: rgba(212, 226, 241, 0.42);
          cursor: pointer;
          font-size: 20px;
        }

        .investment-admin-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 13px;
        }

        .investment-admin-stat {
          position: relative;
          display: flex;
          align-items: center;
          gap: 13px;
          min-height: 100px;
          padding: 17px;
          overflow: hidden;
          border: 1px solid rgba(75, 155, 224, 0.12);
          border-radius: 16px;
          background:
            linear-gradient(
              135deg,
              rgba(11, 27, 45, 0.92),
              rgba(3, 12, 23, 0.96)
            );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.025),
            0 18px 45px rgba(0, 0, 0, 0.16);
        }

        .investment-admin-stat::after {
          content: "";
          position: absolute;
          right: -35px;
          bottom: -50px;
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: rgba(31, 135, 255, 0.07);
          filter: blur(20px);
        }

        .admin-stat-icon {
          display: grid;
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          place-items: center;
          border: 1px solid rgba(75, 159, 255, 0.15);
          border-radius: 12px;
          background: rgba(34, 111, 180, 0.08);
          font-size: 18px;
        }

        .admin-stat-icon.blue {
          color: #4ba9ff;
        }

        .admin-stat-icon.green {
          color: #4be59b;
        }

        .admin-stat-icon.gold {
          color: #e7c866;
        }

        .admin-stat-icon.violet {
          color: #ae96ff;
        }

        .investment-admin-stat span,
        .investment-admin-stat strong,
        .investment-admin-stat small {
          display: block;
        }

        .investment-admin-stat span {
          margin-bottom: 4px;
          color: rgba(203, 220, 238, 0.5);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .investment-admin-stat strong {
          color: #f1f7ff;
          font-size: 22px;
          line-height: 1.1;
        }

        .investment-admin-stat small {
          margin-top: 5px;
          color: rgba(194, 214, 234, 0.38);
          font-size: 10px;
        }

        .investment-admin-tabs {
          display: flex;
          gap: 5px;
          padding: 5px;
          border: 1px solid rgba(64, 149, 224, 0.13);
          border-radius: 14px;
          background: rgba(4, 13, 24, 0.8);
        }

        .investment-admin-tabs button {
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 43px;
          padding: 0 15px;
          border: 1px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: rgba(204, 220, 237, 0.5);
          cursor: pointer;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.02em;
          transition: all 0.2s ease;
        }

        .investment-admin-tabs button:hover {
          color: #bfe2ff;
        }

        .investment-admin-tabs button.active {
          border-color: rgba(63, 157, 255, 0.18);
          background: rgba(28, 102, 164, 0.12);
          color: #e6f4ff;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            0 0 20px rgba(35, 132, 220, 0.06);
        }

        .investment-admin-tabs button > span {
          color: #42a6ff;
          font-size: 16px;
        }

        .investment-admin-tabs button b {
          display: inline-grid;
          min-width: 20px;
          height: 20px;
          place-items: center;
          padding: 0 5px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.05);
          color: rgba(215, 229, 243, 0.6);
          font-size: 9px;
        }

        .investment-admin-section {
          min-width: 0;
          padding: 20px;
          border: 1px solid rgba(72, 153, 222, 0.12);
          border-radius: 20px;
          background:
            linear-gradient(
              135deg,
              rgba(7, 20, 34, 0.94),
              rgba(3, 11, 21, 0.98)
            );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.025),
            0 24px 60px rgba(0, 0, 0, 0.16);
        }

        .investment-admin-section-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 20px;
        }

        .investment-admin-section-header h3 {
          margin: 5px 0 4px;
          color: #f0f7ff;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.025em;
        }

        .investment-admin-section-header p {
          margin: 0;
          color: rgba(201, 218, 235, 0.47);
          font-size: 11px;
        }

        .investment-admin-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 42px;
          padding: 0 15px;
          border: 1px solid rgba(73, 165, 255, 0.32);
          border-radius: 11px;
          background:
            linear-gradient(
              135deg,
              rgba(27, 119, 201, 0.25),
              rgba(16, 65, 112, 0.18)
            );
          color: #cbeaff;
          cursor: pointer;
          font-size: 11px;
          font-weight: 800;
          transition: all 0.2s ease;
          box-shadow: 0 0 24px rgba(33, 132, 221, 0.06);
        }

        .investment-admin-primary:hover {
          border-color: rgba(75, 174, 255, 0.65);
          background: rgba(24, 110, 185, 0.32);
          transform: translateY(-1px);
          box-shadow: 0 0 30px rgba(31, 133, 223, 0.12);
        }

        .investment-admin-primary span {
          font-size: 17px;
          color: #54b2ff;
        }

        .investment-plan-admin-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .investment-plan-admin-card {
          position: relative;
          display: flex;
          min-width: 0;
          flex-direction: column;
          padding: 17px;
          overflow: hidden;
          border: 1px solid rgba(72, 155, 225, 0.14);
          border-radius: 17px;
          background:
            linear-gradient(
              145deg,
              rgba(11, 30, 50, 0.92),
              rgba(3, 12, 23, 0.98)
            );
          transition:
            transform 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .investment-plan-admin-card:hover {
          transform: translateY(-2px);
          border-color: rgba(67, 160, 239, 0.27);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.18);
        }

        .investment-plan-admin-card.disabled {
          opacity: 0.68;
        }

        .investment-plan-admin-card::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 1px;
          background: linear-gradient(
            90deg,
            rgba(56, 165, 255, 0.7),
            rgba(212, 175, 55, 0.3),
            transparent
          );
        }

        .plan-admin-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .plan-admin-symbol {
          display: grid;
          width: 40px;
          height: 40px;
          place-items: center;
          border: 1px solid rgba(70, 161, 242, 0.16);
          border-radius: 12px;
          background: rgba(31, 121, 198, 0.08);
          color: #51acff;
          font-size: 18px;
        }

        .plan-admin-status {
          display: flex;
          align-items: center;
          gap: 6px;
          color: rgba(204, 222, 240, 0.55);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .status-dot.enabled {
          background: #42df91;
          box-shadow: 0 0 10px rgba(66, 223, 145, 0.8);
        }

        .status-dot.disabled {
          background: #718091;
        }

        .plan-admin-title {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-top: 15px;
        }

        .plan-admin-title span {
          color: #48a8ff;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .plan-admin-title h4 {
          margin: 4px 0 0;
          color: #f0f7ff;
          font-size: 17px;
          font-weight: 800;
        }

        .plan-admin-title > strong {
          color: #e5ca70;
          font-size: 21px;
          white-space: nowrap;
        }

        .plan-admin-description {
          min-height: 38px;
          margin: 11px 0 15px;
          color: rgba(199, 218, 236, 0.5);
          font-size: 11px;
          line-height: 1.6;
        }

        .plan-admin-details {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
          padding: 10px;
          border: 1px solid rgba(73, 150, 220, 0.08);
          border-radius: 11px;
          background: rgba(0, 8, 17, 0.28);
        }

        .plan-admin-details span,
        .plan-admin-details strong {
          display: block;
        }

        .plan-admin-details span {
          margin-bottom: 4px;
          color: rgba(194, 215, 234, 0.38);
          font-size: 8px;
          text-transform: uppercase;
        }

        .plan-admin-details strong {
          color: rgba(229, 241, 251, 0.82);
          font-size: 10px;
          line-height: 1.3;
        }

        .plan-admin-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          margin-top: 13px;
        }

        .plan-admin-metrics div {
          min-width: 0;
        }

        .plan-admin-metrics span,
        .plan-admin-metrics strong {
          display: block;
        }

        .plan-admin-metrics span {
          margin-bottom: 4px;
          color: rgba(191, 213, 233, 0.36);
          font-size: 8px;
          text-transform: uppercase;
        }

        .plan-admin-metrics strong {
          overflow: hidden;
          color: #cfe7fb;
          font-size: 11px;
          text-overflow: ellipsis;
        }

        .plan-admin-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 16px;
        }

        .plan-edit-button,
        .plan-toggle-button {
          min-height: 36px;
          border-radius: 9px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
          transition: all 0.2s ease;
        }

        .plan-edit-button {
          border: 1px solid rgba(71, 155, 226, 0.16);
          background: rgba(24, 74, 115, 0.08);
          color: #9ecbf0;
        }

        .plan-edit-button:hover {
          border-color: rgba(75, 165, 240, 0.35);
          background: rgba(27, 91, 142, 0.15);
        }

        .plan-toggle-button {
          border: 1px solid rgba(71, 155, 226, 0.16);
          background: rgba(10, 24, 39, 0.8);
        }

        .plan-toggle-button.enable {
          border-color: rgba(55, 218, 143, 0.18);
          color: #6ee5a9;
        }

        .plan-toggle-button.disable {
          color: #e4b5b5;
        }

        .plan-toggle-button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.04);
        }

        .plan-toggle-button:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .investment-admin-filters {
          display: grid;
          grid-template-columns: minmax(240px, 1fr) 145px 135px 170px auto;
          gap: 8px;
          margin-bottom: 13px;
        }

        .investment-admin-search {
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 39px;
          padding: 0 11px;
          border: 1px solid rgba(68, 151, 221, 0.13);
          border-radius: 9px;
          background: rgba(2, 10, 19, 0.68);
        }

        .investment-admin-search > span {
          color: rgba(69, 164, 245, 0.65);
          font-size: 17px;
        }

        .investment-admin-search input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #e8f3fd;
          font-size: 10px;
        }

        .investment-admin-search input::placeholder {
          color: rgba(195, 216, 235, 0.32);
        }

        .investment-admin-filters select {
          min-width: 0;
          min-height: 39px;
          padding: 0 10px;
          border: 1px solid rgba(68, 151, 221, 0.13);
          border-radius: 9px;
          outline: 0;
          background: rgba(2, 10, 19, 0.78);
          color: rgba(218, 233, 246, 0.72);
          font-size: 10px;
        }

        .clear-filters {
          min-height: 39px;
          padding: 0 12px;
          border: 1px solid rgba(212, 175, 55, 0.13);
          border-radius: 9px;
          background: rgba(78, 62, 19, 0.1);
          color: #d8bd69;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
        }

        .investment-result-line {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
          color: rgba(197, 216, 234, 0.42);
          font-size: 9px;
        }

        .investment-result-line strong {
          color: #b9ddfa;
        }

        .filter-active {
          color: #e2c76e;
        }

        .investment-table-wrapper {
          width: 100%;
          overflow-x: auto;
          border: 1px solid rgba(71, 150, 220, 0.09);
          border-radius: 13px;
          background: rgba(1, 8, 16, 0.38);
        }

        .investment-admin-table {
          width: 100%;
          min-width: 1050px;
          border-collapse: collapse;
        }

        .investment-admin-table th {
          padding: 11px 12px;
          border-bottom: 1px solid rgba(68, 151, 221, 0.1);
          background: rgba(10, 27, 44, 0.45);
          color: rgba(176, 204, 228, 0.4);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .investment-admin-table td {
          padding: 12px;
          border-bottom: 1px solid rgba(68, 151, 221, 0.06);
          vertical-align: middle;
        }

        .investment-admin-table tbody tr {
          transition: background 0.2s ease;
        }

        .investment-admin-table tbody tr:hover {
          background: rgba(41, 117, 176, 0.045);
        }

        .investment-admin-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .investment-reference-cell strong,
        .investment-reference-cell span,
        .investment-customer-cell strong,
        .investment-customer-cell span,
        .investment-plan-cell strong,
        .investment-plan-cell span,
        .investment-date-cell strong,
        .investment-date-cell span {
          display: block;
        }

        .investment-reference-cell strong {
          color: #c9e6fb;
          font-size: 10px;
        }

        .investment-reference-cell span {
          margin-top: 4px;
          color: #48a9ff;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .investment-customer-cell {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 155px;
        }

        .customer-avatar {
          display: grid;
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          place-items: center;
          border: 1px solid rgba(76, 160, 232, 0.17);
          border-radius: 9px;
          background: rgba(35, 119, 190, 0.09);
          color: #70bfff;
          font-size: 10px;
          font-weight: 900;
        }

        .investment-customer-cell strong {
          max-width: 150px;
          overflow: hidden;
          color: #dceaf6;
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .investment-customer-cell span {
          max-width: 150px;
          margin-top: 3px;
          overflow: hidden;
          color: rgba(186, 210, 231, 0.36);
          font-size: 8px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .investment-plan-cell strong {
          color: #cde4f5;
          font-size: 10px;
        }

        .investment-plan-cell span {
          margin-top: 3px;
          color: rgba(185, 211, 232, 0.38);
          font-size: 8px;
        }

        .amount-main,
        .amount-sub,
        .profit-main {
          display: block;
        }

        .amount-main {
          color: #e4f1fb;
          font-size: 11px;
        }

        .amount-sub {
          margin-top: 3px;
          color: rgba(180, 207, 230, 0.38);
          font-size: 8px;
        }

        .profit-main {
          color: #57dda0;
          font-size: 11px;
        }

        .investment-date-cell strong {
          color: rgba(218, 233, 246, 0.72);
          font-size: 9px;
          white-space: nowrap;
        }

        .investment-date-cell span {
          margin-top: 3px;
          color: rgba(177, 204, 226, 0.34);
          font-size: 8px;
        }

        .investment-admin-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 7px;
          border: 1px solid rgba(132, 151, 169, 0.12);
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.025);
          color: rgba(197, 214, 230, 0.55);
          font-size: 8px;
          font-weight: 800;
          white-space: nowrap;
        }

        .investment-admin-status > span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #7b8794;
        }

        .investment-admin-status.active {
          border-color: rgba(60, 220, 142, 0.14);
          background: rgba(47, 184, 116, 0.06);
          color: #6de3a8;
        }

        .investment-admin-status.active > span {
          background: #4ce09a;
          box-shadow: 0 0 8px rgba(76, 224, 154, 0.7);
        }

        .investment-admin-status.completed {
          border-color: rgba(71, 157, 255, 0.14);
          color: #79bbf0;
        }

        .investment-admin-status.completed > span {
          background: #5aaeff;
        }

        .investment-admin-status.pending {
          border-color: rgba(229, 194, 76, 0.15);
          color: #ddc56e;
        }

        .investment-admin-status.pending > span {
          background: #e1c354;
        }

        .investment-admin-status.cancelled {
          border-color: rgba(255, 84, 101, 0.15);
          color: #ed8993;
        }

        .investment-admin-status.cancelled > span {
          background: #e86c7a;
        }

        .investment-view-button {
          min-height: 30px;
          padding: 0 10px;
          border: 1px solid rgba(66, 157, 231, 0.17);
          border-radius: 7px;
          background: rgba(34, 109, 172, 0.07);
          color: #8fc9f5;
          cursor: pointer;
          font-size: 9px;
          font-weight: 800;
        }

        .investment-view-button:hover {
          border-color: rgba(73, 168, 246, 0.4);
          background: rgba(36, 119, 189, 0.13);
        }

        .investment-admin-empty {
          display: flex;
          min-height: 260px;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          padding: 30px;
          border: 1px dashed rgba(67, 149, 219, 0.13);
          border-radius: 15px;
          text-align: center;
        }

        .empty-icon {
          display: grid;
          width: 48px;
          height: 48px;
          place-items: center;
          margin-bottom: 13px;
          border: 1px solid rgba(67, 157, 232, 0.14);
          border-radius: 14px;
          background: rgba(31, 119, 193, 0.07);
          color: #4caaff;
          font-size: 21px;
        }

        .investment-admin-empty h4 {
          margin: 0 0 6px;
          color: #dcebf7;
          font-size: 14px;
        }

        .investment-admin-empty p {
          max-width: 420px;
          margin: 0 0 17px;
          color: rgba(188, 210, 229, 0.43);
          font-size: 10px;
          line-height: 1.6;
        }

        .investment-admin-empty button {
          min-height: 35px;
          padding: 0 13px;
          border: 1px solid rgba(68, 161, 237, 0.25);
          border-radius: 8px;
          background: rgba(36, 123, 194, 0.1);
          color: #94ccf3;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
        }

        .investment-admin-security {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 17px 19px;
          border: 1px solid rgba(212, 175, 55, 0.11);
          border-radius: 16px;
          background:
            linear-gradient(
              135deg,
              rgba(42, 33, 12, 0.22),
              rgba(5, 16, 27, 0.76)
            );
        }

        .security-orb {
          display: grid;
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          place-items: center;
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 12px;
          background: rgba(212, 175, 55, 0.05);
          color: #e0c15d;
        }

        .investment-admin-security > div:nth-child(2) {
          min-width: 0;
          flex: 1;
        }

        .investment-admin-security > div:nth-child(2) > span {
          color: #d5b857;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .investment-admin-security h3 {
          margin: 4px 0;
          color: #e5edf5;
          font-size: 12px;
        }

        .investment-admin-security p {
          margin: 0;
          color: rgba(192, 211, 228, 0.4);
          font-size: 9px;
          line-height: 1.5;
        }

        .security-status {
          display: flex;
          align-items: center;
          gap: 7px;
          color: rgba(192, 211, 228, 0.4);
          font-size: 8px;
          font-weight: 800;
          white-space: nowrap;
        }

        .security-status > span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4be29a;
          box-shadow: 0 0 10px rgba(75, 226, 154, 0.75);
        }

        .security-status strong {
          color: #68e5a7;
        }

        .investment-modal-backdrop {
          position: fixed;
          z-index: 1000;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 25px;
          background: rgba(0, 4, 10, 0.78);
          backdrop-filter: blur(12px);
        }

        .investment-plan-modal,
        .investment-detail-modal {
          width: min(620px, 100%);
          max-height: calc(100vh - 50px);
          overflow-y: auto;
          border: 1px solid rgba(73, 159, 232, 0.2);
          border-radius: 20px;
          background:
            linear-gradient(
              145deg,
              rgba(9, 27, 46, 0.98),
              rgba(2, 10, 19, 0.99)
            );
          box-shadow:
            0 35px 100px rgba(0, 0, 0, 0.55),
            0 0 50px rgba(28, 119, 202, 0.08);
        }

        .investment-detail-modal {
          width: min(700px, 100%);
        }

        .investment-modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding: 20px 21px 16px;
          border-bottom: 1px solid rgba(69, 148, 216, 0.1);
        }

        .investment-modal-header span {
          color: #4ba9ff;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        .investment-modal-header h3 {
          margin: 5px 0 0;
          color: #f0f7ff;
          font-size: 19px;
          letter-spacing: -0.025em;
        }

        .investment-modal-header > button {
          display: grid;
          width: 31px;
          height: 31px;
          place-items: center;
          border: 1px solid rgba(82, 157, 222, 0.12);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.025);
          color: rgba(207, 224, 239, 0.52);
          cursor: pointer;
          font-size: 19px;
        }

        .investment-plan-form {
          display: flex;
          flex-direction: column;
          gap: 15px;
          padding: 20px 21px 21px;
        }

        .investment-plan-form label > span {
          display: block;
          margin-bottom: 6px;
          color: rgba(206, 225, 241, 0.56);
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .investment-plan-form input[type="text"],
        .investment-plan-form input[type="number"],
        .investment-plan-form textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(70, 151, 220, 0.13);
          border-radius: 9px;
          outline: 0;
          background: rgba(1, 9, 18, 0.72);
          color: #e8f4fd;
          font: inherit;
          font-size: 11px;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .investment-plan-form input[type="text"],
        .investment-plan-form input[type="number"] {
          min-height: 40px;
          padding: 0 11px;
        }

        .investment-plan-form textarea {
          min-height: 92px;
          padding: 10px 11px;
          resize: vertical;
          line-height: 1.5;
        }

        .investment-plan-form input:focus,
        .investment-plan-form textarea:focus {
          border-color: rgba(65, 163, 245, 0.4);
          box-shadow: 0 0 0 3px rgba(40, 137, 216, 0.06);
        }

        .investment-plan-form input::placeholder,
        .investment-plan-form textarea::placeholder {
          color: rgba(186, 211, 232, 0.24);
        }

        .form-grid-two {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .admin-input-unit {
          position: relative;
        }

        .admin-input-unit input {
          padding-right: 55px !important;
        }

        .admin-input-unit b {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          color: #4ca8f8;
          font-size: 8px;
          pointer-events: none;
        }

        .investment-plan-form label > small {
          display: block;
          margin-top: 5px;
          color: rgba(190, 211, 230, 0.3);
          font-size: 8px;
        }

        .plan-enabled-toggle {
          display: flex !important;
          align-items: center;
          gap: 11px;
          padding: 12px;
          border: 1px solid rgba(70, 150, 218, 0.1);
          border-radius: 11px;
          background: rgba(255, 255, 255, 0.018);
          cursor: pointer;
        }

        .plan-enabled-toggle input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .toggle-visual {
          position: relative;
          display: block !important;
          width: 36px;
          height: 20px;
          flex: 0 0 36px;
          margin: 0 !important;
          border-radius: 20px;
          background: rgba(104, 119, 134, 0.35);
          transition: background 0.2s ease;
        }

        .toggle-visual span {
          position: absolute;
          left: 3px;
          top: 3px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #aab7c4;
          transition: transform 0.2s ease;
        }

        .plan-enabled-toggle input:checked + .toggle-visual {
          background: rgba(49, 204, 133, 0.3);
        }

        .plan-enabled-toggle input:checked + .toggle-visual span {
          transform: translateX(16px);
          background: #50df9c;
          box-shadow: 0 0 9px rgba(80, 223, 156, 0.45);
        }

        .plan-enabled-toggle > div {
          min-width: 0;
        }

        .plan-enabled-toggle > div strong,
        .plan-enabled-toggle > div small {
          display: block;
        }

        .plan-enabled-toggle > div strong {
          margin: 0 0 3px;
          color: #dcebf6;
          font-size: 10px;
        }

        .plan-enabled-toggle > div small {
          color: rgba(190, 211, 230, 0.38);
          font-size: 8px;
        }

        .investment-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 4px;
          padding-top: 15px;
          border-top: 1px solid rgba(68, 149, 218, 0.08);
        }

        .modal-cancel,
        .modal-save {
          min-height: 39px;
          padding: 0 14px;
          border-radius: 9px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
        }

        .modal-cancel {
          border: 1px solid rgba(74, 149, 214, 0.13);
          background: transparent;
          color: rgba(198, 218, 235, 0.55);
        }

        .modal-save {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          border: 1px solid rgba(65, 164, 245, 0.32);
          background: rgba(32, 128, 205, 0.16);
          color: #bfe4ff;
        }

        .modal-save:hover:not(:disabled) {
          background: rgba(36, 137, 219, 0.25);
          border-color: rgba(71, 174, 255, 0.55);
        }

        .modal-save:disabled,
        .modal-cancel:disabled {
          opacity: 0.55;
          cursor: default;
        }

        .modal-spinner {
          width: 13px;
          height: 13px;
          border: 1px solid rgba(191, 228, 255, 0.25);
          border-top-color: #a9dcff;
          border-radius: 50%;
          animation: modal-spin 0.7s linear infinite;
        }

        @keyframes modal-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .detail-status-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 15px 21px 0;
        }

        .detail-asset {
          padding: 5px 8px;
          border: 1px solid rgba(70, 159, 232, 0.13);
          border-radius: 20px;
          color: #55adff;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.1em;
        }

        .detail-primary {
          margin: 15px 21px;
          padding: 17px;
          border: 1px solid rgba(72, 155, 226, 0.11);
          border-radius: 13px;
          background: rgba(4, 16, 29, 0.62);
        }

        .detail-primary span,
        .detail-primary strong,
        .detail-primary small {
          display: block;
        }

        .detail-primary span {
          color: rgba(194, 215, 234, 0.4);
          font-size: 8px;
          text-transform: uppercase;
        }

        .detail-primary strong {
          margin: 5px 0;
          color: #eef8ff;
          font-size: 25px;
        }

        .detail-primary small {
          color: rgba(194, 215, 234, 0.38);
          font-size: 9px;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          margin: 0 21px;
          overflow: hidden;
          border: 1px solid rgba(68, 148, 217, 0.08);
          border-radius: 12px;
          background: rgba(68, 148, 217, 0.07);
        }

        .detail-grid > div {
          min-width: 0;
          padding: 11px;
          background: rgba(4, 13, 23, 0.94);
        }

        .detail-grid span,
        .detail-grid strong {
          display: block;
        }

        .detail-grid span {
          margin-bottom: 4px;
          color: rgba(187, 210, 231, 0.35);
          font-size: 8px;
          text-transform: uppercase;
        }

        .detail-grid strong {
          overflow: hidden;
          color: rgba(223, 237, 248, 0.8);
          font-size: 10px;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .detail-grid .detail-profit {
          color: #58dda0;
        }

        .detail-security-note {
          display: flex;
          gap: 10px;
          margin: 15px 21px;
          padding: 11px;
          border: 1px solid rgba(212, 175, 55, 0.1);
          border-radius: 10px;
          background: rgba(83, 64, 17, 0.08);
        }

        .detail-security-note > span {
          color: #d5b65c;
          font-size: 13px;
        }

        .detail-security-note p {
          margin: 0;
          color: rgba(201, 216, 231, 0.43);
          font-size: 8px;
          line-height: 1.6;
        }

        .detail-close-button {
          width: calc(100% - 42px);
          min-height: 39px;
          margin: 0 21px 21px;
          border: 1px solid rgba(72, 151, 220, 0.14);
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.025);
          color: rgba(207, 225, 240, 0.62);
          cursor: pointer;
          font-size: 10px;
          font-weight: 800;
        }

        .detail-close-button:hover {
          background: rgba(255, 255, 255, 0.045);
          color: #dcebf7;
        }

        @media (max-width: 1100px) {
          .investment-admin-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .investment-plan-admin-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .investment-admin-filters {
            grid-template-columns: 1fr 1fr 1fr;
          }

          .investment-admin-search {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 760px) {
          .investment-admin-topline {
            align-items: flex-start;
            flex-direction: column;
          }

          .investment-admin-refresh {
            align-self: stretch;
            justify-content: center;
          }

          .investment-admin-stats {
            grid-template-columns: 1fr 1fr;
          }

          .investment-admin-section {
            padding: 14px;
          }

          .investment-admin-section-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .investment-admin-primary {
            width: 100%;
            justify-content: center;
          }

          .investment-plan-admin-grid {
            grid-template-columns: 1fr;
          }

          .investment-admin-filters {
            grid-template-columns: 1fr 1fr;
          }

          .investment-admin-search {
            grid-column: 1 / -1;
          }

          .clear-filters {
            grid-column: 1 / -1;
          }

          .investment-admin-tabs {
            overflow-x: auto;
          }

          .investment-admin-tabs button {
            flex: 0 0 auto;
          }

          .investment-admin-security {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .security-status {
            width: 100%;
          }

          .form-grid-two {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .investment-admin-stats {
            grid-template-columns: 1fr;
          }

          .investment-admin-stat {
            min-height: 82px;
          }

          .investment-admin-alert {
            align-items: flex-start;
          }

          .detail-grid {
            grid-template-columns: 1fr;
          }

          .investment-modal-backdrop {
            padding: 10px;
          }

          .investment-plan-modal,
          .investment-detail-modal {
            max-height: calc(100vh - 20px);
            border-radius: 15px;
          }
        }
      `}</style>
    </AdminModule>
  );
}
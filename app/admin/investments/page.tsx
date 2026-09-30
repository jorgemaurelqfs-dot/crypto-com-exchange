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
  created_at?: string;
  updated_at?: string;
  investment_count?: number | string;
};

type Investment = {
  id: string;
  reference: string;
  user_id: string;
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
  updated_at?: string;
  plan_name?: string | null;
};

type Profile = {
  id: string;
  account_id: string | null;
  username: string | null;
  full_name: string | null;
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

const emptyForm: PlanForm = {
  name: "",
  description: "",
  asset_symbol: "CCT",
  minimum_amount: "",
  maximum_amount: "",
  duration_days: "30",
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

function formatPercent(
  value: number | string | null | undefined,
) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "0%";
  }

  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(amount)}%`;
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
      return status || "Unknown";
  }
}

function statusClass(status: string) {
  switch (status) {
    case "active":
      return "admin-investment-status active";

    case "completed":
      return "admin-investment-status completed";

    case "pending":
      return "admin-investment-status pending";

    case "cancelled":
      return "admin-investment-status cancelled";

    default:
      return "admin-investment-status";
  }
}

export default function AdminInvestmentsPage() {
  const supabase = createClient();

  const [plans, setPlans] = useState<InvestmentPlan[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>(
    {},
  );

  const [loading, setLoading] = useState(true);
  const [savingPlan, setSavingPlan] = useState(false);
  const [changingStatus, setChangingStatus] = useState<string | null>(
    null,
  );

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(
    null,
  );

  const [form, setForm] = useState<PlanForm>(emptyForm);

  const [investmentSearch, setInvestmentSearch] = useState("");
  const [investmentStatus, setInvestmentStatus] = useState("all");
  const [investmentAsset, setInvestmentAsset] = useState("all");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        plansResult,
        investmentsResult,
      ] = await Promise.all([
        supabase.rpc("admin_get_investment_plans"),

        supabase.rpc("admin_get_investments"),
      ]);

      if (plansResult.error) {
        throw new Error(
          `Unable to load investment plans: ${plansResult.error.message}`,
        );
      }

      if (investmentsResult.error) {
        throw new Error(
          `Unable to load investments: ${investmentsResult.error.message}`,
        );
      }

      const loadedPlans =
        (plansResult.data ?? []) as InvestmentPlan[];

      const loadedInvestments =
        (investmentsResult.data ?? []) as Investment[];

      setPlans(loadedPlans);
      setInvestments(loadedInvestments);

      const userIds = Array.from(
        new Set(
          loadedInvestments
            .map((investment) => investment.user_id)
            .filter(Boolean),
        ),
      );

      if (userIds.length > 0) {
        const { data: profileData, error: profileError } =
          await supabase
            .from("profiles")
            .select(
              `
                id,
                account_id,
                username,
                full_name
              `,
            )
            .in("id", userIds);

        if (!profileError && profileData) {
          const profileMap: Record<string, Profile> = {};

          for (const profile of profileData as Profile[]) {
            profileMap[profile.id] = profile;
          }

          setProfiles(profileMap);
        }
      } else {
        setProfiles({});
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load investment data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setForm(emptyForm);
    setEditingPlanId(null);
  }

  function openCreateForm() {
    resetForm();
    setShowPlanForm(true);
    setError("");
    setSuccess("");
  }

  function openEditForm(plan: InvestmentPlan) {
    setEditingPlanId(plan.id);

    setForm({
      name: plan.name,
      description: plan.description || "",
      asset_symbol: plan.asset_symbol,
      minimum_amount: String(plan.minimum_amount ?? ""),
      maximum_amount:
        plan.maximum_amount === null ||
        plan.maximum_amount === undefined
          ? ""
          : String(plan.maximum_amount),
      duration_days: String(plan.duration_days),
      profit_rate: String(plan.profit_rate),
      enabled: plan.enabled,
    });

    setShowPlanForm(true);
    setError("");
    setSuccess("");
  }

  function closePlanForm() {
    if (savingPlan) {
      return;
    }

    setShowPlanForm(false);
    resetForm();
  }

  async function handlePlanSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const name = form.name.trim();
    const description = form.description.trim();
    const assetSymbol = form.asset_symbol.trim().toUpperCase();

    const minimumAmount = Number(form.minimum_amount);

    const maximumAmount =
      form.maximum_amount.trim() === ""
        ? null
        : Number(form.maximum_amount);

    const durationDays = Number(form.duration_days);
    const profitRate = Number(form.profit_rate);

    if (!name) {
      setError("Enter an investment plan name.");
      return;
    }

    if (!assetSymbol) {
      setError("Enter an asset symbol.");
      return;
    }

    if (
      !Number.isFinite(minimumAmount) ||
      minimumAmount <= 0
    ) {
      setError("Enter a valid minimum investment amount.");
      return;
    }

    if (
      maximumAmount !== null &&
      (!Number.isFinite(maximumAmount) ||
        maximumAmount <= 0)
    ) {
      setError("Enter a valid maximum investment amount.");
      return;
    }

    if (
      maximumAmount !== null &&
      maximumAmount < minimumAmount
    ) {
      setError(
        "Maximum amount cannot be lower than minimum amount.",
      );
      return;
    }

    if (
      !Number.isFinite(durationDays) ||
      durationDays <= 0 ||
      !Number.isInteger(durationDays)
    ) {
      setError(
        "Duration must be a whole number greater than zero.",
      );
      return;
    }

    if (
      !Number.isFinite(profitRate) ||
      profitRate < 0
    ) {
      setError("Enter a valid profit rate.");
      return;
    }

    setSavingPlan(true);

    try {
      if (editingPlanId) {
        const { error: rpcError } = await supabase.rpc(
          "admin_update_investment_plan",
          {
            p_plan_id: editingPlanId,
            p_name: name,
            p_description: description || null,
            p_asset_symbol: assetSymbol,
            p_minimum_amount: minimumAmount,
            p_maximum_amount: maximumAmount,
            p_duration_days: durationDays,
            p_profit_rate: profitRate,
            p_enabled: form.enabled,
          },
        );

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        setSuccess(
          `${name} has been updated successfully.`,
        );
      } else {
        const { error: rpcError } = await supabase.rpc(
          "admin_create_investment_plan",
          {
            p_name: name,
            p_description: description || null,
            p_asset_symbol: assetSymbol,
            p_minimum_amount: minimumAmount,
            p_maximum_amount: maximumAmount,
            p_duration_days: durationDays,
            p_profit_rate: profitRate,
            p_enabled: form.enabled,
          },
        );

        if (rpcError) {
          throw new Error(rpcError.message);
        }

        setSuccess(
          `${name} has been created successfully.`,
        );
      }

      setShowPlanForm(false);
      resetForm();

      await loadData();
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
    setChangingStatus(plan.id);

    try {
      const { error: rpcError } = await supabase.rpc(
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

      await loadData();
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "Unable to change investment plan status.",
      );
    } finally {
      setChangingStatus(null);
    }
  }

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
    const search = investmentSearch
      .trim()
      .toLowerCase();

    return investments.filter((investment) => {
      const profile = profiles[investment.user_id];

      const matchesSearch =
        !search ||
        investment.reference
          ?.toLowerCase()
          .includes(search) ||
        investment.asset_symbol
          ?.toLowerCase()
          .includes(search) ||
        investment.plan_name
          ?.toLowerCase()
          .includes(search) ||
        profile?.account_id
          ?.toLowerCase()
          .includes(search) ||
        profile?.username
          ?.toLowerCase()
          .includes(search) ||
        profile?.full_name
          ?.toLowerCase()
          .includes(search);

      const matchesStatus =
        investmentStatus === "all" ||
        investment.status === investmentStatus;

      const matchesAsset =
        investmentAsset === "all" ||
        investment.asset_symbol === investmentAsset;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesAsset
      );
    });
  }, [
    investments,
    profiles,
    investmentSearch,
    investmentStatus,
    investmentAsset,
  ]);

  const activePlans = plans.filter(
    (plan) => plan.enabled,
  );

  const activeInvestments = investments.filter(
    (investment) => investment.status === "active",
  );

  const completedInvestments = investments.filter(
    (investment) => investment.status === "completed",
  );

  const totalPrincipal = investments.reduce(
    (total, investment) =>
      total + Number(investment.principal_amount || 0),
    0,
  );

  const totalExpectedProfit = investments.reduce(
    (total, investment) =>
      total + Number(investment.expected_profit || 0),
    0,
  );

  return (
    <AdminModule
      eyebrow="WEALTH MANAGEMENT"
      title="Investments"
      description="Create investment products, manage plan availability and monitor customer investment activity."
      icon="◒"
    >
      <div className="admin-investments-page">
        {error && (
          <div className="admin-investment-alert error">
            <div className="admin-alert-icon">!</div>

            <div>
              <strong>System notice</strong>
              <span>{error}</span>
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
          <div className="admin-investment-alert success">
            <div className="admin-alert-icon">✓</div>

            <div>
              <strong>Operation completed</strong>
              <span>{success}</span>
            </div>

            <button
              type="button"
              onClick={() => setSuccess("")}
            >
              ×
            </button>
          </div>
        )}

        <section className="admin-investment-stats">
          <div className="admin-investment-stat">
            <div className="admin-stat-icon">◒</div>

            <div>
              <span>Investment plans</span>
              <strong>{plans.length}</strong>
              <small>
                {activePlans.length} currently enabled
              </small>
            </div>
          </div>

          <div className="admin-investment-stat">
            <div className="admin-stat-icon">◈</div>

            <div>
              <span>Total investments</span>
              <strong>{investments.length}</strong>
              <small>
                {activeInvestments.length} active
              </small>
            </div>
          </div>

          <div className="admin-investment-stat">
            <div className="admin-stat-icon">↗</div>

            <div>
              <span>Total principal</span>
              <strong>
                {formatAmount(totalPrincipal)}
              </strong>
              <small>CCT currently recorded</small>
            </div>
          </div>

          <div className="admin-investment-stat">
            <div className="admin-stat-icon">✦</div>

            <div>
              <span>Expected profit</span>
              <strong>
                {formatAmount(totalExpectedProfit)}
              </strong>
              <small>
                {completedInvestments.length} completed
              </small>
            </div>
          </div>
        </section>

        <section className="admin-investment-section">
          <div className="admin-section-header">
            <div>
              <span className="admin-section-eyebrow">
                PRODUCT CONFIGURATION
              </span>

              <h2>Investment plans</h2>

              <p>
                Control the investment products available
                to customers.
              </p>
            </div>

            <button
              type="button"
              className="admin-primary-button"
              onClick={openCreateForm}
            >
              <span>+</span>
              Create plan
            </button>
          </div>

          {loading ? (
            <div className="admin-investment-loading">
              <div className="admin-spinner" />
              <span>Loading investment plans...</span>
            </div>
          ) : plans.length === 0 ? (
            <div className="admin-investment-empty">
              <div className="admin-empty-icon">◒</div>

              <h3>No investment plans</h3>

              <p>
                Create your first investment plan to make
                it available on the customer investment
                center.
              </p>

              <button
                type="button"
                className="admin-primary-button"
                onClick={openCreateForm}
              >
                Create first plan
              </button>
            </div>
          ) : (
            <div className="admin-plan-grid">
              {plans.map((plan) => {
                const planInvestments =
                  investments.filter(
                    (investment) =>
                      investment.plan_id === plan.id,
                  );

                const planPrincipal =
                  planInvestments.reduce(
                    (total, investment) =>
                      total +
                      Number(
                        investment.principal_amount || 0,
                      ),
                    0,
                  );

                return (
                  <article
                    className={`admin-plan-card ${
                      plan.enabled
                        ? ""
                        : "disabled"
                    }`}
                    key={plan.id}
                  >
                    <div className="admin-plan-card-top">
                      <div className="admin-plan-symbol">
                        {plan.asset_symbol
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>

                      <div className="admin-plan-status">
                        <span
                          className={
                            plan.enabled
                              ? "enabled"
                              : "disabled"
                          }
                        />

                        {plan.enabled
                          ? "Enabled"
                          : "Disabled"}
                      </div>
                    </div>

                    <div className="admin-plan-heading">
                      <div>
                        <h3>{plan.name}</h3>

                        <span>
                          {plan.asset_symbol} •{" "}
                          {plan.duration_days} days
                        </span>
                      </div>

                      <strong>
                        {formatPercent(
                          plan.profit_rate,
                        )}
                      </strong>
                    </div>

                    <p className="admin-plan-description">
                      {plan.description ||
                        "No plan description has been provided."}
                    </p>

                    <div className="admin-plan-limits">
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
                          {plan.maximum_amount ===
                          null
                            ? "No limit"
                            : `${formatAmount(
                                plan.maximum_amount,
                              )} ${
                                plan.asset_symbol
                              }`}
                        </strong>
                      </div>
                    </div>

                    <div className="admin-plan-activity">
                      <div>
                        <span>Investments</span>
                        <strong>
                          {planInvestments.length}
                        </strong>
                      </div>

                      <div>
                        <span>Principal</span>
                        <strong>
                          {formatAmount(
                            planPrincipal,
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="admin-plan-actions">
                      <button
                        type="button"
                        className="admin-secondary-button"
                        onClick={() =>
                          openEditForm(plan)
                        }
                      >
                        Edit plan
                      </button>

                      <button
                        type="button"
                        className={`admin-toggle-button ${
                          plan.enabled
                            ? "disable"
                            : "enable"
                        }`}
                        disabled={
                          changingStatus === plan.id
                        }
                        onClick={() =>
                          togglePlan(plan)
                        }
                      >
                        {changingStatus ===
                        plan.id
                          ? "Updating..."
                          : plan.enabled
                            ? "Disable"
                            : "Enable"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="admin-investment-section">
          <div className="admin-section-header">
            <div>
              <span className="admin-section-eyebrow">
                CUSTOMER PORTFOLIO
              </span>

              <h2>Investment activity</h2>

              <p>
                Review investments created across the
                platform.
              </p>
            </div>

            <div className="admin-investment-count">
              {filteredInvestments.length} shown
            </div>
          </div>

          <div className="admin-investment-filters">
            <div className="admin-search-field">
              <span>⌕</span>

              <input
                type="text"
                placeholder="Search reference, account, user or plan..."
                value={investmentSearch}
                onChange={(event) =>
                  setInvestmentSearch(
                    event.target.value,
                  )
                }
              />
            </div>

            <select
              value={investmentAsset}
              onChange={(event) =>
                setInvestmentAsset(event.target.value)
              }
            >
              <option value="all">All assets</option>

              {assets.map((asset) => (
                <option key={asset} value={asset}>
                  {asset}
                </option>
              ))}
            </select>

            <select
              value={investmentStatus}
              onChange={(event) =>
                setInvestmentStatus(event.target.value)
              }
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="completed">
                Completed
              </option>
              <option value="cancelled">
                Cancelled
              </option>
            </select>
          </div>

          {loading ? (
            <div className="admin-investment-loading">
              <div className="admin-spinner" />
              <span>
                Loading customer investments...
              </span>
            </div>
          ) : filteredInvestments.length === 0 ? (
            <div className="admin-investment-empty">
              <div className="admin-empty-icon">⌁</div>

              <h3>No matching investments</h3>

              <p>
                No customer investments match the current
                filters.
              </p>
            </div>
          ) : (
            <div className="admin-investment-table-wrap">
              <table className="admin-investment-table">
                <thead>
                  <tr>
                    <th>Investment</th>
                    <th>Customer</th>
                    <th>Plan</th>
                    <th>Principal</th>
                    <th>Profit</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredInvestments.map(
                    (investment) => {
                      const profile =
                        profiles[investment.user_id];

                      return (
                        <tr key={investment.id}>
                          <td>
                            <div className="admin-investment-reference">
                              <strong>
                                {investment.reference}
                              </strong>

                              <span>
                                {investment.asset_symbol}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="admin-customer-cell">
                              <strong>
                                {profile?.full_name ||
                                  profile?.username ||
                                  "Account holder"}
                              </strong>

                              <span>
                                {profile?.account_id ||
                                  profile?.username ||
                                  investment.user_id.slice(
                                    0,
                                    8,
                                  )}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="admin-plan-cell">
                              <strong>
                                {investment.plan_name ||
                                  plans.find(
                                    (plan) =>
                                      plan.id ===
                                      investment.plan_id,
                                  )?.name ||
                                  "Investment plan"}
                              </strong>

                              <span>
                                {formatPercent(
                                  investment.profit_rate,
                                )}
                              </span>
                            </div>
                          </td>

                          <td>
                            <strong className="table-amount">
                              {formatAmount(
                                investment.principal_amount,
                              )}{" "}
                              {investment.asset_symbol}
                            </strong>
                          </td>

                          <td>
                            <div className="table-profit">
                              <strong>
                                +
                                {formatAmount(
                                  investment.expected_profit,
                                )}
                              </strong>

                              <span>
                                Earned{" "}
                                {formatAmount(
                                  investment.earned_profit,
                                )}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span
                              className={statusClass(
                                investment.status,
                              )}
                            >
                              <i />
                              {statusLabel(
                                investment.status,
                              )}
                            </span>
                          </td>

                          <td>
                            <span className="table-date">
                              {formatDate(
                                investment.created_at,
                              )}
                            </span>
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

        <section className="admin-investment-security">
          <div className="security-orb">◆</div>

          <div>
            <span>SECURE INVESTMENT CONTROL</span>

            <h3>
              Investment changes are processed through
              administrator RPC functions.
            </h3>

            <p>
              The admin interface does not directly modify
              investment records or customer balances.
              Plan creation, updates and availability
              changes are handled by the database security
              layer.
            </p>
          </div>

          <div className="security-status">
            <span />
            SECURE
          </div>
        </section>
      </div>

      {showPlanForm && (
        <div className="admin-modal-backdrop">
          <div
            className="admin-plan-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="investment-plan-modal-title"
          >
            <div className="admin-modal-header">
              <div>
                <span className="admin-section-eyebrow">
                  {editingPlanId
                    ? "PLAN MANAGEMENT"
                    : "NEW PRODUCT"}
                </span>

                <h2 id="investment-plan-modal-title">
                  {editingPlanId
                    ? "Edit investment plan"
                    : "Create investment plan"}
                </h2>

                <p>
                  Configure the product customers will
                  see in the investment center.
                </p>
              </div>

              <button
                type="button"
                className="admin-modal-close"
                onClick={closePlanForm}
                disabled={savingPlan}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <form
              className="admin-plan-form"
              onSubmit={handlePlanSubmit}
            >
              <div className="admin-form-grid">
                <div className="admin-form-field full">
                  <label htmlFor="plan-name">
                    Plan name
                  </label>

                  <input
                    id="plan-name"
                    type="text"
                    placeholder="CCT Growth 30"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="admin-form-field">
                  <label htmlFor="plan-asset">
                    Asset symbol
                  </label>

                  <input
                    id="plan-asset"
                    type="text"
                    placeholder="CCT"
                    value={form.asset_symbol}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        asset_symbol:
                          event.target.value.toUpperCase(),
                      }))
                    }
                  />
                </div>

                <div className="admin-form-field">
                  <label htmlFor="plan-duration">
                    Duration
                  </label>

                  <div className="admin-input-suffix">
                    <input
                      id="plan-duration"
                      type="number"
                      min="1"
                      step="1"
                      value={form.duration_days}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          duration_days:
                            event.target.value,
                        }))
                      }
                    />

                    <span>days</span>
                  </div>
                </div>

                <div className="admin-form-field">
                  <label htmlFor="plan-minimum">
                    Minimum amount
                  </label>

                  <div className="admin-input-suffix">
                    <input
                      id="plan-minimum"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="100"
                      value={form.minimum_amount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          minimum_amount:
                            event.target.value,
                        }))
                      }
                    />

                    <span>{form.asset_symbol || "CCT"}</span>
                  </div>
                </div>

                <div className="admin-form-field">
                  <label htmlFor="plan-maximum">
                    Maximum amount
                  </label>

                  <div className="admin-input-suffix">
                    <input
                      id="plan-maximum"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="No limit"
                      value={form.maximum_amount}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          maximum_amount:
                            event.target.value,
                        }))
                      }
                    />

                    <span>{form.asset_symbol || "CCT"}</span>
                  </div>

                  <small>
                    Leave empty for no maximum.
                  </small>
                </div>

                <div className="admin-form-field">
                  <label htmlFor="plan-profit">
                    Profit rate
                  </label>

                  <div className="admin-input-suffix">
                    <input
                      id="plan-profit"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="5"
                      value={form.profit_rate}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          profit_rate:
                            event.target.value,
                        }))
                      }
                    />

                    <span>%</span>
                  </div>
                </div>

                <div className="admin-form-field full">
                  <label htmlFor="plan-description">
                    Description
                  </label>

                  <textarea
                    id="plan-description"
                    rows={4}
                    placeholder="Describe the investment plan..."
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description:
                          event.target.value,
                      }))
                    }
                  />
                </div>

                <label className="admin-plan-enabled">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        enabled:
                          event.target.checked,
                      }))
                    }
                  />

                  <span className="admin-custom-checkbox">
                    ✓
                  </span>

                  <span>
                    <strong>Make plan available</strong>
                    <small>
                      Customers can see and select this
                      plan when enabled.
                    </small>
                  </span>
                </label>
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={closePlanForm}
                  disabled={savingPlan}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-primary-button"
                  disabled={savingPlan}
                >
                  {savingPlan ? (
                    <>
                      <span className="admin-button-spinner" />
                      Saving...
                    </>
                  ) : editingPlanId ? (
                    "Save changes"
                  ) : (
                    "Create plan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-investments-page {
          position: relative;
          color: #e9f5ff;
        }

        .admin-investment-alert {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 22px;
          padding: 14px 16px;
          border: 1px solid rgba(0, 153, 255, 0.2);
          border-radius: 16px;
          background: rgba(4, 12, 24, 0.82);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
        }

        .admin-investment-alert.error {
          border-color: rgba(255, 82, 82, 0.28);
        }

        .admin-investment-alert.success {
          border-color: rgba(46, 220, 145, 0.25);
        }

        .admin-alert-icon {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          flex: 0 0 34px;
          border-radius: 10px;
          background: rgba(0, 153, 255, 0.1);
          color: #63c7ff;
          font-weight: 800;
        }

        .error .admin-alert-icon {
          color: #ff7777;
          background: rgba(255, 80, 80, 0.1);
        }

        .success .admin-alert-icon {
          color: #61e9ae;
          background: rgba(40, 220, 140, 0.1);
        }

        .admin-investment-alert div:nth-child(2) {
          display: grid;
          gap: 3px;
          flex: 1;
        }

        .admin-investment-alert strong {
          font-size: 13px;
          letter-spacing: 0.05em;
        }

        .admin-investment-alert span {
          color: #7e99ad;
          font-size: 12px;
        }

        .admin-investment-alert > button {
          border: 0;
          background: transparent;
          color: #688093;
          cursor: pointer;
          font-size: 20px;
        }

        .admin-investment-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
          margin-bottom: 26px;
        }

        .admin-investment-stat {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 108px;
          padding: 18px;
          overflow: hidden;
          border: 1px solid rgba(73, 139, 180, 0.16);
          border-radius: 18px;
          background:
            linear-gradient(
              145deg,
              rgba(11, 29, 49, 0.92),
              rgba(3, 10, 20, 0.94)
            );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.035),
            0 18px 45px rgba(0, 0, 0, 0.2);
        }

        .admin-investment-stat::after {
          content: "";
          position: absolute;
          width: 110px;
          height: 110px;
          right: -50px;
          top: -55px;
          border-radius: 50%;
          background: rgba(0, 153, 255, 0.08);
          filter: blur(5px);
        }

        .admin-stat-icon {
          width: 45px;
          height: 45px;
          display: grid;
          place-items: center;
          flex: 0 0 45px;
          border: 1px solid rgba(0, 153, 255, 0.18);
          border-radius: 13px;
          background: rgba(0, 153, 255, 0.07);
          color: #5cc4ff;
          font-size: 20px;
          box-shadow: 0 0 25px rgba(0, 153, 255, 0.08);
        }

        .admin-investment-stat > div:last-child {
          min-width: 0;
          display: grid;
          gap: 3px;
        }

        .admin-investment-stat span {
          color: #6f899d;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.11em;
        }

        .admin-investment-stat strong {
          color: #edf8ff;
          font-size: 22px;
          line-height: 1.1;
        }

        .admin-investment-stat small {
          color: #4f687a;
          font-size: 10px;
        }

        .admin-investment-section {
          position: relative;
          margin-bottom: 28px;
          padding: 24px;
          overflow: hidden;
          border: 1px solid rgba(73, 139, 180, 0.15);
          border-radius: 22px;
          background:
            linear-gradient(
              145deg,
              rgba(7, 19, 33, 0.94),
              rgba(2, 8, 16, 0.97)
            );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.03),
            0 25px 70px rgba(0, 0, 0, 0.2);
        }

        .admin-investment-section::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              90deg,
              rgba(0, 153, 255, 0.025) 1px,
              transparent 1px
            ),
            linear-gradient(
              rgba(0, 153, 255, 0.018) 1px,
              transparent 1px
            );
          background-size: 42px 42px;
          mask-image: linear-gradient(
            to bottom,
            black,
            transparent 70%
          );
        }

        .admin-section-header {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .admin-section-header > div:first-child {
          min-width: 0;
        }

        .admin-section-eyebrow {
          display: block;
          margin-bottom: 6px;
          color: #3faee8;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.18em;
        }

        .admin-section-header h2 {
          margin: 0;
          color: #f1f9ff;
          font-size: 22px;
          letter-spacing: -0.02em;
        }

        .admin-section-header p {
          margin: 6px 0 0;
          color: #637c8f;
          font-size: 12px;
        }

        .admin-primary-button,
        .admin-secondary-button,
        .admin-toggle-button {
          min-height: 40px;
          border-radius: 11px;
          padding: 0 15px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.03em;
          cursor: pointer;
          transition:
            transform 0.18s ease,
            border-color 0.18s ease,
            background 0.18s ease;
        }

        .admin-primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(0, 153, 255, 0.45);
          background:
            linear-gradient(
              135deg,
              rgba(0, 142, 235, 0.9),
              rgba(0, 87, 155, 0.92)
            );
          color: white;
          box-shadow:
            0 8px 30px rgba(0, 115, 210, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .admin-primary-button:hover {
          transform: translateY(-1px);
          border-color: rgba(94, 198, 255, 0.75);
        }

        .admin-secondary-button {
          border: 1px solid rgba(82, 124, 153, 0.25);
          background: rgba(7, 20, 34, 0.8);
          color: #a9c1d2;
        }

        .admin-secondary-button:hover {
          border-color: rgba(0, 153, 255, 0.35);
          color: white;
        }

        .admin-primary-button:disabled,
        .admin-secondary-button:disabled,
        .admin-toggle-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          transform: none;
        }

        .admin-plan-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(
            auto-fit,
            minmax(285px, 1fr)
          );
          gap: 15px;
        }

        .admin-plan-card {
          position: relative;
          padding: 19px;
          overflow: hidden;
          border: 1px solid rgba(67, 128, 166, 0.18);
          border-radius: 17px;
          background:
            linear-gradient(
              150deg,
              rgba(8, 27, 46, 0.86),
              rgba(3, 11, 20, 0.9)
            );
          transition:
            transform 0.2s ease,
            border-color 0.2s ease;
        }

        .admin-plan-card:hover {
          transform: translateY(-2px);
          border-color: rgba(0, 153, 255, 0.35);
        }

        .admin-plan-card.disabled {
          opacity: 0.66;
        }

        .admin-plan-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 17px;
        }

        .admin-plan-symbol {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(212, 175, 55, 0.28);
          border-radius: 11px;
          background: rgba(212, 175, 55, 0.07);
          color: #f0d46b;
          font-size: 15px;
          font-weight: 900;
        }

        .admin-plan-status {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #617b8d;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .admin-plan-status span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #657786;
        }

        .admin-plan-status span.enabled {
          background: #38dfa0;
          box-shadow: 0 0 10px rgba(56, 223, 160, 0.6);
        }

        .admin-plan-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .admin-plan-heading h3 {
          margin: 0;
          color: #edf8ff;
          font-size: 16px;
        }

        .admin-plan-heading span {
          display: block;
          margin-top: 4px;
          color: #60798c;
          font-size: 10px;
        }

        .admin-plan-heading > strong {
          color: #53e7a9;
          font-size: 17px;
          white-space: nowrap;
        }

        .admin-plan-description {
          min-height: 39px;
          margin: 13px 0;
          color: #7891a3;
          font-size: 11px;
          line-height: 1.6;
        }

        .admin-plan-limits {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 9px;
        }

        .admin-plan-limits > div,
        .admin-plan-activity > div {
          padding: 10px;
          border: 1px solid rgba(83, 128, 158, 0.11);
          border-radius: 10px;
          background: rgba(2, 10, 18, 0.55);
        }

        .admin-plan-limits span,
        .admin-plan-activity span {
          display: block;
          margin-bottom: 4px;
          color: #536d80;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .admin-plan-limits strong,
        .admin-plan-activity strong {
          color: #dbeaf4;
          font-size: 11px;
        }

        .admin-plan-activity {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 14px;
        }

        .admin-plan-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .admin-toggle-button {
          border: 1px solid rgba(80, 112, 132, 0.25);
          background: rgba(7, 17, 28, 0.75);
          color: #8ba3b4;
        }

        .admin-toggle-button.enable {
          border-color: rgba(46, 220, 145, 0.25);
          color: #5de5aa;
        }

        .admin-toggle-button.disable {
          color: #e5b56c;
        }

        .admin-investment-count {
          padding: 8px 11px;
          border: 1px solid rgba(75, 128, 164, 0.18);
          border-radius: 9px;
          background: rgba(3, 13, 23, 0.7);
          color: #7691a4;
          font-size: 10px;
          white-space: nowrap;
        }

        .admin-investment-filters {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 150px 160px;
          gap: 9px;
          margin-bottom: 16px;
        }

        .admin-search-field,
        .admin-investment-filters select {
          height: 40px;
          border: 1px solid rgba(77, 126, 157, 0.19);
          border-radius: 10px;
          background: rgba(2, 10, 18, 0.72);
          color: #b9cfdd;
          font-family: inherit;
          font-size: 11px;
          outline: none;
        }

        .admin-search-field {
          display: flex;
          align-items: center;
          padding: 0 12px;
          gap: 9px;
        }

        .admin-search-field span {
          color: #3c94c5;
          font-size: 16px;
        }

        .admin-search-field input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #dbeaf4;
          font: inherit;
        }

        .admin-search-field input::placeholder {
          color: #4e6779;
        }

        .admin-investment-filters select {
          padding: 0 10px;
        }

        .admin-investment-table-wrap {
          position: relative;
          z-index: 1;
          overflow-x: auto;
          border: 1px solid rgba(73, 128, 160, 0.13);
          border-radius: 14px;
        }

        .admin-investment-table {
          width: 100%;
          min-width: 920px;
          border-collapse: collapse;
        }

        .admin-investment-table th {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(74, 125, 156, 0.14);
          background: rgba(3, 14, 25, 0.72);
          color: #526e81;
          font-size: 9px;
          font-weight: 800;
          text-align: left;
          text-transform: uppercase;
          letter-spacing: 0.09em;
          white-space: nowrap;
        }

        .admin-investment-table td {
          padding: 14px;
          border-bottom: 1px solid rgba(68, 117, 146, 0.09);
          color: #9db4c3;
          font-size: 11px;
          vertical-align: middle;
        }

        .admin-investment-table tbody tr {
          transition: background 0.15s ease;
        }

        .admin-investment-table tbody tr:hover {
          background: rgba(0, 153, 255, 0.025);
        }

        .admin-investment-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .admin-investment-reference,
        .admin-customer-cell,
        .admin-plan-cell,
        .table-profit {
          display: grid;
          gap: 4px;
        }

        .admin-investment-reference strong,
        .admin-customer-cell strong,
        .admin-plan-cell strong {
          color: #dbeaf4;
          font-size: 11px;
        }

        .admin-investment-reference span,
        .admin-customer-cell span,
        .admin-plan-cell span,
        .table-profit span,
        .table-date {
          color: #526d80;
          font-size: 9px;
        }

        .table-amount {
          color: #cfe6f4;
          white-space: nowrap;
          font-size: 11px;
        }

        .table-profit strong {
          color: #56e2a6;
          font-size: 11px;
        }

        .admin-investment-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border: 1px solid rgba(91, 120, 139, 0.15);
          border-radius: 999px;
          background: rgba(4, 14, 23, 0.72);
          color: #7890a1;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .admin-investment-status i {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #758694;
        }

        .admin-investment-status.active {
          color: #55e4a7;
          border-color: rgba(53, 218, 145, 0.18);
        }

        .admin-investment-status.active i {
          background: #46dfa0;
          box-shadow: 0 0 8px rgba(70, 223, 160, 0.55);
        }

        .admin-investment-status.completed {
          color: #62c6ff;
          border-color: rgba(0, 153, 255, 0.2);
        }

        .admin-investment-status.completed i {
          background: #48b9f4;
        }

        .admin-investment-status.pending {
          color: #e5bf72;
          border-color: rgba(212, 175, 55, 0.2);
        }

        .admin-investment-status.pending i {
          background: #d9b15c;
        }

        .admin-investment-status.cancelled {
          color: #ff8585;
          border-color: rgba(255, 88, 88, 0.2);
        }

        .admin-investment-status.cancelled i {
          background: #ff6d6d;
        }

        .admin-investment-empty,
        .admin-investment-loading {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          min-height: 220px;
          padding: 30px;
          text-align: center;
          border: 1px dashed rgba(75, 126, 157, 0.16);
          border-radius: 15px;
          background: rgba(2, 10, 18, 0.42);
        }

        .admin-investment-empty {
          display: flex;
          flex-direction: column;
        }

        .admin-empty-icon {
          width: 55px;
          height: 55px;
          display: grid;
          place-items: center;
          margin-bottom: 12px;
          border: 1px solid rgba(0, 153, 255, 0.16);
          border-radius: 15px;
          background: rgba(0, 153, 255, 0.05);
          color: #3faee8;
          font-size: 23px;
        }

        .admin-investment-empty h3 {
          margin: 0;
          color: #dbeaf4;
          font-size: 16px;
        }

        .admin-investment-empty p {
          max-width: 430px;
          margin: 7px 0 16px;
          color: #60798c;
          font-size: 11px;
          line-height: 1.6;
        }

        .admin-spinner {
          width: 30px;
          height: 30px;
          margin-bottom: 12px;
          border: 2px solid rgba(0, 153, 255, 0.12);
          border-top-color: #32aeea;
          border-radius: 50%;
          animation: adminSpin 0.8s linear infinite;
        }

        .admin-investment-loading span {
          color: #60798c;
          font-size: 11px;
        }

        .admin-investment-security {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 10px;
          padding: 19px;
          border: 1px solid rgba(212, 175, 55, 0.12);
          border-radius: 17px;
          background:
            linear-gradient(
              120deg,
              rgba(18, 20, 18, 0.84),
              rgba(5, 12, 17, 0.94)
            );
        }

        .security-orb {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          flex: 0 0 43px;
          border: 1px solid rgba(212, 175, 55, 0.22);
          border-radius: 12px;
          background: rgba(212, 175, 55, 0.06);
          color: #d8bd61;
        }

        .admin-investment-security > div:nth-child(2) {
          flex: 1;
        }

        .admin-investment-security > div:nth-child(2) > span {
          color: #b69a4b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .admin-investment-security h3 {
          margin: 4px 0 3px;
          color: #dbe6eb;
          font-size: 13px;
        }

        .admin-investment-security p {
          margin: 0;
          color: #627987;
          font-size: 10px;
          line-height: 1.55;
        }

        .security-status {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #53dba4;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .security-status span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #4ee0a3;
          box-shadow: 0 0 9px rgba(78, 224, 163, 0.6);
        }

        .admin-modal-backdrop {
          position: fixed;
          z-index: 1000;
          inset: 0;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(0, 3, 8, 0.78);
          backdrop-filter: blur(12px);
        }

        .admin-plan-modal {
          width: min(700px, 100%);
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          border: 1px solid rgba(70, 143, 187, 0.25);
          border-radius: 22px;
          background:
            linear-gradient(
              145deg,
              rgba(8, 24, 41, 0.98),
              rgba(2, 8, 15, 0.99)
            );
          box-shadow:
            0 35px 100px rgba(0, 0, 0, 0.65),
            0 0 70px rgba(0, 125, 210, 0.08);
        }

        .admin-modal-header {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 23px 24px 18px;
          border-bottom: 1px solid rgba(72, 127, 159, 0.13);
        }

        .admin-modal-header h2 {
          margin: 0;
          color: #eff9ff;
          font-size: 21px;
        }

        .admin-modal-header p {
          margin: 6px 0 0;
          color: #60798b;
          font-size: 11px;
        }

        .admin-modal-close {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          border: 1px solid rgba(85, 124, 148, 0.18);
          border-radius: 10px;
          background: rgba(4, 14, 23, 0.7);
          color: #7791a2;
          cursor: pointer;
          font-size: 19px;
        }

        .admin-plan-form {
          padding: 22px 24px 24px;
        }

        .admin-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }

        .admin-form-field {
          display: grid;
          gap: 7px;
        }

        .admin-form-field.full {
          grid-column: 1 / -1;
        }

        .admin-form-field label {
          color: #7590a2;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .admin-form-field input,
        .admin-form-field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(72, 128, 162, 0.2);
          border-radius: 10px;
          outline: none;
          background: rgba(2, 9, 16, 0.78);
          color: #e2f0f8;
          font-family: inherit;
          font-size: 12px;
        }

        .admin-form-field input {
          height: 42px;
          padding: 0 12px;
        }

        .admin-form-field textarea {
          resize: vertical;
          min-height: 90px;
          padding: 12px;
        }

        .admin-form-field input:focus,
        .admin-form-field textarea:focus {
          border-color: rgba(0, 153, 255, 0.48);
          box-shadow: 0 0 0 3px rgba(0, 153, 255, 0.05);
        }

        .admin-form-field small {
          color: #50697a;
          font-size: 9px;
        }

        .admin-input-suffix {
          display: flex;
          align-items: center;
          overflow: hidden;
          border: 1px solid rgba(72, 128, 162, 0.2);
          border-radius: 10px;
          background: rgba(2, 9, 16, 0.78);
        }

        .admin-input-suffix input {
          border: 0;
          background: transparent;
          box-shadow: none;
        }

        .admin-input-suffix span {
          padding: 0 11px;
          color: #547184;
          font-size: 9px;
          font-weight: 800;
          white-space: nowrap;
        }

        .admin-plan-enabled {
          grid-column: 1 / -1;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 12px;
          border: 1px solid rgba(72, 128, 162, 0.14);
          border-radius: 12px;
          background: rgba(2, 11, 19, 0.55);
          cursor: pointer;
        }

        .admin-plan-enabled input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .admin-custom-checkbox {
          width: 20px;
          height: 20px;
          display: grid;
          place-items: center;
          flex: 0 0 20px;
          border: 1px solid rgba(0, 153, 255, 0.35);
          border-radius: 6px;
          background: rgba(0, 153, 255, 0.1);
          color: #5cc7ff;
          font-size: 11px;
        }

        .admin-plan-enabled input:not(:checked)
          + .admin-custom-checkbox {
          color: transparent;
          background: rgba(4, 13, 21, 0.7);
          border-color: rgba(76, 110, 132, 0.22);
        }

        .admin-plan-enabled > span:last-child {
          display: grid;
          gap: 3px;
        }

        .admin-plan-enabled strong {
          color: #d6e7f0;
          font-size: 11px;
        }

        .admin-plan-enabled small {
          color: #5d7587;
          font-size: 9px;
        }

        .admin-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 9px;
          margin-top: 20px;
          padding-top: 18px;
          border-top: 1px solid rgba(72, 127, 159, 0.12);
        }

        .admin-button-spinner {
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: adminSpin 0.7s linear infinite;
        }

        @keyframes adminSpin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 1050px) {
          .admin-investment-stats {
            grid-template-columns: repeat(2, 1fr);
          }

          .admin-investment-filters {
            grid-template-columns: 1fr 1fr;
          }

          .admin-search-field {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 720px) {
          .admin-investment-section {
            padding: 17px;
            border-radius: 17px;
          }

          .admin-section-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .admin-investment-stats {
            grid-template-columns: 1fr;
          }

          .admin-investment-filters {
            grid-template-columns: 1fr;
          }

          .admin-search-field {
            grid-column: auto;
          }

          .admin-form-grid {
            grid-template-columns: 1fr;
          }

          .admin-form-field.full,
          .admin-plan-enabled {
            grid-column: auto;
          }

          .admin-plan-grid {
            grid-template-columns: 1fr;
          }

          .admin-investment-security {
            align-items: flex-start;
            flex-direction: column;
          }

          .security-status {
            margin-left: 59px;
          }

          .admin-plan-modal {
            max-height: calc(100vh - 20px);
          }

          .admin-modal-header,
          .admin-plan-form {
            padding-left: 17px;
            padding-right: 17px;
          }
        }
      `}</style>
    </AdminModule>
  );
}
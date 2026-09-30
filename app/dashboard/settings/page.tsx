"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../../../lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email_notifications_enabled: boolean;
  security_alerts_enabled: boolean;
  preferred_currency: string;
  timezone: string;
  verification_status: string | null;
};

type WalletOption = {
  id: string;
  asset_code: string;
  asset_name: string;
  network_code: string;
  network_name: string;
  address_label: string | null;
  is_enabled: boolean;
  display_order: number;
};

type SavedAddress = {
  id: string;
  user_id: string;
  wallet_option_id: string;
  label: string | null;
  wallet_address: string;
  is_preferred: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  asset_code: string;
  asset_name: string;
  network_code: string;
  network_name: string;
  address_label: string | null;
};

type VerificationStatus = {
  email: string | null;
  email_confirmed_at: string | null;
  is_verified: boolean;
};

type AddressForm = {
  wallet_option_id: string;
  label: string;
  wallet_address: string;
  is_preferred: boolean;
};

const TIMEZONES = [
  "UTC",
  "Africa/Lagos",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Los_Angeles",
  "America/Toronto",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
];

const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "NGN",
  "CAD",
  "AUD",
  "CHF",
  "JPY",
];

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [verification, setVerification] =
    useState<VerificationStatus | null>(null);

  const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  const [activeSection, setActiveSection] = useState("profile");

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(
    null
  );

  const [addressForm, setAddressForm] = useState<AddressForm>({
    wallet_option_id: "",
    label: "",
    wallet_address: "",
    is_preferred: false,
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedWalletOption = useMemo(
    () =>
      walletOptions.find(
        (option) => option.id === addressForm.wallet_option_id
      ) || null,
    [walletOptions, addressForm.wallet_option_id]
  );

  const clearMessages = useCallback(() => {
    setMessage("");
    setError("");
  }, []);

  /*
   * Synchronize the profile verification status with Supabase Auth.
   *
   * Auth is the source of truth for whether the user's email has actually
   * been confirmed.
   */
  const syncVerificationStatus = useCallback(
    async (
      userId: string,
      isVerified: boolean,
      currentStatus: string | null
    ) => {
      const newStatus = isVerified ? "verified" : "pending";

      if (currentStatus === newStatus) {
        return;
      }

      /*
       * Use the database synchronization function supplied by the migration.
       *
       * If the function is unavailable for any reason, the UI still uses
       * Supabase Auth as the source of truth.
       */
      const { error: syncError } = await supabase.rpc(
        "sync_profile_email_verification",
        {
          p_user_id: userId,
        }
      );

      if (syncError) {
        console.warn(
          "Profile verification synchronization warning:",
          syncError.message
        );

        /*
         * Fallback for installations where the synchronization RPC has not
         * been granted correctly yet.
         */
        const { error: fallbackError } = await supabase
          .from("profiles")
          .update({
            verification_status: newStatus,
          })
          .eq("id", userId);

        if (fallbackError) {
          console.warn(
            "Profile verification fallback warning:",
            fallbackError.message
          );
        }
      }
    },
    [supabase]
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const [
        profileResult,
        optionsResult,
        addressesResult,
        verificationResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            `
              id,
              full_name,
              username,
              avatar_url,
              email_notifications_enabled,
              security_alerts_enabled,
              preferred_currency,
              timezone,
              verification_status
            `
          )
          .eq("id", user.id)
          .maybeSingle(),

        supabase
          .from("withdrawal_wallet_options")
          .select(
            `
              id,
              asset_code,
              asset_name,
              network_code,
              network_name,
              address_label,
              is_enabled,
              display_order
            `
          )
          .eq("is_enabled", true)
          .order("display_order", { ascending: true }),

        supabase
          .from("my_saved_withdrawal_addresses")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase.rpc("get_my_email_verification_status"),
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (optionsResult.error) {
        throw optionsResult.error;
      }

      if (addressesResult.error) {
        throw addressesResult.error;
      }

      if (verificationResult.error) {
        throw verificationResult.error;
      }

      if (!profileResult.data) {
        throw new Error("Your profile could not be found.");
      }

      const profileData = profileResult.data as Profile;
      const verificationData =
        verificationResult.data?.[0] as VerificationStatus | undefined;

      setProfile(profileData);
      setWalletOptions((optionsResult.data || []) as WalletOption[]);
      setSavedAddresses((addressesResult.data || []) as SavedAddress[]);

      if (verificationData) {
        setVerification(verificationData);

        /*
         * Supabase Auth determines the real verification state.
         */
        const authVerified = Boolean(verificationData.is_verified);

        if (
          authVerified &&
          profileData.verification_status !== "verified"
        ) {
          await syncVerificationStatus(
            user.id,
            true,
            profileData.verification_status
          );

          setProfile((current) =>
            current
              ? {
                  ...current,
                  verification_status: "verified",
                }
              : current
          );
        }

        if (
          !authVerified &&
          profileData.verification_status !== "pending"
        ) {
          await syncVerificationStatus(
            user.id,
            false,
            profileData.verification_status
          );

          setProfile((current) =>
            current
              ? {
                  ...current,
                  verification_status: "pending",
                }
              : current
          );
        }
      }
    } catch (err) {
      console.error("Settings loading error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your settings."
      );
    } finally {
      setLoading(false);
    }
  }, [supabase, syncVerificationStatus]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveProfile() {
    if (!profile) return;

    clearMessages();
    setSavingProfile(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: profile.full_name?.trim() || null,
          username: profile.username?.trim() || null,
          avatar_url: profile.avatar_url?.trim() || null,
          email_notifications_enabled:
            profile.email_notifications_enabled,
          security_alerts_enabled:
            profile.security_alerts_enabled,
          preferred_currency: profile.preferred_currency,
          timezone: profile.timezone,
        })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      setMessage("Your profile settings have been saved.");
    } catch (err) {
      console.error("Profile save error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save your profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  function startAddingAddress() {
    clearMessages();

    setEditingAddressId(null);

    setAddressForm({
      wallet_option_id: walletOptions[0]?.id || "",
      label: "",
      wallet_address: "",
      is_preferred: false,
    });

    setShowAddressForm(true);
    setActiveSection("withdrawal");
  }

  function startEditingAddress(address: SavedAddress) {
    clearMessages();

    setEditingAddressId(address.id);

    setAddressForm({
      wallet_option_id: address.wallet_option_id,
      label: address.label || "",
      wallet_address: address.wallet_address,
      is_preferred: address.is_preferred,
    });

    setShowAddressForm(true);
    setActiveSection("withdrawal");
  }

  function cancelAddressForm() {
    setShowAddressForm(false);
    setEditingAddressId(null);

    setAddressForm({
      wallet_option_id: "",
      label: "",
      wallet_address: "",
      is_preferred: false,
    });
  }

  async function saveAddress() {
    clearMessages();

    if (!addressForm.wallet_option_id) {
      setError("Please select an asset and network.");
      return;
    }

    if (!addressForm.wallet_address.trim()) {
      setError("Please enter the wallet address.");
      return;
    }

    setSavingAddress(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const payload = {
        wallet_option_id: addressForm.wallet_option_id,
        label: addressForm.label.trim() || null,
        wallet_address: addressForm.wallet_address.trim(),
        is_preferred: addressForm.is_preferred,
      };

      if (editingAddressId) {
        const { error: updateError } = await supabase
          .from("saved_withdrawal_addresses")
          .update(payload)
          .eq("id", editingAddressId)
          .eq("user_id", user.id);

        if (updateError) {
          throw updateError;
        }

        setMessage("Withdrawal destination updated.");
      } else {
        const { error: insertError } = await supabase
          .from("saved_withdrawal_addresses")
          .insert({
            user_id: user.id,
            ...payload,
          });

        if (insertError) {
          throw insertError;
        }

        setMessage("Withdrawal destination saved.");
      }

      cancelAddressForm();
      await reloadSavedAddresses();
    } catch (err) {
      console.error("Address save error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save the withdrawal destination."
      );
    } finally {
      setSavingAddress(false);
    }
  }

  async function reloadSavedAddresses() {
    const { data, error: reloadError } = await supabase
      .from("my_saved_withdrawal_addresses")
      .select("*")
      .order("created_at", { ascending: false });

    if (reloadError) {
      console.error("Address reload error:", reloadError);
      return;
    }

    setSavedAddresses((data || []) as SavedAddress[]);
  }

  async function deleteAddress(id: string) {
    clearMessages();

    const confirmed = window.confirm(
      "Delete this saved withdrawal destination?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const { error: deleteError } = await supabase
        .from("saved_withdrawal_addresses")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (deleteError) {
        throw deleteError;
      }

      setSavedAddresses((current) =>
        current.filter((address) => address.id !== id)
      );

      setMessage("Withdrawal destination deleted.");
    } catch (err) {
      console.error("Address deletion error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete the withdrawal destination."
      );
    }
  }

  async function makePreferred(address: SavedAddress) {
    clearMessages();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Your session has expired.");
      }

      const { error: updateError } = await supabase
        .from("saved_withdrawal_addresses")
        .update({
          is_preferred: true,
        })
        .eq("id", address.id)
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      await reloadSavedAddresses();

      setMessage(
        `${address.asset_code} ${address.network_code} is now your preferred destination.`
      );
    } catch (err) {
      console.error("Preferred address error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update the preferred destination."
      );
    }
  }

  async function refreshVerification() {
    clearMessages();

    try {
      const { data, error: verificationError } = await supabase.rpc(
        "get_my_email_verification_status"
      );

      if (verificationError) {
        throw verificationError;
      }

      const current = data?.[0] as VerificationStatus | undefined;

      if (!current) {
        throw new Error("Unable to read verification status.");
      }

      setVerification(current);

      const newStatus = current.is_verified ? "verified" : "pending";

      if (profile && profile.verification_status !== newStatus) {
        await syncVerificationStatus(
          profile.id,
          current.is_verified,
          profile.verification_status
        );

        setProfile({
          ...profile,
          verification_status: newStatus,
        });
      }

      setMessage(
        current.is_verified
          ? "Your email is verified."
          : "Your email has not been verified yet."
      );
    } catch (err) {
      console.error("Verification refresh error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh verification status."
      );
    }
  }

  async function resendVerificationEmail() {
    clearMessages();

    if (!verification?.email) {
      setError("No email address is available for this account.");
      return;
    }

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: verification.email,
      });

      if (resendError) {
        throw resendError;
      }

      setMessage("A new verification email has been sent.");
    } catch (err) {
      console.error("Verification email error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to send the verification email."
      );
    }
  }

  function maskAddress(address: string) {
    if (address.length <= 18) {
      return address;
    }

    return `${address.slice(0, 9)}...${address.slice(-9)}`;
  }

  function formatDate(value: string) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return value;
    }
  }

  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-loading">
          <div className="settings-spinner" />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="settings-page">
        <div className="settings-error-card">
          <div className="settings-error-icon">!</div>

          <h2>Unable to load settings</h2>

          <p>
            {error || "Your profile could not be loaded."}
          </p>

          <button
            type="button"
            className="settings-primary-button"
            onClick={() => void loadSettings()}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isVerified =
    verification?.is_verified === true ||
    profile.verification_status === "verified";

  return (
    <div className="settings-page">
      <div className="settings-background-orb settings-orb-one" />
      <div className="settings-background-orb settings-orb-two" />

      <div className="settings-container">
        {/* HEADER */}
        <div className="settings-header">
          <div>
            <div className="settings-eyebrow">ACCOUNT CENTER</div>

            <h1>Settings</h1>

            <p>
              Manage your profile, security preferences and saved
              withdrawal destinations.
            </p>
          </div>

          <div
            className={`settings-verification-badge ${
              isVerified ? "verified" : "pending"
            }`}
          >
            <span className="verification-dot" />

            {isVerified ? "Email Verified" : "Email Pending"}
          </div>
        </div>

        {/* ALERTS */}
        {message && (
          <div className="settings-alert settings-alert-success">
            <span>✓</span>

            <div>{message}</div>

            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        {error && (
          <div className="settings-alert settings-alert-error">
            <span>!</span>

            <div>{error}</div>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* MAIN LAYOUT */}
        <div className="settings-layout">
          {/* SIDEBAR */}
          <aside className="settings-sidebar">
            <button
              type="button"
              className={`settings-nav-item ${
                activeSection === "profile" ? "active" : ""
              }`}
              onClick={() => setActiveSection("profile")}
            >
              <span className="settings-nav-icon">◉</span>

              <span>
                <strong>Profile</strong>
                <small>Personal information</small>
              </span>
            </button>

            <button
              type="button"
              className={`settings-nav-item ${
                activeSection === "withdrawal" ? "active" : ""
              }`}
              onClick={() => setActiveSection("withdrawal")}
            >
              <span className="settings-nav-icon">◇</span>

              <span>
                <strong>Withdrawal</strong>
                <small>Saved destinations</small>
              </span>
            </button>

            <button
              type="button"
              className={`settings-nav-item ${
                activeSection === "security" ? "active" : ""
              }`}
              onClick={() => setActiveSection("security")}
            >
              <span className="settings-nav-icon">◆</span>

              <span>
                <strong>Security</strong>
                <small>Alerts & verification</small>
              </span>
            </button>

            <button
              type="button"
              className={`settings-nav-item ${
                activeSection === "preferences" ? "active" : ""
              }`}
              onClick={() => setActiveSection("preferences")}
            >
              <span className="settings-nav-icon">⚙</span>

              <span>
                <strong>Preferences</strong>
                <small>Display settings</small>
              </span>
            </button>
          </aside>

          <main className="settings-content">
            {/* PROFILE */}
            {activeSection === "profile" && (
              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      IDENTITY
                    </span>

                    <h2>Profile information</h2>

                    <p>
                      Update the information associated with your
                      exchange account.
                    </p>
                  </div>
                </div>

                <div className="profile-hero-card">
                  <div className="profile-avatar">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Profile avatar"
                      />
                    ) : (
                      <span>
                        {(
                          profile.full_name ||
                          profile.username ||
                          "U"
                        )
                          .charAt(0)
                          .toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="profile-hero-info">
                    <h3>
                      {profile.full_name ||
                        profile.username ||
                        "Exchange User"}
                    </h3>

                    <p>
                      {verification?.email ||
                        "Email unavailable"}
                    </p>

                    <div
                      className={`profile-status ${
                        isVerified ? "verified" : "pending"
                      }`}
                    >
                      <span />

                      {isVerified
                        ? "Verified account"
                        : "Email verification pending"}
                    </div>
                  </div>

                  <div className="profile-hero-right">
                    <span>ACCOUNT STATUS</span>
                    <strong>ACTIVE</strong>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="card-title-row">
                    <div>
                      <h3>Personal details</h3>

                      <p>
                        Keep your account information up to date.
                      </p>
                    </div>
                  </div>

                  <div className="settings-form-grid">
                    <label className="settings-field">
                      <span>Full name</span>

                      <input
                        type="text"
                        value={profile.full_name || ""}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            full_name: event.target.value,
                          })
                        }
                        placeholder="Your full name"
                      />
                    </label>

                    <label className="settings-field">
                      <span>Username</span>

                      <input
                        type="text"
                        value={profile.username || ""}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            username: event.target.value,
                          })
                        }
                        placeholder="Username"
                      />
                    </label>

                    <label className="settings-field settings-field-full">
                      <span>Profile picture URL</span>

                      <input
                        type="url"
                        value={profile.avatar_url || ""}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            avatar_url: event.target.value,
                          })
                        }
                        placeholder="https://example.com/avatar.jpg"
                      />

                      <small>
                        Enter a public image URL for your
                        profile picture.
                      </small>
                    </label>

                    <label className="settings-field settings-field-full">
                      <span>Email address</span>

                      <input
                        type="email"
                        value={verification?.email || ""}
                        disabled
                      />

                      <small>
                        Your email address is managed through
                        account authentication.
                      </small>
                    </label>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="settings-primary-button"
                      onClick={() => void saveProfile()}
                      disabled={savingProfile}
                    >
                      {savingProfile
                        ? "Saving..."
                        : "Save Profile"}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* WITHDRAWAL */}
            {activeSection === "withdrawal" && (
              <section className="settings-section">
                <div className="section-heading section-heading-with-action">
                  <div>
                    <span className="section-kicker">
                      DESTINATIONS
                    </span>

                    <h2>Saved withdrawal addresses</h2>

                    <p>
                      Save frequently used wallet destinations
                      for faster withdrawals.
                    </p>
                  </div>

                  {!showAddressForm && (
                    <button
                      type="button"
                      className="settings-primary-button"
                      onClick={startAddingAddress}
                    >
                      + Add Destination
                    </button>
                  )}
                </div>

                <div className="withdrawal-info-banner">
                  <div className="info-banner-icon">i</div>

                  <div>
                    <strong>
                      Withdrawal destinations are optional
                    </strong>

                    <p>
                      You can save addresses here for convenience.
                      You can also manually enter a destination
                      whenever you make a withdrawal.
                    </p>
                  </div>
                </div>

                {showAddressForm && (
                  <div className="settings-card address-form-card">
                    <div className="card-title-row">
                      <div>
                        <h3>
                          {editingAddressId
                            ? "Edit destination"
                            : "Add withdrawal destination"}
                        </h3>

                        <p>
                          Enter the address exactly as it appears
                          in your external wallet.
                        </p>
                      </div>

                      <button
                        type="button"
                        className="close-form-button"
                        onClick={cancelAddressForm}
                        aria-label="Close form"
                      >
                        ×
                      </button>
                    </div>

                    <div className="settings-form-grid">
                      <label className="settings-field settings-field-full">
                        <span>Asset & network</span>

                        <select
                          value={addressForm.wallet_option_id}
                          onChange={(event) =>
                            setAddressForm({
                              ...addressForm,
                              wallet_option_id:
                                event.target.value,
                            })
                          }
                        >
                          <option value="">
                            Select asset and network
                          </option>

                          {walletOptions.map((option) => (
                            <option
                              key={option.id}
                              value={option.id}
                            >
                              {option.asset_code} —{" "}
                              {option.asset_name} /{" "}
                              {option.network_name}
                            </option>
                          ))}
                        </select>

                        {selectedWalletOption?.address_label && (
                          <small>
                            Expected destination:{" "}
                            {selectedWalletOption.address_label}
                          </small>
                        )}
                      </label>

                      <label className="settings-field settings-field-full">
                        <span>Wallet address</span>

                        <input
                          type="text"
                          value={addressForm.wallet_address}
                          onChange={(event) =>
                            setAddressForm({
                              ...addressForm,
                              wallet_address:
                                event.target.value,
                            })
                          }
                          placeholder={
                            selectedWalletOption?.address_label ||
                            "Enter wallet address"
                          }
                          spellCheck={false}
                          autoComplete="off"
                        />

                        <small>
                          Always verify the network before saving
                          an address.
                        </small>
                      </label>

                      <label className="settings-field settings-field-full">
                        <span>Label</span>

                        <input
                          type="text"
                          maxLength={100}
                          value={addressForm.label}
                          onChange={(event) =>
                            setAddressForm({
                              ...addressForm,
                              label: event.target.value,
                            })
                          }
                          placeholder="e.g. My Binance wallet"
                        />
                      </label>
                    </div>

                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={addressForm.is_preferred}
                        onChange={(event) =>
                          setAddressForm({
                            ...addressForm,
                            is_preferred:
                              event.target.checked,
                          })
                        }
                      />

                      <span>
                        <strong>
                          Set as preferred destination
                        </strong>

                        <small>
                          This will become the preferred address
                          for this asset/network.
                        </small>
                      </span>
                    </label>

                    <div className="form-actions">
                      <button
                        type="button"
                        className="settings-secondary-button"
                        onClick={cancelAddressForm}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="settings-primary-button"
                        onClick={() => void saveAddress()}
                        disabled={savingAddress}
                      >
                        {savingAddress
                          ? "Saving..."
                          : editingAddressId
                          ? "Update Destination"
                          : "Save Destination"}
                      </button>
                    </div>
                  </div>
                )}

                <div className="settings-card">
                  <div className="card-title-row">
                    <div>
                      <h3>Your destinations</h3>

                      <p>
                        These addresses are available for your
                        future withdrawals.
                      </p>
                    </div>

                    <span className="count-badge">
                      {savedAddresses.length}
                    </span>
                  </div>

                  {savedAddresses.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        ◇
                      </div>

                      <h3>No saved destinations</h3>

                      <p>
                        You have not saved a withdrawal address
                        yet.
                      </p>

                      <button
                        type="button"
                        className="settings-primary-button"
                        onClick={startAddingAddress}
                      >
                        Add Your First Destination
                      </button>
                    </div>
                  ) : (
                    <div className="address-list">
                      {savedAddresses.map((address) => (
                        <div
                          key={address.id}
                          className="address-item"
                        >
                          <div className="address-asset-icon">
                            {address.asset_code.slice(0, 1)}
                          </div>

                          <div className="address-main">
                            <div className="address-title">
                              <strong>
                                {address.label ||
                                  `${address.asset_code} destination`}
                              </strong>

                              {address.is_preferred && (
                                <span className="preferred-badge">
                                  Preferred
                                </span>
                              )}

                              {address.is_verified && (
                                <span className="verified-mini-badge">
                                  Verified
                                </span>
                              )}
                            </div>

                            <div className="address-network">
                              {address.asset_name} ·{" "}
                              {address.network_name}
                            </div>

                            <div className="address-value">
                              {maskAddress(
                                address.wallet_address
                              )}
                            </div>

                            <div className="address-date">
                              Added{" "}
                              {formatDate(address.created_at)}
                            </div>
                          </div>

                          <div className="address-actions">
                            {!address.is_preferred && (
                              <button
                                type="button"
                                onClick={() =>
                                  void makePreferred(address)
                                }
                              >
                                Make Preferred
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                startEditingAddress(address)
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className="danger-action"
                              onClick={() =>
                                void deleteAddress(address.id)
                              }
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* SECURITY */}
            {activeSection === "security" && (
              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      SECURITY
                    </span>

                    <h2>Security & verification</h2>

                    <p>
                      Manage account alerts and check the
                      verification status of your email.
                    </p>
                  </div>
                </div>

                <div
                  className={`verification-card ${
                    isVerified ? "verified" : "pending"
                  }`}
                >
                  <div className="verification-card-icon">
                    {isVerified ? "✓" : "!"}
                  </div>

                  <div className="verification-card-content">
                    <span>EMAIL VERIFICATION</span>

                    <h3>
                      {isVerified
                        ? "Your email is verified"
                        : "Your email needs verification"}
                    </h3>

                    <p>
                      {verification?.email ||
                        "No email address available"}
                    </p>

                    {verification?.email_confirmed_at && (
                      <small>
                        Verified on{" "}
                        {formatDate(
                          verification.email_confirmed_at
                        )}
                      </small>
                    )}
                  </div>

                  <div className="verification-actions">
                    <button
                      type="button"
                      className="settings-secondary-button"
                      onClick={() =>
                        void refreshVerification()
                      }
                    >
                      Refresh Status
                    </button>

                    {!isVerified && (
                      <button
                        type="button"
                        className="settings-primary-button"
                        onClick={() =>
                          void resendVerificationEmail()
                        }
                      >
                        Resend Email
                      </button>
                    )}
                  </div>
                </div>

                <div className="settings-card">
                  <div className="card-title-row">
                    <div>
                      <h3>Security notifications</h3>

                      <p>
                        Choose which account-related security
                        messages you want to receive.
                      </p>
                    </div>
                  </div>

                  <div className="toggle-list">
                    <div className="toggle-row">
                      <div>
                        <strong>Security alerts</strong>

                        <p>
                          Receive notifications about important
                          account security events.
                        </p>
                      </div>

                      <button
                        type="button"
                        className={`toggle-switch ${
                          profile.security_alerts_enabled
                            ? "on"
                            : ""
                        }`}
                        onClick={() =>
                          setProfile({
                            ...profile,
                            security_alerts_enabled:
                              !profile.security_alerts_enabled,
                          })
                        }
                        aria-label="Toggle security alerts"
                      >
                        <span />
                      </button>
                    </div>

                    <div className="toggle-row">
                      <div>
                        <strong>Email notifications</strong>

                        <p>
                          Receive general account and platform
                          notifications by email.
                        </p>
                      </div>

                      <button
                        type="button"
                        className={`toggle-switch ${
                          profile.email_notifications_enabled
                            ? "on"
                            : ""
                        }`}
                        onClick={() =>
                          setProfile({
                            ...profile,
                            email_notifications_enabled:
                              !profile.email_notifications_enabled,
                          })
                        }
                        aria-label="Toggle email notifications"
                      >
                        <span />
                      </button>
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="settings-primary-button"
                      onClick={() => void saveProfile()}
                      disabled={savingProfile}
                    >
                      {savingProfile
                        ? "Saving..."
                        : "Save Security Settings"}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* PREFERENCES */}
            {activeSection === "preferences" && (
              <section className="settings-section">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">
                      PREFERENCES
                    </span>

                    <h2>Interface preferences</h2>

                    <p>
                      Customize how supported account information
                      is displayed.
                    </p>
                  </div>
                </div>

                <div className="settings-card">
                  <div className="settings-form-grid">
                    <label className="settings-field">
                      <span>Preferred currency</span>

                      <select
                        value={profile.preferred_currency}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            preferred_currency:
                              event.target.value,
                          })
                        }
                      >
                        {CURRENCIES.map((currency) => (
                          <option
                            key={currency}
                            value={currency}
                          >
                            {currency}
                          </option>
                        ))}
                      </select>

                      <small>
                        Used for supported display values
                        throughout the interface.
                      </small>
                    </label>

                    <label className="settings-field">
                      <span>Timezone</span>

                      <select
                        value={profile.timezone}
                        onChange={(event) =>
                          setProfile({
                            ...profile,
                            timezone: event.target.value,
                          })
                        }
                      >
                        {TIMEZONES.map((timezone) => (
                          <option
                            key={timezone}
                            value={timezone}
                          >
                            {timezone}
                          </option>
                        ))}
                      </select>

                      <small>
                        Used when displaying supported dates and
                        times.
                      </small>
                    </label>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="settings-primary-button"
                      onClick={() => void saveProfile()}
                      disabled={savingProfile}
                    >
                      {savingProfile
                        ? "Saving..."
                        : "Save Preferences"}
                    </button>
                  </div>
                </div>

                <div className="settings-card advanced-settings-card">
                  <div className="card-title-row">
                    <div>
                      <span className="section-kicker">
                        ADVANCED
                      </span>

                      <h3>Account information</h3>

                      <p>
                        Technical account information for
                        reference.
                      </p>
                    </div>
                  </div>

                  <div className="account-information-grid">
                    <div>
                      <span>PROFILE ID</span>
                      <strong>{profile.id}</strong>
                    </div>

                    <div>
                      <span>VERIFICATION</span>
                      <strong>
                        {isVerified ? "VERIFIED" : "PENDING"}
                      </strong>
                    </div>

                    <div>
                      <span>SAVED DESTINATIONS</span>
                      <strong>
                        {savedAddresses.length}
                      </strong>
                    </div>

                    <div>
                      <span>AVAILABLE NETWORKS</span>
                      <strong>
                        {walletOptions.length}
                      </strong>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      <style jsx global>{`
        .settings-page {
          min-height: 100%;
          position: relative;
          overflow: hidden;
          padding: 34px;
          color: #f5f7fb;
          background:
            radial-gradient(
              circle at 90% 5%,
              rgba(194, 153, 59, 0.09),
              transparent 28%
            ),
            radial-gradient(
              circle at 10% 80%,
              rgba(25, 108, 255, 0.07),
              transparent 30%
            ),
            #030810;
        }

        .settings-container {
          width: 100%;
          max-width: 1450px;
          margin: 0 auto;
          position: relative;
          z-index: 2;
        }

        .settings-background-orb {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          filter: blur(2px);
        }

        .settings-orb-one {
          width: 300px;
          height: 300px;
          right: -150px;
          top: 180px;
          background: rgba(194, 153, 59, 0.035);
        }

        .settings-orb-two {
          width: 260px;
          height: 260px;
          left: -130px;
          bottom: 100px;
          background: rgba(35, 99, 235, 0.035);
        }

        .settings-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 30px;
        }

        .settings-eyebrow,
        .section-kicker {
          display: block;
          color: #caa85e;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .settings-header h1 {
          margin: 0;
          font-size: clamp(30px, 4vw, 46px);
          line-height: 1;
          letter-spacing: -0.04em;
          font-weight: 800;
        }

        .settings-header p {
          margin: 12px 0 0;
          color: #8994a7;
          font-size: 14px;
        }

        .settings-verification-badge {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 10px 15px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.025);
          color: #aeb7c7;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
        }

        .settings-verification-badge.verified {
          border-color: rgba(64, 210, 138, 0.2);
          color: #62dba0;
        }

        .settings-verification-badge.pending {
          border-color: rgba(230, 175, 64, 0.2);
          color: #dcb867;
        }

        .verification-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          box-shadow: 0 0 12px currentColor;
        }

        .settings-alert {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          padding: 13px 16px;
          border-radius: 12px;
          font-size: 13px;
          border: 1px solid;
        }

        .settings-alert > span {
          width: 22px;
          height: 22px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 50%;
          font-size: 11px;
          font-weight: 900;
        }

        .settings-alert > div {
          flex: 1;
        }

        .settings-alert button {
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-size: 20px;
          opacity: 0.6;
        }

        .settings-alert-success {
          color: #65dba0;
          background: rgba(53, 188, 119, 0.06);
          border-color: rgba(53, 188, 119, 0.16);
        }

        .settings-alert-success > span {
          background: rgba(53, 188, 119, 0.12);
        }

        .settings-alert-error {
          color: #ff8989;
          background: rgba(255, 77, 77, 0.06);
          border-color: rgba(255, 77, 77, 0.16);
        }

        .settings-alert-error > span {
          background: rgba(255, 77, 77, 0.12);
        }

        .settings-layout {
          display: grid;
          grid-template-columns: 245px minmax(0, 1fr);
          gap: 22px;
          align-items: start;
        }

        .settings-sidebar {
          position: sticky;
          top: 20px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 8px;
          border: 1px solid rgba(255, 255, 255, 0.065);
          border-radius: 16px;
          background: rgba(8, 14, 24, 0.7);
          backdrop-filter: blur(18px);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.18);
        }

        .settings-nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 13px 12px;
          border: 1px solid transparent;
          border-radius: 11px;
          background: transparent;
          color: #788498;
          text-align: left;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .settings-nav-item:hover {
          color: #d9dee7;
          background: rgba(255, 255, 255, 0.025);
        }

        .settings-nav-item.active {
          color: #f4f5f8;
          border-color: rgba(202, 168, 94, 0.13);
          background: linear-gradient(
            135deg,
            rgba(202, 168, 94, 0.12),
            rgba(202, 168, 94, 0.035)
          );
          box-shadow:
            inset 3px 0 0 #caa85e,
            0 8px 20px rgba(0, 0, 0, 0.12);
        }

        .settings-nav-icon {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 8px;
          color: #9ba6b9;
          background: rgba(255, 255, 255, 0.035);
        }

        .settings-nav-item.active .settings-nav-icon {
          color: #d6b768;
          background: rgba(202, 168, 94, 0.08);
        }

        .settings-nav-item strong {
          display: block;
          font-size: 12px;
          font-weight: 700;
        }

        .settings-nav-item small {
          display: block;
          margin-top: 3px;
          color: #5f6a7c;
          font-size: 10px;
        }

        .settings-content {
          min-width: 0;
        }

        .settings-section {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .section-heading {
          margin-bottom: 2px;
        }

        .section-heading-with-action {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
        }

        .section-heading h2 {
          margin: 0;
          font-size: 25px;
          letter-spacing: -0.025em;
        }

        .section-heading p {
          margin: 7px 0 0;
          color: #7c8799;
          font-size: 13px;
          line-height: 1.6;
        }

        .settings-card {
          padding: 23px;
          border: 1px solid rgba(255, 255, 255, 0.065);
          border-radius: 16px;
          background:
            linear-gradient(
              145deg,
              rgba(14, 22, 35, 0.9),
              rgba(7, 13, 22, 0.82)
            );
          box-shadow:
            0 20px 55px rgba(0, 0, 0, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.02);
        }

        .card-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
        }

        .card-title-row h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 750;
        }

        .card-title-row p {
          margin: 5px 0 0;
          color: #687487;
          font-size: 12px;
        }

        .count-badge {
          min-width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          padding: 0 9px;
          border-radius: 9px;
          color: #d8b967;
          background: rgba(202, 168, 94, 0.08);
          font-size: 12px;
          font-weight: 800;
        }

        .profile-hero-card {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 22px;
          border: 1px solid rgba(202, 168, 94, 0.11);
          border-radius: 16px;
          background:
            radial-gradient(
              circle at 10% 0%,
              rgba(202, 168, 94, 0.08),
              transparent 34%
            ),
            rgba(10, 18, 29, 0.85);
        }

        .profile-avatar {
          width: 76px;
          height: 76px;
          flex: 0 0 auto;
          overflow: hidden;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 2px solid rgba(202, 168, 94, 0.35);
          background: linear-gradient(
            135deg,
            rgba(202, 168, 94, 0.2),
            rgba(202, 168, 94, 0.03)
          );
          color: #dfc378;
          font-size: 28px;
          font-weight: 800;
          box-shadow: 0 0 30px rgba(202, 168, 94, 0.06);
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-hero-info {
          min-width: 0;
          flex: 1;
        }

        .profile-hero-info h3 {
          margin: 0;
          font-size: 18px;
        }

        .profile-hero-info > p {
          margin: 5px 0 8px;
          color: #778397;
          font-size: 12px;
        }

        .profile-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 10px;
          font-weight: 700;
        }

        .profile-status span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .profile-status.verified {
          color: #5ed79c;
        }

        .profile-status.pending {
          color: #d6ae5b;
        }

        .profile-hero-right {
          align-self: stretch;
          min-width: 110px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          gap: 5px;
          padding-left: 18px;
          border-left: 1px solid rgba(255, 255, 255, 0.06);
        }

        .profile-hero-right span {
          color: #566174;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.14em;
        }

        .profile-hero-right strong {
          color: #62d99e;
          font-size: 11px;
        }

        .settings-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 17px;
        }

        .settings-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .settings-field-full {
          grid-column: 1 / -1;
        }

        .settings-field > span {
          color: #a5afbf;
          font-size: 11px;
          font-weight: 700;
        }

        .settings-field > small {
          color: #5e6a7e;
          font-size: 10px;
          line-height: 1.5;
        }

        .settings-field input,
        .settings-field select {
          width: 100%;
          height: 45px;
          box-sizing: border-box;
          padding: 0 13px;
          border: 1px solid rgba(255, 255, 255, 0.075);
          border-radius: 9px;
          outline: none;
          background: rgba(255, 255, 255, 0.025);
          color: #edf0f5;
          font: inherit;
          font-size: 12px;
          transition: 0.2s ease;
        }

        .settings-field select {
          cursor: pointer;
        }

        .settings-field input:focus,
        .settings-field select:focus {
          border-color: rgba(202, 168, 94, 0.4);
          background: rgba(202, 168, 94, 0.025);
          box-shadow: 0 0 0 3px rgba(202, 168, 94, 0.05);
        }

        .settings-field input:disabled {
          color: #697486;
          cursor: not-allowed;
          opacity: 0.75;
        }

        .form-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 23px;
          padding-top: 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.055);
        }

        .settings-primary-button,
        .settings-secondary-button {
          min-height: 40px;
          padding: 0 16px;
          border-radius: 9px;
          font: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .settings-primary-button {
          border: 1px solid rgba(202, 168, 94, 0.35);
          color: #11100b;
          background: linear-gradient(
            135deg,
            #d9bc72,
            #b8954d
          );
          box-shadow: 0 8px 24px rgba(202, 168, 94, 0.1);
        }

        .settings-primary-button:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }

        .settings-secondary-button {
          border: 1px solid rgba(255, 255, 255, 0.09);
          color: #aeb7c6;
          background: rgba(255, 255, 255, 0.035);
        }

        .settings-secondary-button:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.06);
        }

        .settings-primary-button:disabled,
        .settings-secondary-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .withdrawal-info-banner {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px 17px;
          border: 1px solid rgba(202, 168, 94, 0.12);
          border-radius: 12px;
          background: rgba(202, 168, 94, 0.035);
        }

        .info-banner-icon {
          width: 23px;
          height: 23px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 50%;
          color: #d7b767;
          background: rgba(202, 168, 94, 0.09);
          font-size: 11px;
          font-weight: 900;
        }

        .withdrawal-info-banner strong {
          display: block;
          color: #c8ced9;
          font-size: 11px;
        }

        .withdrawal-info-banner p {
          margin: 4px 0 0;
          color: #6d788b;
          font-size: 11px;
          line-height: 1.5;
        }

        .address-form-card {
          border-color: rgba(202, 168, 94, 0.15);
        }

        .close-form-button {
          width: 31px;
          height: 31px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.025);
          color: #8b96a8;
          cursor: pointer;
          font-size: 18px;
        }

        .checkbox-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 18px;
          cursor: pointer;
        }

        .checkbox-row input {
          width: 16px;
          height: 16px;
          margin-top: 2px;
          accent-color: #caa85e;
          cursor: pointer;
        }

        .checkbox-row strong {
          display: block;
          color: #bfc7d3;
          font-size: 11px;
        }

        .checkbox-row small {
          display: block;
          margin-top: 4px;
          color: #606c7f;
          font-size: 10px;
        }

        .address-list {
          display: flex;
          flex-direction: column;
        }

        .address-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 17px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.055);
        }

        .address-item:first-child {
          padding-top: 2px;
        }

        .address-item:last-child {
          padding-bottom: 2px;
          border-bottom: 0;
        }

        .address-asset-icon {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border: 1px solid rgba(202, 168, 94, 0.15);
          border-radius: 11px;
          color: #d4b564;
          background: rgba(202, 168, 94, 0.055);
          font-size: 14px;
          font-weight: 900;
        }

        .address-main {
          min-width: 0;
          flex: 1;
        }

        .address-title {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 7px;
        }

        .address-title strong {
          color: #dfe4eb;
          font-size: 12px;
        }

        .preferred-badge,
        .verified-mini-badge {
          padding: 3px 6px;
          border-radius: 5px;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .preferred-badge {
          color: #d6b567;
          background: rgba(202, 168, 94, 0.09);
        }

        .verified-mini-badge {
          color: #60d99d;
          background: rgba(60, 202, 132, 0.08);
        }

        .address-network {
          margin-top: 4px;
          color: #7b8799;
          font-size: 10px;
        }

        .address-value {
          margin-top: 7px;
          color: #b0b9c8;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            Monaco,
            Consolas,
            monospace;
          font-size: 10px;
        }

        .address-date {
          margin-top: 5px;
          color: #515d70;
          font-size: 9px;
        }

        .address-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 6px;
        }

        .address-actions button {
          min-height: 32px;
          padding: 0 9px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 7px;
          color: #8d99ab;
          background: rgba(255, 255, 255, 0.025);
          font: inherit;
          font-size: 9px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .address-actions button:hover {
          color: #e7ebf1;
          background: rgba(255, 255, 255, 0.055);
        }

        .address-actions .danger-action {
          color: #c87777;
        }

        .address-actions .danger-action:hover {
          color: #ff8c8c;
          border-color: rgba(255, 80, 80, 0.15);
          background: rgba(255, 80, 80, 0.04);
        }

        .empty-state {
          min-height: 260px;
          display: flex;
          align-items: center;
          flex-direction: column;
          justify-content: center;
          text-align: center;
        }

        .empty-state-icon {
          width: 58px;
          height: 58px;
          display: grid;
          place-items: center;
          margin-bottom: 15px;
          border: 1px solid rgba(202, 168, 94, 0.14);
          border-radius: 15px;
          color: #c9a85e;
          background: rgba(202, 168, 94, 0.045);
          font-size: 22px;
        }

        .empty-state h3 {
          margin: 0;
          font-size: 14px;
        }

        .empty-state p {
          margin: 7px 0 18px;
          color: #657084;
          font-size: 11px;
        }

        .verification-card {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px;
          border: 1px solid;
          border-radius: 15px;
        }

        .verification-card.verified {
          border-color: rgba(64, 208, 137, 0.13);
          background: rgba(48, 183, 116, 0.035);
        }

        .verification-card.pending {
          border-color: rgba(202, 168, 94, 0.14);
          background: rgba(202, 168, 94, 0.035);
        }

        .verification-card-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 13px;
          font-size: 18px;
          font-weight: 900;
        }

        .verification-card.verified
          .verification-card-icon {
          color: #5fd89d;
          background: rgba(64, 208, 137, 0.08);
        }

        .verification-card.pending
          .verification-card-icon {
          color: #d5af5c;
          background: rgba(202, 168, 94, 0.08);
        }

        .verification-card-content {
          flex: 1;
          min-width: 0;
        }

        .verification-card-content > span {
          color: #687487;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .verification-card-content h3 {
          margin: 4px 0;
          font-size: 15px;
        }

        .verification-card-content p {
          margin: 0;
          color: #8a95a7;
          font-size: 11px;
          overflow-wrap: anywhere;
        }

        .verification-card-content small {
          display: block;
          margin-top: 5px;
          color: #5d687b;
          font-size: 9px;
        }

        .verification-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .toggle-list {
          display: flex;
          flex-direction: column;
        }

        .toggle-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 17px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.055);
        }

        .toggle-row:last-child {
          border-bottom: 0;
        }

        .toggle-row strong {
          color: #c8ced8;
          font-size: 12px;
        }

        .toggle-row p {
          margin: 5px 0 0;
          color: #697589;
          font-size: 10px;
          line-height: 1.5;
        }

        .toggle-switch {
          width: 44px;
          height: 24px;
          padding: 3px;
          flex: 0 0 auto;
          border: 0;
          border-radius: 999px;
          background: #202937;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .toggle-switch span {
          display: block;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #758195;
          transition: 0.2s ease;
        }

        .toggle-switch.on {
          background: rgba(202, 168, 94, 0.3);
        }

        .toggle-switch.on span {
          transform: translateX(20px);
          background: #d5b565;
          box-shadow: 0 0 12px rgba(202, 168, 94, 0.35);
        }

        .advanced-settings-card {
          margin-top: 0;
        }

        .account-information-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .account-information-grid > div {
          min-width: 0;
          padding: 14px;
          border: 1px solid rgba(255, 255, 255, 0.055);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.018);
        }

        .account-information-grid span {
          display: block;
          color: #596578;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .account-information-grid strong {
          display: block;
          margin-top: 7px;
          color: #adb6c5;
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .settings-loading {
          min-height: 70vh;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 12px;
          color: #727e91;
          font-size: 12px;
        }

        .settings-spinner {
          width: 28px;
          height: 28px;
          border: 2px solid rgba(202, 168, 94, 0.12);
          border-top-color: #caa85e;
          border-radius: 50%;
          animation: settings-spin 0.8s linear infinite;
        }

        @keyframes settings-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .settings-error-card {
          max-width: 500px;
          margin: 120px auto;
          padding: 30px;
          text-align: center;
          border: 1px solid rgba(255, 80, 80, 0.12);
          border-radius: 16px;
          background: rgba(10, 16, 26, 0.9);
        }

        .settings-error-icon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          margin: 0 auto 15px;
          border-radius: 50%;
          color: #ff8585;
          background: rgba(255, 80, 80, 0.08);
          font-weight: 900;
        }

        .settings-error-card h2 {
          margin: 0;
          font-size: 18px;
        }

        .settings-error-card p {
          margin: 9px 0 20px;
          color: #747f91;
          font-size: 12px;
          line-height: 1.6;
        }

        @media (max-width: 1000px) {
          .settings-layout {
            grid-template-columns: 1fr;
          }

          .settings-sidebar {
            position: static;
            display: grid;
            grid-template-columns: repeat(4, 1fr);
          }

          .settings-nav-item {
            min-height: 65px;
          }

          .settings-nav-item small {
            display: none;
          }
        }

        @media (max-width: 720px) {
          .settings-page {
            padding: 20px 14px 30px;
          }

          .settings-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .settings-verification-badge {
            align-self: flex-start;
          }

          .settings-sidebar {
            grid-template-columns: repeat(2, 1fr);
          }

          .settings-nav-item {
            padding: 10px;
          }

          .settings-form-grid,
          .account-information-grid {
            grid-template-columns: 1fr;
          }

          .settings-field-full {
            grid-column: auto;
          }

          .profile-hero-card {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .profile-hero-right {
            width: 100%;
            align-items: flex-start;
            padding: 14px 0 0;
            border-left: 0;
            border-top: 1px solid rgba(255, 255, 255, 0.06);
          }

          .section-heading-with-action {
            align-items: flex-start;
            flex-direction: column;
          }

          .address-item {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .address-actions {
            width: 100%;
            justify-content: flex-start;
            padding-left: 56px;
          }

          .verification-card {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .verification-actions {
            width: 100%;
            justify-content: flex-start;
          }

          .form-actions {
            justify-content: stretch;
          }

          .form-actions button {
            flex: 1;
          }
        }

        @media (max-width: 450px) {
          .settings-sidebar {
            grid-template-columns: 1fr 1fr;
          }

          .settings-nav-item strong {
            font-size: 10px;
          }

          .settings-card,
          .profile-hero-card {
            padding: 17px;
          }

          .settings-header h1 {
            font-size: 32px;
          }
        }
      `}</style>
    </div>
  );
}
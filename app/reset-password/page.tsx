"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogo from "../../components/BrandLogo";
import { createClient } from "../../lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (!session) {
        setError(
          "This password reset link is invalid or has expired. Please request a new reset link.",
        );
      }

      setCheckingSession(false);
    }

    checkRecoverySession();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (checkingSession) {
      return;
    }

    if (password.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      });

    if (updateError) {
      setError(
        updateError.message ||
          "Unable to update your password. Please request a new reset link and try again.",
      );
      setLoading(false);
      return;
    }

    setSuccess(
      "Your password has been updated successfully. Redirecting you to sign in...",
    );

    await supabase.auth.signOut();

    setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 1800);
  }

  const disabled =
    loading ||
    checkingSession ||
    Boolean(success);

  return (
    <main className="reset-page">
      <div className="reset-background">
        <div className="reset-glow reset-glow-one" />
        <div className="reset-glow reset-glow-two" />
        <div className="reset-grid" />
      </div>

      <div className="reset-shell">
        <div className="reset-brand">
          <BrandLogo />
        </div>

        <section className="reset-card">
          <div className="card-top-line" />

          <div className="reset-heading">
            <div className="security-icon">◆</div>

            <p className="eyebrow">SECURE ACCOUNT RECOVERY</p>

            <h1>
              Create a new
              <span> password.</span>
            </h1>

            <p className="subtitle">
              Choose a strong password for your Crypto Com Exchange
              account. Your new password will replace the previous one.
            </p>
          </div>

          {checkingSession ? (
            <div className="checking-state">
              <span className="large-spinner" />
              <p>Verifying your recovery session...</p>
            </div>
          ) : (
            <form
              onSubmit={handleReset}
              className="reset-form"
            >
              <div className="field-group">
                <label htmlFor="password">
                  New password
                </label>

                <div className="password-wrapper">
                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your new password"
                    autoComplete="new-password"
                    disabled={disabled}
                    minLength={8}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword((current) => !current)
                    }
                    disabled={disabled}
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="confirm-password">
                  Confirm new password
                </label>

                <div className="password-wrapper">
                  <input
                    id="confirm-password"
                    type={
                      showConfirmPassword
                        ? "text"
                        : "password"
                    }
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Confirm your new password"
                    autoComplete="new-password"
                    disabled={disabled}
                    minLength={8}
                    required
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowConfirmPassword(
                        (current) => !current,
                      )
                    }
                    disabled={disabled}
                    aria-label={
                      showConfirmPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showConfirmPassword
                      ? "Hide"
                      : "Show"}
                  </button>
                </div>
              </div>

              <div className="password-rules">
                <div
                  className={
                    password.length >= 8
                      ? "rule valid"
                      : "rule"
                  }
                >
                  <span>
                    {password.length >= 8
                      ? "✓"
                      : "•"}
                  </span>
                  At least 8 characters
                </div>

                <div
                  className={
                    password === confirmPassword &&
                    confirmPassword.length > 0
                      ? "rule valid"
                      : "rule"
                  }
                >
                  <span>
                    {password === confirmPassword &&
                    confirmPassword.length > 0
                      ? "✓"
                      : "•"}
                  </span>
                  Passwords match
                </div>
              </div>

              {error && (
                <div className="message error-message">
                  <span>!</span>
                  <p>{error}</p>
                </div>
              )}

              {success && (
                <div className="message success-message">
                  <span>✓</span>
                  <p>{success}</p>
                </div>
              )}

              <button
                type="submit"
                className="reset-button"
                disabled={disabled}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Updating password...
                  </>
                ) : (
                  <>
                    Update password
                    <span>→</span>
                  </>
                )}
              </button>
            </form>
          )}

          {!success && (
            <div className="back-login">
              <Link href="/login">
                <span>←</span>
                Back to sign in
              </Link>
            </div>
          )}

          <div className="trust-row">
            <div>
              <span className="trust-dot" />
              Secure recovery
            </div>

            <div>
              <span className="trust-dot" />
              Protected account
            </div>

            <div>
              <span className="trust-dot" />
              Encrypted connection
            </div>
          </div>
        </section>

        <p className="copyright">
          © {new Date().getFullYear()} Crypto Com Exchange. All
          rights reserved.
        </p>
      </div>

      <style jsx>{`
        .reset-page {
          min-height: 100vh;
          width: 100%;
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 15% 15%,
              rgba(0, 160, 255, 0.12),
              transparent 28%
            ),
            radial-gradient(
              circle at 85% 85%,
              rgba(212, 175, 55, 0.08),
              transparent 30%
            ),
            #030810;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          box-sizing: border-box;
        }

        .reset-background {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .reset-glow {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.16;
        }

        .reset-glow-one {
          top: -180px;
          left: -140px;
          background: #008cff;
        }

        .reset-glow-two {
          right: -180px;
          bottom: -180px;
          background: #d4af37;
        }

        .reset-grid {
          position: absolute;
          inset: 0;
          opacity: 0.08;
          background-image:
            linear-gradient(
              rgba(255, 255, 255, 0.08) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.08) 1px,
              transparent 1px
            );
          background-size: 55px 55px;
          mask-image: linear-gradient(
            to bottom,
            transparent,
            black 20%,
            black 80%,
            transparent
          );
        }

        .reset-shell {
          width: 100%;
          max-width: 560px;
          position: relative;
          z-index: 2;
        }

        .reset-brand {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }

        .reset-brand :global(.brandLogo) {
          transform: scale(1.08);
        }

        .reset-brand :global(.brandLogo:hover) {
          transform: scale(1.08) translateY(-1px);
        }

        .reset-card {
          position: relative;
          background: linear-gradient(
            145deg,
            rgba(13, 23, 36, 0.94),
            rgba(5, 12, 20, 0.97)
          );
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 24px;
          padding: 42px;
          box-shadow:
            0 30px 90px rgba(0, 0, 0, 0.55),
            0 0 50px rgba(0, 130, 255, 0.06),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(20px);
        }

        .card-top-line {
          position: absolute;
          top: 0;
          left: 12%;
          right: 12%;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(212, 175, 55, 0.8),
            transparent
          );
        }

        .reset-heading {
          text-align: center;
          max-width: 500px;
          margin: 0 auto 34px;
        }

        .security-icon {
          width: 42px;
          height: 42px;
          margin: 0 auto 18px;
          display: grid;
          place-items: center;
          color: #d4af37;
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 13px;
          background: rgba(212, 175, 55, 0.06);
          box-shadow: 0 0 25px rgba(212, 175, 55, 0.08);
          font-size: 14px;
        }

        .eyebrow {
          margin: 0 0 12px;
          color: #d4af37;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.2em;
        }

        .reset-heading h1 {
          margin: 0;
          font-size: clamp(32px, 5vw, 46px);
          line-height: 1.08;
          letter-spacing: -0.035em;
        }

        .reset-heading h1 span {
          color: #4db7ff;
          text-shadow: 0 0 30px rgba(77, 183, 255, 0.2);
        }

        .subtitle {
          max-width: 460px;
          margin: 17px auto 0;
          color: #8e9aaa;
          line-height: 1.7;
          font-size: 14px;
        }

        .checking-state {
          min-height: 170px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 15px;
          color: #8995a5;
          font-size: 13px;
        }

        .checking-state p {
          margin: 0;
        }

        .large-spinner {
          width: 34px;
          height: 34px;
          border: 3px solid rgba(255, 255, 255, 0.08);
          border-top-color: #d4af37;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        .reset-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field-group label {
          color: #c4ccd6;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .password-wrapper {
          position: relative;
        }

        .password-wrapper input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.035);
          color: #ffffff;
          padding: 14px 76px 14px 15px;
          outline: none;
          font-size: 14px;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;
        }

        .password-wrapper input::placeholder {
          color: #596575;
        }

        .password-wrapper input:focus {
          border-color: rgba(77, 183, 255, 0.7);
          background: rgba(77, 183, 255, 0.035);
          box-shadow:
            0 0 0 3px rgba(77, 183, 255, 0.08),
            0 0 25px rgba(77, 183, 255, 0.05);
        }

        .password-wrapper input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .password-toggle {
          position: absolute;
          top: 50%;
          right: 12px;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: #4db7ff;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          padding: 5px;
        }

        .password-toggle:hover:not(:disabled) {
          color: #7bcaff;
        }

        .password-toggle:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .password-rules {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          margin-top: -4px;
        }

        .rule {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #687483;
          font-size: 11px;
        }

        .rule span {
          width: 17px;
          height: 17px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          color: #687483;
          font-size: 10px;
          font-weight: 900;
        }

        .rule.valid {
          color: #8ddfbb;
        }

        .rule.valid span {
          background: rgba(43, 209, 133, 0.14);
          color: #48d996;
        }

        .message {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          border-radius: 11px;
          padding: 12px 14px;
          font-size: 13px;
          line-height: 1.5;
        }

        .message span {
          flex: 0 0 auto;
          width: 20px;
          height: 20px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          font-weight: 800;
        }

        .message p {
          margin: 0;
        }

        .error-message {
          color: #ffb4b4;
          background: rgba(255, 65, 65, 0.08);
          border: 1px solid rgba(255, 65, 65, 0.18);
        }

        .error-message span {
          background: rgba(255, 65, 65, 0.18);
          color: #ff7272;
        }

        .success-message {
          color: #a9f2cf;
          background: rgba(43, 209, 133, 0.07);
          border: 1px solid rgba(43, 209, 133, 0.18);
        }

        .success-message span {
          background: rgba(43, 209, 133, 0.16);
          color: #48d996;
        }

        .reset-button {
          min-height: 52px;
          border: 0;
          border-radius: 13px;
          cursor: pointer;
          color: #05090f;
          background: linear-gradient(
            100deg,
            #d4af37,
            #f0cf69,
            #d4af37
          );
          background-size: 200% 100%;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.03em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          box-shadow:
            0 10px 30px rgba(212, 175, 55, 0.13),
            inset 0 1px 0 rgba(255, 255, 255, 0.45);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .reset-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 15px 40px rgba(212, 175, 55, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.45);
        }

        .reset-button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(0, 0, 0, 0.25);
          border-top-color: #05090f;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        .back-login {
          display: flex;
          justify-content: center;
          margin-top: 23px;
        }

        .back-login a {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #4db7ff;
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
        }

        .back-login a:hover {
          color: #75c9ff;
        }

        .back-login a span {
          transition: transform 0.2s ease;
        }

        .back-login a:hover span {
          transform: translateX(-3px);
        }

        .trust-row {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 30px;
          padding-top: 22px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          color: #687483;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .trust-row > div {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .trust-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #35d795;
          box-shadow: 0 0 8px rgba(53, 215, 149, 0.7);
        }

        .copyright {
          text-align: center;
          color: #4f5a68;
          font-size: 11px;
          margin: 22px 0 0;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 650px) {
          .reset-page {
            padding: 25px 14px;
          }

          .reset-card {
            padding: 28px 20px;
            border-radius: 20px;
          }

          .reset-heading h1 {
            font-size: 34px;
          }

          .reset-brand {
            margin-bottom: 20px;
          }

          .reset-brand :global(.brandLogo) {
            transform: scale(1);
          }

          .reset-brand :global(.brandLogo:hover) {
            transform: translateY(-1px);
          }

          .password-rules {
            flex-direction: column;
            gap: 8px;
          }

          .trust-row {
            flex-direction: column;
            align-items: center;
            gap: 10px;
          }
        }
      `}</style>
    </main>
  );
}
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BrandLogo from "../../components/BrandLogo";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkExistingSession() {
      const { data } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (data.session) {
        router.replace("/dashboard");
        return;
      }

      setCheckingSession(false);
    }

    checkExistingSession();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setError("Please enter your email address and password.");
      return;
    }

    setLoading(true);

    const { error: signInError } =
      await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

    if (signInError) {
      setError(
        signInError.message ||
          "Unable to sign in. Please check your credentials and try again.",
      );

      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  if (checkingSession) {
    return (
      <main className="login-page">
        <div className="login-background">
          <div className="login-glow login-glow-one" />
          <div className="login-glow login-glow-two" />
          <div className="login-grid" />
        </div>

        <div className="session-loader">
          <div className="session-spinner" />

          <p>Checking secure session...</p>
        </div>

        <style jsx>{`
          .login-page {
            min-height: 100vh;
            width: 100%;
            position: relative;
            overflow: hidden;
            background: #030810;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .login-background {
            position: fixed;
            inset: 0;
            pointer-events: none;
            overflow: hidden;
          }

          .login-glow {
            position: absolute;
            width: 420px;
            height: 420px;
            border-radius: 50%;
            filter: blur(100px);
            opacity: 0.16;
          }

          .login-glow-one {
            top: -180px;
            left: -140px;
            background: #008cff;
          }

          .login-glow-two {
            right: -180px;
            bottom: -180px;
            background: #d4af37;
          }

          .login-grid {
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

          .session-loader {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 15px;
          }

          .session-spinner {
            width: 30px;
            height: 30px;
            border: 2px solid rgba(212, 175, 55, 0.2);
            border-top-color: #d4af37;
            border-radius: 50%;
            animation: spin 0.75s linear infinite;
          }

          .session-loader p {
            margin: 0;
            color: #7e8b9a;
            font-size: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-background">
        <div className="login-glow login-glow-one" />
        <div className="login-glow login-glow-two" />
        <div className="login-grid" />
      </div>

      <div className="login-shell">
        <div className="login-brand">
          <BrandLogo />
        </div>

        <section className="login-card">
          <div className="card-top-line" />

          <div className="login-heading">
            <div className="security-icon">◆</div>

            <p className="eyebrow">SECURE ACCESS</p>

            <h1>
              Welcome
              <span> back.</span>
            </h1>

            <p className="subtitle">
              Sign in to access your digital asset wallet,
              investments, and account.
            </p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="field-group">
              <label htmlFor="email">Email address</label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                disabled={loading}
                autoFocus
                required
              />
            </div>

            <div className="field-group">
              <div className="password-label-row">
                <label htmlFor="password">Password</label>

                <Link href="/forgot-password">
                  Forgot password?
                </Link>
              </div>

              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? "HIDE" : "SHOW"}
                </button>
              </div>
            </div>

            {error && (
              <div className="message error-message">
                <span>!</span>

                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <span>→</span>
                </>
              )}
            </button>
          </form>

          <div className="register-prompt">
            <span>Don't have an account?</span>

            <Link href="/register">Create account</Link>
          </div>

          <div className="trust-row">
            <div>
              <span className="trust-dot" />
              Secure authentication
            </div>

            <div>
              <span className="trust-dot" />
              Encrypted session
            </div>

            <div>
              <span className="trust-dot" />
              Protected wallet
            </div>
          </div>
        </section>

        <p className="copyright">
          © {new Date().getFullYear()} Crypto Com Exchange. All
          rights reserved.
        </p>
      </div>

      <style jsx>{`
        .login-page {
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

        .login-background {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .login-glow {
          position: absolute;
          width: 420px;
          height: 420px;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.16;
        }

        .login-glow-one {
          top: -180px;
          left: -140px;
          background: #008cff;
        }

        .login-glow-two {
          right: -180px;
          bottom: -180px;
          background: #d4af37;
        }

        .login-grid {
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

        .login-shell {
          width: 100%;
          max-width: 560px;
          position: relative;
          z-index: 2;
        }

        .login-brand {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }

        .login-brand :global(.brandLogo) {
          transform: scale(1.08);
        }

        .login-brand :global(.brandLogo:hover) {
          transform: scale(1.08) translateY(-1px);
        }

        .login-card {
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

        .login-heading {
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

        .login-heading h1 {
          margin: 0;
          font-size: clamp(32px, 5vw, 46px);
          line-height: 1.08;
          letter-spacing: -0.035em;
        }

        .login-heading h1 span {
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

        .login-form {
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

        .password-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .password-label-row a {
          color: #4db7ff;
          font-size: 11px;
          font-weight: 700;
          text-decoration: none;
        }

        .password-label-row a:hover {
          text-decoration: underline;
        }

        .field-group input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.035);
          color: #ffffff;
          padding: 14px 15px;
          outline: none;
          font-size: 14px;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            background 0.2s ease;
        }

        .field-group input::placeholder {
          color: #596575;
        }

        .field-group input:focus {
          border-color: rgba(77, 183, 255, 0.7);
          background: rgba(77, 183, 255, 0.035);
          box-shadow:
            0 0 0 3px rgba(77, 183, 255, 0.08),
            0 0 25px rgba(77, 183, 255, 0.05);
        }

        .field-group input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .password-input-wrapper {
          position: relative;
        }

        .password-input-wrapper input {
          padding-right: 72px;
        }

        .password-toggle {
          position: absolute;
          top: 50%;
          right: 12px;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: #758293;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.08em;
          cursor: pointer;
          padding: 6px;
        }

        .password-toggle:hover:not(:disabled) {
          color: #d4af37;
        }

        .password-toggle:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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

        .login-button {
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

        .login-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow:
            0 15px 40px rgba(212, 175, 55, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.45);
        }

        .login-button:disabled {
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

        .register-prompt {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 23px;
          color: #727e8d;
          font-size: 13px;
        }

        .register-prompt a {
          color: #4db7ff;
          font-weight: 700;
          text-decoration: none;
        }

        .register-prompt a:hover {
          text-decoration: underline;
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
          .login-page {
            padding: 25px 14px;
          }

          .login-card {
            padding: 28px 20px;
            border-radius: 20px;
          }

          .login-heading h1 {
            font-size: 34px;
          }

          .login-brand {
            margin-bottom: 20px;
          }

          .login-brand :global(.brandLogo) {
            transform: scale(1);
          }

          .login-brand :global(.brandLogo:hover) {
            transform: translateY(-1px);
          }
        }
      `}</style>
    </main>
  );
}
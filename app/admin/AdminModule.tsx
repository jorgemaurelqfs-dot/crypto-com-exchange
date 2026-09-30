"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type AdminModuleProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  children?: ReactNode;
};

export default function AdminModule({
  eyebrow,
  title,
  description,
  icon,
  children,
}: AdminModuleProps) {
  return (
    <main className="admin-module-page">
      <div className="admin-module-grid" />
      <div className="admin-module-glow admin-module-glow-one" />
      <div className="admin-module-glow admin-module-glow-two" />
      <div className="admin-module-scanline" />

      <div className="admin-module-shell">
        <div className="module-page-header">
          <div className="module-topbar">
            <Link href="/admin" className="module-back">
              <span className="module-back-arrow">←</span>

              <span className="module-back-copy">
                <span className="module-back-label">CONTROL CENTER</span>
                <span className="module-back-title">
                  Admin Dashboard
                </span>
              </span>
            </Link>

            <div className="module-system-status">
              <span className="module-status-dot" />
              <span>SYSTEM ONLINE</span>
            </div>
          </div>

          <div className="module-heading">
            <div className="module-heading-icon-wrap">
              <div className="module-heading-icon">{icon}</div>

              <div className="module-icon-ring module-icon-ring-one" />
              <div className="module-icon-ring module-icon-ring-two" />
            </div>

            <div className="module-heading-copy">
              <div className="module-eyebrow-row">
                <span className="module-eyebrow-line" />
                <span className="module-eyebrow">{eyebrow}</span>
              </div>

              <h1>{title}</h1>

              <p>{description}</p>

              <div className="module-heading-meta">
                <span>CRYPTO COM EXCHANGE</span>
                <span className="module-meta-separator">/</span>
                <span>ADMINISTRATOR ACCESS</span>
                <span className="module-meta-separator">/</span>
                <span>SECURE NODE</span>
              </div>
            </div>

            <div className="module-heading-decoration">
              <div className="module-decoration-label">
                ADMIN NODE
              </div>

              <div className="module-decoration-box">
                <span />
                <span />
                <span />
                <span />
              </div>

              <div className="module-decoration-code">
                <span>SEC</span>
                <span>01</span>
                <span>ADM</span>
              </div>
            </div>
          </div>
        </div>

        <div className="module-page-content">
          {children}
        </div>
      </div>

      <style jsx>{`
        .admin-module-page {
          --admin-black: #010204;
          --admin-black-soft: #03070c;
          --admin-blue-black: #04101b;
          --admin-blue-dark: #071b2d;
          --admin-blue: #0b6ea8;
          --admin-electric: #18a9ff;
          --admin-electric-soft: #69caff;
          --admin-gold: #d4af37;
          --admin-gold-light: #f0d46b;
          --admin-gold-dark: #8e6e18;
          --admin-white: #f4f8fc;
          --admin-muted: #8295a8;
          --admin-border: rgba(57, 130, 174, 0.22);

          position: relative;
          isolation: isolate;
          width: 100%;
          min-height: 100vh;
          padding: 0;
          overflow: hidden;
          color: var(--admin-white);
          background:
            radial-gradient(
              circle at 10% 5%,
              rgba(0, 153, 255, 0.13),
              transparent 30%
            ),
            radial-gradient(
              circle at 90% 10%,
              rgba(212, 175, 55, 0.08),
              transparent 25%
            ),
            radial-gradient(
              circle at 50% 100%,
              rgba(0, 91, 145, 0.1),
              transparent 35%
            ),
            linear-gradient(
              145deg,
              #010204 0%,
              #02070d 45%,
              #04111d 100%
            );
        }

        .admin-module-page::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -3;
          pointer-events: none;
          opacity: 0.28;
          background-image:
            linear-gradient(
              rgba(41, 119, 161, 0.12) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(41, 119, 161, 0.12) 1px,
              transparent 1px
            );
          background-size: 52px 52px;
          mask-image: linear-gradient(
            to bottom,
            black,
            rgba(0, 0, 0, 0.55),
            transparent
          );
        }

        .admin-module-page::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 20;
          pointer-events: none;
          opacity: 0.035;
          background: repeating-linear-gradient(
            to bottom,
            transparent 0,
            transparent 3px,
            rgba(255, 255, 255, 0.8) 4px
          );
        }

        .admin-module-grid {
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
          background:
            linear-gradient(
              90deg,
              transparent 0%,
              rgba(24, 169, 255, 0.025) 50%,
              transparent 100%
            );
        }

        .admin-module-glow {
          position: absolute;
          z-index: -1;
          pointer-events: none;
          border-radius: 50%;
          filter: blur(90px);
        }

        .admin-module-glow-one {
          top: -160px;
          left: -140px;
          width: 420px;
          height: 420px;
          background: rgba(0, 153, 255, 0.08);
        }

        .admin-module-glow-two {
          right: -180px;
          top: 240px;
          width: 500px;
          height: 500px;
          background: rgba(212, 175, 55, 0.045);
        }

        .admin-module-scanline {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 1px;
          z-index: 15;
          pointer-events: none;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(24, 169, 255, 0.8),
            rgba(212, 175, 55, 0.7),
            transparent
          );
          box-shadow: 0 0 18px rgba(24, 169, 255, 0.45);
          animation: adminScan 7s linear infinite;
        }

        .admin-module-shell {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 1700px;
          margin: 0 auto;
          padding: 28px 32px 60px;
        }

        .module-page-header {
          position: relative;
          margin-bottom: 26px;
          padding: 22px 26px 28px;
          border: 1px solid var(--admin-border);
          border-radius: 20px;
          overflow: hidden;
          background:
            linear-gradient(
              135deg,
              rgba(7, 27, 45, 0.92),
              rgba(2, 8, 14, 0.96)
            );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.035),
            0 24px 80px rgba(0, 0, 0, 0.32),
            0 0 50px rgba(0, 119, 180, 0.035);
          backdrop-filter: blur(18px);
        }

        .module-page-header::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 190px;
          height: 1px;
          background: linear-gradient(
            90deg,
            var(--admin-electric),
            transparent
          );
          box-shadow: 0 0 18px rgba(24, 169, 255, 0.7);
        }

        .module-page-header::after {
          content: "";
          position: absolute;
          right: -100px;
          bottom: -150px;
          width: 360px;
          height: 360px;
          border-radius: 50%;
          border: 1px solid rgba(24, 169, 255, 0.08);
          box-shadow:
            0 0 0 40px rgba(24, 169, 255, 0.025),
            0 0 0 80px rgba(24, 169, 255, 0.015);
          pointer-events: none;
        }

        .module-topbar {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 18px;
          margin-bottom: 24px;
          border-bottom: 1px solid rgba(75, 128, 158, 0.13);
        }

        .module-back {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          color: var(--admin-white);
          text-decoration: none;
          transition:
            transform 180ms ease,
            color 180ms ease;
        }

        .module-back:hover {
          color: var(--admin-gold-light);
          transform: translateX(3px);
        }

        .module-back-arrow {
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          border: 1px solid rgba(24, 169, 255, 0.26);
          border-radius: 10px;
          color: var(--admin-electric-soft);
          background: rgba(24, 169, 255, 0.055);
          font-size: 19px;
          box-shadow:
            inset 0 0 18px rgba(24, 169, 255, 0.035),
            0 0 18px rgba(24, 169, 255, 0.025);
        }

        .module-back-copy {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .module-back-label {
          color: var(--admin-gold);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.22em;
          line-height: 1;
        }

        .module-back-title {
          color: #d9e4ec;
          font-size: 13px;
          font-weight: 650;
          letter-spacing: 0.01em;
        }

        .module-system-status {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 8px 12px;
          border: 1px solid rgba(61, 185, 125, 0.18);
          border-radius: 999px;
          color: #79d9ad;
          background: rgba(61, 185, 125, 0.035);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.16em;
          white-space: nowrap;
        }

        .module-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #45d895;
          box-shadow:
            0 0 7px rgba(69, 216, 149, 0.85),
            0 0 16px rgba(69, 216, 149, 0.4);
          animation: statusPulse 2s ease-in-out infinite;
        }

        .module-heading {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .module-heading-icon-wrap {
          position: relative;
          display: grid;
          place-items: center;
          width: 92px;
          height: 92px;
          flex: 0 0 92px;
        }

        .module-heading-icon {
          position: relative;
          z-index: 3;
          display: grid;
          place-items: center;
          width: 70px;
          height: 70px;
          border: 1px solid rgba(24, 169, 255, 0.4);
          border-radius: 18px;
          color: var(--admin-electric-soft);
          background:
            linear-gradient(
              145deg,
              rgba(24, 169, 255, 0.12),
              rgba(3, 17, 29, 0.88)
            );
          box-shadow:
            inset 0 0 30px rgba(24, 169, 255, 0.06),
            0 0 30px rgba(24, 169, 255, 0.07);
          font-size: 30px;
          font-weight: 300;
        }

        .module-heading-icon::after {
          content: "";
          position: absolute;
          inset: 6px;
          border: 1px solid rgba(212, 175, 55, 0.12);
          border-radius: 13px;
        }

        .module-icon-ring {
          position: absolute;
          border: 1px solid rgba(24, 169, 255, 0.12);
          border-radius: 50%;
          pointer-events: none;
        }

        .module-icon-ring-one {
          inset: 5px;
        }

        .module-icon-ring-two {
          inset: -6px;
          border-color: rgba(212, 175, 55, 0.08);
        }

        .module-heading-copy {
          min-width: 0;
          flex: 1;
        }

        .module-eyebrow-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 7px;
        }

        .module-eyebrow-line {
          width: 30px;
          height: 1px;
          background: linear-gradient(
            90deg,
            var(--admin-gold),
            transparent
          );
          box-shadow: 0 0 8px rgba(212, 175, 55, 0.35);
        }

        .module-eyebrow {
          color: var(--admin-gold-light);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.23em;
        }

        .module-heading h1 {
          margin: 0;
          color: var(--admin-white);
          font-size: clamp(30px, 4vw, 48px);
          font-weight: 760;
          line-height: 1;
          letter-spacing: -0.045em;
          text-shadow:
            0 0 30px rgba(24, 169, 255, 0.08);
        }

        .module-heading-copy > p {
          max-width: 780px;
          margin: 12px 0 0;
          color: var(--admin-muted);
          font-size: 14px;
          line-height: 1.7;
        }

        .module-heading-meta {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 15px;
          color: #557187;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.18em;
        }

        .module-meta-separator {
          color: rgba(212, 175, 55, 0.45);
        }

        .module-heading-decoration {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: center;
          min-width: 130px;
          opacity: 0.75;
        }

        .module-decoration-label {
          margin-bottom: 10px;
          color: #4f7189;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.2em;
        }

        .module-decoration-box {
          display: grid;
          grid-template-columns: repeat(4, 8px);
          gap: 6px;
          padding: 11px;
          border: 1px solid rgba(24, 169, 255, 0.12);
          border-radius: 8px;
          background: rgba(24, 169, 255, 0.025);
        }

        .module-decoration-box span {
          width: 8px;
          height: 8px;
          border-radius: 2px;
          background: rgba(24, 169, 255, 0.45);
          box-shadow: 0 0 7px rgba(24, 169, 255, 0.18);
        }

        .module-decoration-box span:nth-child(2) {
          background: rgba(212, 175, 55, 0.7);
        }

        .module-decoration-box span:nth-child(4) {
          background: rgba(24, 169, 255, 0.2);
        }

        .module-decoration-code {
          display: flex;
          gap: 10px;
          margin-top: 9px;
          color: #3f6075;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.15em;
        }

        .module-page-content {
          position: relative;
          z-index: 2;
          width: 100%;
        }

        @keyframes statusPulse {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }

          50% {
            opacity: 0.55;
            transform: scale(0.8);
          }
        }

        @keyframes adminScan {
          0% {
            transform: translateY(0);
            opacity: 0;
          }

          8% {
            opacity: 1;
          }

          90% {
            opacity: 0.65;
          }

          100% {
            transform: translateY(100vh);
            opacity: 0;
          }
        }

        @media (max-width: 900px) {
          .admin-module-shell {
            padding: 20px 18px 45px;
          }

          .module-page-header {
            padding: 20px 20px 24px;
          }

          .module-heading-decoration {
            display: none;
          }

          .module-heading {
            gap: 18px;
          }
        }

        @media (max-width: 640px) {
          .admin-module-shell {
            padding: 14px 12px 35px;
          }

          .module-page-header {
            padding: 17px 15px 20px;
            border-radius: 16px;
          }

          .module-topbar {
            align-items: flex-start;
            margin-bottom: 20px;
          }

          .module-system-status {
            padding: 7px 9px;
            font-size: 7px;
          }

          .module-system-status span:last-child {
            display: none;
          }

          .module-heading {
            align-items: flex-start;
            gap: 14px;
          }

          .module-heading-icon-wrap {
            width: 62px;
            height: 62px;
            flex: 0 0 62px;
          }

          .module-heading-icon {
            width: 52px;
            height: 52px;
            border-radius: 14px;
            font-size: 22px;
          }

          .module-heading h1 {
            font-size: 30px;
          }

          .module-heading-copy > p {
            margin-top: 9px;
            font-size: 12px;
            line-height: 1.55;
          }

          .module-heading-meta {
            display: none;
          }

          .module-eyebrow {
            font-size: 8px;
            letter-spacing: 0.16em;
          }

          .module-eyebrow-line {
            width: 20px;
          }
        }
      `}</style>
    </main>
  );
}
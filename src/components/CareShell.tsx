"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTideCloak } from "@/lib/mock";
import type { ReactNode } from "react";

export const card: React.CSSProperties = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, marginBottom: 16, boxShadow: "0 8px 28px #00000012" };
export const btn: React.CSSProperties = { background: "var(--teal)", color: "#fff", border: "1px solid var(--teal)", borderRadius: 9, padding: "10px 15px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 650 };
export const btnGhost: React.CSSProperties = { ...btn, background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" };
export const btnDanger: React.CSSProperties = { ...btn, background: "var(--danger-bg)", borderColor: "#6d3438", color: "#ff9c9d" };
export const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: "0.8rem", wordBreak: "break-all", color: "var(--muted)" };

const NAV = [
  ["/patient", "Bệnh nhân", "♡"],
  ["/gp", "Bác sĩ GP", "+"],
  ["/physio", "Vật lý trị liệu", "⌁"],
  ["/admin", "Quản trị", "⌘"],
  ["/admin-attack", "Kiểm tra zero-trust", "◉"],
];

export function CareShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { authenticated, login, logout, isInitializing, getValueFromIdToken } = useTideCloak();
  const pathname = usePathname();
  const username = getValueFromIdToken("preferred_username");

  if (isInitializing) return <main className="loading-screen"><span className="spinner" /><p>Đang kết nối không gian bảo mật…</p></main>;
  if (!authenticated) return <main className="login-gate"><div className="gate-mark"><img src="/branding/logo.png" alt="" /></div><span className="eyebrow">CARE PASSPORT</span><h1>Đăng nhập để tiếp tục</h1><p>Hồ sơ sức khỏe của bạn được bảo vệ bởi Tide.</p><button onClick={login} style={btn}>Đăng nhập an toàn <span>↗</span></button><Link href="/" className="back-link">← Trở về trang chủ</Link></main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand-lockup sidebar-brand"><span className="brand-mark"><img src="/branding/logo.png" alt="" /></span><span><strong>Care Passport</strong><small>SECURE HEALTH VAULT</small></span></Link>
      <div className="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav className="side-nav">{NAV.map(([href, label, icon]) => <Link className={`side-link ${pathname === href ? "active" : ""}`} href={href} key={href}><span className="side-icon">{icon}</span><span>{label}</span>{pathname === href && <i />}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="security-card"><span className="security-card-icon">⌑</span><div><strong>Mã hóa đầu cuối</strong><small>Quyền truy cập được xác minh bởi Tide</small></div><span className="online-dot" /></div><div className="sidebar-footnote">Dữ liệu trong môi trường này chỉ dùng cho demo.</div></div>
    </aside>
    <main className="workspace">
      <header className="workspace-topbar"><div className="breadcrumb"><Link href="/">Care Passport</Link><span>/</span><strong>{title}</strong></div><div className="topbar-actions"><span className="secure-indicator"><i /> Mạng được bảo vệ</span><div className="user-menu"><span className="avatar">{String(username || "U").slice(0, 1).toUpperCase()}</span><span className="user-name">{username}<small>Đã xác thực</small></span></div><button className="button button-quiet button-small" onClick={logout}>Đăng xuất</button></div></header>
      <section className="workspace-content"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> CARE PASSPORT</div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><span className="page-status"><i /> KẾT NỐI AN TOÀN</span></div>{children}</section>
      <footer className="workspace-footer"><span>© 2026 CARE PASSPORT · RMIT × TIDE</span><span>HỒ SƠ MẪU · DỮ LIỆU GIẢ</span></footer>
    </main>
  </div>;
}

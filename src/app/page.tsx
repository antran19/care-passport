"use client";

import Link from "next/link";
import { useTideCloak } from "@/lib/mock";

const roles = [
  { number: "01", title: "Bệnh nhân", description: "Quản lý hồ sơ sức khỏe và quyết định ai được xem.", href: "/patient", icon: "♡", detail: "Chia sẻ có kiểm soát" },
  { number: "02", title: "Bác sĩ", description: "Đọc hồ sơ đã được bệnh nhân chia sẻ với nhóm chăm sóc.", href: "/gp", icon: "+", detail: "Quyền chỉ đọc" },
  { number: "03", title: "Quản trị viên", description: "Duyệt yêu cầu chia sẻ và theo dõi nhật ký cấp quyền.", href: "/admin", icon: "⌘", detail: "Care Steward" },
];

export default function HomePage() {
  const { authenticated, getValueFromIdToken, login, logout, isInitializing } = useTideCloak();
  const name = getValueFromIdToken("preferred_username");

  return (
    <main className="home-page">
      <header className="home-topbar">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark"><img src="/branding/logo.png" alt="" /></span>
          <span><strong>Care Passport</strong><small>HỒ SƠ SỨC KHỎE CỦA BẠN</small></span>
        </Link>
        <div className="topbar-actions">
          <span className="secure-indicator"><i /> Môi trường bảo mật</span>
          {authenticated ? <><span className="user-chip"><span className="avatar">{String(name || "U").slice(0, 1).toUpperCase()}</span>{name}</span><button className="button button-quiet button-small" onClick={logout}>Đăng xuất</button></> : <button className="button button-primary button-small" onClick={login} disabled={isInitializing}>Đăng nhập bằng Tide</button>}
        </div>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> QUYỀN KIỂM SOÁT THUỘC VỀ BẠN</div>
          <h1>Chăm sóc tốt hơn,<br /><em>bảo mật từ gốc.</em></h1>
          <p>Hồ sơ sức khỏe được mã hóa ngay trên thiết bị. Bạn chọn ai có thể xem — và có thể thu hồi quyền truy cập.</p>
          <div className="hero-assurance"><span className="assurance-icon">✓</span><span><strong>Riêng tư theo thiết kế</strong><small>Quản trị viên không thể đọc nội dung hồ sơ.</small></span></div>
        </div>
        <div className="hero-visual" aria-label="Minh họa hồ sơ sức khỏe được bảo vệ">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="vault-card"><div className="vault-card-top"><span className="mini-brand">CP</span><span className="live-tag"><i /> ĐANG BẢO VỆ</span></div><div className="vault-symbol"><span>＋</span><i>⌑</i></div><div className="vault-caption"><small>KHÔNG GIAN SỨC KHỎE CÁ NHÂN</small><strong>Mọi dữ liệu. Trong tầm kiểm soát.</strong></div><div className="vault-card-bottom"><span>END-TO-END ENCRYPTED</span><span>•••• 2048</span></div></div>
          <div className="floating-note note-encrypted"><span className="note-icon">⌑</span><span><strong>Mã hóa trên trình duyệt</strong><small>Máy chủ chỉ lưu bản mã</small></span></div>
          <div className="floating-note note-shared"><span className="note-icon note-icon-green">✓</span><span><strong>Quyền truy cập có hạn</strong><small>Bạn luôn giữ quyền quyết định</small></span></div>
          <div className="visual-glow" />
        </div>
      </section>

      <section className="roles-section">
        <div className="section-heading"><div><div className="eyebrow">BẮT ĐẦU TẠI ĐÂY</div><h2>Chọn không gian của bạn</h2></div><p>Mỗi vai trò có quyền truy cập riêng,<br />được xác minh bởi mạng Tide.</p></div>
        <div className="role-grid">{roles.map((role) => <Link className="role-card" href={role.href} key={role.href}><div className="role-card-top"><span className="role-icon">{role.icon}</span><span className="role-number">{role.number}</span></div><div className="role-meta">{role.detail}</div><h3>{role.title}</h3><p>{role.description}</p><div className="role-link">Mở không gian <span>↗</span></div></Link>)}</div>
      </section>

      <section className="demo-guide"><div className="guide-heading"><span className="guide-icon">▷</span><div><span className="eyebrow">HƯỚNG DẪN DEMO</span><h2>4 bước, 2 phút</h2></div></div><div className="guide-steps"><div><b>01</b><span>Đăng nhập patient1, mã hóa hồ sơ</span></div><div><b>02</b><span>Gửi yêu cầu chia sẻ cho bác sĩ</span></div><div><b>03</b><span>Đăng nhập admin1, duyệt yêu cầu</span></div><div><b>04</b><span>Bác sĩ đọc hồ sơ; admin thử đọc bị chặn</span></div></div><div className="demo-note">Dùng thanh <strong>Mock Role</strong> ở góc màn hình để chuyển nhanh giữa các vai trò khi demo.</div></section>

      <footer className="home-footer"><span>© 2026 CARE PASSPORT · RMIT × TIDE</span><span><i /> DỮ LIỆU DEMO · KHÔNG CHỨA THÔNG TIN BỆNH NHÂN THẬT</span></footer>
    </main>
  );
}

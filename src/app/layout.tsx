import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "Care Passport — Hồ sơ sức khỏe bảo mật",
  description: "Hồ sơ sức khỏe được mã hóa. Bạn quyết định ai có quyền truy cập.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

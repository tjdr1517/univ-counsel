import type { Metadata } from "next";
import "./globals.css";

const title = "대입 상담 기록";

export const metadata: Metadata = {
  title,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

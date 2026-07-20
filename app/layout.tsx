import type { Metadata } from "next";
import "./globals.css";

const title = "대입 상담 기록";
const description = "교사와 학생이 함께 관리하는 안전한 대입 상담 기록";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

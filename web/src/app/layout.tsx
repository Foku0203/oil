import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "น้ำมันวันนี้ · Thai Oil Pulse",
  description:
    "ราคาน้ำมันหน้าปั๊ม ค่าเงินบาท และราคาน้ำมันดิบโลก อัปเดตอัตโนมัติทุกวันด้วย data pipeline",
};

// Applies the saved theme before paint so there is no light/dark flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${plexThai.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">{children}</main>
        <footer className="mx-auto w-full max-w-6xl px-4 py-8 text-xs text-muted sm:px-6">
          ข้อมูล: PTT OR, บางจาก, ECB (Frankfurter), Yahoo Finance · ราคาขายปลีกเขตกรุงเทพฯ ·
          ใช้เพื่อการศึกษา ไม่ใช่คำแนะนำการลงทุน
        </footer>
      </body>
    </html>
  );
}

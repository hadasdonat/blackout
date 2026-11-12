import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blackout · חדר בריחה בסייבר",
  description: "לומדים לחקור לוגים ומיילים מתחזים, ואז עוצרים מתקפה אמיתית נגד השעון. בלי ידע קודם.",
  openGraph: { title: "Blackout · חדר בריחה בסייבר", description: "תצליחו לעצור את התוקף לפני שהשעון נגמר?", type: "website" },
};
export const viewport: Viewport = { themeColor: "#0f1119", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Hebrew:wght@400;500;600&family=Saira+Stencil+One&family=Secular+One&display=swap" />
      </head>
      <body>
        <div className="bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}

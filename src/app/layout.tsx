import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blackout · לומדים סייבר מאפס",
  description: "שישה שלבים, פקודות טרמינל, תרגול וחזרה, ומורה AI שעונה על כל שאלה. בלי ידע קודם.",
  openGraph: { title: "Blackout · לומדים סייבר מאפס", description: "לומדים סייבר ופקודות טרמינל מאפס, עם מורה AI ואתגר בסוף כל שלב.", type: "website" },
};
export const viewport: Viewport = { themeColor: "#121a33", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&family=Karantina:wght@400;700&family=Saira+Stencil+One&display=swap" />
      </head>
      <body>
        <div className="bg" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://tzeela-master.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "צאלה",
  description: "שולחן עבודה אישי חכם",
  applicationName: "צאלה",
  // Link previews (WhatsApp, Facebook, etc.). The image itself comes from app/opengraph-image.jpg.
  openGraph: {
    type: "website",
    url: "/",
    siteName: "צאלה",
    title: "צאלה",
    description: "שולחן עבודה אישי חכם",
    locale: "he_IL",
  },
  twitter: { card: "summary_large_image", title: "צאלה", description: "שולחן עבודה אישי חכם" },
  // Private app: keep it out of search engines (link previews still work).
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#1F5E4A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

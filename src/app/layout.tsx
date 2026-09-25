import type { Metadata } from "next";
import { DM_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Challenging Youth | Vinayaka Chavithi DJ Songs",
  description: "A festive home for the Challenging Youth DJ song collection.",
  manifest: "/manifest.webmanifest",
  icons: [
    { rel: "icon", url: "/logo.jpeg", type: "image/jpeg" },
    { rel: "apple-touch-icon", url: "/logo.jpeg", type: "image/jpeg" },
  ],
  appleWebApp: {
    capable: true,
    title: "Challenging Youth",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

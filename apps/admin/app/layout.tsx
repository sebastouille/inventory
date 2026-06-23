import type { Metadata } from "next";
import { Geist_Mono, Manrope, Sora } from "next/font/google";
import { UiProviders } from "@inventory/ui";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Inventory Admin",
  description: "Back-office de gouvernance et d habilitation"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${manrope.variable} ${geistMono.variable} ${sora.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <UiProviders>{children}</UiProviders>
      </body>
    </html>
  );
}

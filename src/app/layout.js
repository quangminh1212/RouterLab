import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/shared/components/ThemeProvider";
import { initConsoleLogCapture } from "@/lib/consoleLogBuffer";
import { RuntimeI18nProvider } from "@/i18n/RuntimeI18nProvider";
import { logger } from "@/lib/logger";

// Hook console immediately at module load time (server-side only, runs once)
initConsoleLogCapture();
logger.info("APP", "Console log capture initialized");
logger.info("APP", "xlabrouter application starting up");

function bootstrapServerInits() {
  if (typeof window !== "undefined") return;

  const globalKey = "__xlabrouterServerInitStarted";
  if (globalThis[globalKey]) return;
  globalThis[globalKey] = true;

  const delayRaw = Number(process.env.APP_BOOTSTRAP_DELAY_MS);
  const bootstrapDelayMs = Number.isFinite(delayRaw) && delayRaw >= 0 ? delayRaw : 5000;

  setTimeout(() => {
    Promise.allSettled([
      import("@/lib/initCloudSync"),
      import("@/lib/network/initOutboundProxy"),
    ]).then((results) => {
      if (results[0]?.status === "fulfilled") {
        logger.info("APP", "Cloud sync module loaded");
      } else {
        logger.warn("APP", "Cloud sync module failed to load");
      }

      if (results[1]?.status === "fulfilled") {
        logger.info("APP", "Outbound proxy module loaded");
      } else {
        logger.warn("APP", "Outbound proxy module failed to load");
      }
    }).catch(() => {
      logger.warn("APP", "Server bootstrap initialization failed");
    });
  }, bootstrapDelayMs);
}

bootstrapServerInits();

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "xlabrouter - AI Infrastructure Management",
  description: "One endpoint for all your AI providers. Manage keys, monitor usage, and scale effortlessly.",
  icons: {
    icon: "/topup.png",
    apple: "/topup.png",
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <RuntimeI18nProvider>
            {children}
          </RuntimeI18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

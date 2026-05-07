import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/shared/components/ThemeProvider";
import { initConsoleLogCapture } from "@/lib/consoleLogBuffer";
import { RuntimeI18nProvider } from "@/i18n/RuntimeI18nProvider";

function bootstrapAppModule() {
  if (typeof window !== "undefined") return;

  const globalKey = "__xlabrouterAppModuleBootstrapped";
  if (globalThis[globalKey]) return;
  globalThis[globalKey] = true;

  initConsoleLogCapture();
}

bootstrapAppModule();

function bootstrapServerInits() {
  if (typeof window !== "undefined") return;

  const globalKey = "__xlabrouterServerInitStarted";
  if (globalThis[globalKey]) return;
  globalThis[globalKey] = true;

  setTimeout(() => {
    void import("@/lib/initCloudSync").catch(() => {});
    void import("@/lib/network/initOutboundProxy").catch(() => {});
  }, 1500);
}

bootstrapServerInits();

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "arial"],
});

export const metadata = {
  title: "XLab Router - AI Infrastructure Management",
  description: "One endpoint for all your AI providers. Manage keys, monitor usage, and scale effortlessly.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export const viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('theme');
                  var theme = stored ? JSON.parse(stored).state.theme : 'dark';
                  var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  var effectiveTheme = theme === 'system' ? systemTheme : theme;
                  if (effectiveTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
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



"use client";

import { useState, useEffect } from "react";
import { Card, Button, Input } from "@/shared/components";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasPassword, setHasPassword] = useState(null);
  const [oauthUrl, setOauthUrl] = useState("");
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  const router = useRouter();

  const qrUrl = oauthUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(oauthUrl)}`
    : "";

  useEffect(() => {
    const googleError = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("google")
      : null;
    if (!googleError) return;
    if (googleError === "not-configured") {
      setError("Google Drive OAuth chưa cấu hình trong XLab_Router và cũng không tìm thấy trong C:\\Dev\\XLab_Web (.env.local/.env).");
      return;
    }
    setError(`Google login failed: ${googleError}`);
  }, []);

  useEffect(() => {
    async function checkAuth() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

      try {
        const res = await fetch(`${baseUrl}/api/settings/require-login`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.requireLogin === false) {
            router.push("/dashboard");
            router.refresh();
            return;
          }
          setHasPassword(data.hasPassword !== false);
          setOauthUrl(`${window.location.origin}/api/auth/google/start`);
        } else {
          // Safe fallback on non-OK response to avoid infinite loading state.
          setHasPassword(true);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        setHasPassword(true);
      }
    }
    checkAuth();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        let data = null;
        try {
          data = await res.json();
        } catch {
          // ignore parse error and use fallback message
        }
        setError(data?.error || "Invalid password");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while checking password
  if (hasPassword === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-text-muted mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 w-14 h-14 rounded-xl overflow-hidden bg-surface/60 border border-black/5 dark:border-white/10">
            <img src="/topup.png" alt="XLab Router logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-3xl font-bold text-primary mb-2">XLab Router</h1>
          <p className="text-text-muted">Scan QR OAuth to access dashboard</p>
        </div>

        <Card>
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-sm text-text-muted mb-3">Quét mã QR bằng điện thoại để mở Google OAuth</p>
              {qrUrl ? (
                <img src={qrUrl} alt="Google OAuth QR" className="mx-auto rounded-lg border border-border" width={240} height={240} />
              ) : (
                <div className="h-[240px] rounded-lg border border-border flex items-center justify-center text-sm text-text-muted">Preparing OAuth QR...</div>
              )}
              {oauthUrl && (
                <div className="mt-3 flex justify-center">
                  <Button variant="secondary" onClick={() => window.open(oauthUrl, "_self")}>Open OAuth</Button>
                </div>
              )}
            </div>

            <button type="button" className="text-xs underline text-text-muted" onClick={() => setShowPasswordFallback((v) => !v)}>
              {showPasswordFallback ? "Hide password fallback" : "Use password fallback"}
            </button>

            {showPasswordFallback && (
              <form onSubmit={handleLogin} className="flex flex-col gap-4 pt-2 border-t border-border/50">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                </div>
                <Button type="submit" variant="primary" className="w-full" loading={loading}>Login</Button>
                {!hasPassword && <p className="text-xs text-center text-text-muted mt-2">Default password: <code className="bg-sidebar px-1 rounded">123456</code></p>}
              </form>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

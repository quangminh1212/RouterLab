"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Card, Button, Input } from "@/shared/components";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [oauthUrl, setOauthUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const googleError = typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("google")
      : null;
    if (!googleError) return;
    setError(`Login failed: ${googleError}`);
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
          const qrRes = await fetch(`${window.location.origin}/api/auth/oauth-qr`, { cache: "no-store" });
          const qrData = await qrRes.json().catch(() => ({}));
          setOauthUrl(qrData?.url || "");
          setAuthReady(true);
        } else {
          setAuthReady(true);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        setAuthReady(true);
      }
    }
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!oauthUrl) return;
    QRCode.toDataURL(oauthUrl, { width: 240, margin: 1, errorCorrectionLevel: "M" })
      .then(setQrDataUrl)
      .catch(() => setError("Failed to render authenticator QR"));
  }, [oauthUrl]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/oauth-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: authCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Invalid authenticator code");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!authReady) {
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
          <p className="text-text-muted">Scan with Google Authenticator to access dashboard</p>
        </div>

        <Card>
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-sm text-text-muted mb-3">Quét mã QR bằng Google Authenticator, sau đó nhập mã 6 số để đăng nhập</p>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Authenticator QR" className="mx-auto rounded-lg border border-border" width={240} height={240} />
              ) : (
                <div className="h-[240px] rounded-lg border border-border flex items-center justify-center text-sm text-text-muted">Preparing authenticator QR...</div>
              )}
              <div className="mt-4 flex flex-col gap-3">
                <Input
                  placeholder="Enter 6-digit code"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                />
                <Button onClick={handleSubmit} loading={submitting} disabled={authCode.length !== 6}>
                  Login
                </Button>
              </div>
              {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

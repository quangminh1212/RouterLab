"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/shared/components/Button";
import Card from "@/shared/components/Card";
import Input from "@/shared/components/Input";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [oauthUrl, setOauthUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrUnavailable, setQrUnavailable] = useState(false);
  const [authCode, setAuthCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const normalizedAuthCode = authCode.trim();
  const canSubmit = normalizedAuthCode.length >= 6 && !submitting;

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
          setQrUnavailable(!qrRes.ok || !qrData?.url);
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
    let cancelled = false;

    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(oauthUrl, { width: 240, margin: 1, errorCorrectionLevel: "M" })
      )
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to render authenticator QR");
      });

    return () => {
      cancelled = true;
    };
  }, [oauthUrl]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/oauth-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", code: normalizedAuthCode }),
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
          <p className="text-text-muted">Scan with Google Authenticator or use a backup code</p>
        </div>

        <Card>
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-sm text-text-muted mb-3">
                {qrUnavailable
                  ? "Enter the 6-digit code from your existing Authenticator app or a backup code"
                  : "Scan the QR with Google Authenticator, then enter a 6-digit code or a backup code"}
              </p>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Authenticator QR" className="mx-auto rounded-lg border border-border" width={240} height={240} />
              ) : qrUnavailable ? (
                <div className="h-[160px] rounded-lg border border-border flex items-center justify-center text-sm text-text-muted px-6">
                  QR setup is only available from localhost or after login.
                </div>
              ) : (
                <div className="h-[240px] rounded-lg border border-border flex items-center justify-center text-sm text-text-muted">Preparing authenticator QR...</div>
              )}
              <div className="mt-4 flex flex-col gap-3">
                <Input
                  placeholder="Enter 6-digit code or backup code"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 32))}
                />
                <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
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

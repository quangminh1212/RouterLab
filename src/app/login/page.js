"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Card, Button } from "@/shared/components";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [oauthUrl, setOauthUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const router = useRouter();

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
          setOauthUrl(`${window.location.origin}/api/auth/google/start`);
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
      .catch(() => setError("Failed to render OAuth QR"));
  }, [oauthUrl]);

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
          <p className="text-text-muted">Scan QR OAuth to access dashboard</p>
        </div>

        <Card>
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-sm text-text-muted mb-3">Quét mã QR bằng điện thoại để mở Google OAuth</p>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Google OAuth QR" className="mx-auto rounded-lg border border-border" width={240} height={240} />
              ) : (
                <div className="h-[240px] rounded-lg border border-border flex items-center justify-center text-sm text-text-muted">Preparing OAuth QR...</div>
              )}
              {oauthUrl && (
                <div className="mt-3 flex justify-center">
                  <Button variant="secondary" onClick={() => window.open(oauthUrl, "_self")}>Open OAuth</Button>
                </div>
              )}
              {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

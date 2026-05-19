"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Button from "@/shared/components/Button";
import Card from "@/shared/components/Card";
import Input from "@/shared/components/Input";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [authReady, setAuthReady] = useState(false);
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
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <img src="/topup.png" alt="XLab Router logo" className="mx-auto mb-3 h-14 w-14 object-contain" />
          <h1 className="text-3xl font-bold text-primary">XLab Router</h1>
        </div>

        <Card>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Enter 6-digit code"
              value={authCode}
              autoFocus
              onChange={(e) => setAuthCode(e.target.value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 32))}
            />
            <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
              Login
            </Button>
            {error && <p className="text-center text-xs text-red-500">{error}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

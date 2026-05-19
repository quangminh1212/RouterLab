"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card } from "@/shared/components";
import { APP_CONFIG } from "@/shared/constants/config";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Vui long nhap ten dang nhap va mat khau");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Dang nhap that bai");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError("Loi ket noi, vui long thu lai");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4">
            <span className="material-symbols-outlined text-primary text-[28px]">router</span>
          </div>
          <h1 className="text-xl font-semibold text-text-main">{APP_CONFIG?.name || "XLab Router"}</h1>
          <p className="text-sm text-text-muted mt-1">Dang nhap de tiep tuc</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Ten dang nhap"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              disabled={loading}
              required
            />
            <Input
              label="Mat khau"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
              required
            />
            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">error</span>
                {error}
              </p>
            )}
            <Button type="submit" fullWidth loading={loading} disabled={loading}>
              Dang nhap
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button, Input, Card } from "@/shared/components";
import { APP_CONFIG } from "@/shared/constants/config";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!password) {
      setError("Vui lòng nhập mật khẩu");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Đăng nhập thất bại");
        return;
      }
      router.replace("/dashboard");
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4 overflow-hidden">
            <Image src="/icon.png" alt="RouterLab" width={56} height={56} priority />
          </div>
          <h1 className="text-xl font-semibold text-text-main">{APP_CONFIG?.name || "RouterLab"}</h1>
          <p className="text-sm text-text-muted mt-1">Nhập mật khẩu để tiếp tục</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Mật khẩu"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
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
              Đăng nhập
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

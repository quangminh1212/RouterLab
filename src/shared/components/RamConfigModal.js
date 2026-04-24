"use client";

import { useState, useEffect } from "react";
import { cn } from "@/shared/utils/cn";
import PropTypes from "prop-types";

const RAM_PRESETS = [
  { value: 512, label: "512 MB" },
  { value: 1024, label: "1 GB" },
  { value: 2048, label: "2 GB (Khuyến nghị)" },
  { value: 4096, label: "4 GB" },
  { value: 8192, label: "8 GB" },
];

export default function RamConfigModal({ isOpen, onClose }) {
  const [selectedRam, setSelectedRam] = useState(2048);
  const [customRam, setCustomRam] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/settings/ram")
        .then(res => res.json())
        .then(data => {
          if (data.ram) {
            const preset = RAM_PRESETS.find(p => p.value === data.ram);
            if (preset) {
              setSelectedRam(data.ram);
              setUseCustom(false);
            } else {
              setCustomRam(String(data.ram));
              setUseCustom(true);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    const ramValue = useCustom ? parseInt(customRam) : selectedRam;
    
    if (isNaN(ramValue) || ramValue < 256 || ramValue > 32768) {
      alert("Giá trị RAM không hợp lệ (256-32768 MB)");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings/ram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ram: ramValue }),
      });

      if (res.ok) {
        alert("Đã lưu cấu hình RAM. Khởi động lại ứng dụng để áp dụng.");
        onClose();
      } else {
        alert("Lỗi khi lưu cấu hình");
      }
    } catch (error) {
      alert("Lỗi kết nối");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className={cn(
        "relative w-full bg-surface border border-black/10 dark:border-white/10 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-w-md"
      )}>
        <div className="px-6 py-4 border-b border-black/10 dark:border-white/10">
          <h2 className="text-lg font-semibold text-text-main">Cấu hình RAM</h2>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-text-muted">
            Điều chỉnh giới hạn RAM để tối ưu hiệu suất theo cấu hình máy của bạn.
          </p>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-text-main">
              <input
                type="radio"
                checked={!useCustom}
                onChange={() => setUseCustom(false)}
                className="accent-blue-500"
              />
              Chọn từ danh sách
            </label>

            {!useCustom && (
              <div className="grid grid-cols-2 gap-2 ml-6">
                {RAM_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => setSelectedRam(preset.value)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      selectedRam === preset.value
                        ? "bg-blue-500 text-white"
                        : "bg-black/5 dark:bg-white/5 text-text-main hover:bg-black/10 dark:hover:bg-white/10"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-text-main">
              <input
                type="radio"
                checked={useCustom}
                onChange={() => setUseCustom(true)}
                className="accent-blue-500"
              />
              Tùy chỉnh (MB)
            </label>

            {useCustom && (
              <input
                type="number"
                value={customRam}
                onChange={(e) => setCustomRam(e.target.value)}
                placeholder="Nhập giá trị (256-32768)"
                min="256"
                max="32768"
                className="ml-6 w-full px-4 py-2 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-black/10 dark:border-white/10 flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm text-text-main hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

RamConfigModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
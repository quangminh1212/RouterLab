"use client";

import { Modal, Button } from "@/shared/components";

export default function EndpointTailscaleModals({
  showTsModal,
  tsInstalling,
  setShowTsModal,
  setTsSudoPassword,
  setTsStatus,
  tsInstalled,
  handleInstallTailscale,
  tsInstallLog,
  tsLogRef,
  handleConnectTailscale,
  tsStatus,
  showDisableTsModal,
  tsLoading,
  setShowDisableTsModal,
  handleDisableTailscale,
}) {
  return (
    <>
      <Modal
        isOpen={showTsModal}
        title="Tailscale Funnel"
        onClose={() => { if (!tsInstalling) { setShowTsModal(false); setTsSudoPassword(""); setTsStatus(null); } }}
      >
        <div className="flex flex-col gap-4">
          {tsInstalled === null && (
            <p className="text-sm text-text-muted flex items-center gap-2">
              <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
              Checking...
            </p>
          )}

          {tsInstalled === false && !tsInstalling && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-muted">Tailscale chưa được cài. Cài đặt để có link tunnel cố định (miễn phí, truy cập public).</p>
              <div className="flex gap-2">
                <Button
                  onClick={handleInstallTailscale}
                  fullWidth
                  className="bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white!"
                >
                  Install Tailscale
                </Button>
                <Button onClick={() => setShowTsModal(false)} variant="ghost" fullWidth>Cancel</Button>
              </div>
            </div>
          )}

          {tsInstalling && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                Installing Tailscale...
              </div>
              {tsInstallLog.length > 0 && (
                <div ref={tsLogRef} className="bg-black/5 dark:bg-white/5 rounded p-2 max-h-40 overflow-y-auto font-mono text-xs text-text-muted">
                  {tsInstallLog.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tsInstalled === true && !tsInstalling && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Tailscale installed
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    const tab = window.open("", "tailscale_auth", "width=600,height=700");
                    if (tab) {
                      try {
                        tab.document.write("<p style='font-family:sans-serif;text-align:center;margin-top:40px'>Connecting to Tailscale...</p>");
                      } catch {
                      }
                    }
                    handleConnectTailscale(tab);
                  }}
                  fullWidth
                  className="bg-linear-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white!"
                >
                  Connect
                </Button>
                <Button onClick={() => setShowTsModal(false)} variant="ghost" fullWidth>Cancel</Button>
              </div>
            </div>
          )}

          {tsStatus ? <StatusAlert status={tsStatus} /> : null}
        </div>
      </Modal>

      <Modal
        isOpen={showDisableTsModal}
        title="Disable Tailscale"
        onClose={() => !tsLoading && setShowDisableTsModal(false)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">Tailscale Funnel will be stopped. Remote access via Tailscale URL will stop working.</p>
          <div className="flex gap-2">
            <Button onClick={handleDisableTailscale} fullWidth disabled={tsLoading} className="bg-red-500! hover:bg-red-600! text-white!">
              {tsLoading ? "Disabling..." : "Disable"}
            </Button>
            <Button onClick={() => setShowDisableTsModal(false)} variant="ghost" fullWidth disabled={tsLoading}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function StatusAlert({ status, className = "" }) {
  const renderMessage = (msg) => {
    const parts = msg.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, i) =>
      /^https?:\/\//.test(part)
        ? <a key={i} href={part} target="_blank" rel="noreferrer" className="underline font-medium">{part}</a>
        : part
    );
  };

  return (
    <div className={`p-2 rounded text-sm ${className} ${status.type === "success" ? "bg-green-500/10 text-green-600 dark:text-green-400" :
        status.type === "warning" ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" :
        status.type === "info" ? "bg-primary/50/10 text-primary dark:text-blue-400" :
          "bg-red-500/10 text-red-600 dark:text-red-400"
      }`}>
      {renderMessage(status.message)}
    </div>
  );
}

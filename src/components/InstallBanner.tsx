import { useState, useEffect } from "react";

function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && (navigator as any).standalone === true)
  );
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("install-banner-dismissed") === "true",
  );
  const [isStandalone] = useState(() => isStandaloneMode());
  const [showIOSBanner] = useState(() => isIOS() && !isStandaloneMode());

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !showIOSBanner) return null;

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("install-banner-dismissed", "true");
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-accent text-white text-sm">
      <span>
        {showIOSBanner
          ? "To install, tap the share icon then 'Add to Home Screen'"
          : "Install TPC Catalog for the best experience"}
      </span>
      <div className="flex gap-2 shrink-0 ml-2">
        {!showIOSBanner && (
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 bg-white text-accent rounded font-medium min-h-10"
          >
            Install
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="px-2 min-h-10 min-w-10 flex items-center justify-center text-lg"
          aria-label="Dismiss install banner"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

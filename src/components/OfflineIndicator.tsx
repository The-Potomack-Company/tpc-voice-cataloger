import { useOnlineStatus } from "../hooks/useOnlineStatus";

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="flex items-center justify-center py-1 bg-gray-100 dark:bg-gray-800"
      aria-live="polite"
      role="status"
    >
      <svg
        className="w-4 h-4 text-gray-500 dark:text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3l18 18M9.348 6.782A10.451 10.451 0 0112 6c2.873 0 5.504 1.154 7.413 3.024M5.636 9.024a10.398 10.398 0 011.712-1.242M7.758 12.758A6.001 6.001 0 0112 10.5c1.272 0 2.452.395 3.424 1.07M10.586 15.414a3.001 3.001 0 013.828-1M12 19.5v.75"
        />
      </svg>
    </div>
  );
}

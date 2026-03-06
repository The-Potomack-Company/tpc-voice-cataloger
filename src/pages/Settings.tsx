import { useUIStore } from "../stores/uiStore";

export function SettingsPage() {
  const resetWalkthrough = useUIStore((s) => s.resetWalkthrough);

  return (
    <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Settings
      </h1>

      {/* About section */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          About
        </h2>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <p className="text-gray-900 dark:text-gray-100 font-medium">
            TPC Catalog v1.0
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Speech-to-catalog tool for auctioneers
          </p>
        </div>
      </section>

      {/* Storage section */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Storage
        </h2>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-900 dark:text-gray-100">Database</span>
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
              Active
            </span>
          </div>
        </div>
      </section>

      {/* Actions section */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Actions
        </h2>
        <button
          onClick={resetWalkthrough}
          className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-left
                     text-gray-900 dark:text-gray-100 min-h-12
                     hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Reset Walkthrough
        </button>
      </section>
    </div>
  );
}

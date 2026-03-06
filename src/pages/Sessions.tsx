import { Link } from "react-router";
import { useUIStore } from "../stores/uiStore";
import { Walkthrough } from "../components/Walkthrough";

export function SessionsPage() {
  const hasCompletedWalkthrough = useUIStore(
    (s) => s.hasCompletedWalkthrough,
  );

  if (!hasCompletedWalkthrough) {
    return <Walkthrough />;
  }

  // Empty state — no sessions can be created yet (Phase 3+)
  return (
    <div className="flex flex-col items-center justify-center min-h-full portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-12">
      <svg
        className="w-20 h-20 text-gray-300 dark:text-gray-600 mb-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
      </svg>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        No sessions yet
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8 text-center">
        Create your first cataloging session to get started.
      </p>
      <Link
        to="/new"
        className="bg-accent hover:bg-accent-hover text-white font-medium py-3 px-8 rounded-lg min-h-12 flex items-center justify-center transition-colors"
      >
        Start New Session
      </Link>
    </div>
  );
}

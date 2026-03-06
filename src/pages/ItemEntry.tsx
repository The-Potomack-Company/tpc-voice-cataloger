import { useParams, useNavigate } from "react-router";

export function ItemEntryPage() {
  const { sessionId, itemId } = useParams<{
    sessionId: string;
    itemId?: string;
  }>();
  const navigate = useNavigate();

  return (
    <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
      <button
        onClick={() => navigate(`/session/${sessionId}`)}
        className="flex items-center gap-1 text-accent min-h-12 mb-4"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 19.5L8.25 12l7.5-7.5"
          />
        </svg>
        Back to Session
      </button>

      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Item Entry
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          {itemId ? `Editing item ${itemId}` : "New item"} in session{" "}
          {sessionId}
        </p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-4">
          Coming in Plan 02
        </p>
      </div>
    </div>
  );
}

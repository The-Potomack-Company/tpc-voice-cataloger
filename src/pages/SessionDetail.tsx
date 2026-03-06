import { useParams } from "react-router";

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="portrait:px-4 landscape:px-8 landscape:max-w-3xl landscape:mx-auto py-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
        Session Detail
      </h1>
      <p className="text-gray-500 dark:text-gray-400">
        Session ID: {id}
      </p>
      <p className="text-gray-400 dark:text-gray-500 mt-2 text-sm">
        Full session detail view will be implemented in Plan 03.
      </p>
    </div>
  );
}

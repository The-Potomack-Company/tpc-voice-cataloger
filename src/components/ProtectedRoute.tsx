import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../stores/authStore';

export function ProtectedRoute() {
  const { session, loading } = useAuthStore();

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-dvh bg-white dark:bg-gray-900"
        role="status"
        aria-label="Loading"
      >
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

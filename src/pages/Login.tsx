import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const signIn = useAuthStore((s) => s.signIn);
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setSubmitting(false);
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <div className="flex items-center justify-center h-dvh bg-white dark:bg-gray-900">
      <div className="w-full max-w-sm mx-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 text-center">
          TPC Catalog
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1 mb-8">
          Speech-to-catalog tool for auctioneers
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full min-h-12 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full min-h-12 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-accent focus:border-accent outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-12 rounded-lg bg-accent text-white font-medium mt-6 disabled:opacity-50"
          >
            {submitting ? (
              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full inline-block" />
            ) : (
              'Sign In'
            )}
          </button>

          {error && (
            <p
              role="alert"
              className="text-sm text-red-600 dark:text-red-400 mt-3 text-center"
            >
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

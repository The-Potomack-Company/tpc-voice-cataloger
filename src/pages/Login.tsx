import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Eyebrow } from '../ui/Eyebrow';

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
    <div className="flex items-center justify-center h-dvh">
      <div className="w-full max-w-sm mx-4">
        <header className="text-center mb-8">
          <Eyebrow>The Potomack Co.</Eyebrow>
          <h1 className="tpc-display tpc-display-2 mt-2 text-ink">
            Catalog
          </h1>
          <p className="text-sm text-ink-3 mt-2">
            Speech-to-catalog tool for auctioneers
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />

          <Input
            id="password"
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            disabled={submitting}
            fullWidth
            className="mt-2"
          >
            {submitting ? (
              <span
                className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full inline-block"
                aria-hidden="true"
              />
            ) : (
              'Sign In'
            )}
          </Button>

          {error && (
            <p role="alert" className="text-sm text-err text-center">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

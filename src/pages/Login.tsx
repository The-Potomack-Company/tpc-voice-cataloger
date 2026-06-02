import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Eyebrow } from '../ui/Eyebrow';
import { toUserMessage } from '../lib/toUserMessage';

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
      // T-36-02: never render raw GoTrue text — funnel through the single
      // friendly-copy mapper so no email-exists/credentials oracle leaks.
      setError(toUserMessage(error));
      setSubmitting(false);
    } else {
      navigate('/', { replace: true });
    }
  }

  return (
    <main className="flex items-center justify-center h-dvh">
      <div className="w-full max-w-sm mx-4">
        <header className="text-center mb-8">
          {/* Italic serif "P" monogram — the only place the italic display font
              renders as a hero mark per docs/design-handoff/prototype-primitives.jsx */}
          <span
            aria-hidden
            className="tpc-display-text"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              border: "1px solid var(--ink)",
              borderRadius: 10,
              color: "var(--ink)",
              fontSize: 40,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              marginBottom: 18,
            }}
          >
            P
          </span>
          <Eyebrow>The Potomack Co.</Eyebrow>
          <h1 className="tpc-display tpc-display-2 mt-2 text-ink">
            Catalog
          </h1>
          <p className="text-sm text-ink-3 mt-2">
            Speech-to-catalog tool for auctioneers
          </p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 tpc-card p-5" style={{ background: "var(--bg-2)" }}>
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
    </main>
  );
}

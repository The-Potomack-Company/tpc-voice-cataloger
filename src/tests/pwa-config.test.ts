import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('PWA Workbox config', () => {
  const viteConfig = readFileSync(
    resolve(__dirname, '../../vite.config.ts'),
    'utf-8',
  );

  it('has runtimeCaching with NetworkOnly handler for supabase.co URLs', () => {
    expect(viteConfig).toContain('runtimeCaching');
    expect(viteConfig).toContain("handler: 'NetworkOnly'");
    expect(viteConfig).toContain('supabase\\.co');
  });

  it('has navigateFallbackDenylist excluding /auth routes', () => {
    expect(viteConfig).toContain('navigateFallbackDenylist');
    expect(viteConfig).toContain('/^\\/auth/');
  });
});

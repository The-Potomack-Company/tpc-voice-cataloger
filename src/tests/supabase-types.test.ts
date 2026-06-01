import { describe, it, expect } from 'vitest';
import type { Database, Tables, Insertable, Updatable } from '../db/database.types';

describe('Supabase Database Types', () => {
  it('Database type has public.Tables with all 4 tables', () => {
    // Type-level test: if this compiles, the tables exist in the type
    type PublicTables = Database['public']['Tables'];
    // Type-level assertions: these assignments verify the types exist at compile time
    const profiles: PublicTables['profiles'] = {} as PublicTables['profiles'];
    const sessions: PublicTables['sessions'] = {} as PublicTables['sessions'];
    const items: PublicTables['items'] = {} as PublicTables['items'];
    const exportHistory: PublicTables['export_history'] = {} as PublicTables['export_history'];

    // Runtime assertion that the type structure is correct
    expect(profiles).toBeDefined();
    expect(sessions).toBeDefined();
    expect(items).toBeDefined();
    expect(exportHistory).toBeDefined();
  });

  it('Tables helper extracts Row type for profiles', () => {
    type Profile = Tables<'profiles'>;
    // Verify expected fields exist at type level
    const profile: Profile = {
      id: 'uuid-string',
      role: 'admin',
      display_name: 'Test User',
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(profile.id).toBe('uuid-string');
    expect(profile.role).toBe('admin');
    expect(profile.display_name).toBe('Test User');
    expect(profile.is_active).toBe(true);
  });

  it('Tables helper extracts Row type for sessions', () => {
    type Session = Tables<'sessions'>;
    const session: Session = {
      id: 'uuid',
      name: 'Test Session',
      mode: 'house',
      status: 'active',
      notes: '',
      review_notes: null,
      created_by: 'user-uuid',
      assigned_to: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };
    expect(session.mode).toBe('house');
    expect(session.status).toBe('active');
    expect(session.assigned_to).toBeNull();
  });

  it('Tables helper extracts Row type for items', () => {
    type Item = Tables<'items'>;
    const item: Item = {
      id: 'uuid',
      session_id: 'session-uuid',
      mode: 'sale',
      receipt_number: '39135-2',
      title: 'TEST TITLE',
      description: 'test description',
      condition: 'good',
      estimate: '$100-200',
      measurements: '10 x 5 x 3 in.',
      category: 'furniture',
      transcript: 'original speech',
      ai_status: 'done',
      sort_order: 1,
      created_at: '2026-01-01T00:00:00Z',
      claimed_at: null,
      ai_attempts: 0,
    };
    expect(item.receipt_number).toBe('39135-2');
    expect(item.ai_status).toBe('done');
  });

  it('items Row includes claimed_at (string | null) and ai_attempts (number)', () => {
    type Item = Tables<'items'>;
    const claimed: Item['claimed_at'] = '2026-06-01T00:00:00Z';
    const unclaimed: Item['claimed_at'] = null;
    const attempts: Item['ai_attempts'] = 3;
    expect(claimed).toBe('2026-06-01T00:00:00Z');
    expect(unclaimed).toBeNull();
    expect(attempts).toBe(3);
  });

  it('items Insertable allows claimed_at and ai_attempts', () => {
    type InsertItem = Insertable<'items'>;
    const withClaim: InsertItem = {
      session_id: 'session-uuid',
      mode: 'sale',
      receipt_number: '39135-3',
      claimed_at: null,
      ai_attempts: 0,
    };
    expect(withClaim.claimed_at).toBeNull();
    expect(withClaim.ai_attempts).toBe(0);
  });

  it('items Updatable allows claimed_at and ai_attempts', () => {
    type UpdateItem = Updatable<'items'>;
    const partial: UpdateItem = {
      claimed_at: '2026-06-01T12:00:00Z',
      ai_attempts: 2,
    };
    expect(partial.claimed_at).toBe('2026-06-01T12:00:00Z');
    expect(partial.ai_attempts).toBe(2);
  });

  it('Insertable helper makes optional fields optional', () => {
    type InsertSession = Insertable<'sessions'>;
    // id, status, notes, review_notes, assigned_to, created_at, updated_at are optional on insert
    const minimal: InsertSession = {
      name: 'New Session',
      mode: 'house',
      created_by: 'user-uuid',
    };
    expect(minimal.name).toBe('New Session');
  });

  it('Updatable helper makes all fields optional', () => {
    type UpdateSession = Updatable<'sessions'>;
    // All fields are optional on update
    const partial: UpdateSession = {
      status: 'submitted',
    };
    expect(partial.status).toBe('submitted');
  });
});

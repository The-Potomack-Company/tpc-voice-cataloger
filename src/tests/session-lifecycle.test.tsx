import { describe, it } from 'vitest';

describe('Session Lifecycle', () => {
  describe('submit', () => {
    it.todo('LIFE-01: specialist can submit an active session for review');
    it.todo('LIFE-01: submit button is disabled when items are queued');
    it.todo('LIFE-01: submit confirmation dialog shows session name and lock warning');
  });

  describe('read-only', () => {
    it.todo('LIFE-02: submitted session is read-only for specialist');
    it.todo('LIFE-02: specialist cannot add items to submitted session');
    it.todo('LIFE-02: specialist sees blue status banner on submitted session');
  });

  describe('admin edit', () => {
    it.todo('LIFE-03: admin can edit item fields on submitted sessions');
    it.todo('LIFE-03: admin is never locked by session status');
  });

  describe('return', () => {
    it.todo('LIFE-04: admin can return submitted session to specialist');
    it.todo('LIFE-04: return dialog allows optional review notes');
    it.todo('LIFE-04: returned session status changes to returned');
  });

  describe('review notes', () => {
    it.todo('LIFE-05: returned session shows sticky amber banner with review notes');
    it.todo('LIFE-05: banner displays admin review notes text');
    it.todo('LIFE-05: returned session is unlocked for specialist editing');
  });

  describe('export', () => {
    it.todo('LIFE-06: export button is visible only to admin');
    it.todo('LIFE-06: specialist does not see export button');
    it.todo('LIFE-06: export sets session status to exported');
  });
});

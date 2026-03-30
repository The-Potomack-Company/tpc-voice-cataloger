import { describe, it } from 'vitest';

describe('useWalkthroughStatus', () => {
  describe('complete', () => {
    it.todo('WT-04: completeWalkthrough writes walkthrough_completed=true to Supabase profiles');
    it.todo('WT-04: completeWalkthrough sets local walkthroughCompleted to true optimistically');
    it.todo('WT-04: fetches walkthrough_completed and role in a single query');
  });

  describe('reset', () => {
    it.todo('WT-05: resetWalkthrough writes walkthrough_completed=false to Supabase profiles');
    it.todo('WT-05: resetWalkthrough sets local walkthroughCompleted to false optimistically');
    it.todo('WT-05: Settings reset button calls resetWalkthrough from hook');
  });

  describe('loading', () => {
    it.todo('returns loading=true initially, then false after query resolves');
    it.todo('defaults to walkthroughCompleted=false when no user is logged in');
    it.todo('defaults to role=specialist when profile query fails');
  });
});

import { describe, it } from 'vitest';

describe('Walkthrough', () => {
  describe('shared steps', () => {
    it.todo('WT-01: renders shared steps for specialist role (8 shared + 2 specialist = 10 total)');
    it.todo('WT-01: first step shows Welcome to TPC Catalog title');
    it.todo('WT-01: last shared step shows Export to Chrome Extension');
  });

  describe('admin steps', () => {
    it.todo('WT-02: admin sees 11 steps (8 shared + 3 admin)');
    it.todo('WT-02: admin steps include Manage Accounts, Assign Sessions, Review & Export');
    it.todo('WT-02: admin role section label shows ADMIN FEATURES');
  });

  describe('specialist steps', () => {
    it.todo('WT-03: specialist sees 10 steps (8 shared + 2 specialist)');
    it.todo('WT-03: specialist steps include Submit Your Work and Review Notes');
    it.todo('WT-03: specialist role section label shows YOUR WORKFLOW');
  });

  describe('gate', () => {
    it.todo('WT-06: Sessions page shows walkthrough when walkthroughCompleted is false');
    it.todo('WT-06: Sessions page does NOT show walkthrough when walkthroughCompleted is true');
    it.todo('WT-06: Sessions page does NOT read hasCompletedWalkthrough from uiStore');
  });

  describe('back navigation', () => {
    it.todo('WT-07: Back button is hidden on first step');
    it.todo('WT-07: Back button appears from step 2 onward');
    it.todo('WT-07: Back button returns to previous step');
  });

  describe('completion', () => {
    it.todo('WT-08: final step shows Start Cataloging button');
    it.todo('WT-08: clicking Start Cataloging calls onComplete/completeWalkthrough');
    it.todo('WT-08: Skip tutorial link calls onComplete/completeWalkthrough');
  });
});

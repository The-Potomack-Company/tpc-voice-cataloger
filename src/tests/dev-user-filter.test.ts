/**
 * Tests the cross-user dev-data filter that hides Josh's sessions from
 * other admin viewers (option C from Phase 31 ChatGPT discussion).
 */
import { describe, it, expect } from "vitest";
import {
  DEV_USER_IDS,
  JOSH_USER_ID,
  isDevUser,
  filterDevSessions,
} from "../constants/devUsers";

interface S {
  id: string;
  created_by?: string | null;
  assigned_to?: string | null;
}

describe("devUsers constants", () => {
  it("JOSH_USER_ID is the canonical Supabase profile UUID", () => {
    expect(JOSH_USER_ID).toBe("a70ae46e-5d51-47cb-9dff-a6a8a7a08bfd");
  });
  it("DEV_USER_IDS includes Josh and is a one-place edit", () => {
    expect(DEV_USER_IDS).toContain(JOSH_USER_ID);
  });
  it("isDevUser identifies Josh and rejects unknowns", () => {
    expect(isDevUser(JOSH_USER_ID)).toBe(true);
    expect(isDevUser("other-uuid")).toBe(false);
    expect(isDevUser(null)).toBe(false);
    expect(isDevUser(undefined)).toBe(false);
  });
});

describe("filterDevSessions", () => {
  const sessions: S[] = [
    { id: "joshs", created_by: JOSH_USER_ID, assigned_to: JOSH_USER_ID },
    { id: "jeffs-own", created_by: "jeff", assigned_to: "jeff" },
    { id: "alices", created_by: "alice", assigned_to: "alice" },
    { id: "jeffs-assigned-to-josh", created_by: "jeff", assigned_to: JOSH_USER_ID },
    { id: "joshs-assigned-to-alice", created_by: JOSH_USER_ID, assigned_to: "alice" },
  ];

  it("hides josh's own sessions from another admin (Jeff)", () => {
    const filtered = filterDevSessions(sessions, "jeff");
    const ids = filtered.map((s) => s.id);
    expect(ids).toContain("jeffs-own");
    expect(ids).toContain("alices");
    expect(ids).not.toContain("joshs");
    // Sessions assigned to Josh (cross-user) are also filtered.
    expect(ids).not.toContain("jeffs-assigned-to-josh");
    expect(ids).not.toContain("joshs-assigned-to-alice");
  });

  it("does NOT filter Josh's own sessions when Josh is the viewer", () => {
    const filtered = filterDevSessions(sessions, JOSH_USER_ID);
    const ids = filtered.map((s) => s.id);
    expect(ids).toContain("joshs");
    expect(ids).toContain("joshs-assigned-to-alice");
    expect(ids).toContain("jeffs-assigned-to-josh");
  });

  it("does not crash when viewerId is null (pre-auth)", () => {
    const filtered = filterDevSessions(sessions, null);
    // No viewer → still hide dev-owned/assigned sessions.
    const ids = filtered.map((s) => s.id);
    expect(ids).not.toContain("joshs");
  });
});

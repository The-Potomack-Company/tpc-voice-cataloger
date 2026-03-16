---
phase: quick
plan: 1
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
must_haves:
  truths:
    - "Private repo The-Potomack-Company/tpc-app exists on GitHub"
    - "All code from local master is pushed to remote main branch"
    - "Remote origin is configured in local git"
  artifacts: []
  key_links:
    - from: "local master branch"
      to: "remote main branch"
      via: "git push origin master:main"
      pattern: "origin.*The-Potomack-Company/tpc-app"
---

<objective>
Create a private GitHub repo `tpc-app` under The-Potomack-Company org and push all local code to its `main` branch.

Purpose: Get the TPC App codebase into the org's GitHub for collaboration and deployment.
Output: Remote repo with all commits on `main`.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
Current state: Local repo on `master` branch with no remotes configured. GitHub CLI authenticated as `jushyi` with access to `The-Potomack-Company` org. Repo `The-Potomack-Company/tpc-app` does not yet exist.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create private repo and push to main</name>
  <files></files>
  <action>
1. Create the private repo under the org using gh CLI:
   `gh repo create The-Potomack-Company/tpc-app --private --source=. --remote=origin`
   This creates the repo AND adds the origin remote in one step.

2. Push all local commits to the remote main branch:
   `git push -u origin master:main`
   This pushes local master to remote main (the default branch name on GitHub).

3. Verify the remote is set and the push succeeded:
   `gh repo view The-Potomack-Company/tpc-app --json name,visibility,defaultBranchRef`
  </action>
  <verify>
    <automated>gh repo view The-Potomack-Company/tpc-app --json name,visibility,defaultBranchRef --jq '.visibility + " " + .defaultBranchRef.name'</automated>
  </verify>
  <done>Output shows "PRIVATE main" confirming the repo exists as private with main as default branch and all commits pushed.</done>
</task>

</tasks>

<verification>
- `git remote -v` shows origin pointing to The-Potomack-Company/tpc-app
- `gh repo view The-Potomack-Company/tpc-app` shows private repo with commits
</verification>

<success_criteria>
- Private repo The-Potomack-Company/tpc-app exists on GitHub
- All local commits are on the remote main branch
- Local repo has origin remote configured
</success_criteria>

<output>
After completion, create `.planning/quick/1-push-everything-to-main-branch-of-new-tp/1-SUMMARY.md`
</output>

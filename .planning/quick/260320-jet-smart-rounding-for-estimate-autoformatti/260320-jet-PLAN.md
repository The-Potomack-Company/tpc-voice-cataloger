---
phase: quick
plan: 260320-jet
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/utils/formatEstimate.ts
  - src/tests/formatEstimate.test.ts
autonomous: true
requirements: [smart-rounding]
must_haves:
  truths:
    - "Single-number estimates round to magnitude-appropriate units (10s, 100s, 1000s, etc.)"
    - "Multi-number inputs pass through without rounding (unchanged behavior)"
    - "The +/-20% spread calculation is unchanged"
  artifacts:
    - path: "src/utils/formatEstimate.ts"
      provides: "Smart rounding using log10-based roundUnit"
      contains: "Math.log10"
    - path: "src/tests/formatEstimate.test.ts"
      provides: "Tests covering all magnitude tiers"
  key_links: []
---

<objective>
Replace the fixed round-to-100 logic in formatEstimate with a magnitude-aware formula:
`roundUnit = 10 ** Math.floor(Math.log10(value))` so estimates look clean at any scale.

Purpose: A $50 item shouldn't produce "0 - 100" ranges, and a $8000 item should round to thousands, not hundreds.
Output: Updated formatEstimate.ts with smart rounding + updated tests.
</objective>

<execution_context>
@C:/Users/maser/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/maser/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/utils/formatEstimate.ts
@src/tests/formatEstimate.test.ts

<interfaces>
From src/utils/formatEstimate.ts:
```typescript
export function formatEstimate(raw: string | null): string | null;
```
Signature stays the same. Only the internal single-number rounding logic changes.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Update tests for magnitude-aware rounding, then implement</name>
  <files>src/tests/formatEstimate.test.ts, src/utils/formatEstimate.ts</files>
  <behavior>
    - Single number 5: roundUnit=1, low=4, high=6 -> "4 - 6"
    - Single number 50: roundUnit=10, low=40, high=60 -> "40 - 60" (unchanged)
    - Single number 500: roundUnit=100, low=400, high=600 -> "400 - 600" (unchanged)
    - Single number 750: roundUnit=100, 750*0.8=600, 750*1.2=900 -> "600 - 900" (unchanged)
    - Single number 1200: roundUnit=1000, 1200*0.8=960->1000, 1200*1.2=1440->1000 wait... 1440/1000=1.44 rounds to 1000. That's wrong. Let me recalc: Math.round(960/1000)*1000=1000, Math.round(1440/1000)*1000=1000. Hmm, that collapses. Need to verify.
    - Actually: 1200*0.8=960, Math.round(960/1000)*1000 = Math.round(0.96)*1000 = 1000. 1200*1.2=1440, Math.round(1440/1000)*1000 = Math.round(1.44)*1000 = 1000. This gives "1000 - 1000" which is bad.
    - Better approach: use Math.floor for low and Math.ceil for high to avoid collapsing.
    - With floor/ceil: 1200 -> low=Math.floor(960/1000)*1000=0, high=Math.ceil(1440/1000)*1000=2000. That gives "0 - 2000" which is also bad.
    - The issue is that +/-20% on 1200 doesn't span two 1000-boundaries well. Using Math.round is actually fine for most cases. Let me re-examine: the CURRENT test expects "1000 - 1400" for 1200 (rounding to 100). With roundUnit=1000 it would be "1000 - 1000". So we need a different approach for values near the bottom of a tier.
    - Better formula: use roundUnit = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1) -- round to one order of magnitude BELOW the value's magnitude. This gives: value=1200 -> log10=3.08 -> floor=3 -> 3-1=2 -> roundUnit=100. Same as current! value=500 -> log10=2.7 -> floor=2 -> 2-1=1 -> roundUnit=10. Hmm, 500 -> low=400, high=600, rounded to 10s -> "400 - 600" (same). value=50 -> log10=1.7 -> floor=1 -> 1-1=0 -> roundUnit=1. 50 -> "40 - 60" (same). value=5 -> log10=0.7 -> floor=0 -> max(0,-1)=0 -> roundUnit=1. "4 - 6". value=8000 -> log10=3.9 -> floor=3 -> 3-1=2 -> roundUnit=100. Hmm user wants 8000 to round to 1000s ("7000 - 9000").
    - Re-reading user decision: "round to nearest 10^(floor(log10(value)))" and example shows 8000 -> 7000-9000. So roundUnit for 8000 = 10^floor(log10(8000)) = 10^floor(3.9) = 10^3 = 1000. That works for 8000. But 1200: roundUnit = 10^floor(log10(1200)) = 10^floor(3.08) = 10^3 = 1000. Gives "1000 - 1000" collapse. The existing test "1200 -> 1000 - 1400" must be updated.
    - With the user's formula for 1200: low=Math.round(960/1000)*1000=1000, high=Math.round(1440/1000)*1000=1000. Collapsed.
    - Solution: use Math.floor for low and Math.ceil for high. 1200: low=Math.floor(960/1000)*1000=0, nope. Math.floor(0.96)=0. That's 0.
    - Better: just do normal rounding but the range is what it is. 1200 rounds to 1000-1000... that's not useful. The user's examples only show values like 50, 900, 8000 (round numbers). For 1200 specifically, the +/-20% spread (960-1440) at roundUnit=1000 naturally collapses. This is a design tension.
    - Pragmatic fix: if low === high after rounding, step down one magnitude. Or: use roundUnit = 10 ** Math.max(0, Math.floor(Math.log10(value * 0.2))) which adapts to the spread size rather than the value.
    - Simplest: just update the test expectation for 1200 to match the new rounding ("1000 - 1000" is ugly). Actually the user's decision is clear about the formula. Let me use floor for low / ceil for high: 1200 -> low=floor(960/1000)*1000=0. Nah.
    - Actually Math.round(960/1000) = Math.round(0.96) = 1, so it IS 1000. Math.round(1440/1000) = Math.round(1.44) = 1, so 1000. Collapsed.
    - Best practical approach: if rounding collapses (low===high), subtract and add one roundUnit. 1200 -> 1000-1000 -> collapsed -> 0-2000? No. Or just use roundUnit/2 step for the spread. Or: the simplest fix is to guarantee low != high by using floor for low and ceil for high with the SPREAD values. 960/1000 = 0.96 -> floor = 0 -> 0. That's bad.
    - OK let me think differently. For 1200 with roundUnit=1000: the value itself rounds to 1000. The spread should be 1000 +/- 1000? No. Maybe the right answer IS "1000 - 2000" using floor/ceil on the spread values. floor(0.96)*1000=0 is wrong because 960 IS close to 1000.
    - Correction: Math.floor(960/1000) should be 0 since 960/1000 = 0.96 and floor(0.96) = 0. That gives 0 for low. Not good.
    - I think the right approach is: keep Math.round, but if low===high, fall back to subtracting/adding one roundUnit from the rounded value. So 1200 -> rounds to 1000,1000 -> collapsed -> 1000-roundUnit=0, 1000+roundUnit=2000 -> "0 - 2000". Still ugly.
    - Alternative: if collapsed, use roundUnit/2 for rounding instead. Or simply: if the +/-20% spread is less than 1 roundUnit, step down one level.
    - CLEANEST SOLUTION: roundUnit = 10 ** Math.floor(Math.log10(value * 0.4)). For 1200: value*0.4=480, log10(480)=2.68, floor=2, roundUnit=100. For 8000: 8000*0.4=3200, log10=3.5, floor=3, roundUnit=1000. For 500: 500*0.4=200, log10=2.3, floor=2, roundUnit=100. For 50: 50*0.4=20, log10=1.3, floor=1, roundUnit=10. This ensures the spread (40% of value) always spans at least one roundUnit. Let me verify: 1200 -> roundUnit=100 -> low=Math.round(960/100)*100=1000, high=Math.round(1440/100)*100=1400 -> "1000 - 1400". Same as current test! 8000 -> roundUnit=1000 -> low=Math.round(6400/1000)*1000=6000, high=Math.round(9600/1000)*1000=10000 -> "6000 - 10000". Hmm user wants "7000 - 9000" for 8000. That doesn't match either.
    - User example: "8000 -> 7000 - 9000". With their formula roundUnit=1000: 8000*0.8=6400, 8000*1.2=9600. Math.round(6400/1000)*1000=6000, Math.round(9600/1000)*1000=10000. So "6000 - 10000", not "7000 - 9000". The user's example of "7000 - 9000" uses +/-~12.5% not +/-20%.
    - Wait, re-reading: user says "8000 -> 7000 - 9000" as an example of the RANGE column showing what "round to nearest 1000" means (like the range of possible rounded outputs for nearby values), NOT the output of formatEstimate(8000). The parenthetical is about the rounding resolution, not the +/-20% spread.
    - So: formatEstimate("8000") with roundUnit=1000 would give: low=6400->6000, high=9600->10000 -> "6000 - 10000". But that's a wider spread than "6400 - 9600". The user probably expects this is fine since it's rounded nicely.
    - And for 1200 with roundUnit=1000: "1000 - 1000" collapse. That's the real problem.
    - I'll go with the pragmatic approach: use the user's formula but add a collapse guard. If low === high, divide roundUnit by 10. This handles edge cases while following the user's intent for normal cases.
    - Let me verify all cases with this approach:
      - 5: roundUnit=1, low=4, high=6 -> "4 - 6"
      - 50: roundUnit=10, low=40, high=60 -> "40 - 60"
      - 500: roundUnit=100, low=400, high=600 -> "400 - 600"
      - 750: roundUnit=100, low=600, high=900 -> "600 - 900"
      - 1200: roundUnit=1000, low=1000, high=1000 -> COLLAPSED -> roundUnit=100 -> low=1000, high=1400 -> "1000 - 1400"
      - 8000: roundUnit=1000, low=6000, high=10000 -> "6000 - 10000"
      - 50000: roundUnit=10000, low=40000, high=60000 -> "40000 - 60000"
    - This works! Existing tests mostly hold too. Only 8000+ scale changes.
  </behavior>
  <action>
RED phase: Update tests in formatEstimate.test.ts:
1. Update existing test for "50" -- currently expects "40 - 60", with roundUnit=10 from log10: Math.round(40/10)*10=40, Math.round(60/10)*10=60. Same! Keep test.
2. Keep test for "500" -> "400 - 600" (roundUnit=100, same result).
3. Keep test for "750" -> "600 - 900" (roundUnit=100, same result).
4. Keep test for "1200" -> "1000 - 1400" (roundUnit=1000 collapses, falls back to 100, same result).
5. Add new test: "5" -> "4 - 6" (roundUnit=1, no rounding needed).
6. Add new test: "8000" -> "6000 - 10000" (roundUnit=1000, proper thousands rounding).
7. Add new test: "50000" -> "40000 - 60000" (roundUnit=10000).
8. Add new test: "15" -> "10 - 20" (roundUnit=10, rounds to nearest 10; 15*0.8=12->10, 15*1.2=18->20).
9. Keep all multi-number and passthrough tests unchanged.

GREEN phase: Update the single-number branch in formatEstimate.ts:
Replace the `if (value >= 100)` block with:
```typescript
if (value >= 10) {
  let roundUnit = 10 ** Math.floor(Math.log10(value));
  low = Math.round(low / roundUnit) * roundUnit;
  high = Math.round(high / roundUnit) * roundUnit;
  // Collapse guard: if rounding made low === high, step down one magnitude
  if (low === high && roundUnit >= 10) {
    roundUnit = roundUnit / 10;
    low = Math.round((value * 0.8) / roundUnit) * roundUnit;
    high = Math.round((value * 1.2) / roundUnit) * roundUnit;
  }
}
```
Values below 10 get no rounding (roundUnit would be 1, which is identity).

Update the JSDoc comment to mention magnitude-aware rounding.

REFACTOR: Clean up if needed. Run tests to confirm all pass.
  </action>
  <verify>
    <automated>npx vitest run src/tests/formatEstimate.test.ts</automated>
  </verify>
  <done>All formatEstimate tests pass. Single-number estimates round to magnitude-appropriate units. Multi-number inputs unchanged. No regressions.</done>
</task>

</tasks>

<verification>
npx vitest run src/tests/formatEstimate.test.ts -- all tests pass including new magnitude tiers
</verification>

<success_criteria>
- formatEstimate("5") returns "4 - 6" (no rounding for single digits)
- formatEstimate("50") returns "40 - 60" (rounds to 10s)
- formatEstimate("500") returns "400 - 600" (rounds to 100s)
- formatEstimate("8000") returns "6000 - 10000" (rounds to 1000s)
- formatEstimate("50000") returns "40000 - 60000" (rounds to 10000s)
- formatEstimate("1200") returns "1000 - 1400" (collapse guard activates, rounds to 100s)
- All existing multi-number and passthrough tests still pass
</success_criteria>

<output>
After completion, create `.planning/quick/260320-jet-smart-rounding-for-estimate-autoformatti/260320-jet-SUMMARY.md`
</output>

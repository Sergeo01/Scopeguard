import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

test("dashboard: 6-tab navigation structure, URL sync, and safe display invariants", () => {
  const dashPath = path.resolve(__dirname, "../app/dashboard/page.tsx");
  const content = fs.readFileSync(dashPath, "utf8");

  // 1. All 6 tabs defined in TABS
  const requiredTabs = ["overview", "policy", "approvals", "activity", "emergency", "alerts"];
  requiredTabs.forEach((tab) => {
    assert.ok(
      content.includes(`id: "${tab}" as const`),
      `TABS must contain tab id: ${tab}`
    );
  });

  // 2. URL parameter sync for ?tab=
  assert.ok(
    content.includes('const qTab = sp.get("tab");'),
    "Dashboard must parse ?tab= query parameter"
  );
  assert.ok(
    content.includes('sp.set("tab", tab);'),
    "Dashboard must update ?tab= query parameter on tab switch"
  );

  // 3. Approvals empty state
  assert.ok(
    content.includes("Nothing waiting. High-value actions will appear here for your decision."),
    "Approvals tab must show exact empty state when queue is empty"
  );

  // 4. Rule 2 live status pill (ACTIVE (UNPAUSED) vs PAUSED (TRIPPED))
  assert.ok(
    content.includes('code: isPaused ? "PAUSED (TRIPPED)" : "ACTIVE (UNPAUSED)"'),
    "Rule 2 must show live status pill (Active/Unpaused, not hardcoded PAUSED)"
  );

  // 5. Rule 7 & 10 config line wrapping (break-words, no mid-word truncation)
  assert.ok(
    content.includes("break-words text-left sm:text-right sm:max-w-[75%]"),
    "Rule configs must use break-words to prevent mid-word truncation"
  );

  // 6. Dynamic gas fuel passed to BudgetVelocityGauge
  assert.ok(
    content.includes("gasBudgetNearRemaining={gasAllowanceNear}"),
    "BudgetVelocityGauge must receive dynamic gasAllowanceNear"
  );

  // 7. No dollar signs on mUSD amounts in Approvals and Activity ledger
  assert.ok(
    content.includes("{item.amount} mUSD"),
    "Pending approvals amount must be formatted as '{item.amount} mUSD' without dollar sign"
  );
  assert.ok(
    content.includes("Threshold: {policy?.high_value_threshold || 250} mUSD"),
    "Quarantine threshold must be formatted without dollar sign"
  );
  assert.ok(
    content.includes("{act.amount} mUSD"),
    "Activity ledger amount must be formatted as '{act.amount} mUSD' without dollar sign"
  );

  // 8. Global banners stay mounted above the tabs
  const bannerPos = content.indexOf("<CircuitBreakerBanner");
  const tabBarPos = content.indexOf("{/* 6-Tab Navigation Bar */}");
  assert.ok(bannerPos !== -1 && tabBarPos !== -1 && bannerPos < tabBarPos, "CircuitBreakerBanner must be above tab bar");
});

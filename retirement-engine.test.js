/* Minimal browser/Node-compatible validation for retirement-engine.js */

(function () {
  "use strict";

  const engine = globalThis.RetirementEngine;
  if (!engine) throw new Error("Load retirement-engine.js before retirement-engine.test.js");

  function close(actual, expected, tolerance = 0.01) {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`Expected ${expected}, received ${actual}`);
    }
  }

  close(engine.verifiedOpeningData.accounts[0].openingBalance, 43385.58);
  close(engine.annualizeMonthly(5500), 66000);
  close(engine.compound(100, 0.07, 1), 107);

  const capped = engine.applyAffordabilityCap({ 2026: 10000, 2027: 20000 }, 15000);
  close(capped[2026], 10000);
  close(capped[2027], 15000);

  const projected = engine.projectAccount({
    openingBalance: 100,
    annualContributions: { 2026: 10, 2027: 10 },
    annualRate: 0.10,
    startYear: 2026,
    endYear: 2027
  });
  close(projected.endingBalance, 142);

  const income = engine.buildGuaranteedIncomeByYear({
    startYear: 2041,
    endYear: 2043,
    pension: { startYear: 2041, monthlyBenefit: 5500, cola: 0 },
    socialSecurity: [
      { startYear: 2043, monthlyBenefit: 2500, cola: 0 },
      { startYear: 2043, monthlyBenefit: 1500, cola: 0 }
    ]
  });
  close(income[0].guaranteedIncomeAnnual, 66000);
  close(income[2].guaranteedIncomeAnnual, 114000);

  console.log("Retirement engine Phase 1 tests passed.");
})();

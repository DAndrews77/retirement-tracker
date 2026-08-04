/* Retirement Tracker — deterministic household engine (Phase 1)
 * Pure functions only. UI integration follows after validation.
 */

(function (root) {
  "use strict";

  const DEFAULT_RETURN_SCENARIOS = [0.05, 0.07, 0.09, 0.12];

  function assertFiniteNumber(value, name) {
    if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
  }

  function annualizeMonthly(monthly) {
    assertFiniteNumber(monthly, "monthly");
    return monthly * 12;
  }

  function compound(balance, annualRate, years) {
    assertFiniteNumber(balance, "balance");
    assertFiniteNumber(annualRate, "annualRate");
    assertFiniteNumber(years, "years");
    return balance * Math.pow(1 + annualRate, years);
  }

  function projectAccount({ openingBalance, annualContributions, annualRate, startYear, endYear }) {
    assertFiniteNumber(openingBalance, "openingBalance");
    assertFiniteNumber(annualRate, "annualRate");
    if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
      throw new RangeError("Invalid projection year range");
    }

    let balance = openingBalance;
    const rows = [];

    for (let year = startYear; year <= endYear; year += 1) {
      const contribution = Math.max(0, Number(annualContributions?.[year] || 0));
      balance = balance * (1 + annualRate) + contribution;
      rows.push({ year, contribution, endingBalance: balance });
    }

    return { endingBalance: balance, rows };
  }

  function applyAffordabilityCap(schedule, annualCap) {
    if (annualCap == null) return { ...schedule };
    assertFiniteNumber(annualCap, "annualCap");
    const capped = {};
    Object.keys(schedule || {}).forEach((year) => {
      capped[year] = Math.min(Math.max(0, Number(schedule[year] || 0)), annualCap);
    });
    return capped;
  }

  function buildGuaranteedIncomeByYear({ startYear, endYear, pension, socialSecurity }) {
    const rows = [];
    for (let year = startYear; year <= endYear; year += 1) {
      const pensionAnnual = pension && year >= pension.startYear
        ? annualizeMonthly(pension.monthlyBenefit) * Math.pow(1 + (pension.cola || 0), year - pension.startYear)
        : 0;
      const ssAnnual = (socialSecurity || []).reduce((sum, benefit) => {
        if (year < benefit.startYear) return sum;
        return sum + annualizeMonthly(benefit.monthlyBenefit) * Math.pow(1 + (benefit.cola || 0), year - benefit.startYear);
      }, 0);
      rows.push({ year, pensionAnnual, socialSecurityAnnual: ssAnnual, guaranteedIncomeAnnual: pensionAnnual + ssAnnual });
    }
    return rows;
  }

  function runHouseholdScenarios(config) {
    const rates = config.returnScenarios || DEFAULT_RETURN_SCENARIOS;
    const accounts = config.accounts || [];
    const results = {};

    rates.forEach((rate) => {
      const accountResults = accounts.map((account) => {
        const contributions = applyAffordabilityCap(account.annualContributions || {}, account.annualContributionCap);
        const projection = projectAccount({
          openingBalance: account.openingBalance || 0,
          annualContributions: contributions,
          annualRate: rate,
          startYear: config.startYear,
          endYear: config.endYear
        });
        return { id: account.id, name: account.name, taxType: account.taxType, ...projection };
      });
      results[rate] = {
        annualRate: rate,
        accounts: accountResults,
        householdEndingBalance: accountResults.reduce((sum, account) => sum + account.endingBalance, 0)
      };
    });

    return results;
  }

  const verifiedOpeningData = Object.freeze({
    valuationDate: "2026-07-24",
    accounts: [{
      id: "primary-401a",
      name: "Primary 401(a)",
      taxType: "pre-tax",
      openingBalance: 40000,
      holding: "SAMPLE_INDEX",
      units: 100,
      nav: 400
    }]
  });

  root.RetirementEngine = Object.freeze({
    DEFAULT_RETURN_SCENARIOS,
    annualizeMonthly,
    compound,
    projectAccount,
    applyAffordabilityCap,
    buildGuaranteedIncomeByYear,
    runHouseholdScenarios,
    verifiedOpeningData
  });
})(typeof window !== "undefined" ? window : globalThis);

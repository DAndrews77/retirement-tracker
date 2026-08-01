export const DEFAULT_RETURN_SCENARIOS = [0.05, 0.07, 0.09, 0.12];

const MONTHS_IN_YEAR = 12;

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be a finite number.`);
}

function monthlyRate(annualRate) {
  return Math.pow(1 + annualRate, 1 / MONTHS_IN_YEAR) - 1;
}

function ageAtYear(startAge, startYear, year) {
  return startAge + (year - startYear);
}

function contributionForYear(account, year, age, profile) {
  const rule = account.contributionRule || { type: 'annual', amount: 0 };
  let annual = 0;

  switch (rule.type) {
    case 'annual':
      annual = rule.amount || 0;
      break;
    case 'monthly':
      annual = (rule.amount || 0) * MONTHS_IN_YEAR;
      break;
    case 'hourly':
      annual = (rule.amount || 0) * (rule.hoursPerYear || profile.hoursPerYear || 0);
      break;
    case 'schedule': {
      const entry = (rule.schedule || []).find(item => item.year === year);
      annual = entry ? entry.amount : 0;
      break;
    }
    default:
      throw new Error(`Unsupported contribution rule: ${rule.type}`);
  }

  if (rule.annualIncrease) {
    annual += Math.max(0, year - profile.startYear) * rule.annualIncrease;
  }

  if (rule.limitByYear && Number.isFinite(rule.limitByYear[year])) {
    annual = Math.min(annual, rule.limitByYear[year]);
  }

  if (Number.isFinite(rule.catchUpAge) && age >= rule.catchUpAge) {
    annual += rule.catchUpAmount || 0;
  }

  return Math.max(0, annual);
}

function employerContributionForYear(account, year, profile) {
  const employer = account.employerContribution;
  if (!employer) return 0;

  switch (employer.type) {
    case 'annual':
      return Math.max(0, employer.amount || 0);
    case 'hourly':
      return Math.max(0, (employer.amount || 0) * (employer.hoursPerYear || profile.hoursPerYear || 0));
    case 'percentOfEmployeeContribution':
      return 0;
    case 'schedule': {
      const entry = (employer.schedule || []).find(item => item.year === year);
      return entry ? Math.max(0, entry.amount || 0) : 0;
    }
    default:
      throw new Error(`Unsupported employer contribution type: ${employer.type}`);
  }
}

function applyAffordabilityCap(requestedContributions, cap) {
  if (!Number.isFinite(cap) || cap < 0) return requestedContributions;

  let remaining = cap;
  return requestedContributions.map(item => {
    if (!item.afterTax) return item;
    const funded = Math.min(item.employeeContribution, remaining);
    remaining -= funded;
    return { ...item, employeeContribution: funded, unfunded: item.employeeContribution - funded };
  });
}

export function projectRetirement(profile, annualReturn) {
  assertFiniteNumber(annualReturn, 'annualReturn');
  if (annualReturn <= -1) throw new Error('annualReturn must be greater than -100%.');
  if (!profile || !Array.isArray(profile.accounts)) throw new Error('profile.accounts is required.');

  const startYear = profile.startYear;
  const endYear = profile.endYear;
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear) {
    throw new Error('Profile startYear/endYear are invalid.');
  }

  const balances = Object.fromEntries(profile.accounts.map(account => [account.id, account.openingBalance || 0]));
  const monthlyGrowth = monthlyRate(annualReturn);
  const yearly = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const age = ageAtYear(profile.startAge, startYear, year);
    const retired = age >= profile.retirementAge;

    const requested = profile.accounts.map(account => ({
      account,
      afterTax: account.taxTreatment === 'roth' || account.taxTreatment === 'taxable',
      employeeContribution: retired ? 0 : contributionForYear(account, year, age, profile),
      employerContribution: retired ? 0 : employerContributionForYear(account, year, profile),
    }));

    const funded = applyAffordabilityCap(requested, profile.maxAnnualAfterTaxSavings);

    const accountRows = [];
    for (const item of funded) {
      const { account } = item;
      let balance = balances[account.id] || 0;
      const employeeMonthly = item.employeeContribution / MONTHS_IN_YEAR;
      const employerMonthly = item.employerContribution / MONTHS_IN_YEAR;

      for (let month = 0; month < MONTHS_IN_YEAR; month += 1) {
        balance += employeeMonthly + employerMonthly;
        balance *= 1 + monthlyGrowth;
      }

      balances[account.id] = balance;
      accountRows.push({
        id: account.id,
        name: account.name,
        owner: account.owner,
        taxTreatment: account.taxTreatment,
        employeeContribution: item.employeeContribution,
        employerContribution: item.employerContribution,
        unfundedContribution: item.unfunded || 0,
        endingBalance: balance,
      });
    }

    const pensionAnnual = age >= profile.pension.startAge ? (profile.pension.monthlyBenefit || 0) * MONTHS_IN_YEAR : 0;
    const socialSecurityAnnual = (profile.socialSecurity || []).reduce((sum, benefit) => {
      return sum + (age >= benefit.startAge ? (benefit.monthlyBenefit || 0) * MONTHS_IN_YEAR : 0);
    }, 0);

    yearly.push({
      year,
      age,
      retired,
      accounts: accountRows,
      totalBalance: Object.values(balances).reduce((sum, value) => sum + value, 0),
      pensionAnnual,
      socialSecurityAnnual,
      guaranteedIncomeAnnual: pensionAnnual + socialSecurityAnnual,
      desiredSpendingAnnual: (profile.desiredMonthlyRetirementSpending || 0) * MONTHS_IN_YEAR,
    });
  }

  const retirementRow = yearly.find(row => row.age >= profile.retirementAge) || yearly.at(-1);
  const finalRow = yearly.at(-1);

  return {
    annualReturn,
    retirementYear: retirementRow.year,
    retirementAge: retirementRow.age,
    balanceAtRetirement: retirementRow.totalBalance,
    finalBalance: finalRow.totalBalance,
    guaranteedIncomeAtRetirement: retirementRow.guaranteedIncomeAnnual,
    fundingGapAtRetirement: Math.max(0, retirementRow.desiredSpendingAnnual - retirementRow.guaranteedIncomeAnnual),
    yearly,
  };
}

export function runScenarioSet(profile, scenarios = DEFAULT_RETURN_SCENARIOS) {
  return scenarios.map(rate => projectRetirement(profile, rate));
}

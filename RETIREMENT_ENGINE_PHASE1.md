# Retirement Engine Phase 1

Sample opening data (see `src/andrew-profile.js` for the placeholder profile
used by the test dashboard — real personal figures are kept local, not
committed to this public repo):
- 401(a) balance: $40,000 (sample)
- Valuation date: 2026-07-24
- Holding: sample broad-market index fund

Phase 1 scope:
- Account-level deterministic projection engine
- Existing balance support
- Annual contribution schedule
- Pension and Social Security inputs
- 5%, 7%, 9%, and 12% return scenarios
- Savings affordability cap
- Annual account balances and retirement-income outputs
- Calculation tests before Monte Carlo work

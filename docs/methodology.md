# Metric definitions

Every number the assistant reports comes from these rules, computed in
`budgets/services/` on `Decimal` values. The model is not permitted to do
arithmetic.

## Variance

```
variance         = actual − budget            (positive = over budget)
variance_percent = variance / budget          (undefined if budget = 0)
```

The API keeps the `actual − budget` sign convention, where positive means
overspend. The UI flips it to the finance convention — overspend shows as a
negative, red number — in `frontend/lib/format.ts`.

## Severity

Severity applies to over-budget line items and is measured as that item's
variance *as a share of the scenario's total budget*, not of its own budget. A
$5,000 overrun means something different in a $50,000 scenario than in a
$5,000,000 one.

```
high   ≥ 10 %
medium ≥  5 %
low    >  0 %
```

Two guards cover division by zero:

- an item with `budget = 0` and `actual > 0` is **high**;
- if the scenario's total budget is 0 and the variance is positive, **high**.

## Scenario health

Health is computed from the scenario totals rather than from any single row,
using `(actual − budget) / budget`:

```
over_budget   more than 10 % over
watch         0–10 % over
on_track      at or under budget
```

## Keeping explanations honest

`services/methodology.py` renders its prose from the same threshold constants
the calculations use. The `explain_metrics` tool reads that output, so what the
assistant says a metric means cannot drift from what the code computes.

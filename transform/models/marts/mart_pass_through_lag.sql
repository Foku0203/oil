-- How quickly do Bangkok pump prices follow world crude?
-- For each fuel and lag L (days), correlate the 7-day change in retail price at day t with the
-- 7-day change in Brent (THB/litre) at day t - L. The lag with the strongest correlation is the
-- typical reaction delay; pass_through_ratio is THB of retail move per 1 THB move in crude cost.
-- Overlapping 7-day windows make the sample autocorrelated, so treat this as indicative, not causal.

with base as (
    select
        price_date,
        fuel_code,
        retail_thb_per_litre - lag(retail_thb_per_litre, 7) over w as retail_chg_7d,
        brent_thb_per_litre  - lag(brent_thb_per_litre, 7)  over w as brent_chg_7d
    from {{ ref('mart_fuel_vs_crude_daily') }}
    window w as (partition by fuel_code order by price_date)
),

lags as (
    select generate_series(0, 42) as lag_days
),

pairs as (
    select
        r.fuel_code,
        l.lag_days,
        r.retail_chg_7d,
        c.brent_chg_7d
    from base r
    cross join lags l
    join base c
        on c.fuel_code = r.fuel_code
       and c.price_date = r.price_date - l.lag_days
    where r.retail_chg_7d is not null
      and c.brent_chg_7d is not null
),

stats as (
    select
        fuel_code,
        lag_days,
        count(*)                                            as n_obs,
        corr(retail_chg_7d, brent_chg_7d)::numeric(6, 4)    as correlation,
        regr_slope(retail_chg_7d, brent_chg_7d)::numeric(8, 4) as pass_through_ratio
    from pairs
    group by fuel_code, lag_days
    -- Need about a year of history for a meaningful estimate.
    having count(*) >= 365
)

select
    s.*,
    s.correlation = max(s.correlation) over (partition by s.fuel_code) as is_best_lag
from stats s

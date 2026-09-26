-- THB value of one unit of each currency, for every calendar day (weekends/holidays carried forward).

with rates as (
    select * from {{ ref('stg_frankfurter__fx_rates') }}
),

usd_thb as (
    select rate_date, units_per_usd as thb_per_usd
    from rates
    where currency = 'THB'
),

crosses as (
    select u.rate_date, 'USD' as currency, u.thb_per_usd as thb_per_unit
    from usd_thb u

    union all

    select r.rate_date, r.currency, u.thb_per_usd / r.units_per_usd
    from rates r
    join usd_thb u using (rate_date)
    where r.currency <> 'THB'
),

spine as (
    select c.currency, gs::date as rate_date
    from (select currency, min(rate_date) as first_date from crosses group by currency) c,
         generate_series(c.first_date, {{ bkk_today() }}, interval '1 day') as gs
),

grouped as (
    select
        sp.currency,
        sp.rate_date,
        c.thb_per_unit,
        count(c.thb_per_unit) over (partition by sp.currency order by sp.rate_date) as fill_group
    from spine sp
    left join crosses c using (currency, rate_date)
)

select
    rate_date,
    currency,
    max(thb_per_unit) over (partition by currency, fill_group)::numeric(18, 6) as thb_per_unit,
    thb_per_unit is not null                                                  as is_published
from grouped

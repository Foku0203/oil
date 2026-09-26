-- Crude benchmarks per calendar day (last settlement carried over non-trading days), converted to THB.

with crude as (
    select * from {{ ref('stg_yahoo__crude_prices') }}
),

spine as (
    select c.benchmark, gs::date as price_date
    from (select benchmark, min(price_date) as first_date from crude group by benchmark) c,
         generate_series(c.first_date, {{ bkk_today() }}, interval '1 day') as gs
),

grouped as (
    select
        sp.benchmark,
        sp.price_date,
        c.close_usd,
        count(c.close_usd) over (partition by sp.benchmark order by sp.price_date) as fill_group
    from spine sp
    left join crude c using (benchmark, price_date)
),

filled as (
    select
        benchmark,
        price_date,
        max(close_usd) over (partition by benchmark, fill_group) as close_usd,
        close_usd is not null                                     as is_trading_day
    from grouped
)

select
    f.price_date,
    f.benchmark,
    f.close_usd                                                             as usd_per_barrel,
    fx.thb_per_unit                                                         as thb_per_usd,
    (f.close_usd * fx.thb_per_unit)::numeric(12, 2)                         as thb_per_barrel,
    (f.close_usd * fx.thb_per_unit / {{ var('litres_per_barrel') }})::numeric(10, 4) as thb_per_litre,
    f.is_trading_day
from filled f
left join {{ ref('int_fx_rates_daily') }} fx
    on fx.rate_date = f.price_date
   and fx.currency = 'USD'

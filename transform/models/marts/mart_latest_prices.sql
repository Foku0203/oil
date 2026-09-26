-- Headline numbers per brand and fuel: today's price, tomorrow's (if announced) and changes over time.

with prices as (
    select * from {{ ref('fct_retail_prices_daily') }}
),

today as (
    select * from prices where price_date = {{ bkk_today() }}
),

last_change as (
    select distinct on (brand, fuel_code)
        brand, fuel_code, price_date as last_change_date, change_thb as last_change_thb
    from prices
    where is_price_change and not is_announced
    order by brand, fuel_code, price_date desc
),

year_range as (
    select brand, fuel_code, min(price_thb) as min_1y_thb, max(price_thb) as max_1y_thb
    from prices
    where price_date > {{ bkk_today() }} - 365 and not is_announced
    group by brand, fuel_code
)

select
    t.brand,
    t.fuel_code,
    f.name_th,
    f.name_en,
    f.fuel_group,
    f.sort_order,
    t.price_date                                    as as_of_date,
    t.price_thb,
    tm.price_thb                                    as tomorrow_price_thb,
    (tm.price_thb - t.price_thb)::numeric(8, 2)     as tomorrow_change_thb,
    t.change_thb                                    as change_1d_thb,
    (t.price_thb - d7.price_thb)::numeric(8, 2)     as change_7d_thb,
    (t.price_thb - d30.price_thb)::numeric(8, 2)    as change_30d_thb,
    (t.price_thb - d365.price_thb)::numeric(8, 2)   as change_365d_thb,
    lc.last_change_date,
    lc.last_change_thb,
    yr.min_1y_thb,
    yr.max_1y_thb
from today t
join {{ ref('dim_fuels') }} f using (fuel_code)
left join prices tm   on tm.brand = t.brand and tm.fuel_code = t.fuel_code and tm.price_date = t.price_date + 1
left join prices d7   on d7.brand = t.brand and d7.fuel_code = t.fuel_code and d7.price_date = t.price_date - 7
left join prices d30  on d30.brand = t.brand and d30.fuel_code = t.fuel_code and d30.price_date = t.price_date - 30
left join prices d365 on d365.brand = t.brand and d365.fuel_code = t.fuel_code and d365.price_date = t.price_date - 365
left join last_change lc on lc.brand = t.brand and lc.fuel_code = t.fuel_code
left join year_range yr  on yr.brand = t.brand and yr.fuel_code = t.fuel_code

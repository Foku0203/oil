with daily as (
    select
        *,
        lag(price_thb) over (partition by brand, fuel_code order by price_date) as prev_price_thb
    from {{ ref('int_retail_prices_daily') }}
)

select
    price_date,
    brand,
    fuel_code,
    price_thb,
    prev_price_thb,
    (price_thb - prev_price_thb)::numeric(8, 2)                     as change_thb,
    coalesce(price_thb <> prev_price_thb, false)                    as is_price_change,
    is_observed,
    is_announced
from daily

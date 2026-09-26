-- Every observed (brand, product, date) price, mapped to a canonical fuel_code.
-- Each source publishes the full product list on every observation, which
-- int_retail_prices_daily relies on to detect discontinued products.

with ptt as (
    select distinct on (product_name, effective_date)
        brand,
        product_name,
        effective_date      as price_date,
        price_thb,
        false               as is_announced
    from {{ ref('stg_ptt__retail_prices') }}
    order by product_name, effective_date, effective_at desc
),

bangchak as (
    select brand, product_name, as_of_date as price_date, price_today_thb as price_thb, false as is_announced
    from {{ ref('stg_bangchak__retail_prices') }}
    where price_today_thb is not null

    union all

    select brand, product_name, as_of_date + 1, price_tomorrow_thb, true
    from {{ ref('stg_bangchak__retail_prices') }}
    where price_tomorrow_thb is not null
),

bangchak_deduped as (
    -- An observed "today" price beats yesterday's announcement for the same date.
    select distinct on (product_name, price_date) *
    from bangchak
    order by product_name, price_date, is_announced
),

unioned as (
    select * from ptt
    union all
    select * from bangchak_deduped
)

select
    u.brand,
    u.product_name,
    m.fuel_code,
    u.price_date,
    u.price_thb,
    u.is_announced
from unioned u
left join {{ ref('fuel_product_map') }} m
    on m.brand = u.brand
   and m.product_name = u.product_name

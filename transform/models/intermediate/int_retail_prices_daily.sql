-- One row per brand, fuel and calendar day, carrying the last known price forward.
-- A series ends the day before the first price list it is missing from (discontinued),
-- otherwise at today, or tomorrow when a next-day price has been announced.

with points as (
    select * from {{ ref('int_retail_price_points') }}
    where fuel_code is not null
),

listings as (
    select distinct brand, price_date from points
),

series as (
    select brand, fuel_code, min(price_date) as first_date, max(price_date) as last_date
    from points
    group by brand, fuel_code
),

bounds as (
    select
        s.brand,
        s.fuel_code,
        s.first_date,
        coalesce(
            (select min(l.price_date) - 1
             from listings l
             where l.brand = s.brand and l.price_date > s.last_date),
            greatest(s.last_date, {{ bkk_today() }})
        ) as end_date
    from series s
),

spine as (
    select brand, fuel_code, gs::date as price_date
    from bounds, generate_series(first_date, end_date, interval '1 day') as gs
),

grouped as (
    select
        sp.brand,
        sp.fuel_code,
        sp.price_date,
        p.price_thb,
        count(p.price_thb) over (
            partition by sp.brand, sp.fuel_code order by sp.price_date
        ) as fill_group
    from spine sp
    left join points p using (brand, fuel_code, price_date)
)

select
    brand,
    fuel_code,
    price_date,
    max(price_thb) over (partition by brand, fuel_code, fill_group) as price_thb,
    price_thb is not null                                           as is_observed,
    price_date > {{ bkk_today() }}                                  as is_announced
from grouped

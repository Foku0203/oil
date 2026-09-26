-- Every retail price change, for timelines and "how often does it move" stats.

select
    p.price_date,
    p.brand,
    p.fuel_code,
    f.name_th,
    f.name_en,
    p.prev_price_thb,
    p.price_thb,
    p.change_thb,
    (p.change_thb / nullif(p.prev_price_thb, 0) * 100)::numeric(6, 2)  as change_pct,
    p.is_announced
from {{ ref('fct_retail_prices_daily') }} p
join {{ ref('dim_fuels') }} f using (fuel_code)
where p.is_price_change

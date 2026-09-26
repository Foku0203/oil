-- PTT retail prices side by side with Brent converted to THB/litre.
-- gap_thb_per_litre is everything that is not crude: refining, taxes, Oil Fund levy/subsidy and marketing margin.

with retail as (
    select price_date, fuel_code, price_thb
    from {{ ref('fct_retail_prices_daily') }}
    where brand = 'PTT' and not is_announced
),

brent as (
    select price_date, usd_per_barrel, thb_per_usd, thb_per_litre
    from {{ ref('fct_crude_prices_daily') }}
    where benchmark = 'brent'
),

joined as (
    select
        r.price_date,
        r.fuel_code,
        r.price_thb                                 as retail_thb_per_litre,
        b.usd_per_barrel                            as brent_usd_per_barrel,
        b.thb_per_usd,
        b.thb_per_litre                             as brent_thb_per_litre,
        (r.price_thb - b.thb_per_litre)::numeric(8, 4) as gap_thb_per_litre
    from retail r
    join brent b using (price_date)
)

select
    *,
    avg(retail_thb_per_litre) over w30  ::numeric(8, 2) as retail_ma30,
    avg(brent_thb_per_litre)  over w30  ::numeric(8, 4) as brent_thb_per_litre_ma30
from joined
window w30 as (partition by fuel_code order by price_date rows between 29 preceding and current row)

select
    rate_date,
    currency,
    thb_per_unit,
    thb_per_unit - lag(thb_per_unit) over (partition by currency order by rate_date) as change_thb,
    is_published
from {{ ref('int_fx_rates_daily') }}

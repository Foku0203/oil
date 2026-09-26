select *
from {{ ref('int_crude_prices_daily') }}
where thb_per_usd is not null

-- The baht has traded between roughly 29 and 39 per USD for decades; outside that band means bad data.
select *
from {{ ref('fct_fx_rates_daily') }}
where currency = 'USD'
  and (thb_per_unit < 25 or thb_per_unit > 45)

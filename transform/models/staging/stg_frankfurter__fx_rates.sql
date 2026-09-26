select
    rate_date,
    quote_currency          as currency,
    rate                    as units_per_usd,
    _ingested_at            as ingested_at
from {{ source('raw', 'fx_rates') }}
where base_currency = 'USD'

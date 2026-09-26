select
    'Bangchak'                      as brand,
    oil_name                        as product_name,
    as_of_date,
    announced_at,
    effective_date,
    nullif(price_yesterday, 0)      as price_yesterday_thb,
    nullif(price_today, 0)          as price_today_thb,
    nullif(price_tomorrow, 0)       as price_tomorrow_thb,
    _ingested_at                    as ingested_at
from {{ source('raw', 'bangchak_oil_prices') }}

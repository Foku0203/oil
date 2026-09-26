select
    price_date,
    case symbol
        when 'BZ=F' then 'brent'
        when 'CL=F' then 'wti'
    end                     as benchmark,
    symbol,
    open_usd,
    high_usd,
    low_usd,
    close_usd,
    volume,
    _ingested_at            as ingested_at
from {{ source('raw', 'crude_prices') }}

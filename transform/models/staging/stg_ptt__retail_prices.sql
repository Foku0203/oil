-- Zero prices mark products PTT listed but did not sell; they are excluded here and surfaced by a source test.
select
    'PTT'                                   as brand,
    product                                 as product_name,
    effective_at,
    {{ bkk_date('effective_at') }}          as effective_date,
    price_thb::numeric(8, 2)                as price_thb,
    _ingested_at                            as ingested_at
from {{ source('raw', 'ptt_oil_prices') }}
where price_thb > 0

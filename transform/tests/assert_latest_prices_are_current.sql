-- The dashboard header must have today's prices for PTT; empty means ingestion stalled.
select 1 as missing
where not exists (
    select 1 from {{ ref('mart_latest_prices') }} where brand = 'PTT'
)

select
    f.fuel_code,
    f.name_th,
    f.name_en,
    f.fuel_group,
    f.sort_order,
    array_agg(distinct m.brand order by m.brand) filter (where m.brand is not null) as brands
from {{ ref('fuels') }} f
left join {{ ref('fuel_product_map') }} m using (fuel_code)
group by 1, 2, 3, 4, 5

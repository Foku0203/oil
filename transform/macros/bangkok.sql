{% macro bkk_today() -%}
    (now() at time zone 'Asia/Bangkok')::date
{%- endmacro %}

{% macro bkk_date(ts) -%}
    ({{ ts }} at time zone 'Asia/Bangkok')::date
{%- endmacro %}

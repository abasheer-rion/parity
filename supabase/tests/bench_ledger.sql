-- A year of ledger history for the made-up data (supabase/tests/bench.sh): one row per
-- order placed and one per fill, in monthly partitions. Never applied to the hosted project.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
do $$
declare m date; part text;
begin
  for i in 1 .. 12 loop
    m := (date_trunc('month', now()) - make_interval(months => i))::date;
    part := format('trade_ledger_y%sm%s', to_char(m, 'YYYY'), to_char(m, 'MM'));
    if to_regclass('parity_private.' || part) is null then
      execute format('create table parity_private.%I partition of public.trade_ledger for values from (%L) to (%L)', part, m::timestamptz, (m + interval '1 month')::timestamptz);
      execute format('alter table parity_private.%I enable row level security', part);
    end if;
  end loop;
end $$;
insert into public.trade_ledger (recorded_at, user_id, account_id, kind, idempotency_key, order_id, symbol, side, status, qty, price)
select least(o.placed_at, now()), o.user_id, o.account_id, 'order_placed', 'order:' || o.id || ':placed', o.id, o.symbol, o.side, o.status, o.qty, o.limit_price
from public.paper_orders o;
insert into public.trade_ledger (recorded_at, user_id, account_id, kind, idempotency_key, order_id, symbol, side, qty, price, fee, cash_delta, bar_date)
select least(o.placed_at + interval '1 hour', now()), f.user_id, f.account_id, 'fill', 'fill:' || f.order_id, f.order_id, f.symbol, f.side, f.qty, f.price, f.fee,
       case when f.side = 'buy' then -(f.qty * f.price + f.fee) else f.qty * f.price - f.fee end, f.bar_date
from public.paper_fills f join public.paper_orders o on o.id = f.order_id;
vacuum analyze public.trade_ledger;

-- Fancy Finery — Nigeria: flat ₦8,500 statewide delivery for every state except Lagos.
--
-- Lagos keeps its per-area pricing untouched. Every OTHER state (and the FCT)
-- gets exactly one delivery record at ₦8,500 (850,000 kobo). This only writes to
-- the Nigeria local-delivery tables (ng_states / ng_destinations) — the
-- international shipping engine, zones, rates and every other country are
-- untouched, and no calculation logic, checkout flow or UI changes.
--
-- Idempotent and transactional (db-apply wraps the file in one transaction):
-- re-running leaves each non-Lagos state with precisely one ₦8,500 record.

-- 1) Ensure all 36 states + the FCT exist; create any that are missing. The
--    case-insensitive name index makes this a no-op for states already present.
insert into public.ng_states (name, code, sort_order)
values
  ('Abia','AB',10),('Adamawa','AD',20),('Akwa Ibom','AK',30),('Anambra','AN',40),
  ('Bauchi','BA',50),('Bayelsa','BY',60),('Benue','BE',70),('Borno','BO',80),
  ('Cross River','CR',90),('Delta','DE',100),('Ebonyi','EB',110),('Edo','ED',120),
  ('Ekiti','EK',130),('Enugu','EN',140),('Federal Capital Territory','FC',150),
  ('Gombe','GO',160),('Imo','IM',170),('Jigawa','JI',180),('Kaduna','KD',190),
  ('Kano','KN',200),('Katsina','KT',210),('Kebbi','KE',220),('Kogi','KO',230),
  ('Kwara','KW',240),('Lagos','LA',250),('Nasarawa','NA',260),('Niger','NI',270),
  ('Ogun','OG',280),('Ondo','ON',290),('Osun','OS',300),('Oyo','OY',310),
  ('Plateau','PL',320),('Rivers','RI',330),('Sokoto','SO',340),('Taraba','TA',350),
  ('Yobe','YO',360),('Zamfara','ZA',370)
on conflict do nothing;

-- 2) Collapse every NON-Lagos state to a single ₦8,500 record.
--    The delete guarantees "exactly one" even if a state had several areas;
--    Lagos is excluded by name, so its per-area pricing is preserved verbatim.
delete from public.ng_destinations d
  using public.ng_states s
 where d.state_id = s.id
   and lower(s.name) <> 'lagos';

-- One flat fee per non-Lagos state, named after the state (so checkout reads
-- "Delivery to Kano", etc.). The on-conflict clause keeps it safe to re-run.
insert into public.ng_destinations (state_id, name, price_kobo, enabled, sort_order)
select s.id, s.name, 850000, true, 0
  from public.ng_states s
 where lower(s.name) <> 'lagos'
on conflict (state_id, lower(name)) do update
  set price_kobo = excluded.price_kobo,
      enabled    = true;

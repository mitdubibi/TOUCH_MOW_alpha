-- FAKE DATA ONLY (PDPA). Centre names, units and remarks are made up.
-- Matches the /demo prototype (src/data/mockData.ts): 1 kitchen, 6 Jurong West blocks, 20 units,
-- and 3 sessions (today lunch, today dinner, tomorrow lunch). Dates are relative to the day you run it.
-- Safe to run again: existing rows are kept. People are created with `npm run dev-user` (see README).

-- address needs 0006_reminders_chat_problems.sql.
insert into public.centres (name, postal_code, lat, lng, address) values
  ('Jurong West Kitchen (demo)', '640518', 1.3494, 103.7168, 'Blk 518 Jurong West St 52 #01-100 (demo), Singapore 640518'),
  ('Boon Lay Kitchen (demo)', '640652', null, null, 'Blk 652 Jurong West St 61 #01-200 (demo), Singapore 640652')
on conflict (name) do update set lat = excluded.lat, lng = excluded.lng, address = excluded.address;

insert into public.blocks (postal_code, block_no, street, lat, lng) values
  ('640501', '501', 'Jurong West St 51', 1.3508, 103.7182),
  ('640502', '502', 'Jurong West St 51', 1.3516, 103.7166),
  ('640513', '513', 'Jurong West St 52', 1.3500, 103.7146),
  ('640516', '516', 'Jurong West St 52', 1.3487, 103.7136),
  ('640518', '518', 'Jurong West St 52', 1.3479, 103.7158),
  ('640524', '524', 'Jurong West St 52', 1.3470, 103.7183)
on conflict (postal_code) do nothing;

insert into public.sessions (centre_id, date, slot, start_time)
select c.id, d.date, d.slot::public.session_slot, d.start_time
from public.centres c,
  (values
    ((now() at time zone 'Asia/Singapore')::date, 'lunch', time '08:30'),
    ((now() at time zone 'Asia/Singapore')::date, 'dinner', time '14:30'),
    ((now() at time zone 'Asia/Singapore')::date + 1, 'lunch', time '08:30')
  ) as d(date, slot, start_time)
where c.name = 'Jurong West Kitchen (demo)'
on conflict (centre_id, date, slot) do nothing;

-- Units and their deliveries. One DO block, so the rows are listed once and everything runs as a
-- single statement (the SQL Editor may run each statement on a different connection, which loses
-- temp tables between statements).
do $$
declare
  seed jsonb := '[
    {"postal": "640501", "unit_no": "#03-110", "floor": 3,  "meal_type": "H-BR",       "remarks": "",                                 "lang": "en", "dinner": false},
    {"postal": "640501", "unit_no": "#07-114", "floor": 7,  "meal_type": "H-M",        "remarks": "Knock loudly",                     "lang": "en", "dinner": true},
    {"postal": "640501", "unit_no": "#11-118", "floor": 11, "meal_type": "HH",         "remarks": "",                                 "lang": "zh", "dinner": false},
    {"postal": "640501", "unit_no": "#12-120", "floor": 12, "meal_type": "H-BR",       "remarks": "Ring bell twice",                  "lang": "en", "dinner": false},
    {"postal": "640502", "unit_no": "#02-205", "floor": 2,  "meal_type": "H-BR",       "remarks": "",                                 "lang": "en", "dinner": false},
    {"postal": "640502", "unit_no": "#09-213", "floor": 9,  "meal_type": "H",          "remarks": "",                                 "lang": "zh", "dinner": true},
    {"postal": "640502", "unit_no": "#12-209", "floor": 12, "meal_type": "H-BR",       "remarks": "Leave on chair outside",           "lang": "en", "dinner": false},
    {"postal": "640513", "unit_no": "#04-301", "floor": 4,  "meal_type": "H-M",        "remarks": "",                                 "lang": "zh", "dinner": false},
    {"postal": "640513", "unit_no": "#04-305", "floor": 4,  "meal_type": "H-BR",       "remarks": "Gate unlocked, leave on chair",    "lang": "en", "dinner": false},
    {"postal": "640513", "unit_no": "#10-311", "floor": 10, "meal_type": "HH",         "remarks": "No sugar drinks",                  "lang": "en", "dinner": true},
    {"postal": "640513", "unit_no": "#13-315", "floor": 13, "meal_type": "H-BR",       "remarks": "",                                 "lang": "zh", "dinner": false},
    {"postal": "640516", "unit_no": "#01-402", "floor": 1,  "meal_type": "H-BR",       "remarks": "",                                 "lang": "en", "dinner": false},
    {"postal": "640516", "unit_no": "#06-410", "floor": 6,  "meal_type": "H-M",        "remarks": "Hard of hearing",                  "lang": "zh", "dinner": true},
    {"postal": "640516", "unit_no": "#13-412", "floor": 13, "meal_type": "H",          "remarks": "",                                 "lang": "en", "dinner": false},
    {"postal": "640518", "unit_no": "#05-123", "floor": 5,  "meal_type": "H-BR",       "remarks": "",                                 "lang": "en", "dinner": false},
    {"postal": "640518", "unit_no": "#05-127", "floor": 5,  "meal_type": "HH",         "remarks": "",                                 "lang": "en", "dinner": false},
    {"postal": "640518", "unit_no": "#09-131", "floor": 9,  "meal_type": "H-M",        "remarks": "Call before arriving",             "lang": "zh", "dinner": true},
    {"postal": "640524", "unit_no": "#02-540", "floor": 2,  "meal_type": "H-BR",       "remarks": "",                                 "lang": "en", "dinner": false},
    {"postal": "640524", "unit_no": "#07-548", "floor": 7,  "meal_type": "H-M",        "remarks": "Uses walking frame, wait at door", "lang": "zh", "dinner": true},
    {"postal": "640524", "unit_no": "#14-544", "floor": 14, "meal_type": "H-BR",       "remarks": "",                                 "lang": "en", "dinner": false}
  ]';
begin
  insert into public.units (postal_code, unit_no, floor)
  select su.postal, su.unit_no, su.floor
  from jsonb_to_recordset(seed) as su(postal text, unit_no text, floor int)
  on conflict (postal_code, unit_no) do nothing;

  -- unit_contacts rows are created by a trigger; set the preferred language.
  update public.unit_contacts uc
  set lang = su.lang
  from jsonb_to_recordset(seed) as su(postal text, unit_no text, lang text)
  join public.units u on u.postal_code = su.postal and u.unit_no = su.unit_no
  where uc.unit_id = u.id;

  -- Lunch (today and tomorrow): all 20 units. Dinner today: the 6 marked dinner.
  insert into public.deliveries (session_id, unit_id, meal_type, remarks)
  select s.id, u.id, su.meal_type, nullif(su.remarks, '')
  from jsonb_to_recordset(seed) as su(postal text, unit_no text, meal_type text, remarks text, dinner boolean)
  join public.units u on u.postal_code = su.postal and u.unit_no = su.unit_no
  join public.sessions s on s.centre_id = (select id from public.centres where name = 'Jurong West Kitchen (demo)')
  where s.date between (now() at time zone 'Asia/Singapore')::date and (now() at time zone 'Asia/Singapore')::date + 1
    and (s.slot = 'lunch' or su.dinner)
    and not (s.slot = 'dinner' and s.date > (now() at time zone 'Asia/Singapore')::date)
  on conflict (session_id, unit_id) do nothing;
end $$;

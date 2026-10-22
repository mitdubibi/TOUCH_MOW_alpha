-- Meal types are now TOUCH's codes: H-BR (normal), HH, H, H-M (minced). Moves the made-up data off the old words.
-- The app only accepts these four from now on (src/lib/meals.ts).

update public.deliveries set meal_type = case meal_type
  when 'Normal' then 'H-BR'
  when 'Soft' then 'H-M'
  when 'Diabetic' then 'HH'
  when 'Vegetarian' then 'H'
end
where meal_type in ('Normal', 'Soft', 'Diabetic', 'Vegetarian');

update public.demo_units set meal_type = case meal_type
  when 'Normal' then 'H-BR'
  when 'Soft' then 'H-M'
  when 'Diabetic' then 'HH'
  when 'Vegetarian' then 'H'
end
where meal_type in ('Normal', 'Soft', 'Diabetic', 'Vegetarian');

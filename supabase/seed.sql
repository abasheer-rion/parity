-- Local development only. Real team emails are added to the hosted project by hand,
-- never committed here.
insert into public.members (email) values ('dev@example.com') on conflict do nothing;

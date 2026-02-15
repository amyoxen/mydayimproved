insert into public.profiles (id, email, is_admin)
values ('18880514-5b80-46c6-b4f4-b2cb5801272f', 'amyoxen@gmail.com', true)
on conflict (id) do update set
  email = excluded.email,
  is_admin = true;

-- Rattachement du compte super administrateur unique (à exécuter UNE FOIS par l'opérateur, après migration).
--
-- Prérequis : le compte dominiquek051@gmail.com existe déjà dans Supabase Auth (Dashboard > Authentication > Users).
-- Ce script ne crée aucun mot de passe et n'est pas exécuté par les migrations.

-- 1. Rattache le compte unique au rôle super_admin.
insert into public.platform_admins (user_id, role)
select u.id, 'super_admin'
from auth.users u
where lower(u.email) = 'dominiquek051@gmail.com'
on conflict (user_id) do update set role = 'super_admin';

-- 2. Contrôle : doit ne retourner qu'une ligne, pour dominiquek051@gmail.com.
select pa.user_id, u.email, pa.role
from public.platform_admins pa
left join auth.users u on u.id = pa.user_id;

-- 3. Autres comptes encore présents ? Les retirer seulement après vérification manuelle du résultat ci-dessus :
-- delete from public.platform_admins
-- where user_id not in (select id from auth.users where lower(email) = 'dominiquek051@gmail.com');

-- L'application lit désormais `role` et non plus `roles`.
--
-- Historiquement c'est `roles` qui portait la valeur réelle (UsersService.findAll
-- filtrait dessus), tandis que `role` restait à sa valeur par défaut. Sans cette
-- reprise, tout compte ADMIN ou VIEWER déclaré uniquement dans `roles` serait
-- silencieusement rétrogradé en USER au démarrage.
--
-- La condition `role = 'USER'` restreint la mise à jour aux comptes dont `role`
-- est resté au défaut : un rôle déjà renseigné dans `role` fait foi et n'est pas
-- écrasé par une valeur `roles` potentiellement plus ancienne.
UPDATE "users"
SET "role" = "roles"
WHERE "role" = 'USER' AND "roles" <> 'USER';

-- Symétrique : réaligne `roles` sur `role` là où seul `role` avait été renseigné,
-- pour que les deux colonnes repartent cohérentes tant que `roles` existe.
UPDATE "users"
SET "roles" = "role"
WHERE "roles" = 'USER' AND "role" <> 'USER';

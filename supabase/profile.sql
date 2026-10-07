-- Rode no SQL Editor. Adiciona idade, altura, cor do perfil e o controle do primeiro cadastro.
alter table profiles
  add column age int check (age between 10 and 100),
  add column height numeric check (height between 100 and 250),
  add column theme text not null default 'green' check (theme in ('green','blue','pink','purple','orange')),
  add column onboarded boolean not null default false;

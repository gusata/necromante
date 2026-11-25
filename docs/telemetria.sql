-- Telemetria de teste do Necromante (Supabase).
-- Cole tudo no SQL Editor do projeto e clique em Run. Pode rodar de novo sem problema.
--
-- O APK usa a chave "publishable" (pública). Com RLS ligado e só a política de INSERT,
-- quem tiver a chave consegue mandar linhas, mas ninguém consegue ler, alterar nem apagar.
-- Você lê pelo painel do Supabase (Table Editor / SQL Editor), que usa a sua conta.

create table if not exists public.runs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  device text not null,
  version text not null,
  outcome text not null check (outcome in ('death', 'quit', 'exit')),
  wave int not null,
  character text,
  data jsonb not null
);

create table if not exists public.errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  device text not null,
  version text not null,
  message text not null,
  data jsonb
);

alter table public.runs enable row level security;
alter table public.errors enable row level security;

drop policy if exists "app insere runs" on public.runs;
create policy "app insere runs" on public.runs
  for insert to anon
  with check (length(device) <= 40 and length(version) <= 20 and pg_column_size(data) < 200000);

drop policy if exists "app insere erros" on public.errors;
create policy "app insere erros" on public.errors
  for insert to anon
  with check (length(device) <= 40 and length(message) <= 2000 and coalesce(pg_column_size(data), 0) < 50000);

-- a chave pública só insere; nada de ler pela API
revoke select, update, delete on public.runs, public.errors from anon, authenticated;
grant insert on public.runs, public.errors to anon;

create index if not exists runs_created_at on public.runs (created_at desc);
create index if not exists runs_device on public.runs (device);


-- =====================================================================
-- Consultas úteis (rode uma por vez no SQL Editor; não precisa salvar)
-- =====================================================================

-- 1) Últimas runs: quem, onde morreu e do quê
-- select created_at, device, version, character, outcome, wave, data->>'where' as onde,
--        data->'hurtLastWave' as dano_na_ultima_onda, data->'fps' as fps
-- from runs order by created_at desc limit 50;

-- 2) Onde as pessoas morrem (por região/onda)
-- select data->>'where' as onde, count(*) as mortes
-- from runs where outcome = 'death' group by 1 order by 2 desc;

-- 3) O que mais machuca o necromante na onda da morte
-- select k as inimigo, sum((v)::numeric) as dano, count(*) as runs
-- from runs, jsonb_each_text(data->'hurtLastWave') as e(k, v)
-- where outcome = 'death' group by k order by dano desc;

-- 4) Itens mais equipados e a onda média de quem usa
-- select e->>'id' as item, count(*) as runs, round(avg(wave), 1) as onda_media
-- from runs, jsonb_array_elements(data->'equipped') as e
-- group by 1 order by 2 desc;

-- 5) Progresso por testador
-- select device, count(*) as runs, max(wave) as melhor, round(avg(wave), 1) as media,
--        round(sum((data->>'time')::numeric) / 60) as minutos_jogados, max(created_at) as ultima
-- from runs group by device order by ultima desc;

-- 6) Celulares lentos
-- select device, data->'device'->>'ua' as aparelho, data->'fps'->>'avg' as fps_medio, data->'fps'->>'min' as fps_min
-- from runs order by (data->'fps'->>'avg')::int asc nulls last limit 20;

-- 7) Erros mais comuns
-- select message, count(*) as vezes, count(distinct device) as aparelhos, max(version) as versao
-- from errors group by message order by vezes desc;

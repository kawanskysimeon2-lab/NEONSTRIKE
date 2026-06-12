-- ============================================================
-- NEONSTRIKE — Schema do banco de dados (Supabase)
-- Cole tudo isso no "SQL Editor" do seu projeto Supabase e clique RUN
-- ============================================================

-- Tabela de jogadores (login + dados salvos)
create table if not exists players (
  username text primary key,
  password_hash text not null,
  data jsonb not null,
  created_at timestamp with time zone default now()
);

-- Tabela de configuração global (anúncios, economia, tema)
create table if not exists game_config (
  id integer primary key,
  config jsonb not null,
  updated_at timestamp with time zone default now()
);

-- Linha inicial de configuração (o jogo cria automaticamente se não existir,
-- mas pode rodar manualmente também)
insert into game_config (id, config)
values (1, '{
  "announcement": "",
  "coinMultiplier": 1.0,
  "xpMultiplier": 1.0,
  "shopBasePrice": 800,
  "theme": {
    "gameName": "NEONSTRIKE",
    "primary": "#b14aff",
    "secondary": "#00f0ff",
    "bg": "#0b0a14"
  }
}')
on conflict (id) do nothing;

-- ============================================================
-- SEGURANÇA (RLS - Row Level Security)
-- Como o login é feito pela própria aplicação (não pelo Supabase Auth),
-- liberamos leitura/escrita pela chave "anon" — a aplicação cuida da
-- validação de senha (hash SHA-256) antes de qualquer operação.
-- ============================================================

alter table players enable row level security;
alter table game_config enable row level security;

create policy "permitir tudo - players" on players
  for all using (true) with check (true);

create policy "permitir tudo - game_config" on game_config
  for all using (true) with check (true);

-- ============================================================
-- REALTIME (para o anúncio geral aparecer instantaneamente)
-- ============================================================
alter publication supabase_realtime add table game_config;

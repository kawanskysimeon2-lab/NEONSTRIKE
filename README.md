# 🎮 NEONSTRIKE

Jogo de tiro 3D em arena (estilo arena shooter), com login real, progresso
salvo no banco de dados, sistema de armas/habilidades/inimigos, ondas
infinitas e painel de administrador (Owner).

---

## ✅ O que já funciona sem nenhuma configuração

Se você abrir o `index.html` direto (ou colocar no GitHub Pages) **sem**
configurar o banco de dados, o jogo funciona em **modo local**: login,
senha e progresso são salvos no `localStorage` do navegador. Funciona,
mas **cada navegador/aparelho tem seus próprios dados** — não dá pra ver
todo mundo no painel admin de verdade.

Para ter login de verdade (qualquer aparelho, dados centralizados, painel
admin vendo todo mundo), siga o passo a passo abaixo com o **Supabase**
(gratuito).

---

## 🔧 Passo a passo — configurar o banco de dados (Supabase, grátis)

1. Crie uma conta em **https://supabase.com** (pode usar GitHub para entrar).
2. Clique em **"New Project"**. Escolha um nome e uma senha de banco (guarde,
   mas você não vai precisar dela no código).
3. Espere o projeto terminar de ser criado (1-2 minutos).
4. No menu lateral, vá em **SQL Editor** → **New query**.
5. Abra o arquivo `schema.sql` (que está junto com este projeto), copie todo
   o conteúdo, cole no editor do Supabase e clique em **RUN**.
6. Agora vá em **Project Settings** (ícone de engrenagem) → **API**.
7. Copie:
   - **Project URL** (algo como `https://xxxxxxxx.supabase.co`)
   - **anon public** key (uma chave longa)
8. Abra o arquivo `config.js` deste projeto e cole nos lugares indicados:

```js
const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'sua-chave-anon-aqui';
```

9. Salve. Pronto — agora o jogo salva tudo no banco de dados real.

---

## 👑 Como se tornar o OWNER (painel admin)

1. Abra o jogo e **crie sua conta** normalmente (aba "CRIAR CONTA").
2. Abra o arquivo `config.js` e troque a linha:

```js
const OWNER_USERNAME = 'kawansky';
```

   Coloque **exatamente o nome de usuário** que você cadastrou (em letras
   minúsculas).

3. Salve o arquivo e suba pro GitHub. Ao entrar com essa conta, vai aparecer
   um botão **⚙ (engrenagem)** no topo do menu — esse é o seu painel admin.

### O que o painel admin realmente faz (tudo funcional, salvo no banco):

- **Jogadores**: ver todos os jogadores cadastrados, editar nível/moedas de
  qualquer um, banir/desbanir contas (jogador banido não consegue logar).
- **Anúncio geral**: escreva uma mensagem e ela aparece **instantaneamente**
  para todos os jogadores no topo do menu (usa Realtime do Supabase — não
  precisa nem recarregar a página).
- **Economia**: multiplicadores globais de moedas e XP, e preço base da loja
  — aplicados a todo mundo na hora.
- **Tema/Visual**: troque o nome do jogo e as cores neon principais — todo
  jogador vê o novo visual.
- **Estatísticas**: números reais vindos do banco (total de jogadores,
  abates totais, moedas em circulação, maior nível).

---

## 🚀 Pode colocar online?

**Sim!** Depois de configurar o Supabase, é só subir esses arquivos
(`index.html`, `style.css`, `config.js`, `audio.js`, `game.js`, `main.js`)
para o seu repositório do GitHub Pages, igual você já fez com o SurvivAI.
Funciona perfeitamente no GitHub Pages porque o Supabase faz o trabalho de
"servidor" — o GitHub só precisa servir os arquivos estáticos.

---

## 🎮 Como jogar

- **WASD** — mover
- **Mouse** — mirar (clique na tela para travar o cursor)
- **Clique esquerdo (mantido)** — atirar
- **Espaço** — usar habilidade equipada
- **ESC** — pausar

Sobreviva o máximo de ondas possível. Cada 5 ondas aparece um **chefe**
(COLOSSO). Ganhe moedas e XP para subir de nível, desbloquear e comprar
armas/habilidades novas no menu.

---

## 🔫 Armas

| Arma | Desbloqueia no nível | Estilo |
|---|---|---|
| Pistola Pulsar | 1 (grátis) | Equilibrada, munição infinita |
| SMG Lâmina | 3 | Tiro muito rápido, dano baixo |
| Fragmentadora | 5 | 6 projéteis por tiro, curto alcance |
| Railgun Singular | 8 | Dano altíssimo, tiro lento |
| Canhão de Plasma | 12 | Explode em área |

## ✨ Habilidades

| Habilidade | Desbloqueia no nível | Efeito |
|---|---|---|
| Impulso Neon | 1 (grátis) | Avanço rápido |
| Escudo de Pulso | 4 | Imunidade total por 3s |
| Overdrive | 6 | Dobra a taxa de tiro por 5s |
| Nanorregeneração | 7 | Cura 50 de vida |
| Nova EMP | 9 | Explosão que atordoa e dana inimigos |

---

## 🛠 Arquivos do projeto

- `index.html` — estrutura das telas (login, menu, jogo, admin)
- `style.css` — visual cyberpunk neon
- `config.js` — configuração do Supabase, armas, habilidades, inimigos
- `audio.js` — todos os sons (gerados via Web Audio API, sem arquivos extras)
- `game.js` — motor 3D (Three.js): arena, combate, ondas, inimigos
- `main.js` — login, persistência, menu, painel admin
- `schema.sql` — script para configurar o banco de dados no Supabase

---

## 💡 Ideias para você expandir depois

- Adicionar mais tipos de arena (trocar de mapa)
- Sistema de skins/cores para o jogador
- Ranking global (top 10 jogadores por pontos)
- Modo "vs amigos" usando o Realtime do Supabase

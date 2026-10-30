# Identity

Base com React, TypeScript e Vite. Supabase preparado para banco e autenticação; publicação estática pelo GitHub Pages.

## Desenvolvimento local

Requisito: Node.js 22.16+ e npm.

```sh
npm install
```

Copie `.env.example` para `.env.local`. No PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Preencha com os valores públicos do painel do projeto Supabase:

```dotenv
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SUA_CHAVE_PUBLICA
```

```sh
npm run dev
```

Abra o endereço exibido pelo Vite. A tela inicial funciona sem Supabase. O cliente só é criado quando as duas variáveis estão preenchidas; isso não confirma conectividade. Os métodos do serviço de autenticação retornam os resultados e erros do SDK para a futura interface tratar.

O frontend local usa, por padrão, um projeto Supabase hospedado. Para executar também o banco na própria máquina, instale Supabase CLI e Docker, execute `supabase init` e `supabase start`, e use a API URL e a anon key retornadas pelo CLI nas mesmas variáveis. Essa stack é opcional e não foi instalada neste projeto.

## Estrutura

```text
.github/workflows/deploy.yml  # Validação e publicação
src/
  components/layout/         # Estrutura visual compartilhada
  lib/supabase.ts            # Cliente único do Supabase
  pages/                    # Telas
  services/auth.ts           # Operações de autenticação
  App.tsx                   # Composição principal
  index.css                 # Estilos globais
  main.tsx                  # Entrada React
.env.example                # Modelo de configuração pública
supabase/migrations/         # SQL versionado do banco
```

Sem sessão, o app mostra a tela de login; com sessão, a tela inicial (`src/auth/`).

## Verificação

```sh
npm run lint
npm run build
npm run preview
```

## PWA

O app pode ser instalado no celular e no computador (`vite-plugin-pwa`, configurado em `vite.config.ts`). O build gera o manifesto (`manifest.webmanifest`) e um service worker que guarda o app (HTML, JS, CSS e ícones). Assim, a tela abre mesmo sem internet, com a carteirinha, as disciplinas e o feed que já estavam guardados no navegador. As chamadas ao Supabase sempre vão à rede. Uma versão nova publicada é instalada sozinha e vale a partir do próximo carregamento.

- O service worker só existe no build: para testar, rode `npm run build` e `npm run preview`.
- O manifesto e os ícones respeitam o caminho base do GitHub Pages (`VITE_BASE_PATH`).
- Os ícones saem de `public/logo.svg`. Depois de mudar o logo, rode `npm run generate-pwa-assets` (configuração em `pwa-assets.config.ts`) e versione os PNGs gerados em `public/`.
- No iPhone, a instalação é pelo Safari: Compartilhar → Adicionar à Tela de Início.

## GitHub Pages

1. Crie um repositório no GitHub e envie este projeto com a branch `main`.
2. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
3. Em **Settings → Secrets and variables → Actions → Variables**, crie `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os valores públicos do projeto.
4. Faça push para `main` ou execute o workflow manualmente. Pull requests executam lint e build, sem publicar.

O workflow define automaticamente a base como `/NOME-DO-REPOSITORIO/`, ou `/` para repositórios `*.github.io`. Para domínio próprio, ajuste `VITE_BASE_PATH` no workflow para `/` e configure o domínio no GitHub Pages.

As variáveis são incorporadas no build: alterações exigem nova publicação. Sem elas, a página abre, mas autenticação e banco ficam indisponíveis.

Ao implementar login, configure no Supabase **Authentication → URL Configuration** o endereço publicado como Site URL e os retornos permitidos, incluindo `http://localhost:5173/` e `https://USUARIO.github.io/REPOSITORIO/`. Se adicionar rotas, prefira hash routing ou trate o retorno direto de URLs no GitHub Pages.

## Dados e acesso

Use somente a publishable key (ou anon key legada) no frontend. Nunca coloque `service_role`, chaves secretas ou senha do banco em variáveis `VITE_*`: elas ficam visíveis no JavaScript publicado. `.env.local` está ignorado pelo Git.

Ative Row Level Security (RLS) e crie políticas adequadas para cada tabela antes de expor dados.

## Migrations

As migrations ficam em `supabase/migrations/`. Usuários, senhas e sessões são do Supabase Auth (schema `auth`) e não precisam de tabelas próprias. A primeira migration cria `public.profiles`, um perfil por usuário, com RLS (cada usuário lê e altera só o próprio nome) e um gatilho que cria o perfil no cadastro. O nome pode ser enviado em `options.data.full_name` no `signUp`.

Para aplicar sem instalar nada, cole o conteúdo do arquivo no **SQL Editor** do painel Supabase e execute uma única vez. Com Supabase CLI:

```sh
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

## Área administrativa

Usuários com `role = 'admin'` em `public.profiles` veem o menu **Administração** (`#/admin`), onde cadastram e removem usuários. O papel só muda pelo SQL Editor ou pela Edge Function; o próprio usuário não consegue alterá-lo.

Criar e remover contas exige a service role, que não pode ir para o frontend. Por isso essas operações passam pela Edge Function `supabase/functions/admin-users`, que confere a sessão e o papel admin de quem chama. A função recebe `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` automaticamente do Supabase.

1. Aplique `20261029130000_add_profile_role.sql` no SQL Editor.
2. Promova o primeiro administrador:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'EMAIL_DO_ADMIN');
   ```

3. Publique a função. Pelo painel: **Edge Functions → Deploy a new function → Via Editor**, nome `admin-users`, cole o conteúdo de `index.ts` e desative **Verify JWT** (a própria função valida o token). Com Supabase CLI:

   ```sh
   supabase functions deploy admin-users --no-verify-jwt --project-ref SEU_PROJECT_REF
   ```

O administrador define uma senha inicial (mínimo 8 caracteres) e a conta já nasce confirmada. Ninguém pode remover o próprio usuário pela tela.

## Matrículas

A migration `20261029140000_create_academic.sql` cria cursos (graduação e pós, com duração), 3 turmas de 5 vagas por curso, os dois polos, os dados do aluno no perfil (nascimento, foto, polo, turno), as matrículas e o bucket privado `avatars`.

- Todo usuário, inclusive administrador, tem polo, turno e matrícula. O número da matrícula é sequencial a partir de 1000.
- Semestres seguem o calendário (jan–jun, jul–dez); o semestre da matrícula é o 1º. A matrícula vence no fim do semestre seguinte ao que contém início + duração (ADS em 29/10/2026 vence em 30/06/2030, 8 semestres).
- Vigente (matriculado ou trancado): o administrador alterna o status livremente ou troca de curso. A troca gera uma matrícula nova e a antiga fica substituída.
- Vencida: o administrador renova (com o mesmo curso ou outro), o que gera uma matrícula nova, ou remove o usuário.
- A matrícula ocupa a primeira turma com vaga. Vencida ou substituída, ela libera a vaga. A limpeza roda no início de cada chamada da Edge Function.

A migration `20261029150000_add_ra_cpf.sql` adiciona o CPF ao perfil (obrigatório, só dígitos, único e validado pelos dígitos verificadores) e o RA à matrícula. Com `20261029160000_ra_format.sql`, o RA é gerado com cada matrícula no formato número da matrícula + 6 dígitos aleatórios + `-` + 2 dígitos aleatórios (matrícula 1005 → `1005202600-05`); as matrículas existentes são convertidas para esse formato.

Depois de aplicar as migrations, republique a função `admin-users`.

## Disciplinas

`20261030140000_create_subjects.sql` cria a grade (`subjects`) e as disciplinas cursadas (`subject_enrollments`); `20261030140100_seed_subjects.sql` preenche a grade dos 49 cursos (1.536 disciplinas: 5 por semestre na graduação com 80 h, 4 na pós com 40 h, estágios e internatos com 160 h). O número de semestres da grade é a duração do curso em meses dividida por 6.

- Uma disciplina do Nº semestre da grade só pode ser cursada a partir do Nº semestre da matrícula (no semestre dela ou depois, por exemplo para refazer após reprovação).
- Ao matricular (cadastro, renovação ou troca de curso) e a cada semestre novo, as disciplinas do semestre entram sozinhas como "cursando".
- Quando o semestre vira, o que estava "cursando" passa a "aprovado". Só o administrador marca reprovado (ou aprovado), em **Usuários → editar → Disciplinas**, onde também inclui e remove disciplinas.
- Matrícula trancada congela as disciplinas: nada é aprovado nem incluído. Ao reativar, o que estava em curso continua no semestre atual.

Não há agendador: a virada de semestre é aplicada por `sync_subject_enrollments` no início de cada operação da função `admin-users` e por `sync_my_subjects` quando o aluno abre o app ou a tela. Matrículas que já existem recebem as disciplinas do semestre atual na primeira sincronização. Na tela do aluno, as disciplinas ficam em cache como a carteirinha e se atualizam pelo Realtime quando o administrador muda algo.

Depois de aplicar as duas migrations, republique a função `admin-users`.

## Notificações

O sino no cabeçalho abre a lista de notificações, com "Marcar como lida" em cada uma e "Marcar todas como lidas". As notificações são de demonstração (`src/services/notifications.ts`) e não vêm do servidor. A cada login a lista é sorteada: de 3 a 8 notificações, das quais de nenhuma a 3 não lidas (às vezes tudo já aparece lido). Ainda no login, há 1 chance em 500 (`CHANCE`) de chegar uma notificação nova sobre o curso, o semestre ou uma disciplina em curso da matrícula. A lista fica no `localStorage` do usuário, então recarregar a página não muda nada; o logout a apaga e o próximo login sorteia outra.

## Secretaria

A tela Secretaria (`#/secretaria`) é uma demonstração: os pedidos não são enviados nem gravados e somem ao recarregar a página.

## Carteirinha

A carteirinha (`#/carteirinha`) fica guardada no `localStorage` do navegador (`src/lib/local-cache.ts`), com a foto embutida como data URL, então abrir a tela não consulta o banco. Tudo roda no navegador, o que funciona no GitHub Pages:

- A primeira abertura consulta o banco e guarda a carteirinha por até 24 horas.
- Enquanto o app está aberto, em qualquer tela, o Supabase Realtime avisa quando o perfil ou a matrícula do aluno mudam, e a carteirinha é refeita sozinha (`studentCardService.watch`, ligado no `AuthProvider`). A foto só é baixada de novo se o arquivo mudar.
- Ao abrir o app ou reconectar, a carteirinha guardada é conferida uma vez em segundo plano, para pegar mudanças feitas enquanto o app estava fechado.
- O cache é apagado no logout (nesta ou em outra aba) ou quando a sessão expira, junto com a sessão do Supabase, que fica no mesmo `localStorage`.

Para o Realtime funcionar, aplique `20261030130000_realtime_student_card.sql` no SQL Editor. Ela publica `profiles` e `enrollments` no Realtime; cada aluno só recebe eventos das próprias linhas, pela RLS. Sem ela, a carteirinha continua sendo conferida ao abrir o app.

## Feed da tela inicial

A tela inicial mostra um feed de notícias personalizado pela área do curso do aluno, lido de fontes RSS/Atom. Os sites não liberam CORS para o navegador, então a leitura passa pela Edge Function `supabase/functions/feed`, que exige usuário autenticado, descobre o curso pela matrícula mais recente de quem chama (com o token do próprio aluno, sob RLS), junta as fontes da área, extrai título, resumo, imagem e data, e guarda cada fonte em memória por 10 minutos. Uma fonte fora do ar não derruba o feed: ela só aparece num aviso.

Cada artigo cai em uma de três categorias, que viram os filtros da tela:

- **Área do curso** (ex.: Tecnologia da Informação): notícias das fontes da área.
- **Estudo e carreira**: fontes de estudo da área (hoje só TI tem: Alura e DEV Community) e notícias de ensino superior que citam a área (palavras-chave da área).
- **Ensino superior**: g1 Educação, Agência Brasil Educação e Jornal da USP, para todos os alunos.

As áreas são TI, Gestão e Negócios, Comunicação e Design, Saúde, Psicologia, Direito, Engenharia e Arquitetura, Educação, Gastronomia e Relações Internacionais. Sem matrícula, ou com um curso fora do mapa, o aluno vê só ensino superior.

No navegador, o último feed fica no `localStorage` (`src/services/feed.ts`) para a tela inicial não mostrar "Carregando…" a cada visita: até 10 minutos ele é usado sem chamar a função; depois aparece na hora e é atualizado em segundo plano; com mais de 1 hora é descartado. O botão **Atualizar** busca na hora, e uma falha ao atualizar mantém os artigos já na tela. O cache é apagado no logout.

O feed não grava nada no Supabase: não há tabela nem migration. Fontes, cursos de cada área e palavras-chave ficam em `areas` e `educationSources` no próprio `index.ts`; ao criar um curso novo em `public.courses`, inclua o código dele na área certa e republique a função.

Publique a função com **Verify JWT** desativado (a própria função valida o token):

```sh
supabase functions deploy feed --no-verify-jwt --project-ref SEU_PROJECT_REF
```

## Versão e tela Sistema

Administradores também veem **Sistema** (`#/system`): versão, data do build, commit, status e latência do Supabase, sessão, dependências e navegador.

A versão segue `MAJOR.MINOR.PATCH`. No deploy, `MAJOR.MINOR` vêm do `version` do `package.json` e `PATCH` é o número da execução do workflow, então cada publicação recebe uma versão nova sem passo manual (`0.0.12`, `0.0.13`…). Para subir MAJOR ou MINOR, altere o `package.json` (por exemplo, `1.2.0` gera `1.2.<execução>`). Localmente a tela mostra a versão do `package.json` como está.

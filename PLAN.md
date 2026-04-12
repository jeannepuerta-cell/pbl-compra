# PBL Compra — Plano de Execucao

## Fase 0: Setup Inicial
- [x] Ler SPEC.md e .env.local
- [x] Criar projeto Next.js 14 com App Router + TypeScript + Tailwind
- [x] Instalar dependencias (@supabase/supabase-js, @supabase/ssr, zod, recharts)
- [x] Garantir .env.local no .gitignore
- [x] Criar PLAN.md

## Fase 1: Banco de Dados (Supabase)
- [ ] Criar tabelas: profiles, operacoes, liquidacoes, campanhas, configuracoes
- [ ] Configurar RLS policies
- [ ] Criar usuarios no Supabase Auth e popular profiles
- [ ] Inserir dados iniciais em configuracoes

## Fase 2: Core Libraries
- [ ] lib/supabase/client.ts (browser client)
- [ ] lib/supabase/server.ts (server client)
- [ ] lib/types.ts (TypeScript types)
- [ ] lib/comissoes.ts (formulas de calculo)

## Fase 3: Autenticacao
- [ ] app/login/page.tsx
- [ ] middleware.ts (protecao de rotas)
- [ ] API para troca de senha
- [ ] API para reset de senha (admin)

## Fase 4: Layout & UI
- [ ] components/layout/Sidebar.tsx
- [ ] components/layout/Topbar.tsx
- [ ] components/ui/MetricCard.tsx
- [ ] components/ui/ProgressBar.tsx
- [ ] components/ui/BarChart.tsx
- [ ] components/ui/PersonCard.tsx

## Fase 5: Paginas
- [ ] Dashboard (metricas, graficos, barras de progresso)
- [ ] Lancamentos (formulario, preview comissao, tabela, CSV import)
- [ ] Comissoes (4 abas: Individual, Equipe, Liquidacao, Gestora)
- [ ] Colaboradores (tabela editavel por setor)
- [ ] Usuarios (lista + reset senha)
- [ ] Relatorios (tabela consolidada + grafico)
- [ ] Campanhas (CRUD campanhas)

## Fase 6: QA
- [ ] npm run build sem erros
- [ ] Correcoes de TypeScript/lint

## Fase 7: Deploy
- [ ] Criar repositorio GitHub
- [ ] Push do codigo
- [ ] Criar projeto Vercel + env vars
- [ ] Deploy producao
- [ ] Gerar RESUMO.md

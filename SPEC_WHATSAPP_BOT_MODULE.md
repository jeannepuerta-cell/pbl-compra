# SPEC — Módulo de Atendimento WhatsApp com IA

**Projeto:** Extensão do sistema PBL existente
**Stack:** Next.js + TypeScript + Tailwind CSS + Supabase + Vercel
**Integrações externas:** n8n (webhook + envio), OpenAI Conversations API, WhatsApp API não-oficial (Evolution/WPPConnect — abstraída via n8n)
**Formato:** Multi-agente para Claude Code (1 orquestrador + N agentes especialistas)

---

## 1. Contexto e objetivo

O sistema PBL já existe e está rodando (Next.js + Supabase + Vercel + GitHub, credenciais já configuradas em `.env.local`). Esta spec descreve um **módulo adicional** a ser anexado ao sistema: um **atendimento inteligente via WhatsApp** com bot de IA, modo treinamento com human-in-the-loop, e painel interno tipo "WhatsApp Web clonado".

A empresa atua com **compras e processos judiciais** — domínio sensível. O bot precisa ser cauteloso, por isso o modo treinamento é obrigatório nas primeiras semanas antes de ir pra produção automática.

### Princípios arquiteturais

- **Desacoplamento total da camada de envio:** a aplicação **nunca** envia mensagens pro WhatsApp diretamente. Ela expõe respostas via API, e o n8n consome e envia. Isso permite trocar de API não-oficial pra Cloud API oficial no futuro sem refatoração.
- **Orquestrador agnóstico de canal:** a Edge Function que conversa com a OpenAI não sabe se é WhatsApp, Instagram ou web. Recebe texto, devolve texto.
- **Multi-prompt com versionamento:** vários bots podem coexistir, cada um com seu system prompt versionado.
- **Human-in-the-loop com feedback estruturado:** no modo treinamento, cada correção humana vira dado pra evolução do prompt.

---

## 2. Escopo do módulo

### 2.1. Módulos do sistema (tela de seleção pós-login)

Após login, usuário vê uma **tela de seleção de módulos** mostrando apenas os módulos aos quais tem acesso:

- **Módulo Comissão de Vendas** (já existe ou será criado à parte)
- **Módulo Administrativo** (já existe ou será criado à parte)
- **Módulo Atendimento WhatsApp** ← foco desta spec

Se o usuário tiver acesso a apenas um módulo, redireciona direto. Se tiver múltiplos, mostra a tela de seleção.

### 2.2. Sistema de permissões (role-based)

Implementar via tabela de roles no Supabase com RLS. Roles relevantes:

- `admin` — acesso total
- `atendente_whatsapp` — acesso ao módulo de atendimento WhatsApp
- `comissao` — acesso ao módulo de comissão
- (outras roles conforme o sistema existente)

**O botão/card do módulo WhatsApp só aparece na tela de seleção se o usuário tiver a role `atendente_whatsapp` ou `admin`.** O agente de permissões deve verificar como o sistema atual já trata auth e estender sem quebrar nada.

### 2.3. Módulo Atendimento WhatsApp — funcionalidades

1. **Inbox estilo WhatsApp Web** — clone visual fiel do WhatsApp Web com adaptações
2. **Gestão de bots e prompts** (CRUD, versionamento, toggle liga/desliga, modo treinamento/produção)
3. **Modo treinamento** com card de sugestão da IA, aprovação/edição/refinamento por instrução
4. **Gestão de clientes e conversas** (embrião do futuro CRM)
5. **Rotina manual de análise e evolução de prompt** (gera relatório e sugere nova versão)
6. **Escalação automática por palavras-chave** (bypass do bot pra temas sensíveis)

---

## 3. Modelo de dados (Supabase)

Todas as tabelas com RLS habilitado. Schema: `public` (ou schema dedicado `whatsapp` se preferir isolar — o agente de banco decide baseado no padrão existente).

### 3.1. `prompts`
Armazena os system prompts versionados.

- `id` uuid PK
- `nome` text — identificador humano ("Atendimento Geral v1")
- `tipo` enum: `atendimento`, `refinamento`, `analise_divergencia`, `reescrita_prompt`
- `system_prompt` text
- `modelo` text — ex: `gpt-4o`, `gpt-4o-mini`
- `temperatura` float default 0.3
- `versao` int — incrementa a cada nova versão do mesmo nome
- `ativo` boolean — só uma versão ativa por nome
- `guard_rails` jsonb — regras estruturadas (ver seção 6)
- `created_at`, `updated_at`

### 3.2. `bots_config`
Configuração dos bots (pode existir 1 ou N).

- `id` uuid PK
- `nome` text
- `prompt_atendimento_id` uuid FK → prompts
- `prompt_refinamento_id` uuid FK → prompts
- `ativo` boolean — liga/desliga o bot
- `modo` enum: `treinamento`, `producao`
- `grupo_whatsapp_id` text — JID do grupo de fallback
- `mensagem_boas_vindas` text — a primeira resposta automática
- `palavras_escalacao` text[] — gatilhos de bypass automático
- `created_at`, `updated_at`

### 3.3. `clientes`
- `id` uuid PK
- `telefone` text unique
- `nome` text nullable
- `metadata` jsonb
- `created_at`, `updated_at`

### 3.4. `conversas`
Agrupa mensagens por cliente + canal. Também guarda o `openai_conversation_id` da Conversations API.

- `id` uuid PK
- `cliente_id` uuid FK
- `bot_id` uuid FK → bots_config
- `canal` text default `whatsapp`
- `openai_conversation_id` text — ID retornado pela Conversations API no primeiro turno, reutilizado nos próximos
- `status` enum: `ativa`, `arquivada`, `escalada`
- `boas_vindas_enviada` boolean default false
- `ultima_mensagem_at` timestamptz
- `created_at`, `updated_at`

### 3.5. `mensagens`
Uma row por mensagem, rows separadas por direção.

- `id` uuid PK
- `conversa_id` uuid FK
- `direcao` enum: `in`, `out`
- `autor` enum: `cliente`, `ia`, `humano`, `sistema`
- `conteudo` text — o que foi efetivamente dito/enviado
- `resposta_sugerida_ia` text nullable — só em rows `out` em modo treinamento; a sugestão original antes de qualquer edição
- `instrucao_refinamento` text nullable — instrução em linguagem natural dada pelo humano ao prompt de refinamento
- `aprovada_por` uuid FK → users nullable
- `modo_no_momento` enum: `treinamento`, `producao` — snapshot do modo quando a mensagem foi processada
- `prompt_id_usado` uuid FK → prompts nullable
- `metadata` jsonb — anexos, IDs do WhatsApp, etc.
- `created_at` timestamptz

**Índices:** `(conversa_id, created_at DESC)`, `(conversa_id, direcao)`.

### 3.6. `prompt_relatorios`
Relatórios gerados pela rotina manual de análise.

- `id` uuid PK
- `prompt_analisado_id` uuid FK → prompts
- `periodo_inicio`, `periodo_fim` timestamptz
- `divergencias_analisadas` int
- `analise_texto` text — output do prompt `analise_divergencia`
- `prompt_sugerido` text nullable — output do prompt `reescrita_prompt`
- `aprovado` boolean default false
- `criado_por` uuid FK → users
- `created_at`

### 3.7. `user_roles` (se não existir)
- `user_id` uuid FK → auth.users
- `role` text — `admin`, `atendente_whatsapp`, `comissao`, etc.
- PK composta (user_id, role)

**RLS:** o agente de banco deve inspecionar o padrão de RLS já existente no sistema e manter consistência. Regras mínimas: só `admin` e `atendente_whatsapp` leem/escrevem nas tabelas de WhatsApp.

---

## 4. Arquitetura de fluxo

### 4.1. Fluxo de mensagem recebida (cliente → sistema)

```
Cliente envia msg no WhatsApp
  ↓
API não-oficial captura
  ↓
n8n webhook recebe
  ↓
n8n identifica/cadastra cliente no Supabase
  ↓
n8n chama Edge Function `orchestrator` com { telefone, mensagem, bot_id }
  ↓
Edge Function:
  - verifica bots_config.ativo (se off → retorna null)
  - verifica palavras_escalacao (se match → retorna { escalar: true })
  - busca/cria conversa e openai_conversation_id
  - se primeira mensagem e !boas_vindas_enviada → retorna { texto: mensagem_boas_vindas, tipo: 'boas_vindas' }
  - chama OpenAI Conversations API com o prompt ativo
  - salva mensagem `in` e mensagem `out` (com resposta_sugerida_ia preenchida)
  - se modo = treinamento → retorna { texto: null, sugestao: <resp>, aguardando_humano: true }
  - se modo = producao → retorna { texto: <resp>, tipo: 'resposta_ia' }
  ↓
n8n recebe retorno:
  - se texto != null → envia pelo endpoint de envio
  - se aguardando_humano → notifica grupo WhatsApp (pergunta + link wa.me + sugestão)
  - se escalar → notifica grupo WhatsApp como escalação
```

### 4.2. Fluxo de aprovação no painel interno (treinamento)

```
Atendente abre o clone do WhatsApp
  ↓
Vê conversa com card de sugestão da IA
  ↓
Escolhe uma ação:
  [Aprovar] → marca mensagem como aprovada, dispara POST /api/send
  [Editar]  → edita texto, salva como conteudo final, dispara POST /api/send
  [Refinar] → digita instrução, chama Edge Function `refine`
              que usa prompt_refinamento_id + { pergunta, sugestao, instrucao }
              retorna nova sugestão → atendente decide de novo
  ↓
POST /api/send → endpoint interno que repassa pro n8n (webhook de envio)
  ↓
n8n envia via API do WhatsApp
  ↓
Mensagem registrada em `mensagens` com autor=humano ou ia aprovada, modo_no_momento=treinamento
```

### 4.3. Endpoints

**Edge Functions (Supabase):**
- `POST /functions/v1/orchestrator` — recebe mensagem, retorna texto ou sugestão
- `POST /functions/v1/refine` — recebe pergunta + sugestão + instrução, retorna nova sugestão
- `POST /functions/v1/analyze-prompt` — rotina manual de análise (gera relatório)
- `POST /functions/v1/rewrite-prompt` — rotina manual de reescrita (gera nova versão sugerida)

**API Routes (Next.js, internas ao app):**
- `POST /api/send` — recebe { conversa_id, conteudo, autor } do frontend, valida permissão, registra em `mensagens`, repassa pro webhook de envio do n8n
- `GET /api/conversas` — lista conversas
- `GET /api/conversas/[id]/mensagens` — timeline da conversa
- `POST /api/prompts/*` — CRUD de prompts
- `POST /api/bots-config/*` — CRUD de configuração

**Importante:** o orquestrador **nunca** envia mensagens. Envio é responsabilidade exclusiva do n8n via `/api/send` → webhook n8n.

---

## 5. OpenAI Conversations API

Usar **Conversations API** (não Responses). Fluxo:

1. Primeira mensagem de um cliente: criar conversation com `POST /v1/conversations`, salvar ID em `conversas.openai_conversation_id`.
2. Mensagens seguintes: reutilizar o mesmo `conversation_id`, só acrescentar o turno novo.
3. System prompt vem de `prompts` onde `tipo = 'atendimento'` e `ativo = true` pro bot em questão.
4. Guard rails são injetados no system prompt como seção estruturada.

Modelo recomendado: `gpt-4o-mini` pra custo; `gpt-4o` se qualidade for crítica. Deixar configurável em `bots_config` ou direto no `prompts.modelo`.

---

## 6. Guard rails (jsonb em `prompts.guard_rails`)

Estrutura sugerida:

```json
{
  "nunca_prometer": ["prazos específicos", "valores exatos sem consulta"],
  "sempre_escalar_se": ["cliente menciona advogado", "cliente pede cancelamento formal"],
  "tom": "formal mas acolhedor",
  "proibido_mencionar": ["concorrentes", "casos de outros clientes"]
}
```

O agente de prompts monta esses campos como instruções no final do system prompt.

---

## 7. Rotina manual de evolução de prompt

Acionada por botão no painel admin. Fluxo:

1. Admin escolhe bot + período (ex: últimos 14 dias)
2. Frontend chama `POST /functions/v1/analyze-prompt` com `{ bot_id, periodo_inicio, periodo_fim }`
3. Edge Function busca todas as mensagens `out` do período onde `resposta_sugerida_ia != conteudo` OU onde houve `instrucao_refinamento`
4. Monta payload estruturado com os trios `{pergunta, sugestao, resposta_final, instrucao_se_houver}`
5. Chama OpenAI com o prompt `tipo = 'analise_divergencia'` — retorna texto analítico apontando padrões
6. Salva em `prompt_relatorios.analise_texto`
7. Admin lê o relatório e clica "Sugerir nova versão do prompt"
8. Frontend chama `POST /functions/v1/rewrite-prompt` com `{ relatorio_id }`
9. Edge Function usa prompt `tipo = 'reescrita_prompt'` + analise + prompt atual → retorna novo system prompt
10. Salva em `prompt_relatorios.prompt_sugerido`
11. Admin aprova → cria nova row em `prompts` com versão incrementada, marca a anterior como `ativo=false`

**Essa rotina nunca é automática.** Sempre manual, sempre com aprovação explícita.

---

## 8. UI — Clone do WhatsApp Web

**Objetivo visual:** clone fiel do WhatsApp Web (https://web.whatsapp.com) com adaptações mínimas pras funcionalidades extras.

### Layout
- **Sidebar esquerda (30%):** lista de conversas, foto/inicial do cliente, última mensagem, hora, badge de não lidas. Busca no topo.
- **Área principal direita (70%):** header com nome/telefone do cliente, timeline de mensagens (bubbles estilo WhatsApp — verde claro pra enviadas, branco pra recebidas), input no rodapé.

### Adaptações específicas
- **Badge de modo:** no header da conversa, indicador "MODO TREINAMENTO" quando aplicável (cor chamativa)
- **Card de sugestão da IA:** aparece acima do input quando há uma sugestão pendente em modo treinamento. Layout:
  - Título: "Sugestão da IA"
  - Texto da sugestão em destaque
  - 3 botões: `Aprovar e enviar` / `Editar` / `Refinar com instrução`
  - Ao clicar em "Refinar": abre campo de texto pra instrução em linguagem natural, botão "Gerar nova versão"
  - Após refinar, substitui o card pela nova sugestão (mantém histórico de refinamentos colapsável)
- **Indicador de autor na bubble:** pequeno selo "IA" ou "Humano" nas mensagens enviadas (só visível internamente, não vai pro cliente)
- **Escalação:** conversas escaladas ficam com marcador visual destacado na sidebar

### Tecnologia
- Next.js App Router
- Tailwind CSS (seguir tokens do sistema existente — o agente de frontend deve ler o `tailwind.config` atual)
- Supabase Realtime pra atualização ao vivo de mensagens novas
- Componentes Radix/shadcn se já estiver no projeto; caso contrário, apenas Tailwind puro

---

## 9. Arquitetura multi-agente pro Claude Code

**Orquestrador Mestre:** lê esta spec, delega por fases, valida entregas, mantém contexto entre agentes, roda testes de integração entre camadas.

### Agentes especialistas

1. **Agente de Contexto do Sistema Existente**
   Inspeciona o repo atual (estrutura de pastas, auth, padrões de código, Tailwind config, schema Supabase existente) e produz um `CONTEXT.md` que todos os outros agentes consultam. Primeira execução obrigatória.

2. **Agente de Banco de Dados**
   Cria migrations do Supabase (tabelas 3.1 a 3.7), RLS, índices, seeds iniciais (bot de exemplo, prompts base). Segue o padrão de migrations já usado no projeto.

3. **Agente de Permissões e Auth**
   Estende o sistema de auth existente pra suportar roles. Cria middleware/helpers pra proteger rotas. Garante que o botão do módulo WhatsApp só aparece pra quem tem role.

4. **Agente de Edge Functions (Orquestrador de Bot)**
   Cria as 4 Edge Functions: `orchestrator`, `refine`, `analyze-prompt`, `rewrite-prompt`. Integra Conversations API da OpenAI. Gerencia `openai_conversation_id` por conversa. Responsável por nunca enviar mensagens — só retornar texto.

5. **Agente de API Routes Internas**
   Implementa `/api/send`, `/api/conversas/*`, `/api/prompts/*`, `/api/bots-config/*`. Valida permissões em todas as rotas. `/api/send` faz o repasse pro webhook do n8n (URL vem de env var).

6. **Agente de Frontend — Tela de Seleção de Módulos**
   Pós-login, renderiza cards só dos módulos permitidos. Redirect automático se só tem 1 módulo.

7. **Agente de Frontend — Clone WhatsApp Web**
   Constrói a UI descrita na seção 8. Usa Supabase Realtime. Pixel-perfect com WhatsApp Web como referência.

8. **Agente de Frontend — Admin de Prompts e Bots**
   Painel CRUD pra prompts (com versionamento visível), bots_config, guard rails (editor jsonb amigável), botão de rotina de análise, visualização de relatórios.

9. **Agente de Integração n8n**
   Produz documentação dos contratos: o que o n8n deve mandar pro `orchestrator`, o que recebe de volta, como chamar `/api/send`, como notificar grupo WhatsApp. Entrega em `docs/N8N_CONTRACT.md` com exemplos de payload JSON.

10. **Agente de QA e Testes**
    Escreve testes de integração das Edge Functions, testa RLS (tentar acessar dados sem permissão), valida que o orquestrador nunca envia mensagens, valida fluxo de modo treinamento → produção.

### Ordem de execução recomendada

1. Contexto → 2. Banco → 3. Permissões → 4. Edge Functions → 5. API Routes → 9. Contratos n8n (docs) → 6. Tela seleção → 7. Clone WhatsApp → 8. Admin prompts → 10. QA

---

## 10. Variáveis de ambiente adicionais

Anexar ao `.env.local` existente:

```
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=gpt-4o-mini
N8N_SEND_WEBHOOK_URL=
N8N_GROUP_NOTIFY_WEBHOOK_URL=
WHATSAPP_FALLBACK_GROUP_ID=
```

---

## 11. Fora de escopo (explícito)

- Envio direto de mensagens pelo backend Next.js (sempre via n8n)
- Integração com Cloud API oficial do WhatsApp (futuro)
- Fine-tuning de modelo (a evolução é por reescrita de system prompt)
- CRM completo (esta spec é embrião — estrutura de dados já permite evolução)
- Rotina automática de reescrita de prompt (sempre manual, com aprovação)

---

## 12. Critérios de aceitação

- [ ] Usuário sem role `atendente_whatsapp` não vê o módulo nem acessa as rotas
- [ ] Bot desligado (`ativo=false`) não gera chamadas à OpenAI
- [ ] Modo treinamento nunca envia resposta da IA automaticamente pro cliente
- [ ] Modo produção envia diretamente via n8n
- [ ] `openai_conversation_id` é criado uma vez e reutilizado nos turnos seguintes
- [ ] Mensagens sempre registradas em `mensagens` com `modo_no_momento` correto
- [ ] Refinamento por instrução funciona e mantém histórico
- [ ] Rotina manual de análise gera relatório textual legível
- [ ] Rotina manual de reescrita gera nova versão do prompt (não ativa automaticamente)
- [ ] Clone visual do WhatsApp Web é fiel ao original
- [ ] Palavras de escalação fazem bypass do bot e notificam grupo
- [ ] Nenhum endpoint da aplicação envia mensagem direto — sempre via n8n

---

**Fim da spec.** Claude Code deve começar pelo Agente de Contexto e seguir a ordem da seção 9.

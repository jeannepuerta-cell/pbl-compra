# PBL Compra — Especificação Técnica
## Sistema de Comissionamento — Geração de Negócios

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) |
| Estilização | Tailwind CSS |
| Backend | Next.js API Routes (serverless) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Hospedagem | Vercel |

---

## Identidade Visual

| Token | Valor |
|-------|-------|
| Verde principal | `#01423e` |
| Verde escuro | `#002e2b` |
| Verde claro | `#e6f0ef` |
| Dourado principal | `#c39152` |
| Dourado claro | `#f9f3ea` |
| Dourado escuro | `#9a6e35` |

Logo: PBL Compra — fundo verde escuro, símbolo dourado, letras brancas.

---

## Perfis de Acesso

### Gestora (admin)
- Login: `jeanne` / Senha inicial: `anne`
- Acesso total ao sistema
- Únicas telas exclusivas: Lançamentos, Colaboradores, Usuários, Campanhas, Painel da Gestora

### Equipe Jurídica (user)
| Login | Nome | Senha inicial |
|-------|------|---------------|
| daniel | Daniel | niel |
| fernanda | Fernanda | anda |
| luizfernando | Luiz Fernando | ando |
| luizhenrique | Luiz Henrique | ique |
| nataly | Nataly | taly |
| nicolli | Nicolli | olli |
| tarciane | Tarciane | iane |
| tatiana | Tatiana | iana |

### Equipe Comercial (user)
| Login | Nome | Senha inicial |
|-------|------|---------------|
| andressa | Andressa | essa |
| barbara | Bárbara | bara |
| gabriella | Gabriella | ella |
| hilary | Hilary | lary |
| vitor | Vitor | itor |

---

## Banco de Dados — Supabase

### Tabela: `users` (extensão de auth.users)

```sql
create table public.profiles (
  id uuid references auth.users primary key,
  login text unique not null,
  name text not null,
  cargo text,
  setor text not null, -- 'juridico' | 'comercial' | 'gestor'
  role text not null default 'user', -- 'admin' | 'user'
  initials text,
  salario numeric default 0,
  created_at timestamptz default now()
);
```

### Tabela: `operacoes`

```sql
create table public.operacoes (
  id bigserial primary key,
  tipo text not null, -- 'processo' | 'precatorio' | 'comercial'
  responsavel text not null references profiles(login),
  numero text,
  creditos integer default 1,
  valor numeric default 0,
  comissao numeric default 0,
  data date not null,
  created_at timestamptz default now()
);

-- RLS: admin vê tudo, user vê só as próprias
alter table operacoes enable row level security;

create policy "admin vê tudo" on operacoes
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "user vê as próprias" on operacoes
  for select using (
    responsavel = (select login from profiles where id = auth.uid())
  );

create policy "apenas admin insere" on operacoes
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "apenas admin deleta" on operacoes
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
```

### Tabela: `liquidacoes`

```sql
create table public.liquidacoes (
  id bigserial primary key,
  mes text not null, -- formato 'YYYY-MM'
  total_proc integer not null,
  pool numeric not null,
  vpp numeric not null, -- valor por processo = pool / total_proc
  por_pessoa jsonb default '{}', -- { "daniel": 487.74, "fernanda": 665.80, ... }
  created_at timestamptz default now()
);
```

### Tabela: `campanhas`

```sql
create table public.campanhas (
  id bigserial primary key,
  nome text not null,
  objetivo text,
  premio numeric default 500,
  equipe text default 'todos', -- 'todos' | 'juridico' | 'comercial'
  atingido boolean default false,
  created_at timestamptz default now()
);
```

### Tabela: `configuracoes`

```sql
create table public.configuracoes (
  chave text primary key,
  valor jsonb not null
);

-- Valores iniciais
insert into configuracoes values
  ('metas', '{"meta": 0, "supermeta": 0}'),
  ('campanhas_semana', '[
    {"id": 1, "nome": "Semana 1", "atingido": false},
    {"id": 2, "nome": "Semana 2", "atingido": false},
    {"id": 3, "nome": "Semana 3", "atingido": false},
    {"id": 4, "nome": "Semana 4", "atingido": false}
  ]');
```

---

## Regras de Negócio — Comissionamento

### Equipe Jurídica

#### 1. Processo inserido
```
comissao += R$ 0,50 por processo
```

#### 2. Créditos comprados
```
comissao += creditos × R$ 20,00
```

#### 3. Bônus por valor alto
```
se valor_operacao > R$ 20.000:
  comissao += 2 × R$ 20,00  (= +R$ 40,00)
```

#### 4. Bônus de volume mensal
```
se volume_total_pessoa >= R$ 400.000:
  bonus = floor(volume_total / 100.000) × R$ 100,00
  (sem limite máximo)
  
Exemplos:
  R$ 400k → R$ 400,00
  R$ 500k → R$ 500,00
  R$ 850k → R$ 800,00
```

#### 5. Liquidação mensal (proporcional)
```
valor_por_processo = pool_total / total_processos_liquidados_empresa

comissao_liquidacao_pessoa = 
  processos_liquidados_pela_pessoa × valor_por_processo

Referência março/2026: R$ 2.880 ÷ 256 processos = R$ 11,25/processo
```

> ⚠️ A comissão de liquidação é distribuída para TODOS os jurídicos
> independente de quem fechou o processo. É uma política da empresa
> (CLT) e não deve ser alterada.

---

### Nicolli (Jurídico + Precatório)

Além de todas as regras do jurídico, recebe também:

#### Precatórios
```
comissao += creditos_disponiveis × R$ 20,00
```
Mesma regra de bônus por valor acima de R$ 20k aplica.
Mesmo objetivo de volume de R$ 400k, calculado separadamente
(só pelos processos que ela inseriu e negociou).

---

### Equipe Comercial

#### 1. Créditos comprados
```
comissao += creditos × R$ 20,00
```

#### 2. Bônus por valor alto
```
se valor_operacao > R$ 20.000:
  comissao += 2 × R$ 20,00  (= +R$ 40,00)
```

#### 3. Bônus de volume mensal
```
(mesma regra do jurídico — acima de R$ 400k)
```

---

### Gestora (Jeanne)

| Situação | Valor |
|----------|-------|
| Mínimo garantido | R$ 10.000 |
| Meta atingida | R$ 12.000 |
| Super meta atingida | R$ 14.000 |
| Por campanha semanal atingida | +R$ 500 (máx 4 = +R$ 2.000) |

Meta e super meta são definidas mensalmente pela CEO.
Valores de meta e super meta variam todo mês.

---

## Fórmula de Comissão — Pseudocódigo

```typescript
function calcularComissao(tipo: string, creditos: number, valor: number): number {
  const bonus = valor > 20000 ? 2 : 0
  
  if (tipo === 'processo') {
    return 0.50 + (creditos + bonus) * 20
  }
  
  // precatorio ou comercial
  return (creditos + bonus) * 20
}

function calcularBonusVolume(volumeTotal: number): number {
  if (volumeTotal < 400000) return 0
  return Math.floor(volumeTotal / 100000) * 100
}

function calcularLiquidacaoPessoa(
  processosLiquidadosPessoa: number,
  totalProcessosEmpresa: number,
  poolTotal: number
): number {
  const valorPorProcesso = poolTotal / totalProcessosEmpresa
  return processosLiquidadosPessoa * valorPorProcesso
}

function calcularTotalPessoa(uid: string): PessoaStats {
  const ops = operacoes.filter(o => o.responsavel === uid)
  const volumeTotal = ops.reduce((s, o) => s + o.valor, 0)
  const comBase = ops.reduce((s, o) => s + o.comissao, 0)
  const bonus = calcularBonusVolume(volumeTotal)
  const liq = setor === 'juridico' ? calcularLiquidacaoPessoa(...) : 0
  const salario = profile.salario
  
  return {
    volumeTotal,
    comBase,
    bonus,
    liq,
    salario,
    totalComissao: comBase + bonus + liq,
    totalBruto: comBase + bonus + liq + salario
  }
}
```

---

## Telas do Sistema

### 1. Login
- Seleção de usuário (dropdown agrupado por setor)
- Campo de senha
- Erro inline se senha incorreta
- Redireciona para Dashboard após login

### 2. Dashboard
- Métricas: volume total, comissões totais, folha salarial, total a pagar
- Gráfico de barras: volume por colaborador (verde = jurídico, dourado = comercial)
- Gráfico de barras: comissões por setor
- Barras de progresso de meta (R$ 400k) por pessoa

### 3. Lançamentos *(admin only)*
- Formulário com 3 tipos: Processo Jurídico / Precatório / Comercial
- Preview de comissão em tempo real antes de registrar
- Tabela de operações registradas com possibilidade de excluir
- Importação via CSV (formato: data, tipo, login, numero, creditos, valor)

### 4. Comissões
- **Aba Individual:** card por pessoa com breakdown completo
  - Volume, comissão base, bônus volume, liquidação (jurídico)
  - Salário base + total a receber
  - Barra de progresso meta
  - Filtro por colaborador (admin) ou apenas próprios dados (user)
- **Aba Por equipe:** tabela comparativa jurídico vs comercial
- **Aba Liquidação jurídica:** *(admin only)*
  - Formulário: mês, total processos empresa, pool R$
  - Inputs individuais por jurídico
  - Cálculo automático proporcional
  - Histórico de liquidações
- **Aba Painel da gestora:** *(admin only)*
  - Metas do mês (meta / super meta)
  - Campanhas semanais (4 × R$ 500)
  - Comissão projetada

### 5. Colaboradores *(admin only)*
- Tabela por setor (jurídico e comercial separados)
- Campos editáveis: cargo e salário base
- Salva individualmente por colaborador

### 6. Usuários *(admin only)*
- Lista todos os colaboradores
- Botão para redefinir senha de qualquer pessoa

### 7. Relatórios
- Tabela consolidada: nome, setor, ops, volume, comissão base, bônus, liquidação, salário, total
- Linha de total geral
- Gráfico de participação percentual no volume

### 8. Campanhas *(admin only)*
- Criação de campanhas esporádicas com: nome, objetivo, prêmio, equipe alvo
- Toggle de conclusão por campanha
- Lista de campanhas ativas

---

## Funcionalidades Transversais

### Alteração de senha (todos os usuários)
- Clique no avatar/nome no header abre modal
- Campos: senha atual, nova senha, confirmação
- Validação mínima de 4 caracteres

### Redefinição de senha (admin)
- Disponível na aba Usuários
- Admin define nova senha para qualquer colaborador sem precisar da senha atual

---

## Estrutura de Pastas Sugerida (Next.js App Router)

```
pbl-compra/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # redirect para /dashboard ou /login
│   ├── login/
│   │   └── page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── lancamentos/
│   │   └── page.tsx
│   ├── comissoes/
│   │   └── page.tsx
│   ├── colaboradores/
│   │   └── page.tsx
│   ├── usuarios/
│   │   └── page.tsx
│   ├── relatorios/
│   │   └── page.tsx
│   └── campanhas/
│       └── page.tsx
├── components/
│   ├── layout/
│   │   ├── Topbar.tsx
│   │   └── Sidebar.tsx
│   ├── ui/
│   │   ├── MetricCard.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── BarChart.tsx
│   │   └── PersonCard.tsx
│   └── forms/
│       ├── FormProcesso.tsx
│       ├── FormPrecatorio.tsx
│       └── FormComercial.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── comissoes.ts                # todas as fórmulas de cálculo
│   └── types.ts                   # tipos TypeScript
├── hooks/
│   ├── useStats.ts
│   ├── useOperacoes.ts
│   └── useLiquidacoes.ts
└── middleware.ts                   # proteção de rotas autenticadas
```

---

## Variáveis de Ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Observações Importantes

1. **Liquidação de março/2026 (referência):** 256 processos liquidados, pool de R$ 2.880, valor por processo R$ 11,25
2. **A comissão de liquidação é paga a TODOS os jurídicos** independente de quem fez a venda — política CLT da empresa, não alterar
3. **Nicolli tem dois módulos separados** no sistema: jurídico (com todos os processos) e precatório (créditos disponíveis × R$ 20)
4. **O objetivo de volume de R$ 400k da Nicolli para precatórios** considera apenas os processos que ela inseriu e negociou, não o volume total da empresa
5. **Campanhas semanais da gestora** são 4 por mês, R$ 500 cada, objetivos definidos semana a semana
6. **Senhas iniciais** seguem o padrão: 4 últimas letras do primeiro nome

---

*Especificação gerada com base nas sessões de levantamento de requisitos com Jeanne — PBL Compra, abril/2026*

# PBL Compra - Resumo da Entrega

## URLs

| Recurso | URL |
|---------|-----|
| Aplicacao (Vercel) | https://app-jeanne3.vercel.app |
| Repositorio GitHub | https://github.com/jeannepuerta-cell/pbl-compra |
| Projeto Supabase | https://supabase.com/dashboard/project/mijoysppgyyibazbkmfd |

## Stack Implementada

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes (serverless)
- **Banco de dados**: Supabase (PostgreSQL) com RLS
- **Autenticacao**: Supabase Auth
- **Hospedagem**: Vercel
- **Graficos**: Recharts

## Credenciais de Acesso

Login via dropdown na pagina de login. Email gerado automaticamente como `login@pblcompra.com`.

### Gestora (admin - acesso total)
| Login | Senha |
|-------|-------|
| jeanne | anne |

### Equipe Juridica
| Login | Senha |
|-------|-------|
| daniel | niel |
| fernanda | anda |
| luizfernando | ando |
| luizhenrique | ique |
| nataly | taly |
| nicolli | olli |
| tarciane | iane |
| tatiana | iana |

### Equipe Comercial
| Login | Senha |
|-------|-------|
| andressa | essa |
| barbara | bara |
| gabriella | ella |
| hilary | lary |
| vitor | itor |

## Funcionalidades Implementadas

### Paginas
1. **Login** - Dropdown de usuario agrupado por setor + campo de senha
2. **Dashboard** - Metricas (volume, comissoes, folha, total), graficos de barras, barras de progresso por pessoa
3. **Lancamentos** (admin) - Formulario de 3 tipos, preview de comissao em tempo real, tabela de operacoes, importacao CSV
4. **Comissoes** - 4 abas:
   - Individual: cards com breakdown completo por pessoa
   - Por Equipe: tabela comparativa juridico vs comercial
   - Liquidacao Juridica (admin): formulario + calculo proporcional + historico
   - Painel da Gestora (admin): metas, campanhas semanais, projecao de comissao
5. **Colaboradores** (admin) - Tabelas por setor com edicao inline de cargo/salario
6. **Usuarios** (admin) - Lista de usuarios com botao de redefinir senha
7. **Relatorios** - Tabela consolidada + grafico de participacao no volume
8. **Campanhas** (admin) - CRUD de campanhas com toggle de conclusao

### Funcionalidades Transversais
- Alteracao de senha (todos os usuarios via avatar no header)
- Redefinicao de senha (admin na tela Usuarios)
- Protecao de rotas via middleware (redirecionamento automatico)
- RLS no Supabase (admin ve tudo, user ve apenas o proprio)

### Regras de Comissionamento
- Processo inserido: R$ 0,50
- Creditos comprados: creditos x R$ 20,00
- Bonus valor alto (> R$ 20k): +R$ 40,00
- Bonus volume mensal (>= R$ 400k): floor(volume/100k) x R$ 100
- Liquidacao juridica proporcional (pool / total processos)
- Nicolli: juridico + precatorio separado
- Gestora: base R$ 10k-14k + campanhas semanais (R$ 500 cada)

## Banco de Dados

5 tabelas criadas com RLS ativo:
- `profiles` - Perfis de usuario (extensao de auth.users)
- `operacoes` - Operacoes/lancamentos
- `liquidacoes` - Liquidacoes mensais juridicas
- `campanhas` - Campanhas esporadicas
- `configuracoes` - Metas e campanhas semanais da gestora

## Proximos Passos

1. **Dominio customizado**: Configurar dominio proprio no Vercel
2. **Backup**: Configurar backup automatico do Supabase
3. **Notificacoes**: Adicionar notificacoes por email quando atingir metas
4. **Exportacao**: Adicionar exportacao de relatorios em PDF/Excel
5. **Historico**: Adicionar filtro por mes/periodo nos relatorios
6. **Mobile**: Testar e ajustar responsividade em dispositivos moveis
7. **Logs de auditoria**: Registrar quem fez cada lancamento/alteracao

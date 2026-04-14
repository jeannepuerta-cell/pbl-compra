# Spec de desenvolvimento — Módulo de Contratos PBL Compra

> Este documento é o spec completo para o desenvolvedor implementar o módulo de geração de contratos de cessão de crédito dentro da aplicação maior da PBL Compra. Siga as instruções na ordem apresentada.

---

## 1. Contexto do negócio

A PBL Compra é uma empresa que compra créditos de processos judiciais. O fluxo operacional é:

1. Um robô capta processos judiciais e os classifica como **Ouro**, **Prata** ou **Bronze**
2. Analistas jurídicos analisam e inserem os processos no CRM (PipeDrive)
3. O time comercial negocia com o advogado/cedente a compra dos créditos
4. Após o fechamento, é gerado um **contrato de cessão de crédito** em `.docx`
5. O contrato vai para o setor de contencioso para validação e assinatura

O módulo que você vai construir cobre os passos 3 e 4: **registro do fechamento comercial** e **geração automática do contrato**.

---

## 2. Stack e integração

- **Framework:** Next.js com TypeScript
- **Estilização:** Tailwind CSS — siga o design system existente da aplicação
- **Banco de dados:** PostgreSQL (Supabase ou instância própria)
- **ORM:** Prisma
- **Geração de `.docx`:** biblioteca `docx` (npm) — mesma usada no protótipo
- **IA:** API da Anthropic (modelo `claude-sonnet-4-20250514`) — para processar o campo livre de observações e transformar em linguagem jurídica
- **Autenticação:** aproveitar o sistema de auth já existente na aplicação maior

O módulo deve ser montado como uma seção/rota da aplicação existente, não como projeto separado.

---

## 3. Rotas da aplicação

```
/contratos                     → listagem de contratos gerados
/contratos/novo                → formulário de fechamento + contrato (duas abas)
/contratos/[id]                → visualização de um contrato específico
/contratos/[id]/download       → download do .docx
/api/contratos                 → POST — salvar fechamento
/api/contratos/[id]/gerar      → POST — gerar .docx
/api/contratos/[id]/processar-obs → POST — processar observações com IA
```

---

## 4. Schema do banco de dados (PostgreSQL via Prisma)

```prisma
// schema.prisma

model Fechamento {
  id                    String    @id @default(cuid())
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  // Identificação
  numeroProcesso        String
  numeroContrato        String?
  comercialResponsavel  String
  analistaJuridico      String?
  dataFechamento        DateTime

  // Tipo de cessão
  // valores: "sucumbencia" | "honorarios" | "integral" | "personalizado"
  tipoCessao            String
  creditosPersonalizados String[]  // ["principal", "honorarios", "sucumbencia"]

  // Observações da negociação (texto livre do comercial)
  observacoesRaw        String?   // texto original digitado pelo comercial
  observacoesProcessadas String?  // texto após processamento pela IA (linguagem jurídica)

  // Valores
  valorCondenacao       Decimal?  @db.Decimal(15, 2)
  valorFechado          Decimal   @db.Decimal(15, 2)
  desagio               Decimal?  @db.Decimal(5, 2)  // percentual

  // Dados bancários (condicionais)
  incluirDadosBancarios Boolean   @default(false)
  banco                 String?
  agencia               String?
  conta                 String?
  tipoConta             String?   // "Corrente" | "Poupança"
  bancoCpf              String?

  // Dados do processo (preenchidos na aba Contrato)
  vara                  String?
  comarca               String?
  autorNome             String?
  reuNome               String?

  // Cedente 1
  c1Nome                String?
  c1Profissao           String?
  c1Nacionalidade       String?
  c1EstadoCivil         String?
  c1Nascimento          String?
  c1Cpf                 String?
  c1Rg                  String?
  c1OabUf               String?
  c1OabNumero           String?
  c1Endereco            String?
  c1Bairro              String?
  c1Cidade              String?
  c1Uf                  String?
  c1Cep                 String?

  // Cedente 2 (opcional — advogado/procurador)
  temSegundoCedente     Boolean   @default(false)
  c2Nome                String?
  c2Profissao           String?
  c2Nacionalidade       String?
  c2EstadoCivil         String?
  c2Nascimento          String?
  c2Cpf                 String?
  c2OabUf               String?
  c2OabNumero           String?
  c2Endereco            String?
  c2Bairro              String?
  c2Cidade              String?
  c2Uf                  String?
  c2Cep                 String?

  // Assinatura
  cidadeAssinatura      String?
  ufAssinatura          String?
  dataAssinatura        String?

  // Status do contrato
  // valores: "rascunho" | "gerado" | "enviado_contencioso" | "assinado"
  status                String    @default("rascunho")

  // Relacionamentos
  contratos             Contrato[]
  userId                String     // FK para o usuário da aplicação maior
}

model Contrato {
  id           String    @id @default(cuid())
  createdAt    DateTime  @default(now())
  fechamentoId String
  fechamento   Fechamento @relation(fields: [fechamentoId], references: [id])
  nomeArquivo  String
  // Se quiser armazenar o arquivo: use storage externo (S3, Supabase Storage)
  // e salve apenas a URL aqui
  urlArquivo   String?
  geradoPor    String    // userId
}
```

**Índices recomendados:**
```prisma
@@index([numeroProcesso])
@@index([status])
@@index([userId])
@@index([dataFechamento])
```

---

## 5. Lógica de negócio — tipos de cessão

O tipo de cessão determina o texto das cláusulas do contrato. Implemente esta lógica como uma função utilitária:

```typescript
// lib/contratos/objeto-cessao.ts

export type TipoCessao = 'sucumbencia' | 'honorarios' | 'integral' | 'personalizado'

export interface ObjetoCessao {
  desc: string           // "dos honorários sucumbenciais"
  curto: string          // "honorários sucumbenciais"
  englobados: string     // texto do parágrafo 2º da cláusula 3ª
  paragrafoUnico: string | null  // parágrafo único da cláusula 1ª (null = não incluir)
}

export function getObjetoCessao(
  tipo: TipoCessao,
  creditosPersonalizados: string[] = []
): ObjetoCessao {
  switch (tipo) {
    case 'sucumbencia':
      return {
        desc: 'dos honorários sucumbenciais',
        curto: 'honorários sucumbenciais',
        englobados: 'o montante dos honorários sucumbenciais',
        paragrafoUnico: null,
      }
    case 'honorarios':
      return {
        desc: 'dos honorários contratuais',
        curto: 'honorários contratuais',
        englobados: 'o montante dos honorários contratuais',
        paragrafoUnico: null,
      }
    case 'integral':
      return {
        desc: 'dos direitos creditórios disponíveis',
        curto: 'direitos creditórios disponíveis',
        englobados: 'o montante de valores principais, honorários contratuais e honorários sucumbenciais',
        paragrafoUnico: 'São objetos da presente cessão o crédito principal, os honorários contratuais e os honorários sucumbenciais.',
      }
    case 'personalizado': {
      const mapa: Record<string, string> = {
        principal: 'o crédito principal',
        honorarios: 'os honorários contratuais',
        sucumbencia: 'os honorários sucumbenciais',
      }
      const lista = creditosPersonalizados.map(c => mapa[c]).filter(Boolean)
      const txt = lista.length > 1
        ? lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1]
        : lista[0] || ''
      return {
        desc: 'dos direitos creditórios disponíveis',
        curto: 'direitos creditórios disponíveis',
        englobados: txt,
        paragrafoUnico: lista.length > 1
          ? 'São objetos da presente cessão ' + txt + '.'
          : null,
      }
    }
  }
}
```

**Regra importante:** quando `tipoCessao` é `sucumbencia` ou `honorarios`, o **cedente 1 é o advogado** — exibe o campo OAB e oculta o campo RG. Quando é `integral` ou `personalizado`, o cedente 1 é o **autor/credor** e o cedente 2 é o advogado.

---

## 6. Geração do arquivo .docx

Instale a dependência:
```bash
npm install docx
```

Implemente como uma Server Action ou API Route. A lógica completa de montagem do documento está abaixo — migre para TypeScript mantendo a estrutura:

```typescript
// lib/contratos/gerar-docx.ts

import {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, UnderlineType
} from 'docx'
import { Fechamento } from '@prisma/client'
import { getObjetoCessao } from './objeto-cessao'

const normal = (text: string, opts = {}) =>
  new TextRun({ text: String(text || ''), font: 'Arial', size: 24, ...opts })

const bold = (text: string, opts = {}) =>
  normal(text, { bold: true, ...opts })

const par = (children: TextRun[], align = AlignmentType.JUSTIFIED) =>
  new Paragraph({ children, alignment: align, spacing: { after: 160, line: 276 } })

const parRecuado = (children: TextRun[]) =>
  new Paragraph({ children, alignment: AlignmentType.JUSTIFIED, spacing: { after: 160, line: 276 }, indent: { left: 720 } })

const vazio = () =>
  new Paragraph({ children: [normal('')], spacing: { after: 120 } })

export function valorExtenso(n: number): string {
  // [manter a implementação do protótipo — converte número para texto em pt-BR]
  // Ex: 33000 → "trinta e três mil reais"
}

export function fmtValor(n: number): string {
  return 'R$ ' + Number(n).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function blocoCedente(prefixo: string, d: Fechamento, isAdv: boolean) {
  const f = (k: string) => (d as any)[prefixo + k] || ''
  return [
    par([bold('CEDENTE: '), normal(f('Nome'), { underline: { type: UnderlineType.SINGLE } })]),
    par([normal(`Profissão: ${f('Profissao')}   Nacionalidade: ${f('Nacionalidade')}   Estado Civil: ${f('EstadoCivil')}   Nascimento: ${f('Nascimento')}`)]),
    isAdv
      ? par([normal(`OAB/${f('OabUf')}: ${f('OabNumero')}   CPF: ${f('Cpf')}`)])
      : par([normal(`${f('Rg') ? 'RG: ' + f('Rg') + '   ' : ''}CPF: ${f('Cpf')}`)]),
    par([normal(`Residente: ${f('Endereco')}`)]),
    par([normal(`Bairro: ${f('Bairro')}   Cidade: ${f('Cidade')}   UF: ${f('Uf')}   CEP: ${f('Cep')}`)]),
    vazio(),
  ]
}

export async function gerarDocx(d: Fechamento): Promise<Buffer> {
  const obj = getObjetoCessao(d.tipoCessao as any, d.creditosPersonalizados)
  const plural = d.temSegundoCedente
  const cedRef = plural ? 'OS CEDENTES' : 'O CEDENTE'
  const isAdv1 = d.tipoCessao === 'sucumbencia' || d.tipoCessao === 'honorarios'
  const vFmt = fmtValor(Number(d.valorFechado))
  const vExt = valorExtenso(Number(d.valorFechado))

  // Texto das observações: usar o processado pela IA se disponível, senão o raw
  const obsTexto = d.observacoesProcessadas || d.observacoesRaw || ''

  // Dados bancários no parágrafo 2º
  const dadosBancarios = d.incluirDadosBancarios && d.banco
    ? `, Banco ${d.banco}${d.agencia ? ', Ag. ' + d.agencia : ''}${d.conta ? ', Conta ' + d.conta + ' (' + (d.tipoConta || 'Corrente') + ')' : ''}`
    : ''

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        }
      },
      children: [
        new Paragraph({
          children: [bold('CONTRATO DE CESSÃO DE CRÉDITO DE AÇÃO JUDICIAL')],
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 }
        }),
        new Paragraph({
          children: [normal('Nº ' + (d.numeroContrato || ''))],
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 }
        }),

        // Cedente(s)
        ...blocoCedente('c1', d, isAdv1),
        ...(plural ? blocoCedente('c2', d, true) : []),

        // Cessionária (dados fixos da PBL)
        par([
          bold('CESSIONÁRIA: '),
          normal('PBL - COMPRA DE CRÉDITOS JUDICIAIS LTDA'),
          normal(', pessoa jurídica de direito privado, CNPJ 27.192.535/0001-68, domiciliada na Av. Prefeito Osmar Cunha, 183, sala 701, Bloco A, Edifício Ceisa Center, Centro, Florianópolis/SC, CEP 88015-100, neste ato representada pelo seu sócio administrador, '),
          bold('PIERCARLO BLANDO'),
          normal(', brasileiro, divorciado, empresário, RG 2.786.902, CPF 000.064.779-92, domiciliado no mesmo endereço da pessoa jurídica.'),
        ]),
        vazio(),

        // Cláusula 1ª
        par([
          bold('Cláusula 1ª: '),
          normal(
            `O presente contrato tem como objeto a transferência total à CESSIONÁRIA ${obj.desc} de que ${plural ? 'são titulares os CEDENTES' : 'é titular o CEDENTE'}, vinculados ao Processo nº ${d.numeroProcesso}, em tramitação na ${d.vara} da Comarca de ${d.comarca}, que tem ${d.autorNome} como autor${plural && d.tipoCessao === 'integral' ? ', o SEGUNDO CEDENTE como Procurador do Autor' : ''} e ${d.reuNome} como Réu, tendo a CESSIONÁRIA ciência plena de seu conteúdo.`
          ),
        ]),
        ...(obj.paragrafoUnico
          ? [parRecuado([bold('Parágrafo único: '), normal(obj.paragrafoUnico)])]
          : []
        ),
        vazio(),

        // Cláusula 2ª
        par([
          bold('Cláusula 2ª: '),
          normal(
            `Os direitos creditórios disponíveis a que se refere a Cláusula 1ª correspondem ao valor total que couber ${plural ? 'aos CEDENTES' : 'ao CEDENTE'} no referido processo, incluídos correção monetária, juros, multas e pagamentos complementares até o arquivamento definitivo do processo, após o devido abatimento das obrigações legais.`
          ),
        ]),
        vazio(),

        // Cláusula 3ª
        par([
          bold('Cláusula 3ª: '),
          normal(
            `${cedRef}, pelo presente instrumento, ced${plural ? 'em' : 'e'} e transfer${plural ? 'em' : 'e'} à CESSIONÁRIA, de forma irrevogável e irretratável, a totalidade dos direitos creditórios referentes a ${obj.curto} disponíve${plural ? 'is' : 'l'} vinculad${plural ? 'os' : 'o'} ao processo a que se refere a Cláusula 1ª, nos termos referidos na Cláusula 2ª, pelo valor total de ${vFmt} (${vExt}), que serão pagos por meio de transferência bancária no ato da assinatura d${plural ? 'os CEDENTES' : 'o CEDENTE'} no presente contrato.`
          ),
        ]),
        parRecuado([
          bold('Parágrafo primeiro: '),
          normal('O presente contrato somente terá validade após a comprovação do pagamento a que se refere ao caput da presente cláusula.'),
        ]),
        parRecuado([
          bold('Parágrafo segundo: '),
          normal(
            `No valor indicado no caput do presente artigo estão englobados ${obj.englobados}, sendo que o montante será pago para a conta de titularidade d${plural ? 'o SEGUNDO CEDENTE' : 'o CEDENTE'}, via transferência bancária${dadosBancarios}., que deverá fazer a prestação de contas com ${plural ? 'seu cliente, ora PRIMEIRO CEDENTE.' : 'o advogado representante.'}`
          ),
        ]),
        // Parágrafo 3º — observações da negociação (condicional)
        ...(obsTexto
          ? [
              vazio(),
              parRecuado([
                bold('Parágrafo terceiro — condições específicas da negociação: '),
                normal(obsTexto),
              ]),
            ]
          : []
        ),
        vazio(),

        // Cláusulas 4ª a 8ª
        par([bold('Cláusula 4ª: '), normal(`${cedRef}, após a efetivação da transferência bancária do preço da cessão, no prazo a que se refere a Cláusula 3ª, d${plural ? 'ão' : 'á'} plena, rasa, geral e irrevogável quitação do seu pagamento para nada mais repetir ou reclamar, seja a que título for, em razão desta avença, nos autos do processo indicado na Cláusula 1ª, assumindo, inclusive, suas obrigações tributárias na forma da legislação em vigor.`)]),
        vazio(),
        par([bold('Cláusula 5ª: '), normal(`${cedRef} declar${plural ? 'am' : 'a'} que não negoci${plural ? 'aram' : 'ou'} e nem negociar${plural ? 'ão' : 'á'} estes direitos creditórios com terceiros, sendo atualmente legítim${plural ? 'os' : 'o'} e únic${plural ? 'os' : 'o'} proprietári${plural ? 'os' : 'o'} dos direitos em questão, com plenos poderes para deles dispor.`)]),
        vazio(),
        par([bold('Cláusula 6ª: '), normal('A CESSIONÁRIA assumirá os riscos do negócio jurídico, responsabilizando-se pela solvência do devedor.')]),
        vazio(),
        par([bold('Cláusula 7ª: '), normal('O presente contrato passa a vigorar entre as partes a partir de sua assinatura.')]),
        vazio(),
        par([bold('Cláusula 8ª: '), normal('Para dirimir quaisquer controvérsias oriundas do presente contrato, as partes elegem o foro da Comarca de Florianópolis/SC;')]),
        vazio(),
        par([normal('Por estarem assim justos e contratados, firmam o presente instrumento, em duas vias de igual teor, juntamente com 2 (duas) testemunhas.')]),
        vazio(), vazio(),

        // Assinaturas
        new Paragraph({ children: [normal(`${d.cidadeAssinatura}/${d.ufAssinatura}, ${d.dataAssinatura}.`)], alignment: AlignmentType.CENTER, spacing: { after: 480 } }),
        new Paragraph({ children: [normal(`CEDENTE: ${d.c1Nome}${isAdv1 && d.c1OabUf ? ` (OAB/${d.c1OabUf} ${d.c1OabNumero})` : ''}`)], alignment: AlignmentType.CENTER, spacing: { after: 480 } }),
        ...(plural ? [new Paragraph({ children: [normal(`CEDENTE: ${d.c2Nome}${d.c2OabUf ? ` (OAB/${d.c2OabUf} ${d.c2OabNumero})` : ''}`)], alignment: AlignmentType.CENTER, spacing: { after: 480 } })] : []),
        new Paragraph({ children: [normal('Representante legal da Cessionária')], alignment: AlignmentType.CENTER, spacing: { after: 80 } }),
        new Paragraph({ children: [normal('Piercarlo Blando')], alignment: AlignmentType.CENTER, spacing: { after: 640 } }),

        // Testemunhas
        par([bold('Testemunhas')]),
        vazio(),
        par([normal('Assinatura: ___________________________________   Assinatura: ___________________________________')]),
        par([normal('Nome: ___________________________________         Nome: ___________________________________')]),
        par([normal('CPF: ___________________________________           CPF: ___________________________________')]),
      ]
    }]
  })

  return await Packer.toBuffer(doc)
}
```

---

## 7. Integração com a API da Anthropic (IA)

A IA processa o campo livre de observações do comercial e retorna linguagem jurídica pronta para o contrato.

### Variável de ambiente necessária
```env
ANTHROPIC_API_KEY=sk-ant-...
```

### Server Action / API Route
```typescript
// app/api/contratos/[id]/processar-obs/route.ts

import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'

const client = new Anthropic()

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const fechamento = await prisma.fechamento.findUnique({
    where: { id: params.id }
  })

  if (!fechamento?.observacoesRaw) {
    return Response.json({ erro: 'Sem observações para processar' }, { status: 400 })
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Você é um especialista em direito contratual brasileiro especializado em contratos de cessão de crédito judicial.

O comercial registrou a seguinte observação sobre a negociação:
"${fechamento.observacoesRaw}"

Contexto do contrato:
- Tipo de cessão: ${fechamento.tipoCessao}
- Valor fechado: R$ ${fechamento.valorFechado}
- Processo: ${fechamento.numeroProcesso}

Sua tarefa: transforme a observação do comercial em linguagem jurídica formal, adequada para constar como parágrafo em um contrato de cessão de crédito judicial. 

Regras:
- Mantenha o sentido original da observação
- Use linguagem jurídica formal e precisa
- Escreva em terceira pessoa
- Seja conciso — máximo 3 frases
- Não adicione informações que não estejam na observação original
- Retorne apenas o texto do parágrafo, sem introdução ou explicação`
      }
    ]
  })

  const textoProcessado = message.content[0].type === 'text'
    ? message.content[0].text
    : ''

  // Salva o resultado no banco
  await prisma.fechamento.update({
    where: { id: params.id },
    data: { observacoesProcessadas: textoProcessado }
  })

  return Response.json({ textoProcessado })
}
```

### Fluxo de uso na UI
1. Comercial preenche o campo de observações e salva o fechamento
2. Ao clicar em "Gerar contrato", o sistema chama `/api/contratos/[id]/processar-obs` automaticamente se `observacoesRaw` existir e `observacoesProcessadas` for nulo
3. Mostra um estado de loading "Processando observações com IA..."
4. Após retorno, continua para gerar o `.docx` com o texto já em linguagem jurídica

---

## 8. Campos do formulário — mapeamento completo

### Aba 1: Fechamento comercial

| Campo | Tipo | Obrigatório | Observação |
|-------|------|-------------|------------|
| Número do processo | text | Sim | Máscara: `0000000-00.0000.0.00.0000` |
| Comercial responsável | text | Sim | Pode ser select com lista do time |
| Analista jurídico | text | Não | Quem fez a inserção no PipeDrive |
| Data do fechamento | date | Sim | Default: hoje |
| Tipo de cessão | select/pills | Sim | `sucumbencia`, `honorarios`, `integral`, `personalizado` |
| Créditos (se personalizado) | multi-select | Condicional | `principal`, `honorarios`, `sucumbencia` |
| Observações da negociação | textarea | Não | Campo livre — processado pela IA |
| Valor da condenação | decimal | Não | Para calcular deságio |
| Valor fechado | decimal | Sim | |
| Deságio | calculado | — | `((condenacao - fechado) / condenacao) * 100` |
| Incluir dados bancários | boolean/pills | Sim | Default: não |
| Banco | text | Condicional | Só se incluir = sim |
| Agência | text | Condicional | |
| Conta | text | Condicional | |
| Tipo de conta | select/pills | Condicional | `Corrente`, `Poupança` |
| CPF do titular | text | Condicional | |

### Aba 2: Contrato (dados do cedente)

| Campo | Tipo | Obrigatório | Observação |
|-------|------|-------------|------------|
| Número do processo | text | Sim | Herdado do fechamento |
| Número do contrato | text | Sim | Sequencial — gerado ou manual |
| Vara | text | Sim | |
| Comarca | text | Sim | |
| Nome do autor | text | Sim | |
| Nome do réu | text | Sim | |
| Cedente 1 — nome | text | Sim | |
| Cedente 1 — profissão | pills + text | Sim | Advogado, Aposentado, Empresário, Servidor público, outro |
| Cedente 1 — nacionalidade | pills + text | Sim | Brasileiro/Brasileira como padrão |
| Cedente 1 — estado civil | pills + text | Sim | Solteiro/a, Casado/a, Divorciado/a, Viúvo/a |
| Cedente 1 — nascimento | date | Sim | |
| Cedente 1 — CPF | text | Sim | |
| Cedente 1 — RG | text | Não | Oculto quando tipo = sucumbencia/honorarios |
| Cedente 1 — OAB UF + número | text | Condicional | Visível apenas quando tipo = sucumbencia/honorarios |
| Cedente 1 — endereço | text | Sim | |
| Cedente 1 — bairro | text | Sim | |
| Cedente 1 — cidade | text | Sim | |
| Cedente 1 — UF | text | Sim | |
| Cedente 1 — CEP | text | Sim | |
| Segundo cedente (bloco) | toggle | Não | Obrigatório quando tipo = integral |
| Cedente 2 — (mesmos campos) | — | Condicional | Sempre advogado |
| Cidade da assinatura | text | Sim | |
| UF da assinatura | text | Sim | |
| Data da assinatura | date | Sim | Default: hoje |

---

## 9. Regras de UI importantes

### Visibilidade condicional dos campos
```
tipoCessao === 'sucumbencia' || 'honorarios'
  → Cedente 1: exibir campo OAB, ocultar campo RG
  → Label "Cedente — Advogado"
  → Não mostrar bloco Cedente 2 por padrão

tipoCessao === 'integral'
  → Cedente 1: label "Cedente 1 — Autor/credor", sem OAB, com RG
  → Abrir automaticamente o bloco Cedente 2

tipoCessao === 'personalizado'
  → Mostrar seleção de créditos
  → Cedente 1 como autor
```

### Cálculo do deságio
```typescript
const desagio = condenacao > 0 && valorFechado > 0
  ? ((condenacao - valorFechado) / condenacao * 100).toFixed(1) + '%'
  : null
```

### Migração de dados entre abas
Ao salvar o fechamento, os seguintes campos devem ser pré-populados na aba Contrato:
- `numeroProcesso`
- `tipoCessao`
- `valorFechado`
- `creditosPersonalizados`

---

## 10. API Routes completas

### POST `/api/contratos`
Salva o fechamento e retorna o ID para redirecionar para `/contratos/[id]`.

### POST `/api/contratos/[id]/gerar`
1. Busca o fechamento no banco
2. Se `observacoesRaw` existir e `observacoesProcessadas` for null → chama a IA primeiro
3. Chama `gerarDocx(fechamento)`
4. Salva registro em `Contrato`
5. Retorna o buffer com headers de download:
```typescript
return new Response(buffer, {
  headers: {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': `attachment; filename="contrato_${nr}_${nome}.docx"`,
  }
})
```

### PATCH `/api/contratos/[id]`
Atualiza campos do fechamento (usada para salvar dados da aba Contrato sem criar novo registro).

### GET `/api/contratos`
Lista fechamentos com paginação. Filtros: `status`, `comercial`, `dataInicio`, `dataFim`.

---

## 11. Listagem `/contratos`

Tabela com colunas:
- Número do contrato
- Número do processo
- Cedente
- Tipo de cessão
- Valor fechado
- Deságio
- Data do fechamento
- Status (badge colorido)
- Ações: visualizar, baixar .docx, editar

Status com cores:
- `rascunho` → cinza
- `gerado` → azul
- `enviado_contencioso` → amarelo
- `assinado` → verde

---

## 12. Variáveis de ambiente necessárias

```env
DATABASE_URL="postgresql://..."
ANTHROPIC_API_KEY="sk-ant-..."
NEXT_PUBLIC_APP_URL="https://..."
```

---

## 13. Dependências a instalar

```bash
npm install docx @anthropic-ai/sdk
npm install prisma @prisma/client
npx prisma init
```

---

## 14. Dados fixos da cessionária (não vêm do banco)

Estes dados são fixos e devem ser hardcoded na função de geração do contrato:

```typescript
const CESSIONARIA = {
  razaoSocial: 'PBL - COMPRA DE CRÉDITOS JUDICIAIS LTDA',
  cnpj: '27.192.535/0001-68',
  endereco: 'Av. Prefeito Osmar Cunha, 183, sala 701, Bloco A, Edifício Ceisa Center, Centro, Florianópolis/SC, CEP 88015-100',
  representante: 'PIERCARLO BLANDO',
  representanteQualificacao: 'brasileiro, divorciado, empresário, RG 2.786.902, CPF 000.064.779-92',
  foro: 'Florianópolis/SC',
}
```

---

## 15. Observações finais para o desenvolvedor

1. **Não reimplemente o layout** — siga o design system já existente na aplicação maior. Use os componentes de formulário, botões e cards já criados.

2. **O campo de observações é o diferencial** — quando processado pela IA, o texto do comercial vira uma cláusula jurídica formal. Mostre ao usuário o texto original e o processado para validação antes de gerar o contrato.

3. **Valor por extenso** — o contrato exige o valor escrito por extenso em português. Implemente a função `valorExtenso` com atenção: `33000` → `"trinta e três mil reais"`.

4. **Concordância verbal** — todas as cláusulas têm variação singular/plural dependendo de `temSegundoCedente`. Implemente isso com ternários como no protótipo: `ced${plural ? 'em' : 'e'}`.

5. **Parágrafo de OAB** — quando cedente 1 é advogado, a linha de identificação mostra `OAB/UF: número   CPF: xxx`. Quando é pessoa física, mostra `RG: xxx   CPF: xxx`.

6. **Formato da data de nascimento no contrato** — deve ser `DD/MM/AAAA`. Se o campo vier como `Date`, formatar com `toLocaleDateString('pt-BR')`.

7. **Número do contrato** — no protótipo era manual. Na versão de produção, considere gerar automaticamente com sequencial ou UUID curto.

8. **Storage do .docx** — o protótipo gerava o arquivo e devolvia direto para download sem salvar. Na versão de produção, salve o arquivo em storage externo (Supabase Storage ou S3) e guarde a URL no banco para permitir redownload posterior.
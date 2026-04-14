import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  UnderlineType,
} from 'docx'
import { Fechamento } from './types'
import { getObjetoCessao } from './objeto-cessao'
import { valorExtenso } from './valor-extenso'

/**
 * Formats a number as Brazilian currency string.
 * E.g. 150000.50 -> "R$ 150.000,50"
 */
export function fmtValor(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '___/___/______'
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('pt-BR')
}

function formatDateExtenso(dateStr: string | null): string {
  if (!dateStr) return '___ de __________ de ______'
  const date = new Date(dateStr + 'T12:00:00')
  const meses = [
    'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ]
  return `${date.getDate()} de ${meses[date.getMonth()]} de ${date.getFullYear()}`
}

function bold(text: string): TextRun {
  return new TextRun({ text, bold: true, size: 24, font: 'Arial' })
}

function normal(text: string): TextRun {
  return new TextRun({ text, size: 24, font: 'Arial' })
}

function underlineBold(text: string): TextRun {
  return new TextRun({
    text,
    bold: true,
    underline: { type: UnderlineType.SINGLE },
    size: 24,
    font: 'Arial',
  })
}

function emptyLine(): Paragraph {
  return new Paragraph({ children: [normal('')] })
}

function paragraph(
  children: TextRun[],
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.JUSTIFIED
): Paragraph {
  return new Paragraph({ children, alignment, spacing: { after: 120 } })
}

function buildCedenteBlock(
  label: string,
  nome: string | null,
  profissao: string | null,
  nacionalidade: string | null,
  estadoCivil: string | null,
  nascimento: string | null,
  cpf: string | null,
  rg: string | null,
  oabUf: string | null,
  oabNumero: string | null,
  endereco: string | null,
  bairro: string | null,
  cidade: string | null,
  uf: string | null,
  cep: string | null
): Paragraph[] {
  const paragraphs: Paragraph[] = []

  const oab =
    oabUf && oabNumero ? `, inscrito(a) na OAB/${oabUf} sob o n. ${oabNumero}` : ''

  const rgText = rg ? `, RG ${rg}` : ''

  const description =
    `${nome || '___'}, ${nacionalidade || '___'}, ${estadoCivil || '___'}, ${profissao || '___'}` +
    (nascimento ? `, nascido(a) em ${formatDate(nascimento)}` : '') +
    `, inscrito(a) no CPF sob o n. ${cpf || '___'}${rgText}${oab}` +
    `, residente e domiciliado(a) em ${endereco || '___'}, ${bairro || '___'}, ${cidade || '___'}/${uf || '___'}, CEP ${cep || '___'}`

  paragraphs.push(
    paragraph([bold(`${label}: `), normal(description + '.')])
  )

  return paragraphs
}

export async function gerarDocx(d: Fechamento): Promise<Buffer> {
  const objetoCessao = getObjetoCessao(d.tipo_cessao, d.creditos_personalizados)
  const valorFechado = fmtValor(d.valor_fechado)
  const valorFechadoExtenso = valorExtenso(d.valor_fechado)

  const children: Paragraph[] = []

  // Title
  children.push(
    new Paragraph({
      children: [underlineBold('INSTRUMENTO PARTICULAR DE CESSAO DE CREDITO JUDICIAL')],
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
    })
  )

  if (d.numero_contrato) {
    children.push(
      new Paragraph({
        children: [bold(`Contrato n. ${d.numero_contrato}`)],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      })
    )
  }

  children.push(emptyLine())

  // Process info
  children.push(
    paragraph([
      bold('Processo: '),
      normal(d.numero_processo),
    ])
  )

  if (d.vara || d.comarca) {
    children.push(
      paragraph([
        bold('Vara: '),
        normal(`${d.vara || '___'} - Comarca de ${d.comarca || '___'}`),
      ])
    )
  }

  if (d.autor_nome || d.reu_nome) {
    children.push(
      paragraph([
        bold('Partes: '),
        normal(`${d.autor_nome || '___'} x ${d.reu_nome || '___'}`),
      ])
    )
  }

  children.push(emptyLine())

  // Parties section
  children.push(
    new Paragraph({
      children: [underlineBold('PARTES')],
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
    })
  )

  // Cedente 1
  children.push(
    ...buildCedenteBlock(
      'CEDENTE',
      d.c1_nome,
      d.c1_profissao,
      d.c1_nacionalidade,
      d.c1_estado_civil,
      d.c1_nascimento,
      d.c1_cpf,
      d.c1_rg,
      d.c1_oab_uf,
      d.c1_oab_numero,
      d.c1_endereco,
      d.c1_bairro,
      d.c1_cidade,
      d.c1_uf,
      d.c1_cep
    )
  )

  // Cedente 2 (if applicable)
  if (d.tem_segundo_cedente) {
    children.push(emptyLine())
    children.push(
      ...buildCedenteBlock(
        'SEGUNDO(A) CEDENTE',
        d.c2_nome,
        d.c2_profissao,
        d.c2_nacionalidade,
        d.c2_estado_civil,
        d.c2_nascimento,
        d.c2_cpf,
        null, // c2 has no RG field
        d.c2_oab_uf,
        d.c2_oab_numero,
        d.c2_endereco,
        d.c2_bairro,
        d.c2_cidade,
        d.c2_uf,
        d.c2_cep
      )
    )
  }

  children.push(emptyLine())

  // Cessionaria
  children.push(
    paragraph([
      bold('CESSIONARIA: '),
      normal(
        'PBL - COMPRA DE CREDITOS JUDICIAIS LTDA, pessoa juridica de direito privado, ' +
        'inscrita no CNPJ sob o n. 27.192.535/0001-68, com sede na ' +
        'Av. Prefeito Osmar Cunha, 183, sala 701, Bloco A, Edificio Ceisa Center, Centro, ' +
        'Florianopolis/SC, CEP 88015-100, neste ato representada por ' +
        'PIERCARLO BLANDO, brasileiro, divorciado, empresario, ' +
        'RG 2.786.902, CPF 000.064.779-92.'
      ),
    ])
  )

  children.push(emptyLine())

  // Clauses
  children.push(
    new Paragraph({
      children: [underlineBold('CLAUSULAS E CONDICOES')],
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
    })
  )

  // Clause 1 - Object
  children.push(
    paragraph([
      bold('CLAUSULA PRIMEIRA - DO OBJETO. '),
      normal(
        `O(A) CEDENTE, por meio do presente instrumento e na melhor forma de direito, ` +
        `cede e transfere a CESSIONARIA, em carater irrevogavel e irretratavel, ` +
        `${objetoCessao.descricao}.`
      ),
    ])
  )

  children.push(emptyLine())

  // Clause 2 - Price
  children.push(
    paragraph([
      bold('CLAUSULA SEGUNDA - DO PRECO. '),
      normal(
        `Pela cessao dos creditos descritos na Clausula Primeira, a CESSIONARIA pagara ao(a) CEDENTE ` +
        `o valor de ${valorFechado} (${valorFechadoExtenso}).`
      ),
    ])
  )

  if (d.valor_condenacao !== null && d.desagio !== null) {
    children.push(
      paragraph([
        normal(
          `Paragrafo unico: O valor da condenacao e de ${fmtValor(d.valor_condenacao)} ` +
          `e o desagio aplicado e de ${d.desagio}%.`
        ),
      ])
    )
  }

  children.push(emptyLine())

  // Clause 3 - Payment
  children.push(
    paragraph([
      bold('CLAUSULA TERCEIRA - DO PAGAMENTO. '),
      normal(
        'O pagamento do preco ajustado sera efetuado pela CESSIONARIA ao(a) CEDENTE ' +
        'em ate 5 (cinco) dias uteis contados da assinatura do presente instrumento'
      ),
    ])
  )

  // Bank info
  if (d.incluir_dados_bancarios && d.banco) {
    children.push(
      paragraph([
        normal(
          `, mediante deposito ou transferencia bancaria na seguinte conta: ` +
          `Banco: ${d.banco}, Agencia: ${d.agencia || '___'}, ` +
          `Conta: ${d.conta || '___'} (${d.tipo_conta || '___'}), ` +
          `CPF do titular: ${d.banco_cpf || '___'}.`
        ),
      ])
    )
  } else {
    children.push(
      paragraph([
        normal(
          ', mediante deposito ou transferencia bancaria em conta a ser informada pelo(a) CEDENTE.'
        ),
      ])
    )
  }

  children.push(emptyLine())

  // Clause 4 - Obligations
  children.push(
    paragraph([
      bold('CLAUSULA QUARTA - DAS OBRIGACOES DO(A) CEDENTE. '),
      normal(
        'O(A) CEDENTE se obriga a: (i) fornecer todos os documentos e informacoes necessarios ' +
        'para a habilitacao da CESSIONARIA nos autos do processo; (ii) assinar a peticao de ' +
        'habilitacao e quaisquer outros documentos necessarios para a efetivacao da cessao; ' +
        '(iii) comunicar ao juizo e a parte contraria a presente cessao de credito; ' +
        '(iv) nao praticar qualquer ato que possa prejudicar os direitos da CESSIONARIA ' +
        'sobre os creditos cedidos.'
      ),
    ])
  )

  children.push(emptyLine())

  // Clause 5 - Irrevocability
  children.push(
    paragraph([
      bold('CLAUSULA QUINTA - DA IRREVOGABILIDADE. '),
      normal(
        'A presente cessao e feita em carater irrevogavel e irretratavel, ' +
        'nao podendo ser desfeita por nenhuma das partes, salvo por acordo mutuo ' +
        'formalizado por escrito.'
      ),
    ])
  )

  children.push(emptyLine())

  // Clause 6 - Representations
  children.push(
    paragraph([
      bold('CLAUSULA SEXTA - DAS DECLARACOES. '),
      normal(
        'O(A) CEDENTE declara, sob as penas da lei, que: (i) e o(a) legitimo(a) titular ' +
        'dos creditos objeto desta cessao; (ii) os creditos cedidos estao livres e desembaracados ' +
        'de quaisquer onus, gravames, penhoras ou cessoes anteriores; (iii) nao ha qualquer ' +
        'impedimento legal para a realizacao da presente cessao; (iv) todas as informacoes ' +
        'prestadas sao verdadeiras e completas.'
      ),
    ])
  )

  children.push(emptyLine())

  // Clause 7 - Jurisdiction
  children.push(
    paragraph([
      bold('CLAUSULA SETIMA - DO FORO. '),
      normal(
        'As partes elegem o foro da Comarca de Florianopolis/SC para dirimir quaisquer ' +
        'duvidas ou controversias oriundas do presente instrumento, com renuncia expressa ' +
        'a qualquer outro, por mais privilegiado que seja.'
      ),
    ])
  )

  children.push(emptyLine())

  // Observations
  if (d.observacoes_processadas || d.observacoes_raw) {
    children.push(
      paragraph([
        bold('OBSERVACOES: '),
        normal(d.observacoes_processadas || d.observacoes_raw || ''),
      ])
    )
    children.push(emptyLine())
  }

  // Closing
  children.push(
    paragraph([
      normal(
        'E, por estarem assim justas e contratadas, as partes assinam o presente instrumento ' +
        'em 2 (duas) vias de igual teor e forma, na presenca de 2 (duas) testemunhas.'
      ),
    ])
  )

  children.push(emptyLine())

  // Place and date
  const cidade = d.cidade_assinatura || '___'
  const uf = d.uf_assinatura || '___'
  const dataAssinatura = formatDateExtenso(d.data_assinatura)

  children.push(
    new Paragraph({
      children: [normal(`${cidade}/${uf}, ${dataAssinatura}.`)],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 480 },
    })
  )

  children.push(emptyLine())
  children.push(emptyLine())

  // Signature blocks
  // Cedente 1
  children.push(
    new Paragraph({
      children: [normal('_____________________________________________')],
      alignment: AlignmentType.CENTER,
    })
  )
  children.push(
    new Paragraph({
      children: [bold('CEDENTE')],
      alignment: AlignmentType.CENTER,
    })
  )
  children.push(
    new Paragraph({
      children: [normal(d.c1_nome || '___')],
      alignment: AlignmentType.CENTER,
    })
  )
  children.push(
    new Paragraph({
      children: [normal(`CPF: ${d.c1_cpf || '___'}`)],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    })
  )

  // Cedente 2
  if (d.tem_segundo_cedente) {
    children.push(
      new Paragraph({
        children: [normal('_____________________________________________')],
        alignment: AlignmentType.CENTER,
      })
    )
    children.push(
      new Paragraph({
        children: [bold('SEGUNDO(A) CEDENTE')],
        alignment: AlignmentType.CENTER,
      })
    )
    children.push(
      new Paragraph({
        children: [normal(d.c2_nome || '___')],
        alignment: AlignmentType.CENTER,
      })
    )
    children.push(
      new Paragraph({
        children: [normal(`CPF: ${d.c2_cpf || '___'}`)],
        alignment: AlignmentType.CENTER,
        spacing: { after: 480 },
      })
    )
  }

  // Cessionaria
  children.push(
    new Paragraph({
      children: [normal('_____________________________________________')],
      alignment: AlignmentType.CENTER,
    })
  )
  children.push(
    new Paragraph({
      children: [bold('CESSIONARIA')],
      alignment: AlignmentType.CENTER,
    })
  )
  children.push(
    new Paragraph({
      children: [normal('PBL - COMPRA DE CREDITOS JUDICIAIS LTDA')],
      alignment: AlignmentType.CENTER,
    })
  )
  children.push(
    new Paragraph({
      children: [normal('CNPJ: 27.192.535/0001-68')],
      alignment: AlignmentType.CENTER,
    })
  )
  children.push(
    new Paragraph({
      children: [normal('Representante: PIERCARLO BLANDO - CPF: 000.064.779-92')],
      alignment: AlignmentType.CENTER,
      spacing: { after: 480 },
    })
  )

  // Witnesses
  children.push(emptyLine())
  children.push(
    new Paragraph({
      children: [bold('TESTEMUNHAS:')],
      alignment: AlignmentType.LEFT,
      spacing: { after: 360 },
    })
  )

  // Witness 1
  children.push(
    new Paragraph({
      children: [normal('_____________________________________________')],
      alignment: AlignmentType.LEFT,
    })
  )
  children.push(
    new Paragraph({
      children: [normal('Nome:')],
      alignment: AlignmentType.LEFT,
    })
  )
  children.push(
    new Paragraph({
      children: [normal('CPF:')],
      alignment: AlignmentType.LEFT,
      spacing: { after: 360 },
    })
  )

  // Witness 2
  children.push(
    new Paragraph({
      children: [normal('_____________________________________________')],
      alignment: AlignmentType.LEFT,
    })
  )
  children.push(
    new Paragraph({
      children: [normal('Nome:')],
      alignment: AlignmentType.LEFT,
    })
  )
  children.push(
    new Paragraph({
      children: [normal('CPF:')],
      alignment: AlignmentType.LEFT,
    })
  )

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  return Buffer.from(buffer)
}

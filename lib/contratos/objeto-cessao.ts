export type TipoCessao = 'sucumbencia' | 'honorarios' | 'integral' | 'personalizado'

export interface ObjetoCessao {
  titulo: string
  descricao: string
}

export function getObjetoCessao(
  tipo: TipoCessao,
  personalizados?: string[]
): ObjetoCessao {
  switch (tipo) {
    case 'sucumbencia':
      return {
        titulo: 'Honorarios de Sucumbencia',
        descricao:
          'os creditos decorrentes de honorarios advocaticios sucumbenciais fixados nos autos do processo judicial acima indicado',
      }
    case 'honorarios':
      return {
        titulo: 'Honorarios Contratuais',
        descricao:
          'os creditos decorrentes de honorarios advocaticios contratuais vinculados ao processo judicial acima indicado',
      }
    case 'integral':
      return {
        titulo: 'Cessao Integral',
        descricao:
          'a totalidade dos creditos oriundos do processo judicial acima indicado, incluindo principal, juros, correcao monetaria, honorarios sucumbenciais e quaisquer verbas acessorias',
      }
    case 'personalizado':
      return {
        titulo: 'Cessao Personalizada',
        descricao:
          personalizados && personalizados.length > 0
            ? `os seguintes creditos oriundos do processo judicial acima indicado: ${personalizados.join('; ')}`
            : 'os creditos especificados oriundos do processo judicial acima indicado',
      }
  }
}

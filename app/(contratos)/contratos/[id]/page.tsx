import ContratoViewClient from './ContratoViewClient'

export default async function ContratoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ContratoViewClient id={id} />
}

# Contrato de Integração n8n ↔ PBL Compra WhatsApp Bot

## Visão Geral

O sistema PBL Compra **nunca envia mensagens diretamente** para o WhatsApp.
O fluxo é:

```
WhatsApp → API não-oficial → n8n → PBL (orchestrator) → n8n → WhatsApp
```

---

## 1. Webhook: Mensagem Recebida (n8n → PBL)

**Endpoint:** `POST /api/wa/orchestrator`

### Request

```json
{
  "telefone": "5511999999999",
  "mensagem": "Olá, quero saber sobre meu processo",
  "bot_id": "uuid-do-bot"
}
```

### Responses

**Bot desligado:**
```json
{ "ativo": false }
```

**Escalação (palavra-chave detectada):**
```json
{
  "escalar": true,
  "telefone": "5511999999999",
  "mensagem_original": "Quero falar com meu advogado",
  "conversa_id": "uuid"
}
```
→ n8n deve notificar o grupo WhatsApp de fallback.

**Boas-vindas (primeira mensagem):**
```json
{
  "texto": "Olá! Bem-vindo à PBL Compra...",
  "tipo": "boas_vindas",
  "conversa_id": "uuid"
}
```
→ n8n envia o texto via API WhatsApp.

**Modo Produção (resposta automática):**
```json
{
  "texto": "Sobre seu processo, posso informar que...",
  "tipo": "resposta_ia",
  "conversa_id": "uuid"
}
```
→ n8n envia o texto via API WhatsApp.

**Modo Treinamento (aguarda humano):**
```json
{
  "texto": null,
  "sugestao": "Sobre seu processo, posso informar que...",
  "aguardando_humano": true,
  "conversa_id": "uuid",
  "telefone": "5511999999999"
}
```
→ n8n **NÃO envia** ao cliente.
→ n8n notifica o grupo WhatsApp com:
  - Pergunta do cliente
  - Link wa.me para o número
  - Sugestão da IA
  - Link para o painel de atendimento

---

## 2. Webhook: Envio de Mensagem (PBL → n8n)

**Configurar a env var:** `N8N_SEND_WEBHOOK_URL`

Quando um atendente aprova/edita/envia uma resposta no painel, o sistema chama o webhook do n8n:

### Request (PBL → n8n)

```json
{
  "conversa_id": "uuid",
  "telefone": "5511999999999",
  "conteudo": "Texto da resposta aprovada",
  "autor": "humano"
}
```

→ n8n recebe e envia via API WhatsApp para o número do cliente.

---

## 3. Webhook: Notificação de Grupo (PBL → n8n)

**Configurar a env var:** `N8N_GROUP_NOTIFY_WEBHOOK_URL`

Para escalações e notificações de treinamento:

```json
{
  "tipo": "escalacao" | "treinamento",
  "telefone": "5511999999999",
  "mensagem_cliente": "Texto original do cliente",
  "sugestao_ia": "Sugestão da IA (se houver)",
  "link_painel": "https://app-url/wa",
  "link_whatsapp": "https://wa.me/5511999999999"
}
```

---

## 4. Variáveis de Ambiente

```env
# URL do webhook n8n para envio de mensagens
N8N_SEND_WEBHOOK_URL=https://seu-n8n.com/webhook/whatsapp-send

# URL do webhook n8n para notificações de grupo
N8N_GROUP_NOTIFY_WEBHOOK_URL=https://seu-n8n.com/webhook/whatsapp-notify

# JID do grupo WhatsApp de fallback
WHATSAPP_FALLBACK_GROUP_ID=grupo-id@g.us

# OpenAI (para o bot de IA)
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4o-mini
```

---

## 5. Fluxo n8n Recomendado

### Fluxo 1: Receber mensagem
1. Trigger: Webhook da API não-oficial (Evolution/WPPConnect)
2. Extrair: telefone, mensagem
3. HTTP Request → POST /api/wa/orchestrator
4. Switch: baseado no campo de resposta
   - `escalar=true` → notificar grupo
   - `aguardando_humano=true` → notificar grupo (modo treinamento)
   - `texto!=null` → enviar mensagem via API WhatsApp

### Fluxo 2: Enviar mensagem
1. Trigger: Webhook (recebe de /api/wa/send)
2. Extrair: telefone, conteudo
3. HTTP Request → API WhatsApp para enviar mensagem

---

## 6. Regras Importantes

1. **O sistema NUNCA envia mensagens diretamente.** Sempre via n8n.
2. **Em modo treinamento**, a resposta da IA NUNCA é enviada automaticamente.
3. **Escalação** tem prioridade sobre qualquer resposta da IA.
4. **Boas-vindas** só é enviada UMA vez por conversa.
5. O `bot_id` no payload identifica qual bot (e qual prompt) processar.

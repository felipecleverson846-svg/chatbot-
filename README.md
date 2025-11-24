# AgendMed Chatbot

Chatbot para o sistema AgendMed, hospedado separadamente da aplicação principal.

## Instalação Local

```bash
npm install
npm run dev
```

O servidor rodará em `http://localhost:3001`

## Deploy no Render

1. Faça push do código para GitHub
2. Acesse [render.com](https://render.com)
3. Clique em "New +" > "Web Service"
4. Conecte seu repositório GitHub
5. Configure:
   - **Name**: agendmed-chatbot
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Clique em "Create Web Service"

## Endpoints

### POST /api/chat
Enviar mensagem para o chatbot

```json
{
  "userId": "user123",
  "message": "Olá, como funciona o agendamento?"
}
```

### GET /api/chat/:userId
Obter histórico de conversa

### DELETE /api/chat/:userId
Limpar histórico de conversa

### POST /api/whatsapp/send
Enviar mensagem via WhatsApp

```json
{
  "phoneNumber": "5511999999999",
  "message": "Olá! Seu agendamento foi confirmado."
}
```

### GET /api/whatsapp/status
Verificar status da conexão WhatsApp

### GET /health
Verificar status do servidor

## Configuração WhatsApp

1. Na primeira execução, um QR code será exibido no terminal
2. Abra WhatsApp no seu celular
3. Vá em Configurações > Dispositivos Conectados > Conectar um dispositivo
4. Escaneie o QR code
5. Pronto! O chatbot pode enviar mensagens

**Nota:** O WhatsApp Web.js usa a sessão do WhatsApp Web, então você precisa manter o WhatsApp Web conectado no navegador do servidor.

## Integração com Vercel

No seu `.env.local` da aplicação Vercel, adicione:

```
NEXT_PUBLIC_CHATBOT_URL=https://seu-chatbot.onrender.com
```

Depois use em seu componente:

```javascript
const response = await fetch(`${process.env.NEXT_PUBLIC_CHATBOT_URL}/api/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'user123', message: 'Olá' })
});
```

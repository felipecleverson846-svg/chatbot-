# Interface Web do Chatbot AgendMed

## 📱 Visão Geral

A interface web permite conectar e gerenciar o chatbot WhatsApp de forma visual e intuitiva.

## 🎯 Funcionalidades

### 1. **Exibição de QR Code**
- QR code gerado automaticamente
- Atualização automática a cada 30 segundos
- Botão para atualizar manualmente

### 2. **Status em Tempo Real**
- Indicador visual de conexão (verde/vermelho)
- Mensagem de status atualizada
- Verificação automática a cada 5 segundos

### 3. **Estatísticas**
- Contagem de mensagens recebidas
- Contagem de agendamentos realizados

### 4. **Gerenciamento**
- Botão para atualizar QR Code
- Botão para desconectar WhatsApp
- Instruções passo a passo

## 🚀 Como Usar

### Acessar a Interface

1. **Localmente**: http://localhost:3001
2. **Em Produção**: https://seu-dominio.com

### Conectar WhatsApp

1. Abra a interface no navegador
2. Você verá o QR code sendo gerado
3. Abra WhatsApp no seu celular
4. Vá em **Configurações → Dispositivos Conectados → Conectar um dispositivo**
5. Aponte a câmera para o QR code
6. Confirme a conexão

### Após Conectar

- O status mudará para "Conectado" (verde)
- O botão "Desconectar" ficará ativo
- O bot estará pronto para receber mensagens

## 🎨 Design

### Cores
- **Primária**: Roxo (#667eea)
- **Secundária**: Roxo escuro (#764ba2)
- **Sucesso**: Verde (#4caf50)
- **Erro**: Vermelho (#f44336)

### Responsividade
- Desktop: Layout completo
- Tablet: Ajustado
- Mobile: Otimizado para telas pequenas

## 📊 Componentes

### Status Box
Mostra o estado atual da conexão com indicador visual.

### QR Container
Exibe o QR code para escanear com WhatsApp.

### Instructions
Guia passo a passo para conectar.

### Stats
Mostra estatísticas de uso.

### Button Group
Botões de ação (Atualizar, Desconectar).

## 🔄 Fluxo de Atualização

```
Página Carregada
    ↓
Carregar QR Code
    ↓
Verificar Status (a cada 5s)
    ↓
Atualizar QR Code (a cada 30s)
    ↓
Usuário Escaneia QR
    ↓
Status Muda para Conectado
    ↓
Bot Pronto para Usar
```

## 🛠️ Customização

### Mudar Cores

Edite as variáveis CSS em `public/index.html`:

```css
/* Primária */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Secundária */
color: #667eea;
```

### Mudar Textos

Edite os textos HTML:

```html
<h1>🤖 AgendMed Chatbot</h1>
<p>Conecte seu WhatsApp para começar</p>
```

### Adicionar Funcionalidades

Edite o JavaScript em `public/index.html`:

```javascript
// Adicionar nova função
function minhaFuncao() {
  // Seu código aqui
}
```

## 📱 Endpoints Utilizados

- `GET /api/whatsapp/qr` - Obter QR code
- `GET /api/whatsapp/status` - Verificar status
- `POST /api/whatsapp/disconnect` - Desconectar

## 🐛 Troubleshooting

### QR Code não aparece
- Verifique se o servidor está rodando
- Verifique se a porta está correta
- Tente atualizar a página

### Status não atualiza
- Verifique a conexão de internet
- Verifique se o servidor está respondendo
- Abra o console (F12) para ver erros

### Não consegue conectar WhatsApp
- Verifique se o QR code é válido
- Tente gerar um novo QR code
- Verifique se o WhatsApp está atualizado

## 📝 Notas

- A interface é responsiva e funciona em mobile
- O QR code expira após alguns minutos
- A conexão é mantida enquanto o servidor estiver rodando
- Desconectar encerra a sessão do WhatsApp Web

## 🔐 Segurança

- Sem autenticação (pode ser adicionada)
- CORS habilitado para todos os domínios (pode ser restringido)
- Sem dados sensíveis expostos

## 🚀 Deploy

A interface é servida automaticamente quando o servidor inicia.

### Render
- Acesse: `https://seu-app.onrender.com`

### Localhost
- Acesse: `http://localhost:3001`

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- `README.md` - Documentação geral
- `CHATBOT_SETUP.md` - Setup do chatbot
- Logs do servidor

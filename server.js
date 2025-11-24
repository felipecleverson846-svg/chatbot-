const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { initWhatsApp, sendWhatsAppMessage, sendButtonMessage, getWhatsAppStatus, getLastQR } = require('./whatsapp');
const { startBooking, processBookingResponse, getBookingState, saveConfirmedBooking, getServicesButtons, loadServices } = require('./booking');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3001;

// Configurar CORS
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Preflight para CORS
app.options('*', cors());

// Armazenar conversas isoladas por pessoa (phoneNumber como chave)
const conversations = new Map(); // { phoneNumber: [{ role, content, timestamp }] }
const confirmedBookings = new Map(); // { phoneNumber: [{ service, date, time, email, contactName, timestamp }] }

// Inicializar WhatsApp
initWhatsApp(
  () => {
    console.log('QR Code atualizado');
  },
  (msgData) => {
    // Callback quando receber mensagem
    const { phoneNumber, contactName, message, timestamp } = msgData;
    
    console.log(`📨 Mensagem recebida de ${contactName} (${phoneNumber}): ${message}`);
    
    // Inicializar conversa se não existir
    if (!conversations.has(phoneNumber)) {
      conversations.set(phoneNumber, []);
    }
    
    // Adicionar mensagem do usuário ao histórico
    conversations.get(phoneNumber).push({
      role: 'user',
      content: message,
      contactName,
      timestamp
    });
    
    console.log(`✅ Conversa armazenada para ${contactName} (${phoneNumber})`);
    
    // Processar mensagem
    processUserMessage(phoneNumber, contactName, message);
  }
);

// Função para enviar menu com botões
async function sendMenuWithButtons(phoneNumber, contactName) {
  try {
    const menuMessage = `Olá ${contactName}! 👋\n\nBem-vindo ao AgendMed.\n\nComo posso ajudá-lo?\n\n*Menu de opções:*`;
    
    const buttons = [
      { text: '1️⃣ Agendar consulta' },
      { text: '2️⃣ Ver horários disponíveis' },
      { text: '3️⃣ Informações sobre serviços' },
      { text: '4️⃣ Falar com atendente' }
    ];

    console.log(`📤 Enviando menu com botões para ${contactName}...`);
    const result = await sendButtonMessage(phoneNumber, menuMessage, buttons);
    
    if (result.success) {
      console.log(`✅ Menu enviado com sucesso para ${contactName}`);
    } else {
      console.error(`❌ Erro ao enviar menu: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Erro ao enviar menu:', error);
  }
}

// Função para enviar serviços com botões
async function sendServicesWithButtons(phoneNumber, contactName) {
  try {
    const servicesMessage = `📋 *Serviços Disponíveis:*\n\nQual serviço você deseja agendar?`;
    
    const buttons = getServicesButtons();

    console.log(`📤 Enviando serviços com botões para ${contactName}...`);
    const result = await sendButtonMessage(phoneNumber, servicesMessage, buttons);
    
    if (result.success) {
      console.log(`✅ Serviços enviados com sucesso para ${contactName}`);
    } else {
      console.error(`❌ Erro ao enviar serviços: ${result.error}`);
    }
  } catch (error) {
    console.error('❌ Erro ao enviar serviços:', error);
  }
}

// Função para processar mensagem do usuário
async function processUserMessage(phoneNumber, contactName, message) {
  try {
    console.log(`🤖 Processando mensagem de ${contactName}...`);
    
    const messageLower = message.toLowerCase().trim();
    let botResponse = '';

    // Verificar se está em processo de agendamento
    const bookingState = getBookingState(phoneNumber);
    
    if (bookingState) {
      // Processar resposta de agendamento
      console.log('📋 Processando resposta de agendamento...');
      const result = await processBookingResponse(phoneNumber, message);
      botResponse = result.response;
      
      if (result.completed) {
        console.log('✅ Agendamento completado:', result.bookingData);
        // Salvar agendamento confirmado
        if (!confirmedBookings.has(phoneNumber)) {
          confirmedBookings.set(phoneNumber, []);
        }
        confirmedBookings.get(phoneNumber).push(result.bookingData);
      }
    } else if (messageLower === 'olá' || messageLower === 'oi' || messageLower === 'opa' || messageLower === 'e aí') {
      // Enviar menu com botões
      botResponse = `Olá ${contactName}! 👋

Bem-vindo ao AgendMed.

Como posso ajudá-lo?

Menu de opções:
1️⃣ Agendar consulta
2️⃣ Ver horários disponíveis
3️⃣ Informações sobre serviços
4️⃣ Falar com atendente

Digite o número da opção desejada.`;
      
      // Adicionar resposta do bot ao histórico
      if (conversations.has(phoneNumber)) {
        conversations.get(phoneNumber).push({
          role: 'bot',
          content: botResponse,
          timestamp: new Date()
        });
      }

      // Enviar resposta via WhatsApp
      console.log(`📤 Enviando menu para ${phoneNumber}...`);
      console.log(`📝 Conteúdo da mensagem: ${botResponse}`);
      const result = await sendWhatsAppMessage(phoneNumber, botResponse);
      
      if (result.success) {
        console.log(`✅ Menu enviado com sucesso para ${contactName}`);
      } else {
        console.error(`❌ Erro ao enviar menu: ${result.error}`);
      }
      return;
    } else if (messageLower.includes('agendar') || messageLower.includes('agendamento') || messageLower === '1' || messageLower.includes('consulta')) {
      // Iniciar agendamento
      console.log('📅 Iniciando agendamento...');
      const userId = global.userPhoneMap?.get(phoneNumber);
      const servicesMessage = await startBooking(phoneNumber, contactName, userId);
      
      // Adicionar resposta do bot ao histórico
      if (conversations.has(phoneNumber)) {
        conversations.get(phoneNumber).push({
          role: 'bot',
          content: servicesMessage,
          timestamp: new Date()
        });
      }

      // Enviar resposta via WhatsApp
      console.log(`📤 Enviando serviços para ${phoneNumber}...`);
      const result = await sendWhatsAppMessage(phoneNumber, servicesMessage);
      
      if (result.success) {
        console.log(`✅ Serviços enviados com sucesso para ${contactName}`);
      } else {
        console.error(`❌ Erro ao enviar serviços: ${result.error}`);
      }
      return;
    } else if (messageLower === '2' || messageLower.includes('horários') || messageLower.includes('disponível')) {
      // Ver horários disponíveis
      botResponse = `📅 *Horários Disponíveis:*\n\n*Segunda a Sexta:*\n08:00 - 12:00\n14:00 - 18:00\n\n*Sábado:*\n08:00 - 12:00\n\nDigite "1" para agendar uma consulta!`;
    } else if (messageLower === '3' || messageLower.includes('serviços') || messageLower.includes('informações')) {
      // Informações sobre serviços
      botResponse = `🦷 *Nossos Serviços:*\n\n1. *Limpeza* - R$ 100\n   Limpeza profissional dos dentes\n\n2. *Restauração* - R$ 200\n   Restauração de cáries e danos\n\n3. *Clareamento* - R$ 150\n   Clareamento dental profissional\n\n4. *Extração* - R$ 120\n   Extração segura de dentes\n\nDigite "1" para agendar uma consulta!`;
    } else if (messageLower === '4' || messageLower.includes('atendente') || messageLower.includes('falar')) {
      // Falar com atendente
      botResponse = `👨‍💼 *Falar com Atendente*\n\nUm atendente entrará em contato em breve!\n\nHorário de atendimento:\n📞 Segunda a Sexta: 08:00 - 18:00\n📞 Sábado: 08:00 - 12:00\n\nObrigado por entrar em contato! 😊`;
    } else {
      // Resposta padrão para qualquer mensagem não reconhecida
      console.log('💬 Mensagem não reconhecida. Enviando menu padrão...');
      botResponse = `Desculpe, não entendi sua pergunta. 🤔

Menu de opções:
1️⃣ Agendar consulta
2️⃣ Ver horários disponíveis
3️⃣ Informações sobre serviços
4️⃣ Falar com atendente

Digite o número da opção desejada.`;
    }

    // Adicionar resposta do bot ao histórico
    if (conversations.has(phoneNumber)) {
      conversations.get(phoneNumber).push({
        role: 'bot',
        content: botResponse,
        timestamp: new Date()
      });
    }

    // Enviar resposta via WhatsApp
    console.log(`📤 Enviando resposta para ${phoneNumber}...`);
    console.log(`📝 Mensagem: ${botResponse.substring(0, 100)}...`);
    const result = await sendWhatsAppMessage(phoneNumber, botResponse);
    
    if (result.success) {
      console.log(`✅ Resposta enviada com sucesso para ${contactName}`);
    } else {
      console.error(`❌ Erro ao enviar resposta: ${result.error}`);
      console.error(`📞 Telefone: ${phoneNumber}`);
      console.error(`👤 Nome: ${contactName}`);
    }
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
  }
}



// Rota de health check
app.get('/health', (req, res) => {
  console.log('Health check solicitado');
  res.json({ status: 'ok', whatsapp: getWhatsAppStatus() });
});

// Rota raiz - Servir interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota para registrar userId associado ao phoneNumber
app.post('/api/whatsapp/register-user', (req, res) => {
  try {
    const { phoneNumber, userId } = req.body;

    if (!phoneNumber || !userId) {
      return res.status(400).json({ error: 'phoneNumber e userId são obrigatórios' });
    }

    // Armazenar a associação
    global.userPhoneMap = global.userPhoneMap || new Map();
    global.userPhoneMap.set(phoneNumber, userId);

    console.log(`✅ Usuário ${userId} registrado para o telefone ${phoneNumber}`);

    res.json({
      success: true,
      message: 'Usuário registrado com sucesso'
    });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao registrar usuário' });
  }
});

// Rota para enviar mensagem via WhatsApp
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'phoneNumber e message são obrigatórios' });
    }

    const result = await sendWhatsAppMessage(phoneNumber, message);
    res.json(result);
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

// Rota para obter histórico de conversa de uma pessoa
app.get('/api/whatsapp/conversation/:phoneNumber', (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const conversation = conversations.get(phoneNumber) || [];
    
    res.json({
      success: true,
      phoneNumber,
      conversation
    });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao obter conversa' });
  }
});

// Rota para limpar histórico de conversa de uma pessoa
app.delete('/api/whatsapp/conversation/:phoneNumber', (req, res) => {
  try {
    const { phoneNumber } = req.params;
    conversations.delete(phoneNumber);
    
    res.json({
      success: true,
      message: 'Conversa deletada'
    });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao deletar conversa' });
  }
});

// Rota para listar todas as conversas
app.get('/api/whatsapp/conversations', (req, res) => {
  try {
    const allConversations = [];
    
    conversations.forEach((msgs, phoneNumber) => {
      const lastMessage = msgs[msgs.length - 1];
      allConversations.push({
        phoneNumber,
        contactName: lastMessage?.contactName || phoneNumber,
        messageCount: msgs.length,
        lastMessage: lastMessage?.content,
        lastTimestamp: lastMessage?.timestamp
      });
    });
    
    res.json({
      success: true,
      total: allConversations.length,
      conversations: allConversations
    });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao listar conversas' });
  }
});

// Rota para salvar agendamento confirmado
app.post('/api/bookings/save', (req, res) => {
  try {
    const { phoneNumber, bookingData } = req.body;

    if (!phoneNumber || !bookingData) {
      return res.status(400).json({ error: 'phoneNumber e bookingData são obrigatórios' });
    }

    // Inicializar array se não existir
    if (!confirmedBookings.has(phoneNumber)) {
      confirmedBookings.set(phoneNumber, []);
    }

    // Adicionar agendamento
    confirmedBookings.get(phoneNumber).push(bookingData);

    console.log(`✅ Agendamento salvo para ${phoneNumber}`);

    res.json({
      success: true,
      message: 'Agendamento salvo com sucesso',
      bookingId: bookingData.id
    });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao salvar agendamento' });
  }
});

// Rota para obter agendamentos de uma pessoa
app.get('/api/bookings/:phoneNumber', (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const bookings = confirmedBookings.get(phoneNumber) || [];

    res.json({
      success: true,
      phoneNumber,
      total: bookings.length,
      bookings: bookings.map(b => ({
        id: b.id,
        service: b.service.name,
        date: b.date,
        time: b.time,
        email: b.email,
        price: b.service.price,
        timestamp: b.timestamp
      }))
    });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao obter agendamentos' });
  }
});

// Rota para cancelar agendamento
app.delete('/api/bookings/:phoneNumber/:bookingId', (req, res) => {
  try {
    const { phoneNumber, bookingId } = req.params;
    const bookings = confirmedBookings.get(phoneNumber) || [];

    const index = bookings.findIndex(b => b.id === bookingId);
    
    if (index === -1) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    bookings.splice(index, 1);
    confirmedBookings.set(phoneNumber, bookings);

    res.json({
      success: true,
      message: 'Agendamento cancelado com sucesso'
    });
  } catch (error) {
    console.error('Erro:', error);
    res.status(500).json({ error: 'Erro ao cancelar agendamento' });
  }
});

// Rota para verificar status do WhatsApp
app.get('/api/whatsapp/status', (req, res) => {
  res.json(getWhatsAppStatus());
});

// Rota para desconectar WhatsApp
app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    const client = require('./whatsapp').getClient();
    if (client) {
      await client.logout();
      res.json({ success: true, message: 'WhatsApp desconectado' });
    } else {
      res.status(400).json({ error: 'Cliente não inicializado' });
    }
  } catch (error) {
    console.error('Erro ao desconectar:', error);
    res.status(500).json({ error: 'Erro ao desconectar' });
  }
});

// Rota para exibir QR code
app.get('/api/whatsapp/qr', async (req, res) => {
  try {
    const currentQR = getLastQR();
    
    if (!currentQR) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Conectar WhatsApp - AgendMed</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container {
              background: white;
              border-radius: 12px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              padding: 40px;
              max-width: 500px;
              width: 100%;
              text-align: center;
            }
            h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
            .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
            .loading { color: #667eea; font-size: 16px; margin: 40px 0; }
            .spinner {
              border: 4px solid #f3f3f3;
              border-top: 4px solid #667eea;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 20px auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .button {
              background: #667eea;
              color: white;
              border: none;
              padding: 12px 24px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              width: 100%;
              margin-top: 20px;
            }
            .button:hover { background: #5568d3; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔗 Conectar WhatsApp</h1>
            <p class="subtitle">Gerando QR code...</p>
            <div class="spinner"></div>
            <p style="color: #999; font-size: 13px; margin-top: 20px;">
              Aguarde enquanto o QR code é gerado. Isso pode levar alguns segundos.
            </p>
            <button class="button" onclick="location.reload()">
              🔄 Tentar Novamente
            </button>
          </div>
          <script>
            // Auto-refresh a cada 3 segundos
            setTimeout(() => {
              location.reload();
            }, 3000);
          </script>
        </body>
        </html>
      `);
    }

    // Gerar imagem do QR code
    const qrImage = await qrcode.toDataURL(currentQR);

    // Retornar HTML com o QR code
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conectar WhatsApp - AgendMed</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
          }
          
          h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
          }
          
          .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
          }
          
          .qr-container {
            background: #f5f5f5;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
            display: flex;
            justify-content: center;
          }
          
          .qr-container img {
            max-width: 300px;
            width: 100%;
            height: auto;
          }
          
          .instructions {
            background: #f0f7ff;
            border-left: 4px solid #667eea;
            padding: 15px;
            border-radius: 4px;
            text-align: left;
            margin-bottom: 20px;
          }
          
          .instructions h3 {
            color: #667eea;
            margin-bottom: 10px;
            font-size: 14px;
          }
          
          .instructions ol {
            margin-left: 20px;
            color: #555;
            font-size: 13px;
            line-height: 1.8;
          }
          
          .instructions li {
            margin-bottom: 8px;
          }
          
          .status {
            padding: 12px;
            background: #e8f5e9;
            border-radius: 4px;
            color: #2e7d32;
            font-size: 13px;
            margin-bottom: 20px;
          }
          
          .button {
            background: #667eea;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            transition: background 0.3s;
            width: 100%;
          }
          
          .button:hover {
            background: #5568d3;
          }
          
          .button-secondary {
            background: #f5f5f5;
            color: #333;
            margin-top: 10px;
          }
          
          .button-secondary:hover {
            background: #e0e0e0;
          }
          
          .loading {
            display: inline-block;
            width: 8px;
            height: 8px;
            background: #667eea;
            border-radius: 50%;
            animation: pulse 1.5s infinite;
            margin-right: 8px;
          }
          
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔗 Conectar WhatsApp</h1>
          <p class="subtitle">Escaneie o código QR abaixo com seu celular</p>
          
          <div class="qr-container">
            <img src="${qrImage}" alt="QR Code">
          </div>
          
          <div class="status">
            <span class="loading"></span>
            Aguardando leitura do QR code...
          </div>
          
          <div class="instructions">
            <h3>📱 Como conectar:</h3>
            <ol>
              <li>Abra <strong>WhatsApp</strong> no seu celular</li>
              <li>Vá em <strong>Configurações</strong></li>
              <li>Selecione <strong>Dispositivos Conectados</strong></li>
              <li>Toque em <strong>Conectar um dispositivo</strong></li>
              <li>Aponte a câmera para o QR code acima</li>
              <li>Aguarde a confirmação</li>
            </ol>
          </div>
          
          <button class="button" onclick="window.location.reload()">
            🔄 Atualizar QR Code
          </button>
          <button class="button button-secondary" onclick="window.close()">
            ✕ Fechar
          </button>
        </div>
        
        <script>
          // Auto-refresh a cada 30 segundos
          setTimeout(() => {
            window.location.reload();
          }, 30000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Erro ao gerar QR code:', error);
    res.status(500).json({ error: 'Erro ao gerar QR code' });
  }
});



app.listen(PORT, () => {
  console.log(`Chatbot rodando na porta ${PORT}`);
});

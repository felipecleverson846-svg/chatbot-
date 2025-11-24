const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

let whatsappClient = null;
let isReady = false;
let qrCallback = null;
let lastQR = null;
let messageCallback = null; // Callback para quando receber mensagem

// Inicializar cliente WhatsApp
function initWhatsApp(onQR, onMessage) {
  qrCallback = onQR;
  messageCallback = onMessage;
  
  whatsappClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  whatsappClient.on('qr', (qr) => {
    console.log('QR Code recebido. Escaneie com seu WhatsApp:');
    lastQR = qr;
    qrcode.generate(qr, { small: true });
    if (qrCallback) {
      qrCallback(qr);
    }
  });

  whatsappClient.on('ready', () => {
    console.log('✓ WhatsApp conectado e pronto!');
    isReady = true;
    lastQR = null;
  });

  whatsappClient.on('message', async (msg) => {
    // Verificar se é uma mensagem de grupo
    const isGroup = msg.from.includes('@g.us');
    
    if (isGroup) {
      console.log(`Mensagem de grupo ignorada: ${msg.from}`);
      return;
    }
    
    try {
      // Obter informações do contato
      const contact = await msg.getContact();
      const contactName = contact.name || contact.pushname || msg.from;
      const phoneNumber = msg.from.replace('@c.us', '');
      
      console.log(`Mensagem recebida de ${contactName} (${phoneNumber}): ${msg.body}`);
      
      // Chamar callback com os dados da mensagem
      if (messageCallback) {
        messageCallback({
          phoneNumber,
          contactName,
          message: msg.body,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.log(`Mensagem recebida de ${msg.from}: ${msg.body}`);
      const phoneNumber = msg.from.replace('@c.us', '');
      if (messageCallback) {
        messageCallback({
          phoneNumber,
          contactName: msg.from,
          message: msg.body,
          timestamp: new Date()
        });
      }
    }
  });

  whatsappClient.on('disconnected', () => {
    console.log('WhatsApp desconectado');
    isReady = false;
    lastQR = null;
  });

  whatsappClient.initialize();
}

// Função para obter o último QR code
function getLastQR() {
  return lastQR;
}

// Função para obter nome do contato
async function getContactName(phoneNumber) {
  try {
    if (!whatsappClient) {
      return phoneNumber;
    }
    
    const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
    const contact = await whatsappClient.getContactById(chatId);
    
    return contact.name || contact.pushname || phoneNumber;
  } catch (error) {
    console.error('Erro ao obter nome do contato:', error);
    return phoneNumber;
  }
}

// Função para enviar mensagem via WhatsApp
async function sendWhatsAppMessage(phoneNumber, message) {
  try {
    if (!isReady) {
      return { success: false, error: 'WhatsApp não está conectado' };
    }

    // Formatar número (adicionar código do país se necessário)
    const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
    
    // Verificar se é um grupo
    if (chatId.includes('@g.us')) {
      return { success: false, error: 'Não é permitido enviar mensagens para grupos' };
    }
    
    await whatsappClient.sendMessage(chatId, message);
    return { success: true, message: 'Mensagem enviada' };
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    return { success: false, error: error.message };
  }
}

// Função para enviar mensagem com botões
async function sendButtonMessage(phoneNumber, message, buttons) {
  try {
    if (!isReady) {
      return { success: false, error: 'WhatsApp não está conectado' };
    }

    const chatId = phoneNumber.includes('@') ? phoneNumber : `${phoneNumber}@c.us`;
    
    if (chatId.includes('@g.us')) {
      return { success: false, error: 'Não é permitido enviar mensagens para grupos' };
    }

    // Criar botões
    const buttonList = buttons.map((btn, index) => ({
      body: btn.text,
      id: `btn_${index}`
    }));

    const msg = {
      type: 'list',
      body: message,
      footer: 'AgendMed',
      sections: [
        {
          title: 'Opções',
          rows: buttonList
        }
      ]
    };

    await whatsappClient.sendMessage(chatId, msg);
    return { success: true, message: 'Mensagem com botões enviada' };
  } catch (error) {
    console.error('Erro ao enviar mensagem com botões:', error);
    // Fallback: enviar como texto simples
    return await sendWhatsAppMessage(phoneNumber, message);
  }
}

// Função para obter status da conexão
function getWhatsAppStatus() {
  return {
    connected: isReady,
    status: isReady ? 'Conectado' : 'Desconectado'
  };
}

module.exports = {
  initWhatsApp,
  sendWhatsAppMessage,
  sendButtonMessage,
  getWhatsAppStatus,
  getClient: () => whatsappClient,
  isConnected: () => isReady,
  getLastQR: getLastQR,
  getContactName: getContactName
};

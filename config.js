/**
 * Configuração do Chatbot AgendMed
 * 
 * Este arquivo centraliza todas as configurações necessárias
 * para o chatbot funcionar corretamente quando hospedado separadamente
 */

const config = {
  // Porta do servidor
  port: process.env.PORT || 3001,

  // URL do Frontend (Sistema AgendMed)
  // Usado para fazer chamadas de API
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  // URL do Chatbot (para referência)
  chatbotUrl: process.env.CHATBOT_URL || 'http://localhost:3001',

  // Ambiente
  nodeEnv: process.env.NODE_ENV || 'development',

  // Banco de dados (se necessário)
  databaseUrl: process.env.DATABASE_URL,

  // CORS - Configurar domínios permitidos
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  },

  // Validar configuração
  validate() {
    if (!this.frontendUrl) {
      console.warn('⚠️ FRONTEND_URL não configurada. Usando padrão: http://localhost:3000');
    }
    
    if (this.nodeEnv === 'production') {
      if (!this.frontendUrl.startsWith('https://')) {
        console.warn('⚠️ Em produção, FRONTEND_URL deve usar HTTPS');
      }
      if (!this.chatbotUrl.startsWith('https://')) {
        console.warn('⚠️ Em produção, CHATBOT_URL deve usar HTTPS');
      }
    }
  },

  // Obter URLs formatadas
  getApiUrl(endpoint) {
    return `${this.frontendUrl}${endpoint}`;
  },

  // Exibir configuração (sem dados sensíveis)
  display() {
    console.log('\n📋 Configuração do Chatbot:');
    console.log(`   Porta: ${this.port}`);
    console.log(`   Frontend: ${this.frontendUrl}`);
    console.log(`   Chatbot: ${this.chatbotUrl}`);
    console.log(`   Ambiente: ${this.nodeEnv}`);
    console.log('');
  }
};

// Validar ao carregar
config.validate();

module.exports = config;

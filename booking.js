// Estados do agendamento
const BOOKING_STEPS = {
  IDLE: 'idle',
  ASKING_SERVICE: 'asking_service',
  ASKING_PERIOD: 'asking_period',
  ASKING_DATE: 'asking_date',
  ASKING_TIME: 'asking_time',
  CONFIRMING: 'confirming',
  COMPLETED: 'completed'
};

// Armazenar estado de agendamento por pessoa
const bookingStates = new Map();

// Serviços disponíveis (serão carregados dinamicamente)
let SERVICES = [];

// Função para carregar serviços do banco de dados
async function loadServices(userId) {
  try {
    const config = require('./config');
    const response = await fetch(config.getApiUrl(`/api/chatbot/services?userId=${userId}`));
    
    if (!response.ok) {
      console.error('Erro ao buscar serviços:', response.status);
      return [];
    }
    
    const services = await response.json();
    SERVICES = services;
    console.log(`✅ ${services.length} serviços carregados do banco de dados`);
    return services;
  } catch (error) {
    console.error('Erro ao carregar serviços:', error);
    return [];
  }
}

// Função para buscar horários disponíveis
async function getAvailableSlots(userId, date, period) {
  try {
    const config = require('./config');
    const response = await fetch(config.getApiUrl(`/api/schedule/get-appointments?userId=${userId}&date=${date}`));
    
    if (!response.ok) {
      console.error('Erro ao buscar horários:', response.status);
      return [];
    }
    
    const blockedTimes = await response.json();
    
    // Buscar horários do usuário
    const userResponse = await fetch(config.getApiUrl(`/api/chatbot/user-times?userId=${userId}`));
    if (!userResponse.ok) {
      return [];
    }
    
    const userData = await userResponse.json();
    const allTimes = userData.times || [];
    
    // Filtrar por período
    const filteredTimes = allTimes.filter(time => {
      const [hour] = time.split(':').map(Number);
      if (period === 'manhã') {
        return hour >= 8 && hour < 12;
      } else if (period === 'tarde') {
        return hour >= 12 && hour < 18;
      }
      return true;
    });
    
    // Remover horários bloqueados
    const availableTimes = filteredTimes.filter(time => !blockedTimes.includes(time));
    
    return availableTimes;
  } catch (error) {
    console.error('Erro ao buscar horários disponíveis:', error);
    return [];
  }
}

// Iniciar processo de agendamento
async function startBooking(phoneNumber, contactName, userId) {
  // Carregar serviços do banco de dados
  if (SERVICES.length === 0 && userId) {
    await loadServices(userId);
  }
  
  bookingStates.set(phoneNumber, {
    step: BOOKING_STEPS.ASKING_SERVICE,
    data: {
      phoneNumber,
      contactName,
      userId,
      service: null,
      period: null,
      date: null,
      time: null
    }
  });
  
  return getServicesList();
}

// Obter lista de serviços formatada
function getServicesList() {
  let message = '📋 *Serviços Disponíveis:*\n\n';
  SERVICES.forEach((service, index) => {
    message += `${index + 1}. ${service.name} (${service.duration}min - R$ ${service.price})\n`;
  });
  message += '\nDigite o número do serviço desejado:';
  return message;
}

// Obter lista de serviços como botões
function getServicesButtons() {
  return SERVICES.map((service, index) => ({
    text: `${index + 1}️⃣ ${service.name} - R$ ${service.price}`
  }));
}

// Processar resposta do usuário
async function processBookingResponse(phoneNumber, userMessage) {
  const state = bookingStates.get(phoneNumber);
  
  if (!state) {
    return {
      response: 'Desculpe, não consegui encontrar seu agendamento. Digite "agendar" para começar novamente.',
      completed: false
    };
  }

  const { step, data } = state;

  switch (step) {
    case BOOKING_STEPS.ASKING_SERVICE:
      return handleServiceSelection(phoneNumber, userMessage, data);
    
    case BOOKING_STEPS.ASKING_PERIOD:
      return handlePeriodSelection(phoneNumber, userMessage, data);
    
    case BOOKING_STEPS.ASKING_DATE:
      return await handleDateSelection(phoneNumber, userMessage, data);
    
    case BOOKING_STEPS.ASKING_TIME:
      return await handleTimeSelection(phoneNumber, userMessage, data);
    
    case BOOKING_STEPS.CONFIRMING:
      return await handleConfirmation(phoneNumber, userMessage, data);
    
    default:
      return {
        response: 'Desculpe, ocorreu um erro. Digite "agendar" para começar novamente.',
        completed: false
      };
  }
}

// Selecionar serviço
function handleServiceSelection(phoneNumber, userMessage, data) {
  const serviceIndex = parseInt(userMessage) - 1;
  
  if (isNaN(serviceIndex) || serviceIndex < 0 || serviceIndex >= SERVICES.length) {
    return {
      response: `❌ Opção inválida. Por favor, digite um número de 1 a ${SERVICES.length}.`,
      completed: false
    };
  }

  const service = SERVICES[serviceIndex];
  data.service = service;

  // Atualizar estado
  const state = bookingStates.get(phoneNumber);
  state.step = BOOKING_STEPS.ASKING_PERIOD;
  bookingStates.set(phoneNumber, state);

  return {
    response: `✅ Serviço selecionado: *${service.name}*\n\nQual período você prefere?\n\n1️⃣ Manhã (08:00 - 12:00)\n2️⃣ Tarde (12:00 - 18:00)\n\nDigite 1 ou 2:`,
    completed: false
  };
}

// Selecionar período
function handlePeriodSelection(phoneNumber, userMessage, data) {
  const choice = userMessage.trim().toLowerCase();
  
  let period = null;
  if (choice === '1' || choice === 'manhã' || choice === 'manha') {
    period = 'manhã';
  } else if (choice === '2' || choice === 'tarde') {
    period = 'tarde';
  } else {
    return {
      response: '❌ Opção inválida. Por favor, digite 1 para Manhã ou 2 para Tarde.',
      completed: false
    };
  }

  data.period = period;

  // Atualizar estado
  const state = bookingStates.get(phoneNumber);
  state.step = BOOKING_STEPS.ASKING_DATE;
  bookingStates.set(phoneNumber, state);

  return {
    response: `✅ Período selecionado: *${period.charAt(0).toUpperCase() + period.slice(1)}*\n\nQual data você prefere? (formato: DD/MM/YYYY)`,
    completed: false
  };
}

// Selecionar data
async function handleDateSelection(phoneNumber, userMessage, data) {
  // Validar formato de data
  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  
  if (!dateRegex.test(userMessage)) {
    return {
      response: '❌ Formato inválido. Por favor, use o formato DD/MM/YYYY (ex: 25/12/2024)',
      completed: false
    };
  }

  // Validar se a data é futura
  const [day, month, year] = userMessage.split('/');
  const selectedDate = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (selectedDate < today) {
    return {
      response: '❌ A data deve ser no futuro. Por favor, escolha outra data.',
      completed: false
    };
  }

  data.date = userMessage;

  // Buscar horários disponíveis
  const dateFormatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const availableSlots = await getAvailableSlots(data.userId, dateFormatted, data.period);

  if (availableSlots.length === 0) {
    return {
      response: `❌ Desculpe, não há horários disponíveis em ${data.period} para a data ${userMessage}. Por favor, escolha outra data.`,
      completed: false
    };
  }

  // Armazenar horários disponíveis
  const state = bookingStates.get(phoneNumber);
  state.availableSlots = availableSlots;
  state.step = BOOKING_STEPS.ASKING_TIME;
  bookingStates.set(phoneNumber, state);

  // Formatar lista de horários
  let timesList = `✅ Data selecionada: *${userMessage}*\n\n📋 *Horários disponíveis em ${data.period}:*\n\n`;
  availableSlots.forEach((time, index) => {
    timesList += `${index + 1}. ${time}\n`;
  });
  timesList += `\nDigite o número do horário desejado:`;

  return {
    response: timesList,
    completed: false
  };
}

// Selecionar horário
async function handleTimeSelection(phoneNumber, userMessage, data) {
  const state = bookingStates.get(phoneNumber);
  const availableSlots = state.availableSlots || [];
  
  const slotIndex = parseInt(userMessage) - 1;
  
  if (isNaN(slotIndex) || slotIndex < 0 || slotIndex >= availableSlots.length) {
    return {
      response: `❌ Opção inválida. Por favor, digite um número de 1 a ${availableSlots.length}.`,
      completed: false
    };
  }

  const selectedTime = availableSlots[slotIndex];
  data.time = selectedTime;

  // Atualizar estado
  state.step = BOOKING_STEPS.CONFIRMING;
  bookingStates.set(phoneNumber, state);

  // Gerar resumo
  const summary = `
📅 *Resumo do Agendamento:*

👤 Nome: ${data.contactName}
📱 Telefone: ${data.phoneNumber}
🦷 Serviço: ${data.service.name}
📆 Data: ${data.date}
⏰ Horário: ${data.time}
🕐 Período: ${data.period}
💰 Valor: R$ ${data.service.price}

Confirma este agendamento? (sim/não)
  `;

  return {
    response: summary,
    completed: false
  };
}

// Confirmar agendamento
async function handleConfirmation(phoneNumber, userMessage, data) {
  const response = userMessage.toLowerCase().trim();

  if (response === 'sim' || response === 's') {
    // Agendamento confirmado
    const state = bookingStates.get(phoneNumber);
    state.step = BOOKING_STEPS.COMPLETED;
    bookingStates.set(phoneNumber, state);

    // Converter data para formato ISO
    const [day, month, year] = data.date.split('/');
    const appointmentDate = new Date(`${year}-${month}-${day}T${data.time}:00`);

    // Salvar agendamento no banco de dados
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const saveResponse = await fetch(`${frontendUrl}/api/chatbot/save-appointment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.contactName,
          phone: data.phoneNumber,
          serviceId: data.service.id,
          userId: data.userId,
          appointmentDate: appointmentDate.toISOString(),
          time: data.time
        })
      });

      if (!saveResponse.ok) {
        console.error('Erro ao salvar agendamento:', saveResponse.status);
        return {
          response: `⚠️ *Agendamento Confirmado!*\n\nSeu agendamento foi confirmado, mas houve um erro ao registrar no sistema. Por favor, entre em contato conosco.\n\n📋 Detalhes:\n🦷 Serviço: ${data.service.name}\n📆 Data: ${data.date}\n⏰ Horário: ${data.time}`,
          completed: true,
          bookingData: data
        };
      }

      const result = await saveResponse.json();

      return {
        response: `✅ *Agendamento Confirmado!*\n\nSeu agendamento foi registrado com sucesso!\n\n📋 ID: ${result.id}\n🦷 Serviço: ${data.service.name}\n📆 Data: ${data.date}\n⏰ Horário: ${data.time}\n\nObrigado por escolher nossos serviços! 😊`,
        completed: true,
        bookingData: data
      };
    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      return {
        response: `✅ *Agendamento Confirmado!*\n\nSeu agendamento foi confirmado!\n\n🦷 Serviço: ${data.service.name}\n📆 Data: ${data.date}\n⏰ Horário: ${data.time}\n\nObrigado por escolher nossos serviços! 😊`,
        completed: true,
        bookingData: data
      };
    }
  } else if (response === 'não' || response === 'n') {
    // Cancelar agendamento
    bookingStates.delete(phoneNumber);
    
    return {
      response: '❌ Agendamento cancelado. Digite "agendar" se desejar tentar novamente.',
      completed: false
    };
  } else {
    return {
      response: '❌ Resposta inválida. Por favor, digite "sim" ou "não".',
      completed: false
    };
  }
}

// Obter estado atual do agendamento
function getBookingState(phoneNumber) {
  return bookingStates.get(phoneNumber);
}

// Limpar estado de agendamento
function clearBookingState(phoneNumber) {
  bookingStates.delete(phoneNumber);
}

module.exports = {
  BOOKING_STEPS,
  startBooking,
  processBookingResponse,
  getBookingState,
  clearBookingState,
  SERVICES,
  getServicesButtons,
  loadServices
};

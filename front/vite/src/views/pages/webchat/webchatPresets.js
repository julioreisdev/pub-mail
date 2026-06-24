export const WEBCHAT_PRESETS = [
  {
    id: 'pubmail',
    name: 'Pub Mail',
    icon: '💙',
    personalizacao: {
      theme: {
        layoutPreset: 'bubble',
        primaryColor: '#2979ff',
        secondaryColor: '#ffffff',
        backgroundColor: '#f4f6fb',
        font: 'Inter',
        logoUrl: '',
        avatarUrl: '',
        darkMode: false,
        borderRadius: 18,
        bubbleShadow: true,
        backgroundImageUrl: '',
        userBubbleColor: '#2979ff',
        botBubbleColor: '#f4f6fb'
      },
      header: {
        show: true,
        text: 'Pub Mail AI',
        align: 'center',
        style: ''
      },
      quickReplies: ['Quero saber mais!', 'Falar com humano'],
      welcomeBotMessage: 'Olá! Seja bem-vindo(a) ao nosso webchat.',
      welcomeScreen: {
        enabled: true,
        title: 'Bem-vindo!',
        subtitle: 'Podemos te ajudar?',
        mediaType: 'image',
        mediaUrl: '',
        ctaText: 'Começar',
        showQuickReplies: true,
        language: 'pt-BR',
        richText: '<b>Podemos te ajudar?</b>',
        position: 'center'
      },
      animation: {
        type: 'fade',
        duration: 400
      },
      placeholderInput: 'Digite sua mensagem...',
      botName: 'Pub Mail',
      footerText: '',
      customCSS: ''
    }
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '💬',
    personalizacao: {
      theme: {
        layoutPreset: 'whatsapp',
        primaryColor: '#075e54',
        secondaryColor: '#ffffff',
        backgroundColor: '#efeae2',
        font: 'Segoe UI, Helvetica Neue, Arial, sans-serif',
        logoUrl: '',
        avatarUrl: '',
        darkMode: false,
        borderRadius: 14,
        bubbleShadow: true,
        backgroundImageUrl: '',
        userBubbleColor: '#d9fdd3',
        botBubbleColor: '#ffffff'
      },
      header: {
        show: true,
        text: 'Atendimento Pub Mail',
        align: 'left',
        style: ''
      },
      quickReplies: ['Quero uma proposta', 'Falar com especialista', 'Ver planos', 'Me liga depois'],
      welcomeBotMessage: 'Olá! Como posso te ajudar hoje?',
      welcomeScreen: {
        enabled: true,
        title: 'Fale com o time',
        subtitle: 'Atendimento rápido',
        mediaType: '',
        mediaUrl: '',
        ctaText: 'Iniciar conversa',
        showQuickReplies: true,
        language: 'pt-BR',
        richText: '',
        position: 'center'
      },
      animation: {
        type: 'fade',
        duration: 250
      },
      placeholderInput: 'Mensagem',
      botName: 'Atendimento',
      footerText: '',
      customCSS: ''
    }
  }
];

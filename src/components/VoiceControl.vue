<template>
  <button type="button">Voice</button>
</template>

<script>
const { h } = Vue;

const SpeechRecognitionFactory = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export default {
  name: 'VoiceControl',
  emits: ['voice-message'],
  data() {
    return {
      feedbackMessage: '',
      feedbackTimer: 0,
      isListening: false,
      recognition: null,
    };
  },
  mounted() {
    const SpeechRecognition = SpeechRecognitionFactory();
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    recognition.onstart = () => {
      this.isListening = true;
      this.showFeedback('Escuchando...', 5000);
    };
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        this.$emit('voice-message', transcript);
        this.showFeedback('Comando recibido.', 2000);
      }
    };
    recognition.onerror = (event) => {
      const message = event.error === 'no-speech'
        ? 'No se detecto voz. Intenta de nuevo.'
        : event.error === 'audio-capture'
          ? 'Error de microfono. Revisa los permisos.'
          : 'Ocurrio un error.';
      this.showFeedback(message, 3000);
    };
    recognition.onend = () => {
      this.isListening = false;
    };
    this.recognition = recognition;
  },
  beforeUnmount() {
    if (this.feedbackTimer) window.clearTimeout(this.feedbackTimer);
    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.stop();
    }
  },
  methods: {
    showFeedback(message, duration) {
      this.feedbackMessage = message;
      if (this.feedbackTimer) window.clearTimeout(this.feedbackTimer);
      this.feedbackTimer = window.setTimeout(() => {
        this.feedbackMessage = '';
      }, duration);
    },
    toggleListening() {
      if (!this.recognition) {
        this.showFeedback('El control por voz no es compatible con este navegador.', 3000);
        return;
      }
      if (this.isListening) {
        this.recognition.stop();
        return;
      }
      try {
        this.recognition.start();
      } catch {
        this.isListening = false;
        this.showFeedback('No se pudo iniciar el reconocimiento.', 3000);
      }
    },
  },
  render() {
    return h(Vue.Fragment, [
      this.feedbackMessage ? h('div', {
        class: 'glass-panel-dark fixed bottom-24 right-5 z-50 rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-panel transition-all duration-300 md:right-6',
        role: 'status',
        'aria-live': 'assertive',
      }, this.feedbackMessage) : null,
      h('button', {
        class: `fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-2xl border text-white shadow-panel transition duration-300 hover:-translate-y-0.5 md:bottom-6 md:right-6 ${
          this.isListening
            ? 'animate-pulse border-rose-300/40 bg-rose-500/90'
            : 'fideo-soft-glow border-brand-300/30 bg-brand-400 text-slate-950 hover:bg-brand-300'
        }`,
        type: 'button',
        'aria-label': this.isListening ? 'Detener grabacion' : 'Iniciar grabacion de voz',
        onClick: this.toggleListening,
      }, [h('i', { class: 'fa-solid fa-microphone text-xl' })]),
    ]);
  },
};
</script>

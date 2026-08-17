export class VoiceService {
  private recognition: any = null;

  isSupported(): boolean {
    return typeof window !== 'undefined' && 
      (!!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition);
  }

  start(
    lang: string, 
    onResult: (text: string) => void, 
    onError: (error: any) => void, 
    onEnd: () => void
  ) {
    if (!this.isSupported()) {
      onError(new Error('SPEECH_NOT_SUPPORTED'));
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = lang;

    this.recognition.onresult = (event: any) => {
      if (event.results && event.results.length > 0) {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      } else {
        onError(new Error('NO_SPEECH_DETECTED'));
      }
    };

    this.recognition.onerror = (event: any) => {
      console.error('[VoiceService] Speech recognition error', event.error);
      onError(event);
    };

    this.recognition.onend = () => {
      onEnd();
    };

    try {
      this.recognition.start();
    } catch (e) {
      onError(e);
    }
  }

  stop() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.warn('[VoiceService] Stop called on non-running instance', e);
      }
      this.recognition = null;
    }
  }

  /**
   * Speaks a given text out loud using the Web Speech Synthesis API.
   * Compatible with all major browsers including Safari.
   * @param text - The text to read aloud.
   * @param lang - BCP-47 language tag (e.g. 'es-CO', 'en-US').
   */
  speak(text: string, lang: string = 'es-CO', onEnd?: () => void): void {
    if (!('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }

    // Solo cancelar si está activamente hablando para evitar bugs con el ciclo de audio en iOS
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    // iOS Safari Fix: Forzar resume para desbloquear el canal de audio tras finalizar SpeechRecognition
    window.speechSynthesis.resume();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    let ended = false;
    const safeEnd = () => {
      if (!ended) {
        ended = true;
        if (onEnd) onEnd();
      }
    };

    // Estimar el tiempo de lectura (80ms por carácter o mínimo 3 segundos) + margen de seguridad de 2 segundos
    const estimatedMs = Math.max(text.length * 80, 3000);
    const timeoutId = setTimeout(() => {
      console.warn('[VoiceService] speak timeout triggered (fallback)');
      safeEnd();
    }, estimatedMs + 2000);

    utterance.onend = () => {
      clearTimeout(timeoutId);
      safeEnd();
    };

    utterance.onerror = (event) => {
      console.error('[VoiceService] Speech synthesis error', event);
      clearTimeout(timeoutId);
      safeEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}


export const voiceService = new VoiceService();

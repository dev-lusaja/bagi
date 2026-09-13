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
   * iOS Safari Fix: Unlocks speech synthesis audio queue during a user gesture.
   */
  unlockAudio(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.resume();
      // Speak an empty string to initialize audio context on iOS Safari
      const dummyUtterance = new SpeechSynthesisUtterance('');
      dummyUtterance.volume = 0;
      window.speechSynthesis.speak(dummyUtterance);
    } catch (e) {
      console.warn('[VoiceService] Audio unlock failed', e);
    }
  }

  /**
   * Speaks a given text out loud using the Web Speech Synthesis API.
   * Compatible with all major browsers including iOS Safari.
   * @param text - The text to read aloud.
   * @param lang - BCP-47 language tag (e.g. 'es-CO', 'en-US').
   * @param onEnd - Callback called when speech finishes.
   */
  speak(text: string, lang: string = 'es-CO', onEnd?: () => void): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      if (onEnd) onEnd();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    } catch (e) {
      console.warn('[VoiceService] Error resetting synthesis before speak', e);
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    let ended = false;
    let resumeInterval: any = null;

    const safeEnd = () => {
      if (resumeInterval) {
        clearInterval(resumeInterval);
        resumeInterval = null;
      }
      if (!ended) {
        ended = true;
        if (onEnd) onEnd();
      }
    };

    // Estimar el tiempo de lectura (150ms por carácter o mínimo 10 segundos) + margen de seguridad de 5 segundos
    const estimatedMs = Math.max(text.length * 150, 10000);
    const timeoutId = setTimeout(() => {
      console.warn('[VoiceService] speak timeout triggered (fallback)');
      safeEnd();
    }, estimatedMs + 5000);

    // iOS Safari bug fix: periodic resume prevents iOS Safari speech synthesis from pausing silently
    resumeInterval = setInterval(() => {
      if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }, 1000);

    utterance.onend = () => {
      clearTimeout(timeoutId);
      safeEnd();
    };

    utterance.onerror = (event) => {
      console.error('[VoiceService] Speech synthesis error', event);
      clearTimeout(timeoutId);
      safeEnd();
    };

    try {
      window.speechSynthesis.speak(utterance);
      window.speechSynthesis.resume();
    } catch (e) {
      console.error('[VoiceService] Exception during speechSynthesis.speak', e);
      clearTimeout(timeoutId);
      safeEnd();
    }
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}


export const voiceService = new VoiceService();

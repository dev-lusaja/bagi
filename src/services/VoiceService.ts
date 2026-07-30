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
  speak(text: string, lang: string = 'es-CO'): void {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // Stop any ongoing speech first
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}


export const voiceService = new VoiceService();

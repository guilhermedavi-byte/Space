(function () {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  const createMicTranscriber = ({ onFinal, onStatus, onError } = {}) => {
    if (!SpeechRecognition) {
      return {
        supported: false,
        start: () => onError && onError(new Error("speech_recognition_not_supported")),
        stop: () => {},
      };
    }

    let recognition = null;
    const start = () => {
      if (recognition) {
        try {
          recognition.stop();
        } catch (error) {
          // ignore
        }
      }
      recognition = new SpeechRecognition();
      recognition.lang = "pt-BR";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onstart = () => onStatus && onStatus("Ouvindo");
      recognition.onerror = (event) => onError && onError(event?.error || new Error("speech_error"));
      recognition.onend = () => onStatus && onStatus("Pausado");
      recognition.onresult = (event) => {
        const finalText = Array.from(event.results || [])
          .filter((result) => result.isFinal)
          .map((result) => result[0]?.transcript || "")
          .join(" ")
          .trim();
        if (finalText && onFinal) onFinal(finalText);
      };
      recognition.start();
    };

    const stop = () => {
      if (!recognition) return;
      try {
        recognition.stop();
      } catch (error) {
        // ignore
      }
    };

    return { supported: true, start, stop };
  };

  window.SpaceCopilotAudio = { createMicTranscriber };
})();

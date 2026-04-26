import React, { useState, useEffect, useRef } from 'react';
import { MicrophoneIcon } from './icons/Icons';

// Type definitions for the Web Speech API to fix "Cannot find name 'SpeechRecognition'"
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onstart: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface VoiceControlProps {
    addMessage: (text: string, sender: string) => void;
}

// Augment the window object with SpeechRecognition constructors
declare global {
    interface Window {
        SpeechRecognition: { new(): SpeechRecognition };
        webkitSpeechRecognition: { new(): SpeechRecognition };
    }
}

const VoiceControl: React.FC<VoiceControlProps> = ({ addMessage }) => {
    const [isListening, setIsListening] = useState(false);
    const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const feedbackTimeoutRef = useRef<number | null>(null);

    const showFeedback = (message: string, duration: number) => {
        setFeedbackMessage(message);
        if (feedbackTimeoutRef.current) {
            clearTimeout(feedbackTimeoutRef.current);
        }
        feedbackTimeoutRef.current = window.setTimeout(() => {
            setFeedbackMessage(null);
        }, duration);
    };


    useEffect(() => {
        const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionImpl) {
            console.warn("Speech Recognition API is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognitionImpl();
        recognition.continuous = false;
        recognition.lang = 'es-MX';
        recognition.interimResults = false;

        recognition.onstart = () => {
            setIsListening(true);
            showFeedback('Escuchando...', 5000);
        };

        recognition.onresult = (event) => {
            const currentTranscript = event.results[0][0].transcript;
            if (currentTranscript) {
                addMessage(currentTranscript, 'Admin (Voz)');
                showFeedback('Comando recibido.', 2000);
            }
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
            if (event.error === 'no-speech') {
                showFeedback('No se detectó voz. Intenta de nuevo.', 3000);
            } else if (event.error === 'audio-capture') {
                showFeedback('Error de micrófono. Revisa los permisos.', 4000);
            } else {
                console.error('Speech recognition error:', event.error);
                showFeedback('Ocurrió un error.', 3000);
            }
        };
        
        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
                recognitionRef.current.onstart = null;
                recognitionRef.current.onresult = null;
                recognitionRef.current.onerror = null;
                recognitionRef.current.onend = null;
            }
            if (feedbackTimeoutRef.current) {
                clearTimeout(feedbackTimeoutRef.current);
            }
        };
    }, [addMessage]);

    const handleToggleListening = () => {
        if (!recognitionRef.current) {
            alert("El control por voz no es compatible con este navegador.");
            return;
        }

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            try {
                recognitionRef.current.start();
            } catch (error) {
                console.error("Could not start speech recognition:", error);
                setIsListening(false);
                showFeedback('No se pudo iniciar el reconocimiento.', 3000);
            }
        }
    };

    return (
        <>
            {feedbackMessage && (
                <div 
                    className="fixed bottom-28 right-8 bg-gray-800 dark:bg-gray-900 bg-opacity-80 text-white text-sm px-4 py-2 rounded-lg shadow-lg transition-all duration-300 z-50"
                    role="status"
                    aria-live="assertive"
                >
                    {feedbackMessage}
                </div>
            )}
            <button
                onClick={handleToggleListening}
                className={`fixed bottom-8 right-8 w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 transform hover:scale-110 z-50
                ${isListening ? 'bg-red-500 animate-pulse' : 'bg-green-600 hover:bg-green-700'}`}
                aria-label={isListening ? 'Detener grabación' : 'Iniciar grabación de voz'}
            >
                <MicrophoneIcon />
            </button>
        </>
    );
};

export default VoiceControl;
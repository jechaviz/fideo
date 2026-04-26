
import React, { useState } from 'react';

interface AITrainingProps {
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
}

const AITraining: React.FC<AITrainingProps> = ({ systemPrompt, setSystemPrompt }) => {
  const [prompt, setPrompt] = useState(systemPrompt);
  const [trainingInput, setTrainingInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSavePrompt = () => {
    setStatus('saving');
    setSystemPrompt(prompt);
    setTimeout(() => {
        setStatus('saved');
        setTimeout(() => setStatus('idle'), 2000);
    }, 1000);
  };
  
  const handleTrainWithSentence = () => {
    if (!trainingInput.trim()) return;
    const newKnowledge = `\n- Jerga adicional: "${trainingInput}".`;
    setPrompt(prev => prev + newKnowledge);
    setTrainingInput('');
    handleSavePrompt();
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Entrenamiento de la IA</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Aquí puedes ajustar el comportamiento de la IA y enseñarle nueva jerga o reglas.</p>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md mb-6">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Enseñar con una frase</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          Explícale a la IA una nueva regla en lenguaje normal. Por ejemplo: <span className="italic font-mono bg-gray-100 dark:bg-gray-700 p-1 rounded">"Supreme es lo mismo que primera Golden"</span> o <span className="italic font-mono bg-gray-100 dark:bg-gray-700 p-1 rounded">"Los mangos Kent ahora son de Primera"</span>.
        </p>
        <div className="flex space-x-2">
            <input
                type="text"
                value={trainingInput}
                onChange={(e) => setTrainingInput(e.target.value)}
                placeholder="Ej: 'De la buena' se refiere a calidad Extra"
                className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition bg-white text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            />
            <button
                onClick={handleTrainWithSentence}
                className="px-6 py-3 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
                Enseñar
            </button>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Prompt del Sistema (Avanzado)</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Este es el cerebro de la IA. Edítalo directamente para un control total sobre su comportamiento.</p>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={15}
          className="w-full p-3 font-mono text-xs border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition bg-gray-50 border-gray-300 text-gray-800 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300"
        />
        <div className="mt-4 flex justify-end items-center">
            {status === 'saved' && <span className="text-green-600 dark:text-green-400 mr-4">¡Guardado con éxito!</span>}
            <button
                onClick={handleSavePrompt}
                disabled={status === 'saving'}
                className="px-6 py-2 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                {status === 'saving' ? 'Guardando...' : 'Guardar Prompt'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default AITraining;
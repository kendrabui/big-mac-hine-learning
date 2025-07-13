
import React, { useState } from 'react';
import { SparklesIcon } from './icons/SparklesIcon';

interface NaturalLanguageProcessorProps {
    onProcessPrompt: (prompt: string) => void;
    isProcessing: boolean;
}

export const NaturalLanguageProcessor: React.FC<NaturalLanguageProcessorProps> = ({ onProcessPrompt, isProcessing }) => {
    const [prompt, setPrompt] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isProcessing) return;
        onProcessPrompt(prompt);
        setPrompt(''); // Clear after submit
    };

    return (
        <div className="bg-gray-800/80 rounded-xl p-6 shadow-md border border-gray-700">
            <h3 className="text-lg font-bold text-cyan-400 mb-3 flex items-center gap-2">
                <SparklesIcon />
                Update with AI
            </h3>
            <p className="text-gray-400 text-sm mb-4">
                Tell the AI what to do. For example: "Add the standard list of new items."
            </p>
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g., add new items..."
                    className="flex-grow bg-gray-700 text-gray-200 rounded-md p-2 border border-gray-600 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-colors"
                    disabled={isProcessing}
                    aria-label="Natural language command input"
                />
                <button
                    type="submit"
                    disabled={!prompt.trim() || isProcessing}
                    className="bg-cyan-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-cyan-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                    aria-label="Submit AI command"
                >
                    {isProcessing ? (
                        <>
                         <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                        </>
                    ) : (
                       'Submit'
                    )}
                </button>
            </form>
        </div>
    );
};

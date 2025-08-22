import React, { useState, useCallback } from 'react';

interface ProcessInputProps {
  textValue: string;
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  fileValue: File | null;
  onFileChange: (file: File | null) => void;
  onAnalyze: () => void;
  onReset: () => void;
  isLoading: boolean;
  placeholder: string;
}

/**
 * A component responsible for capturing the user's process description.
 * It allows combined input via a textarea and a file upload.
 */
export const ProcessInput: React.FC<ProcessInputProps> = ({ textValue, onTextChange, fileValue, onFileChange, onAnalyze, onReset, isLoading, placeholder }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileChange(e.dataTransfer.files[0]);
    }
  }, [onFileChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileChange(e.target.files[0]);
    }
  };
  
  const hasInput = !!textValue.trim() || !!fileValue;

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg border border-border-light dark:border-border-dark p-6 flex flex-col h-full">
      <div className="mb-1">
        <h2 className="text-xl font-semibold text-on-surface-light dark:text-on-surface-dark">1. Forneça o Processo</h2>
      </div>
      <p className="text-on-surface-secondary-light dark:text-on-surface-secondary-dark mb-4">Descreva em linguagem natural e/ou envie um arquivo (imagem, .bpmn, .xml, e projetos .bpm/.diag do Bizagi).</p>
      
      <div className="flex flex-col space-y-4 flex-grow min-h-0">
        <div className="flex-grow flex flex-col">
            <textarea
                value={textValue}
                onChange={onTextChange}
                placeholder={placeholder}
                className="w-full flex-grow p-4 border border-border-light dark:border-border-dark bg-background-light dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-ifsc-green focus:border-ifsc-green transition-shadow duration-200 resize-none text-sm leading-relaxed text-on-surface-light dark:text-on-surface-dark placeholder:text-gray-400 dark:placeholder:text-gray-500"
                disabled={isLoading}
            />
        </div>


        <div className="flex items-center space-x-3">
            <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
            <span className="text-gray-500 text-xs font-semibold">E/OU</span>
            <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
        </div>
        
        <div 
          className={`relative h-24 w-full rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center text-center p-4 transition-colors ${isDragging ? 'bg-ifsc-green/10 border-ifsc-green' : 'hover:border-ifsc-green dark:hover:border-ifsc-green'}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {fileValue ? (
             <div className="flex flex-col items-center justify-center text-on-surface-light dark:text-on-surface-dark">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 text-ifsc-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-semibold text-sm">{fileValue.name}</p>
                <button 
                  onClick={() => onFileChange(null)}
                  className="mt-2 text-xs text-red-500 hover:text-red-600 hover:underline"
                  disabled={isLoading}
                >
                    Remover
                </button>
             </div>
          ) : (
            <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-on-surface-secondary-light dark:text-on-surface-secondary-dark text-sm">
                    <span className="font-semibold text-ifsc-green">Clique para enviar</span> ou arraste e solte
                </p>
                <input 
                    type="file" 
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileSelect}
                    disabled={isLoading}
                    accept="image/*,.bpmn,.xml,.diag,.bpm"
                />
            </>
          )}
        </div>
      </div>


      <button
        onClick={onAnalyze}
        disabled={isLoading || !hasInput}
        className="mt-6 w-full bg-ifsc-green text-white font-bold py-3 px-4 rounded-lg hover:bg-ifsc-green-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-light dark:focus:ring-offset-surface-dark focus:ring-ifsc-green disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Analisando...
          </>
        ) : (
          'Analisar e Gerar Artefatos'
        )}
      </button>
    </div>
  );
};

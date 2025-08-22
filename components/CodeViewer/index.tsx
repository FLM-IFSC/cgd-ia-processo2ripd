import React, { useState } from 'react';

interface CodeViewerProps {
  /** The code string to be displayed. */
  code: string;
  /** The language of the code for syntax highlighting context (e.g., 'xml', 'json'). */
  language: string;
  /** The default filename for the download functionality. */
  fileName: string;
}

/**
 * A component that displays a block of code with options to copy or download.
 * It features a dark theme for readability.
 */
export const CodeViewer: React.FC<CodeViewerProps> = ({ code, language, fileName }) => {
  const [copied, setCopied] = useState(false);

  /**
   * Handles the copy button click event.
   * Copies the code to the user's clipboard and provides visual feedback.
   */
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  /**
   * Handles the download button click event.
   * Creates a blob from the code and triggers a browser download.
   */
  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden my-2 border border-border-light dark:border-border-dark">
      <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-white/5 text-xs">
        <span className="font-mono text-on-surface-secondary-light dark:text-on-surface-secondary-dark">{language.toUpperCase()}</span>
        <div className="flex items-center space-x-4">
             <button onClick={handleDownload} className="flex items-center text-on-surface-secondary-light dark:text-on-surface-secondary-dark hover:text-ifsc-green dark:hover:text-ifsc-green transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
             </button>
            <button onClick={handleCopy} className="flex items-center text-on-surface-secondary-light dark:text-on-surface-secondary-dark hover:text-ifsc-green dark:hover:text-ifsc-green transition-colors">
                 {copied ? (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copiado!
                    </>
                ) : (
                    <>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                         </svg>
                         Copiar
                    </>
                )}
            </button>
        </div>
      </div>
      <pre className="p-4 text-sm text-white overflow-x-auto max-h-80 bg-gray-800 dark:bg-black/50">
        <code>{code}</code>
      </pre>
    </div>
  );
};
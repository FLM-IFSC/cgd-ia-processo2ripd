import React, { useEffect, useRef, useState } from 'react';

// Make DmnJS available as a global type if it's loaded from a script tag
declare global {
    interface Window {
        DmnJS: any;
    }
}

interface DmnViewerProps {
  xml: string;
}

/**
 * A React component to render a DMN 1.3 decision table visually using the dmn-js library.
 * It takes DMN XML as a string prop and displays it in a container, with
 * added controls for copying and downloading the XML source.
 */
export const DmnViewer: React.FC<DmnViewerProps> = ({ xml }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!containerRef.current || typeof window.DmnJS === 'undefined') {
        setStatus('error');
        console.error("DMN container or DmnJS library not found.");
        return;
    }

    if (!viewerRef.current) {
        viewerRef.current = new window.DmnJS({
            container: containerRef.current,
            height: '100%',
            width: '100%',
        });
    }

    const viewer = viewerRef.current;

    const displayTable = async () => {
        try {
            setStatus('loading');
            await viewer.importXML(xml);
            setStatus('success');
        } catch (err) {
            console.error('Error importing DMN XML:', err);
            setStatus('error');
        }
    };

    if (xml) {
      displayTable();
    }
  }, [xml]);

  const handleCopy = () => {
    navigator.clipboard.writeText(xml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  const handleDownload = () => {
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'decisao.dmn';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col w-full h-full min-h-[300px] border border-border-light dark:border-border-dark rounded-lg bg-surface-light dark:bg-surface-dark overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-white/5 text-xs border-b border-border-light dark:border-border-dark">
            <span className="font-mono font-semibold text-on-surface-secondary-light dark:text-on-surface-secondary-dark">TABELA DE DECISÃO DMN</span>
            <div className="flex items-center space-x-4">
                 <button onClick={handleDownload} className="flex items-center text-on-surface-secondary-light dark:text-on-surface-secondary-dark hover:text-ifsc-green dark:hover:text-ifsc-green transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download (.dmn)
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
                             Copiar XML
                        </>
                    )}
                </button>
            </div>
        </div>
        <div className="flex-grow relative bg-white">
            <div ref={containerRef} className="w-full h-full" style={{ visibility: status === 'success' ? 'visible' : 'hidden' }} />
            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-600">
                    <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Renderizando tabela de decisão...
                </div>
            )}
            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Falha ao renderizar a tabela DMN.
                </div>
            )}
        </div>
    </div>
  );
};
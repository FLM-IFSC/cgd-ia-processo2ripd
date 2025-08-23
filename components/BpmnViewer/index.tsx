import React, { useEffect, useRef, useState } from 'react';
// import JSZip from 'jszip';

// Make BpmnJS available as a global type if it's loaded from a script tag
declare global {
    interface Window {
        BpmnJS: any;
    }
}

interface BpmnViewerProps {
  xml: string;
}

const BPMN_IO_LOGO_BASE64 = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1My4yIDIwLjMiPjxwYXRoIGZpbGw9IiMyMTIxMjEiIGQ9Ik01LjEgMTIuM3YtNi42bC0yLjQgMi4xLTEuMS0xLjNMNy43IDNoMS4ydjkuM0g1LjF6bTguNi0zLjNjMC0xLjIuMy0yLjIuOS0yLjkuNi0uNyAxLjUtMS4xIDIuNy0xLjFzMi4xLjQgMi43IDEuMWMuNi43LjkgMS43LjkgMi45cy0uMyAyLjItLjkgMi45Yy0uNi43LTEuNSAxLjEtMi43IDEuMXMtMi4xLS40LTIuNy0xLjEyLS42LS43LS45LTEuNy0uOS0yLjl6bTEuOCAwYzAgLjguMiAxLjQuNSAxLjguNC40LjkuNiAxLjUuNnMxLjEtLjIgMS41LS42Yy4zLS40LjUtMSAuNS0xLjhíLS4yLTEuNC0uNS0xLjhjLS40LS40LS45LS42LTEuNS0uNnMtMS4xLjItMS41LjZjLS4zLjQtLjUgMS0uNSAxLjh6bTExLjIgMy4zVjNoNC4xYzEuMiAwIDIuMS4zIDIuOC44LjcuNiAxIDEuNCAxIDIuNSAwIC45LS4yIDEuNi0uNyAyLjJjLS41LjUtMS4yLjgtMi4xLjhoLTIuNHYzLjFoLTIuN3ptMi43LTQuMWgxLjNjLjcgMCAxLjItLjIgMS41LS41LjMtLjMuNS0uNy41LTEuMnMtLjItLjktLjUtMS4yYy0uMy0uMy0uOC0uNS0xLjUtLjVoLTEuM3YzLjR6bTEwLjctNS4zaDEuOHY5LjNoLTEuOFYzem01LjggOS4zaDEuOFY0LjJsMy41IDguMWgxLjdsMy41LTguMXY4LjFoMS44VjNoLTIuOWwtMi42IDYtMi42LTZoLTIuOXY5LjN6TTM3LjkgMTIuM1YzaDEuOHY5LjNoLTEuOHptNi41LTQuN2MwLTEuMi4zLTIuMi45LTIuOS42LS43IDEuNS0xLjEgMi43LTEuMXMyLjEuNCAyLjcgMS4xYy42LjcuOSAxLjcuOSAyLjlzLS4zIDIuMi0uOSAyLjljLS42LjctMS41IDEuMS0yLjcgMS4xcy0yLjEtLjQtMi43LTEuMWMtLjYtLjctLjktMS43LS45LTIuOXptMS44IDBjMCAuOC4yIDEuNC41IDEuOC40LjQuOS42IDEuNS42czEuMS0uMiAxLjUtLjZjLjMtLjQuNS0xIC41LTEuOHMtLjItMS44LS41LTEuOGMtLjQtLjQtLjktLjYtMS41LS42cy0xLjEuMi0xLjUtLjZjLS4zLjQtLjUgMS0uNSAxLjh6Ij48L3BhdGg+PC9zdmc+';

/**
 * A React component to render a BPMN 2.0 diagram using the bpmn-js library.
 */
export const BpmnViewer: React.FC<BpmnViewerProps> = ({ xml }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!containerRef.current || typeof window.BpmnJS === 'undefined') {
        setStatus('error');
        console.error("BPMN container or BpmnJS library not found.");
        return;
    }

    if (!viewerRef.current) {
        viewerRef.current = new window.BpmnJS({
            container: containerRef.current,
            height: '100%',
            width: '100%',
        });
    }

    const viewer = viewerRef.current;

    const displayDiagram = async () => {
        try {
            setStatus('loading');
            await viewer.importXML(xml);
            const canvas = viewer.get('canvas');
            canvas.zoom('fit-viewport', 'auto');
            setStatus('success');
        } catch (err) {
            console.error('Error importing BPMN XML:', err);
            setStatus('error');
        }
    };

    if (xml) {
      displayDiagram();
    }
  }, [xml]);

  const handleCopy = () => {
    navigator.clipboard.writeText(xml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  const downloadFile = (content: Blob, filename: string) => {
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadBpmn = () => {
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    downloadFile(blob, 'processo.bpmn');
  };

  const handleDownloadXml = () => {
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    downloadFile(blob, 'processo.xml');
  };

  return (
    <div className="flex flex-col w-full h-full min-h-[400px] border border-border-light dark:border-border-dark rounded-lg bg-surface-light dark:bg-surface-dark overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-white/5 text-xs border-b border-border-light dark:border-border-dark flex-wrap gap-2">
            <span className="font-mono font-semibold text-on-surface-secondary-light dark:text-on-surface-secondary-dark">DIAGRAMA BPMN</span>
            <div className="flex items-center space-x-2">
                 <span className="text-on-surface-secondary-light dark:text-on-surface-secondary-dark font-medium">Download:</span>
                 <button onClick={handleDownloadBpmn} className="px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-on-surface-light dark:text-on-surface-dark">
                    BPMN.io (.bpmn)
                 </button>
                 <button onClick={handleDownloadXml} className="px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-on-surface-light dark:text-on-surface-dark">
                    XML (.xml)
                 </button>
                 <div className="h-4 border-l border-border-light dark:border-border-dark mx-1"></div>
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
        <div className="flex-grow relative bg-gray-50 dark:bg-gray-800/30">
            <div ref={containerRef} className="w-full h-full" style={{ visibility: status === 'success' ? 'visible' : 'hidden' }} />
            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Renderizando diagrama...
                </div>
            )}
            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Falha ao renderizar o diagrama BPMN.
                </div>
            )}
            {status === 'success' && (
                <a
                    href="https://demo.bpmn.io/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Validar e editar no bpmn.io"
                    className="absolute bottom-3 right-3 z-10 opacity-40 hover:opacity-100 transition-opacity"
                >
                    <img src={BPMN_IO_LOGO_BASE64} alt="Powered by bpmn.io" className="h-5" />
                </a>
            )}
        </div>
    </div>
  );
};

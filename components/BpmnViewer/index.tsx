import React, { useEffect, useRef, useState } from 'react';

// Make BpmnJS available as a global type if it's loaded from a script tag
declare global {
    interface Window {
        BpmnJS: any;
    }
}

interface BpmnViewerProps {
  xml: string;
  onXmlChange: (newXml: string) => void;
}

const BPMN_IO_LOGO_BASE64_LIGHT = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1My4yIDIwLjMiPjxwYXRoIGZpbGw9IiMyMTIxMjEiIGQ9Ik01LjEgMTIuM3YtNi42bC0yLjQgMi4xLTEuMS0xLjNMNy43IDNoMS4ydjkuM0g1LjF6bTguNi0zLjNjMC0xLjIuMy0yLjIuOS0yLjkuNi0uNyAxLjUtMS4xIDIuNy0xLjFzMi4xLjQgMi43IDEuMWMuNi43LjkgMS43LjkgMi45cy0uMyAyLjItLjkgMi45Yy0uNi43LTEuNSAxLjEtMi43IDEuMXMtMi4xLS40LTIuNy0xLjFjLS42LS43LS45LTEuNy0uOS0yLjl6bTEuOCAwYzAgLjguMiAxLjQuNSAxLjguNC40LjkuNiAxLjUuNnMxLjEtLjIgMS41LS42Yy4zLS40LjUtMSAuNS0xLjhíLS4yLTEuOC0uNS0xLjhjLS40LS40LS45LS42LTEuNS0uNnMtMS4xLjItMS41LS42Yy0uMy40LS41IDEtLjUgMS44em0xMS4yIDMuM1YzaDQuMWMxLjIgMCAyLjEuMyAyLjguOC43LjYgMSAxLjQgMSAyLjUgMCAuOS0uMiAxLjYtLjcgMi4yYy0uNS41LTEuMi44LTIuMS44aC0yLjR2My4xaC0yLjd6bTIuNy00LjFoMS4zYzEuMiAwIDEuMi0uMiAxLjUtLjUuMy0uMy41LS43LjUtMS4ycy0uMi0uOS0uNS0xLjJjLS4zLS4zLS44LS41LTEuNS0uNWgtMS4zdjMuNHptMTAuNy01LjNoMS44djkuM2gtMS44VjN6bTUuOCA5LjNoMS44VjQuMmwyLjUgOC4xaDEuN2wzLjUtOC4xdjguMWgxLjhWM2gtMi45bC0yLjYgNi0yLjYtNmgtMi45djkuM3pNMzcuOSAxMi4zVjNoMS44djkuM2gtMS44em02LjUtNC43YzAtMS4yLjMtMi4yLjktMi45LjYtLjcgMS41LTEuMSAyLjctMS4xczIuMS40IDIuNyAxLjFjLjYuNy45IDEuNy45IDIuOXMtLjMgMi4yLS45IDIuOWMtLjYuNy0xLjUgMS4xLTIuNyAxLjFzLTIuMS0uNC0yLjctMS4xYy0uNi0uNy0uOS0xLjctLjktMi45em0xLjggMGMwIC44LjIgMS40LjUgMS44LjQuNC45LjYgMS41LjZzMS4xLS4yIDEuNS0uNmMuMy0uNC41LTEgLjUtMS44cy0uMi0xLjgtLjUtMS44Yy0uNC0uNC0uOS0uNi0xLjEtLjZzLTEuMS4yLTEuNS0uNmMtLjMuNC0uNSAxLS41IDEuOHoiLz48L3N2Zz4=';
const BPMN_IO_LOGO_BASE64_DARK = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1My4yIDIwLjMiPjxwYXRoIGZpbGw9IiNGRkZGRkYiIGQ9Ik01LjEgMTIuM3YtNi42bC0yLjQgMi4xLTEuMS0xLjNMNy43IDNoMS4ydjkuM0g1LjF6bTguNi0zLjNjMC0xLjIuMy0yLjIuOS0yLjkuNi0uNyAxLjUtMS4xIDIuNy0xLjFzMi4xLjQgMi43IDEuMWMuNi43LjkgMS43LjkgMi45cy0uMyAyLjItLjkgMi45Yy0uNi43LTEuNSAxLjEtMi43IDEuMXMtMi4xLS40LTIuNy0xLjFjLS42LS43LS45LTEuNy0uOS0yLjl6bTEuOCAwYzAgLjguMiAxLjQuNSAxLjguNC40LjkuNiAxLjUuNnMxLjEtLjIgMS41LS42Yy4zLS40LjUtMSAuNS0xLjhíLS4yLTEuOC0uNS0xLjhjLS40LS40LS45LS42LTEuNS0uNnMtMS4xLjItMS41LS42Yy0uMy40LS41IDEtLjUgMS44em0xMS4yIDMuM1YzaDQuMWMxLjIgMCAyLjEuMyAyLjguOC43LjYgMSAxLjQgMSAyLjUgMCAuOS0uMiAxLjYtLjcgMi4yYy0uNS41LTEuMi44LTIuMS44aC0yLjR2My4xaC0yLjd6bTIuNy00LjFoMS4zYzEuMiAwIDEuMi0uMiAxLjUtLjUuMy0uMy41LS43LjUtMS4ycy0uMi0uOS0uNS0xLjJjLS4zLS4zLS44LS41LTEuNS0uNWgtMS4zdjMuNHptMTAuNy01LjNoMS44djkuM2gtMS44VjN6bTUuOCA5LjNoMS44VjQuMmwyLjUgOC4xaDEuN2wzLjUtOC4xdjguMWgxLjhWM2gtMi45bC0yLjYgNi0yLjYtNmgtMi45djkuM3pNMzcuOSAxMi4zVjNoMS44djkuM2gtMS44em02LjUtNC43YzAtMS4yLjMtMi4yLjktMi45LjYtLjcgMS41LTEuMSAyLjctMS4xczIuMS40IDIuNyAxLjFjLjYuNy45IDEuNy45IDIuOXMtLjMgMi4yLS45IDIuOWMtLjYuNy0xLjUgMS4xLTIuNyAxLjFzLTIuMS0uNC0yLjctMS4xYy0uNi0uNy0uOS0xLjctLjktMi45em0xLjggMGMwIC44LjIgMS40LjUgMS44LjQuNC45LjYgMS41LjZzMS4xLS4yIDEuNS0uNmMuMy0uNC41LTEgLjUtMS44cy0uMi0xLjgtLjUtMS44Yy0uNC0uNC0uOS0uNi0xLjEtLjZzLTEuMS4yLTEuNS0uNmMtLjMuNC0uNSAxLS41IDEuOHoiLz48L3N2Zz4=';

/**
 * A React component to render and edit a BPMN 2.0 diagram using the bpmn-js library.
 */
export const BpmnViewer: React.FC<BpmnViewerProps> = ({ xml, onXmlChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const debounceTimer = useRef<number | null>(null);
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
    
    const eventBus = viewer.get('eventBus');
    const handleModelChange = () => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = window.setTimeout(async () => {
            if (!viewerRef.current) return;
            try {
                const { xml: newXml } = await viewerRef.current.saveXML({ format: true });
                onXmlChange(newXml);
            } catch (err) {
                console.error('Could not save BPMN 2.0 diagram on change', err);
            }
        }, 500); // 500ms debounce
    };
    eventBus.on('commandStack.changed', handleModelChange);

    return () => {
        eventBus.off('commandStack.changed', handleModelChange);
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }
    };
  }, [xml, onXmlChange]);

  const getLatestXml = async (): Promise<string> => {
    if (!viewerRef.current) return '';
    try {
        const { xml } = await viewerRef.current.saveXML({ format: true });
        return xml;
    } catch (err) {
        console.error('Could not get BPMN XML', err);
        return '';
    }
  };

  const handleCopy = async () => {
    const currentXml = await getLatestXml();
    if (!currentXml) return;
    navigator.clipboard.writeText(currentXml).then(() => {
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

  const handleDownloadBpmn = async () => {
    const currentXml = await getLatestXml();
    if (!currentXml) return;
    const blob = new Blob([currentXml], { type: 'application/xml;charset=utf-8' });
    downloadFile(blob, 'processo.bpmn');
  };

  const handleDownloadXml = async () => {
    const currentXml = await getLatestXml();
    if (!currentXml) return;
    const blob = new Blob([currentXml], { type: 'application/xml;charset=utf-8' });
    downloadFile(blob, 'processo.xml');
  };

  const handleZoom = (step: number) => {
    if (viewerRef.current) {
        viewerRef.current.get('zoomScroll').stepZoom(step);
    }
  };

  const handleResetZoom = () => {
      if (viewerRef.current) {
          viewerRef.current.get('canvas').zoom('fit-viewport', 'auto');
      }
  };

  return (
    <div className="flex flex-col w-full h-full min-h-[400px] border border-border-light dark:border-border-dark rounded-lg bg-surface-light dark:bg-surface-dark overflow-hidden">
        <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-white/5 text-xs border-b border-border-light dark:border-border-dark flex-wrap gap-2">
            <span className="font-mono font-semibold text-on-surface-secondary-light dark:text-on-surface-secondary-dark">EDITOR DE DIAGRAMA BPMN</span>
            <div className="flex items-center space-x-2">
                 <span className="text-on-surface-secondary-light dark:text-on-surface-secondary-dark font-medium">Download:</span>
                 <button onClick={handleDownloadBpmn} title="Download como arquivo .bpmn" className="px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-on-surface-light dark:text-on-surface-dark">
                    .bpmn
                 </button>
                 <button onClick={handleDownloadXml} title="Download como arquivo .xml" className="px-2 py-1 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-on-surface-light dark:text-on-surface-dark">
                    .xml
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
        <div className="flex-grow relative bg-white dark:bg-surface-dark">
            <div ref={containerRef} className="w-full h-full [&_.bjs-container]:dark:invert" style={{ visibility: status === 'success' ? 'visible' : 'hidden' }} />
            {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <svg className="animate-spin h-6 w-6 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Renderizando editor...
                </div>
            )}
            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-2" viewBox="0 0 20 20" fill="currentColor">
                       <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Falha ao renderizar o editor BPMN.
                </div>
            )}
            {status === 'success' && (
              <>
                <div className="absolute top-4 right-4 z-10 bg-surface-light dark:bg-surface-dark/80 backdrop-blur-sm rounded-lg shadow-lg border border-border-light dark:border-border-dark flex items-center">
                    <button onClick={() => handleZoom(-1)} title="Afastar" className="p-2 text-on-surface-secondary-light dark:text-on-surface-secondary-dark hover:text-ifsc-green dark:hover:text-ifsc-green rounded-l-md transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    </button>
                    <div className="w-px h-5 bg-border-light dark:bg-border-dark"></div>
                    <button onClick={handleResetZoom} title="Restaurar Zoom" className="p-2 text-on-surface-secondary-light dark:text-on-surface-secondary-dark hover:text-ifsc-green dark:hover:text-ifsc-green transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m0 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5h-4m0 0v-4m0 4l-5-5" /></svg>
                    </button>
                    <div className="w-px h-5 bg-border-light dark:bg-border-dark"></div>
                    <button onClick={() => handleZoom(1)} title="Aproximar" className="p-2 text-on-surface-secondary-light dark:text-on-surface-secondary-dark hover:text-ifsc-green dark:hover:text-ifsc-green rounded-r-md transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-6-6h12" /></svg>
                    </button>
                </div>
                <a
                    href="https://bpmn.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Powered by bpmn.io"
                    className="absolute bottom-3 right-3 z-10 opacity-40 hover:opacity-100 transition-opacity"
                >
                    <img src={BPMN_IO_LOGO_BASE64_LIGHT} alt="Powered by bpmn.io" className="h-5 block dark:hidden" />
                    <img src={BPMN_IO_LOGO_BASE64_DARK} alt="Powered by bpmn.io" className="h-5 hidden dark:block" />
                </a>
              </>
            )}
        </div>
    </div>
  );
};
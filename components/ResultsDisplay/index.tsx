import React, { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, IStylesOptions } from 'docx';
import { AnalysisResult, AnaliseDadosPessoais, DadosPessoaisItem, InventarioIDP, RascunhoRIPD, SugestoesAutomacao, LogAnalise, Tab } from '../../types/index';
import { BpmnViewer } from '../BpmnViewer/index';
import { DmnViewer } from '../DmnViewer/index';

type ArtifactKey = keyof AnalysisResult;

interface ResultsDisplayProps {
    activeTab: Tab;
    results: Partial<AnalysisResult>;
    correctionText: string;
    onCorrectionTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onRefine: () => void;
    isRefining: boolean;
    onGenerateArtifact: (artifact: ArtifactKey) => void;
    generatingStatus: Partial<Record<ArtifactKey, boolean>>;
    errorStatus: Partial<Record<ArtifactKey, string | null>>;
    thinkingLogs: Partial<Record<ArtifactKey | 'refining', string[]>>;
    onDiagramUpdate: (newXml: string) => void;
}

// --- Helper Functions ---

const getArtifactName = (tab: Tab): string => {
    switch(tab) {
        case 'visual': return 'Processo (BPMN)';
        case 'decisao': return 'Decisão (DMN)';
        case 'analise': return 'Análise de Dados';
        case 'inventario': return 'Inventário de Dados';
        case 'ripd': return 'Relatório de Impacto';
        case 'sugestoes': return 'Sugestões';
        case 'log': return 'Log da IA';
        default: return 'Artefato';
    }
};

const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// --- Reusable Components for Views ---

const formatKey = (key: string): string => key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

const DataTable: React.FC<{title: string, data: DadosPessoaisItem[]}> = ({ title, data }) => {
    if (!data || data.length === 0) return null;
    return (
        <div className="mb-6">
            <h4 className="font-semibold text-on-surface-light dark:text-on-surface-dark mb-2">{title}</h4>
            <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
                <table className="w-full divide-y divide-border-light dark:divide-border-dark text-sm table-fixed">
                    <thead className="bg-gray-50 dark:bg-white/5">
                        <tr>
                            <th scope="col" className="w-[30%] px-4 py-3 text-left font-medium text-on-surface-secondary-light dark:text-on-surface-secondary-dark uppercase tracking-wider">Dado</th>
                            <th scope="col" className="w-[50%] px-4 py-3 text-left font-medium text-on-surface-secondary-light dark:text-on-surface-secondary-dark uppercase tracking-wider">Finalidade</th>
                            <th scope="col" className="w-[20%] px-4 py-3 text-left font-medium text-on-surface-secondary-light dark:text-on-surface-secondary-dark uppercase tracking-wider">Classificação</th>
                        </tr>
                    </thead>
                    <tbody className="bg-surface-light dark:bg-surface-dark divide-y divide-border-light dark:divide-border-dark">
                        {data.map((item, index) => (
                            <tr key={index}>
                                <td className="px-4 py-3 whitespace-normal break-words font-medium text-on-surface-light dark:text-on-surface-dark">{item.dado}</td>
                                <td className="px-4 py-3 whitespace-normal break-words text-on-surface-light dark:text-on-surface-dark">{item.finalidade}</td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.classificacao === 'Sensível' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-ifsc-green/20 dark:text-green-200'}`}>
                                        {item.classificacao}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const AnaliseView: React.FC<{data: AnaliseDadosPessoais}> = ({ data }) => (
    <div>
        <DataTable title="Dados Pessoais Identificados" data={data.dados_identificados} />
        <DataTable title="Dados Pessoais Sensíveis Identificados" data={data.dados_sensiveis_identificados} />
    </div>
);

const RenderValue: React.FC<{ value: any }> = ({ value }) => {
    if (value === null || value === undefined) {
        return <span className="text-on-surface-secondary-light dark:text-on-surface-secondary-dark">N/A</span>;
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return <span className="text-on-surface-secondary-light dark:text-on-surface-secondary-dark">Nenhum item</span>;

        return (
            <div className="space-y-2">
                {value.map((item, index) => (
                    <div key={index} className="pl-4 border-l-2 border-border-light dark:border-border-dark">
                        <RenderValue value={item} />
                    </div>
                ))}
            </div>
        );
    }

    if (typeof value === 'object') {
        return (
            <div className="space-y-2 w-full">
                {Object.entries(value).map(([key, val]) => (
                    <div key={key} className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
                        <div className="font-semibold text-on-surface-light dark:text-on-surface-dark sm:col-span-1">{formatKey(key)}</div>
                        <div className="sm:col-span-2"><RenderValue value={val} /></div>
                    </div>
                ))}
            </div>
        );
    }
    
    if (typeof value === 'boolean') {
        return value ? <span className="font-semibold text-green-600 dark:text-green-400">Sim</span> : <span className="font-semibold text-red-600 dark:text-red-400">Não</span>;
    }


    return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
};


const InventarioSection: React.FC<{ title: string; data: any; defaultOpen?: boolean }> = ({ title, data, defaultOpen = false }) => (
    <details className="border border-border-light dark:border-border-dark rounded-lg mb-4 open:shadow-lg transition-shadow" open={defaultOpen}>
        <summary className="px-4 py-3 font-semibold text-on-surface-light dark:text-on-surface-dark cursor-pointer bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors rounded-t-lg">
            {title}
        </summary>
        <div className="p-4 border-t border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark rounded-b-lg">
           <RenderValue value={data} />
        </div>
    </details>
);

const InventarioView: React.FC<{ data: InventarioIDP }> = ({ data }) => {
    if (!data || typeof data !== 'object') {
        return <div className="text-on-surface-secondary-light dark:text-on-surface-secondary-dark">Dados do inventário inválidos ou ausentes.</div>;
    }

    return (
        <div>
            {Object.entries(data).map(([key, value], index) => (
                <InventarioSection
                    key={key}
                    title={formatKey(key)}
                    data={value}
                    defaultOpen={index < 2} // Open first two sections by default
                />
            ))}
        </div>
    );
};


const RipdView: React.FC<{ markdown: RascunhoRIPD }> = ({ markdown }) => {
    if (markdown === null) {
      return (
        <div className="text-center text-on-surface-secondary-light dark:text-on-surface-secondary-dark py-10">O Rascunho do RIPD não foi gerado pois o processo foi classificado como de baixo/médio risco.</div>
      );
    }
    const html = marked(markdown, { gfm: true, breaks: true });
    return (
      <div className="bg-background-light dark:bg-background-dark p-2 rounded-lg">
        <div className="bg-white dark:bg-gray-900 shadow-lg rounded-md p-6 sm:p-8 max-w-4xl mx-auto">
          <div 
            className="prose prose-sm max-w-none dark:prose-invert 
                       prose-h1:text-xl prose-h1:mb-2 prose-h1:text-center
                       prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h2:border-b prose-h2:pb-2 prose-h2:border-border-light dark:prose-h2:border-border-dark
                       prose-hr:my-8
                       prose-p:my-2 prose-p:leading-relaxed
                       prose-strong:text-on-surface-light dark:prose-strong:text-on-surface-dark"
            dangerouslySetInnerHTML={{ __html: html }} 
          />
        </div>
      </div>
    );
};


const SugestoesView: React.FC<{ suggestions: SugestoesAutomacao }> = ({ suggestions }) => (
    <div className="space-y-3">
        {suggestions.map((suggestion, index) => (
            <div key={index} className="flex items-start p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-border-light dark:border-border-dark">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-ifsc-green flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-sm text-on-surface-light dark:text-on-surface-dark">{suggestion}</p>
            </div>
        ))}
    </div>
);

const LogView: React.FC<{ log: LogAnalise }> = ({ log }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(log).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleDownload = () => {
        const blob = new Blob([log], { type: 'text/plain;charset=utf-8' });
        downloadBlob(blob, 'log_analise_ia.txt');
    };
    
    const renderParsedLog = () => {
        if (!log) return null;
        // Split into sections based on the double newline, then render each part.
        return log.split('\n\n').map((section, index) => {
            const trimmedSection = section.trim();
            // Render main headings (e.g., **1. Title:**)
            if (trimmedSection.match(/^\*\*\d+\..*?\*\*$/)) {
                 return <h3 key={index} className="text-md font-semibold mt-4 mb-2 text-on-surface-light dark:text-on-surface-dark">{trimmedSection.replace(/\*\*/g, '')}</h3>;
            }
            // Render list items (e.g., *   **Action:** ...)
            if(trimmedSection.startsWith('*')) {
                return (
                    <div key={index} className="space-y-2">
                        {trimmedSection.split('\n').map((line, lineIndex) => {
                             const lineContent = line.replace(/^\*\s+/, '').trim();
                             const parts = lineContent.split(/:(.*)/s); // Split on the first colon
                             if (parts.length > 1) {
                                 const label = parts[0].replace(/\*\*/g, '');
                                 const value = parts[1].trim();
                                 return (
                                     <div key={lineIndex} className="pl-4 border-l-2 border-ifsc-green/30">
                                         <p><strong className="font-semibold text-on-surface-light dark:text-on-surface-dark">{label}:</strong> <span className="text-on-surface-secondary-light dark:text-on-surface-secondary-dark">{value}</span></p>
                                     </div>
                                 )
                             }
                             return <p key={lineIndex}>{lineContent}</p>;
                        })}
                    </div>
                );
            }
            // Render regular paragraphs
            return <p key={index} className="text-on-surface-secondary-light dark:text-on-surface-secondary-dark mb-2">{trimmedSection}</p>;
        });
    };

    return (
        <div className="flex flex-col w-full h-full border border-border-light dark:border-border-dark rounded-lg bg-surface-light dark:bg-surface-dark overflow-hidden">
            <div className="flex justify-between items-center px-4 py-2 bg-gray-50 dark:bg-white/5 text-xs border-b border-border-light dark:border-border-dark flex-wrap gap-2">
                <span className="font-mono font-semibold text-on-surface-secondary-light dark:text-on-surface-secondary-dark">LOG DE ANÁLISE DA IA</span>
                <div className="flex items-center space-x-2">
                     <button onClick={handleDownload} className="flex items-center text-on-surface-secondary-light dark:text-on-surface-secondary-dark hover:text-ifsc-green dark:hover:text-ifsc-green transition-colors text-xs">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download (.txt)
                     </button>
                     <div className="h-4 border-l border-border-light dark:border-border-dark mx-1"></div>
                    <button onClick={handleCopy} className="flex items-center text-on-surface-secondary-light dark:text-on-surface-secondary-dark hover:text-ifsc-green dark:hover:text-ifsc-green transition-colors text-xs">
                         {copied ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Copiado!
                            </>
                        ) : (
                            <>
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                 Copiar Texto
                            </>
                        )}
                    </button>
                </div>
            </div>
            <div className="p-4 overflow-y-auto text-sm">
                {renderParsedLog()}
            </div>
        </div>
    );
};

const LogViewer: React.FC<{ log: string[], title: string }> = ({ log, title }) => {
    const logContainerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [log]);

    return (
        <div className="mt-4 p-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg text-xs text-left w-full">
            <p className="font-semibold mb-2 text-on-surface-light dark:text-on-surface-dark">{title}</p>
            <div ref={logContainerRef} className="max-h-32 overflow-y-auto font-mono pr-2">
                {log.map((line, index) => (
                    <pre key={index} className="whitespace-pre-wrap text-on-surface-secondary-light dark:text-on-surface-secondary-dark block">{line}</pre>
                ))}
            </div>
        </div>
    );
};

const LoadingComponent: React.FC<{thinkingLog: string[]}> = ({ thinkingLog }) => (
    <div className="flex-grow flex flex-col items-center justify-center text-center text-on-surface-secondary-light dark:text-on-surface-secondary-dark p-4">
        <svg className="animate-spin h-8 w-8 text-ifsc-green mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p>Gerando artefato...</p>
        {thinkingLog.length > 0 && (
           <LogViewer log={thinkingLog} title="Log de Processamento:" />
        )}
    </div>
);

const ErrorComponent: React.FC<{message: string}> = ({ message }) => (
    <div className="flex-grow flex flex-col items-center justify-center text-center text-red-500 bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-red-400">Erro ao Gerar Artefato</h3>
        <p className="mt-1 text-sm">{message}</p>
    </div>
);

// --- Main Component ---

export const ResultsDisplay: React.FC<ResultsDisplayProps> = (props) => {
  const { activeTab, results, correctionText, onCorrectionTextChange, onRefine, isRefining, generatingStatus, errorStatus, thinkingLogs, onDiagramUpdate } = props;
  const [isExporting, setIsExporting] = useState<Partial<Record<'csv' | 'docx', boolean>>>({});
  
  const artifactTabMap: Record<Tab, ArtifactKey | null> = {
    visual: 'processo_visual',
    decisao: 'processo_visual',
    analise: 'analise_dados_pessoais',
    inventario: 'inventario_idp',
    ripd: 'rascunho_ripd',
    sugestoes: 'sugestoes_automacao',
    log: 'log_analise',
  };

  const handleExportCsv = async () => {
    if (!results.inventario_idp) return;
    setIsExporting(prev => ({ ...prev, csv: true }));
    try {
        const data = results.inventario_idp;
        const processName = data.identificacao_servico.nome_processo.replace(/[^a-z0-9]/gi, '_');
        
        const rows: string[][] = [["Chave", "Valor"]];
        const flattenObject = (obj: any, prefix = '') => {
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                const newKey = prefix ? `${prefix} > ${formatKey(key)}` : formatKey(key);
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    flattenObject(value, newKey);
                } else if (Array.isArray(value)) {
                     if(value.length === 0) {
                        rows.push([newKey, "Nenhum item"]);
                     } else {
                        value.forEach((item, index) => {
                           if (typeof item === 'object') {
                             flattenObject(item, `${newKey} [${index + 1}]`);
                           } else {
                             rows.push([`${newKey} [${index + 1}]`, String(item)]);
                           }
                        });
                     }
                } else {
                    rows.push([newKey, String(value)]);
                }
            });
        };
        flattenObject(data);

        let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
        csvContent += rows.map(e => e.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `IDP_${processName}.csv`);

    } catch (error) {
        console.error("Failed to export CSV", error);
        alert("Ocorreu um erro ao exportar o arquivo CSV.");
    } finally {
        setIsExporting(prev => ({ ...prev, csv: false }));
    }
  };

  const handleExportDocx = async () => {
    if (!results.rascunho_ripd) return;
    setIsExporting(prev => ({ ...prev, docx: true }));

    try {
        const markdown = results.rascunho_ripd;
        const processName = results.inventario_idp?.identificacao_servico.nome_processo.replace(/[^a-z0-9]/gi, '_') || 'RIPD';
        
        const styles: IStylesOptions = {
            default: {
                document: {
                    run: { font: "Arial", size: 24, color: "000000" }, // 12pt
                },
            },
            paragraphStyles: [
                { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", run: { size: 32, bold: true, color: "000000" }, }, // 16pt
                { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", run: { size: 28, bold: true, color: "000000" }, }, // 14pt
            ],
        };

        const children: Paragraph[] = [];
        const lines = markdown.replace(/<br>/g, '\n').split('\n');

        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('# ')) {
                children.push(new Paragraph({ text: trimmedLine.substring(2), heading: HeadingLevel.HEADING_1, style: "Heading1" }));
            } else if (trimmedLine.startsWith('## ')) {
                children.push(new Paragraph({ text: trimmedLine.substring(3), heading: HeadingLevel.HEADING_2, style: "Heading2" }));
            } else if (trimmedLine === '---') {
                children.push(new Paragraph({ border: { bottom: { color: "auto", space: 1, style: BorderStyle.SINGLE, size: 6 } } }));
            } else if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**')) {
                const text = trimmedLine.substring(2, trimmedLine.length - 2);
                children.push(new Paragraph({ children: [new TextRun({ text, bold: true })]}));
            } else {
                children.push(new Paragraph({ text: trimmedLine }));
            }
        });
        
        const doc = new Document({
            styles,
            sections: [{ children }]
        });
        
        const blob = await Packer.toBlob(doc);
        downloadBlob(blob, `RIPD_${processName}.docx`);

    } catch (error) {
        console.error("Failed to export DOCX", error);
        alert("Ocorreu um erro ao exportar o arquivo DOCX.");
    } finally {
        setIsExporting(prev => ({ ...prev, docx: false }));
    }
  };

  const renderContent = () => {
    const artifactKey = artifactTabMap[activeTab];

    if (artifactKey) {
        if (generatingStatus[artifactKey]) {
            const log = thinkingLogs[artifactKey] || [];
            return <LoadingComponent thinkingLog={log} />;
        }
        if (errorStatus[artifactKey]) {
            return <ErrorComponent message={errorStatus[artifactKey]!} />;
        }
    }

    const ExportButton: React.FC<{ type: 'csv' | 'docx', onClick: () => void, text: string }> = ({ type, onClick, text }) => (
        <div className="flex justify-end mb-4">
            <button
                onClick={onClick}
                disabled={isExporting[type]}
                className="bg-gray-200 dark:bg-gray-700 text-on-surface-light dark:text-on-surface-dark text-xs font-semibold py-2 px-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-wait transition-colors flex items-center"
            >
            {isExporting[type] ? (
                 <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                    Exportando...
                 </>
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {text}
                </>
            )}
            </button>
        </div>
    );

    switch (activeTab) {
      case 'visual':
        if (!results.processo_visual) return null;
        return <BpmnViewer xml={results.processo_visual.bpmn_xml} onXmlChange={onDiagramUpdate} />;
      case 'decisao':
        if (!results.processo_visual) return null;
        return results.processo_visual.dmn_xml ? (
          <DmnViewer xml={results.processo_visual.dmn_xml} />
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center text-center text-on-surface-secondary-light dark:text-on-surface-secondary-dark p-4 min-h-[300px]">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-md font-semibold">Nenhuma Tabela de Decisão Gerada</h3>
            <p className="mt-1 text-sm max-w-sm">A IA não identificou um ponto de decisão explícito baseado em regras no processo descrito.</p>
          </div>
        );
      case 'analise':
        return results.analise_dados_pessoais ? <AnaliseView data={results.analise_dados_pessoais} /> : null;
      case 'inventario':
        if (!results.inventario_idp) return null;
        return (
            <>
                <ExportButton type="csv" onClick={handleExportCsv} text="Exportar para Planilha (.csv)" />
                <InventarioView data={results.inventario_idp} />
            </>
        );
      case 'ripd':
        if (!results.hasOwnProperty('rascunho_ripd')) return null;
        return (
            <>
               {results.rascunho_ripd && <ExportButton type="docx" onClick={handleExportDocx} text="Exportar para Documento (.docx)" />}
               <RipdView markdown={results.rascunho_ripd!} />
            </>
        );
      case 'sugestoes':
        return results.sugestoes_automacao ? <SugestoesView suggestions={results.sugestoes_automacao} /> : null;
      case 'log':
        return results.log_analise ? <LogView log={results.log_analise} /> : null;
      default:
        return null;
    }
  };
  
  const refiningLog = thinkingLogs.refining || [];
  const artifactName = getArtifactName(activeTab);

  return (
    <div className="flex flex-col h-full flex-grow">
      <div className="flex-grow overflow-y-auto p-1 pr-2 -mr-2 min-h-0">
        {renderContent()}
      </div>

      <div className="mt-6 border-t border-border-light dark:border-border-dark pt-6 flex-shrink-0">
        <h3 className="text-lg font-semibold text-on-surface-light dark:text-on-surface-dark mb-2">3. Corrigir ou Refinar {artifactName}</h3>
        <p className="text-sm text-on-surface-secondary-light dark:text-on-surface-secondary-dark mb-4">Descreva as alterações desejadas. A IA irá regenerar apenas este artefato para garantir consistência.</p>
        <textarea
          value={correctionText}
          onChange={onCorrectionTextChange}
          placeholder="Ex: Adicione a tarefa 'Aprovação do Comitê' após a 'Análise da Gestão de Pessoas'."
          className="w-full h-24 p-4 border border-border-light dark:border-border-dark bg-background-light dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-ifsc-green focus:border-ifsc-green transition-shadow duration-200 resize-none text-sm text-on-surface-light dark:text-on-surface-dark placeholder:text-gray-400 dark:placeholder:text-gray-500"
          disabled={isRefining}
        />
        <button
          onClick={onRefine}
          disabled={isRefining || !correctionText.trim()}
          className="mt-4 w-full bg-ifsc-green text-white font-bold py-3 px-4 rounded-lg hover:bg-ifsc-green-dark disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface-light dark:focus:ring-offset-surface-dark focus:ring-ifsc-green"
        >
          {isRefining ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Refinando...
            </>
          ) : ( `Refinar ${artifactName}` )}
        </button>
        {isRefining && refiningLog.length > 0 && (
            <LogViewer log={refiningLog} title={`Log de Refinamento (${artifactName}):`} />
        )}
      </div>

    </div>
  );
};
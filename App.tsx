import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Header } from './components/Header/index';
import { ProcessInput } from './components/ProcessInput/index';
import { ResultsDisplay } from './components/ResultsDisplay/index';
import * as geminiService from './services/geminiService';
import { AnalysisResult } from './types/index';

type ArtifactKey = keyof AnalysisResult;
type Theme = 'light' | 'dark';

const EXAMPLE_PROCESS_TEXT = `O processo consiste em receber a descrição de uma atividade do IFSC (via texto, imagem ou modelo Bizagi) e convertê-la para os padrões visuais BPMN (fluxo) e DMN (decisões). A partir desta modelagem, a plataforma extrai e estrutura os dados no Inventário de Dados Pessoais (IDP) e, com base na análise de risco, gera o Relatório de Impacto à Proteção de Dados (RIPD) como o artefato final de conformidade.`;

const App: React.FC = () => {
  const [processDescription, setProcessDescription] = useState<string>(EXAMPLE_PROCESS_TEXT);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [correctionText, setCorrectionText] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefining, setIsRefining] = useState<boolean>(false);
  
  const [generating, setGenerating] = useState<Partial<Record<ArtifactKey, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<ArtifactKey, string | null>>>({});
  const [results, setResults] = useState<Partial<AnalysisResult>>({});

  const [thinkingLogs, setThinkingLogs] = useState<Partial<Record<ArtifactKey | 'refining', string[]>>>({});
  const logContainerRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState<Theme>('light');

  // Effect to set initial theme based on OS preference
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }, []);

  // Effect to apply the theme class to the html element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  }, []);


  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [thinkingLogs.processo_visual]);

  const handleReset = useCallback(() => {
    setProcessDescription(EXAMPLE_PROCESS_TEXT);
    setUploadedFile(null);
    setCorrectionText('');
    setIsLoading(false);
    setIsRefining(false);
    setResults({});
    setGenerating({});
    setErrors({});
    setThinkingLogs({});
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!processDescription.trim() && !uploadedFile) {
      setErrors({ processo_visual: 'Por favor, descreva o processo ou envie um arquivo.' });
      return;
    }
    handleReset(); // Reset everything for a new analysis
    setIsLoading(true);
    setThinkingLogs({ processo_visual: [] });

    try {
      const onThinkingUpdate = (update: string) => {
        setThinkingLogs(prev => ({
            ...prev,
            processo_visual: [...(prev.processo_visual || []), update]
        }));
      };
      
      const visualResult = await geminiService.generateVisual(
        { description: processDescription, file: uploadedFile },
        onThinkingUpdate
      );
      setResults(visualResult);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
      setErrors({ processo_visual: errorMsg });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [processDescription, uploadedFile, handleReset]);

  const handleGenerateArtifact = useCallback(async (artifact: ArtifactKey) => {
    setGenerating(prev => ({ ...prev, [artifact]: true }));
    setErrors(prev => ({ ...prev, [artifact]: null }));
    setThinkingLogs(prev => ({...prev, [artifact]: []}));

    const onThinkingUpdate = (update: string) => {
        setThinkingLogs(prev => ({
            ...prev,
            [artifact]: [...(prev[artifact] || []), update]
        }));
    };

    const input = { description: processDescription, file: uploadedFile };
    let promise;

    switch(artifact) {
      case 'analise_dados_pessoais':
        promise = geminiService.generateDataAnalysis(input, results, onThinkingUpdate);
        break;
      case 'inventario_idp':
        promise = geminiService.generateInventory(input, results, onThinkingUpdate);
        break;
      case 'rascunho_ripd':
        promise = geminiService.generateRipd(input, results, onThinkingUpdate);
        break;
      case 'sugestoes_automacao':
        promise = geminiService.generateSuggestions(input, results, onThinkingUpdate);
        break;
      case 'log_analise':
        promise = geminiService.generateLog(input, results, onThinkingUpdate);
        break;
      default:
        console.warn(`Generation for artifact type "${artifact}" is not implemented.`);
        setGenerating(prev => ({ ...prev, [artifact]: false }));
        return;
    }

    try {
        const newResult = await promise;
        setResults(prev => ({ ...prev, ...newResult }));
    } catch(err) {
        const errorMsg = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
        setErrors(prev => ({...prev, [artifact]: errorMsg}));
        console.error(err);
    } finally {
        setGenerating(prev => ({ ...prev, [artifact]: false }));
    }

  }, [processDescription, uploadedFile, results]);


  const handleRefine = useCallback(async () => {
    if (!results || !correctionText.trim()) {
      return;
    }
    setIsRefining(true);
    setErrors({});
    setThinkingLogs(prev => ({...prev, refining: []}));

    try {
      const onThinkingUpdate = (update: string) => {
        setThinkingLogs(prev => ({
            ...prev,
            refining: [...(prev.refining || []), update]
        }));
      };

      const refinedAnalysis = await geminiService.refineProcess(
        results as AnalysisResult,
        correctionText,
        onThinkingUpdate
      );
      setResults(refinedAnalysis);
    } catch (err) {
       const errorMsg = err instanceof Error ? err.message : 'Ocorreu um erro desconhecido.';
       setErrors({ processo_visual: `Falha ao refinar: ${errorMsg}`});
       console.error(err);
    } finally {
      setIsRefining(false);
    }
  }, [results, correctionText]);
  
  const hasResults = Object.keys(results).length > 0;
  const processLog = thinkingLogs.processo_visual || [];

  return (
    <div className="min-h-screen font-sans flex flex-col items-center bg-background-light dark:bg-background-dark text-on-surface-light dark:text-on-surface-dark transition-colors duration-200">
      <Header theme={theme} toggleTheme={toggleTheme} onReset={handleReset} />
      <main className="flex-grow w-full max-w-screen-2xl px-4 md:px-8 py-8">
        <div className="w-full h-full grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          <div className="lg:col-span-1">
            <ProcessInput
              textValue={processDescription}
              onTextChange={(e) => setProcessDescription(e.target.value)}
              fileValue={uploadedFile}
              onFileChange={setUploadedFile}
              onAnalyze={handleAnalyze}
              onReset={handleReset}
              isLoading={isLoading}
              placeholder={EXAMPLE_PROCESS_TEXT}
            />
          </div>
          
          <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark rounded-xl shadow-lg border border-border-light dark:border-border-dark p-6 flex flex-col min-h-[500px] h-full">
            {isLoading && (
              <div className="flex-grow flex flex-col items-center justify-center text-center text-on-surface-secondary-light dark:text-on-surface-secondary-dark">
                <svg className="animate-spin h-10 w-10 text-ifsc-green mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <div className="mt-4 p-3 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg text-xs text-left w-full">
                     <p className="font-semibold mb-2 text-on-surface-light dark:text-on-surface-dark">Log de Processamento da IA:</p>
                     <div ref={logContainerRef} className="max-h-48 overflow-y-auto font-mono pr-2">
                        {processLog.map((line, index) => (
                           <pre key={index} className="whitespace-pre-wrap text-on-surface-secondary-light dark:text-on-surface-secondary-dark block">{line}</pre>
                        ))}
                     </div>
                </div>
              </div>
            )}
            
            {hasResults && !isLoading && (
              <ResultsDisplay
                results={results}
                correctionText={correctionText}
                onCorrectionTextChange={(e) => setCorrectionText(e.target.value)}
                onRefine={handleRefine}
                isRefining={isRefining}
                onGenerateArtifact={handleGenerateArtifact}
                generatingStatus={generating}
                errorStatus={errors}
                thinkingLogs={thinkingLogs}
              />
            )}
             {!hasResults && !isLoading && (
                <div className="flex-grow flex flex-col items-center justify-center text-center text-on-surface-secondary-light dark:text-on-surface-secondary-dark">
                    {errors.processo_visual ? (
                         <div className="text-center text-red-400 bg-red-500/10 border border-red-500/30 p-4 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-4 mx-auto" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <h3 className="text-lg font-semibold text-red-300">Erro na Análise</h3>
                            <p className="mt-1">{errors.processo_visual}</p>
                        </div>
                    ) : (
                        <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <h3 className="text-lg font-semibold">Aguardando análise</h3>
                            <p className="mt-1 max-w-sm">Os artefatos de conformidade LGPD serão exibidos aqui após a execução.</p>
                        </>
                    )}
                </div>
            )}
          </div>
        </div>
      </main>
      <footer className="w-full max-w-screen-2xl px-4 md:px-8 py-4 text-center text-xs text-on-surface-secondary-light dark:text-on-surface-secondary-dark space-y-2">
        <p>
          <strong>Aviso Importante:</strong> Esta ferramenta é um desenvolvimento experimental. Os artefatos gerados por Inteligência Artificial (BPMN, DMN, RIPD, etc.) são rascunhos e <strong>devem ser obrigatoriamente revisados e validados por um especialista humano</strong> antes de qualquer uso oficial.
        </p>
         <p>
          Desenvolvido por FLM na Coordenadoria de Gestão de Dados (CGD) da DTIC do IFSC - Reitoria. Dúvidas ou sugestões, entre em contato pelo e-mail: <a href="mailto:coord.gestao.dados@ifsc.edu.br" className="text-ifsc-green hover:underline">coord.gestao.dados@ifsc.edu.br</a>
        </p>
      </footer>
    </div>
  );
};

export default App;
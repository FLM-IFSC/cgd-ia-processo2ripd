import React, { useEffect } from 'react';
import * as prompts from '../../services/prompts';
import { AnalysisResult } from '../../types/index';

// Subcomponente para exibir um único prompt de forma consistente
const PromptViewer: React.FC<{ title: string; prompt: string }> = ({ title, prompt }) => (
    <div className="mb-6">
        <h3 className="text-lg font-semibold text-on-surface-light dark:text-on-surface-dark mb-2">{title}</h3>
        <div className="bg-background-light dark:bg-background-dark rounded-lg border border-border-light dark:border-border-dark max-h-60 overflow-y-auto">
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap text-on-surface-secondary-light dark:text-on-surface-secondary-dark">{prompt}</pre>
        </div>
    </div>
);

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Um modal para exibir os prompts de IA usados pela aplicação.
 * Fornece transparência sobre como a IA é instruída.
 */
export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    // Não renderiza o modal se não estiver aberto
    if (!isOpen) {
      return null;
    }

    // Efeito para fechar o modal com a tecla 'Escape'
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Obtém os templates dos prompts chamando as funções de serviço com dados vazios
    const visualPrompt = prompts.getVisualPrompt();
    const analysisPrompt = prompts.getAnalysisPrompt('', {});
    const inventoryPrompt = prompts.getInventoryPrompt('', {});
    const ripdPrompt = prompts.getRipdPrompt('', {});
    const suggestionsPrompt = prompts.getSuggestionsPrompt('', {});
    const logPrompt = prompts.getLogPrompt('', {});
    const refinePrompt = prompts.getRefineVisualPrompt({} as AnalysisResult, '"Sua instrução de correção aqui"');


    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
        >
            <div 
                className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col m-4 border border-border-light dark:border-border-dark"
                onClick={e => e.stopPropagation()} // Impede que o modal feche ao clicar dentro dele
            >
                <header className="flex items-center justify-between p-4 border-b border-border-light dark:border-border-dark flex-shrink-0">
                    <h2 id="settings-modal-title" className="text-xl font-bold text-on-surface-light dark:text-on-surface-dark">Configuração de Prompts da IA</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-on-surface-secondary-light dark:text-on-surface-secondary-dark hover:bg-black/5 dark:hover:bg-white/10 transition-colors" aria-label="Fechar">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </header>
                <main className="p-6 overflow-y-auto">
                    <p className="text-sm text-on-surface-secondary-light dark:text-on-surface-secondary-dark mb-6">
                        Estes são os prompts mestres que instruem a Inteligência Artificial. A capacidade de edição e personalização será implementada em futuras versões.
                    </p>
                    <PromptViewer title="1. Análise e Geração de BPMN/DMN" prompt={visualPrompt} />
                    <PromptViewer title="2. Análise de Dados Pessoais" prompt={analysisPrompt} />
                    <PromptViewer title="3. Geração do Inventário (IDP)" prompt={inventoryPrompt} />
                    <PromptViewer title="4. Geração do Relatório de Impacto (RIPD)" prompt={ripdPrompt} />
                    <PromptViewer title="5. Geração de Sugestões de Automação" prompt={suggestionsPrompt} />
                    <PromptViewer title="6. Geração do Log de Análise da IA" prompt={logPrompt} />
                    <PromptViewer title="7. Refinamento de Artefato (Ex: Processo Visual)" prompt={refinePrompt} />
                </main>
            </div>
        </div>
    );
};
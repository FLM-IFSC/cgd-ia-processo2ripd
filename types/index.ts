export interface ProcessoVisual {
  bpmn_xml: string;
  dmn_xml: string | null;
}

export interface DadosPessoaisItem {
  dado: string;
  finalidade: string;
  classificacao: 'Pessoal' | 'Sensível';
}

export interface AnaliseDadosPessoais {
  dados_identificados: DadosPessoaisItem[];
  dados_sensiveis_identificados: DadosPessoaisItem[];
}

export type InventarioIDP = Record<string, any>;

export type RascunhoRIPD = string | null;

export type SugestoesAutomacao = string[];

export type LogAnalise = string;

/**
 * Represents the complete set of analysis artifacts.
 * Each property is optional to allow for incremental, on-demand generation.
 */
export interface AnalysisResult {
  processo_visual?: ProcessoVisual;
  analise_dados_pessoais?: AnaliseDadosPessoais;
  inventario_idp?: InventarioIDP;
  rascunho_ripd?: RascunhoRIPD;
  sugestoes_automacao?: SugestoesAutomacao;
  log_analise?: LogAnalise;
}
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

// --- Detailed Types for InventarioIDP ---

export interface IdentificacaoServico {
  nome_processo: string;
  id_referencia: string;
  data_criacao: string;
  data_atualizacao: string;
}

export interface Agente {
  nome: string;
  endereco: string;
  cep: string;
  telefone: string;
  email: string;
}

export interface Controlador extends Agente {
  natureza_juridica: string;
  cnpj: string;
}

export interface Encarregado {
  nome: string;
  contato: string;
  previsao_legal: string;
}

export interface AgentesTratamento {
  controlador: Controlador;
  encarregado_dpo: Encarregado;
  operadores: Agente[];
}

export interface FaseCicloVida {
    operador: string;
    coleta: boolean;
    retencao: boolean;
    processamento: boolean;
    compartilhamento: boolean;
    eliminacao: boolean;
}

export interface DescricaoFluxo {
    coleta: string;
    armazenamento: string;
    uso: string;
    compartilhamento: string;
    eliminacao: string;
}

export interface EscopoNatureza {
    abrangencia_geografica: string;
    fonte_dados: string;
}

export interface FinalidadeTratamento {
    hipotese_tratamento: string;
    finalidade: string;
    previsao_legal: string;
    resultados_pretendidos: string;
    beneficios_esperados: string;
}

export interface CategoriaDados {
    descricao: string;
    tempo_retencao: string;
    fonte_retencao: string;
}

export interface FrequenciaTotalizacao {
    frequencia_tratamento: string;
    quantidade_dados_pessoais: number;
    quantidade_dados_sensiveis: number;
}

export interface TitularDados {
    categoria: string;
    descricao: string;
    trata_criancas_adolescentes: boolean;
    trata_outro_grupo_vulneravel: boolean;
}

export interface Compartilhamento {
    instituicao: string;
    dados_compartilhados: string;
    finalidade: string;
}

export interface MedidaSeguranca {
    tipo_medida: string;
    descricao_controles: string;
}

export interface TransferenciaInternacional {
    organizacao: string;
    pais: string;
    dados_transferidos: string;
    tipo_garantia: string;
}

export interface ContratoTI {
    numero_processo: string;
    objeto_contrato: string;
    email_gestor: string;
}

export interface ManterAtualizacao {
    politica_atualizacao: string;
    periodicidade: string;
}


export interface InventarioIDP {
  identificacao_servico: IdentificacaoServico;
  agentes_tratamento: AgentesTratamento;
  fases_ciclo_vida: FaseCicloVida[];
  descricao_fluxo_tratamento: DescricaoFluxo;
  escopo_natureza_dados: EscopoNatureza;
  finalidade_tratamento: FinalidadeTratamento;
  categorias_dados_pessoais: CategoriaDados[];
  categorias_dados_sensiveis: CategoriaDados[];
  frequencia_totalizacao: FrequenciaTotalizacao;
  categorias_titulares: TitularDados;
  compartilhamento_dados: Compartilhamento[];
  medidas_seguranca: MedidaSeguranca[];
  transferencia_internacional: TransferenciaInternacional[];
  contratos_ti: ContratoTI[];
  manter_atualizacao: ManterAtualizacao;
}

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

export type Tab = 'visual' | 'decisao' | 'analise' | 'inventario' | 'ripd' | 'sugestoes' | 'log';

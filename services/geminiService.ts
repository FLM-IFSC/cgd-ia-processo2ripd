import { GoogleGenAI } from "@google/genai";
import JSZip from 'jszip';
import { AnalysisResult, AnaliseDadosPessoais, InventarioIDP, LogAnalise, ProcessoVisual, RascunhoRIPD, SugestoesAutomacao } from '../types/index';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const model = 'gemini-2.5-flash';

export interface AnalysisInput {
  description: string;
  file: File | null;
}

const IFSC_CONTEXT = `
# INFORMAÇÕES INSTITUCIONAIS FIXAS DO IFSC (SEMPRE UTILIZAR ESTES DADOS)
- **Controlador**:
  - **Nome**: Instituto Federal de Educação, Ciência e Tecnologia de Santa Catarina (IFSC)
  - **Natureza Jurídica**: Autarquia Federal
  - **CNPJ**: 11.402.887/0001-60
  - **Endereço**: Rua 14 de Julho, 150, Coqueiros - Florianópolis - SC
  - **CEP**: 88075-010
  - **Telefone**: (48) 3877-9000
  - **Email**: gabinete.reitoria@ifsc.edu.br
- **Encarregado pelo Tratamento de Dados Pessoais (DPO)**:
  - **Nome**: Volnei Velleda Rodrigues
  - **Contato**: encarregado.lgpd@ifsc.edu.br
  - **Previsão Legal**: Art. 41 da Lei nº 13.709/2018 (LGPD)
`;

/**
 * Converts a File object to the GoogleGenerativeAI.Part format.
 * Handles standard files (images, text) and special cases like Bizagi .bpm projects.
 * For .bpm files, it unzips them in the browser, concatenates the content of all
 * relevant diagram (.diag) and config (.xml) files, and sends them as a single text part.
 */
const fileToGenerativePart = async (file: File): Promise<{inlineData: { mimeType: string, data: string }}> => {
  const fileName = file.name.toLowerCase();

  // Handle .bpm Bizagi project files by unzipping and concatenating content
  if (fileName.endsWith('.bpm')) {
    try {
      const zip = new JSZip();
      const content = await file.arrayBuffer();
      const loadedZip = await zip.loadAsync(content);
      
      const textPromises: Promise<{ name: string, content: string }>[] = [];
      loadedZip.forEach((_, zipEntry) => {
        const entryName = zipEntry.name.toLowerCase();
        if (!zipEntry.dir && (entryName.endsWith('.diag') || entryName.endsWith('.xml'))) {
          textPromises.push(
            zipEntry.async('string').then(content => ({ name: zipEntry.name, content }))
          );
        }
      });
      
      const allFileContents = await Promise.all(textPromises);

      if (allFileContents.length === 0) {
        throw new Error("Nenhum arquivo de diagrama (.diag) ou de configuração (.xml) foi encontrado dentro do projeto .bpm.");
      }

      // Create a structured text block with the contents of each relevant file
      const combinedText = "CONTEÚDO DO PROJETO BIZAGI (.bpm):\n" + allFileContents
        .map(fileContent => `\n\n--- INÍCIO DO ARQUIVO: ${fileContent.name} ---\n\n${fileContent.content}\n\n--- FIM DO ARQUIVO: ${fileContent.name} ---`)
        .join('');

      // Base64 encode the combined UTF-8 text
      // The btoa(unescape(encodeURIComponent(str))) pattern is a common way to handle UTF-8 strings.
      const data = btoa(unescape(encodeURIComponent(combinedText)));
      return { inlineData: { mimeType: 'text/plain', data } };

    } catch (error) {
      console.error("Error processing .bpm file:", error);
      throw new Error(`Falha ao processar o arquivo de projeto Bizagi (.bpm). Certifique-se de que o arquivo não está corrompido. Detalhes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Original logic for other files (images, .bpmn, .xml, .diag)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file); // Reads as base64 data URL
    reader.onload = () => {
      try {
        const result = (reader.result as string);
        const data = result.split(',')[1];
        
        let mimeType = file.type;
        
        // Fallback for common process model files that browsers might not recognize
        if (!mimeType && (fileName.endsWith('.bpmn') || fileName.endsWith('.xml') || fileName.endsWith('.diag'))) {
          mimeType = 'text/xml';
        }

        if (!mimeType) {
          throw new Error(`Não foi possível determinar o tipo MIME para "${file.name}". Verifique se o arquivo é suportado (imagem, .bpmn, .xml, .diag, .bpm).`);
        }
        
        resolve({ inlineData: { mimeType, data } });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

const generateAndParse = async <T>(
  prompt: string,
  input: AnalysisInput,
  onThinkingUpdate: (update: string) => void,
  isInitialAnalysis: boolean = false
): Promise<T> => {
  const contents: any = { parts: [] };

  if (isInitialAnalysis && input.file) {
    contents.parts.push(await fileToGenerativePart(input.file));
  }
  
  contents.parts.push({ text: prompt });
  
  if (isInitialAnalysis && input.description) {
     contents.parts.push({ text: `\n# CONTEXTO ADICIONAL (LINGUAGEM NATURAL)\n${input.description}` });
  }

  const stream = await ai.models.generateContentStream({ model, contents });
  let accumulatedJson = '';
  for await (const chunk of stream) {
    const chunkText = chunk.text;
    if (chunkText) {
      onThinkingUpdate(chunkText);
      accumulatedJson += chunkText;
    }
  }

  if (!accumulatedJson.trim()) {
    throw new Error("A API não retornou nenhum conteúdo.");
  }
  
  try {
    const startIndex = accumulatedJson.indexOf('{');
    const endIndex = accumulatedJson.lastIndexOf('}');
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        throw new Error("Não foi possível encontrar um objeto JSON válido na resposta da IA.");
    }
    const jsonString = accumulatedJson.substring(startIndex, endIndex + 1);
    return JSON.parse(jsonString) as T;
  } catch (e) {
      console.error("Falha ao parsear a resposta JSON:", accumulatedJson);
      throw new Error(`A resposta da IA não é um JSON válido. Resposta recebida: ${accumulatedJson}`);
  }
};


// --- PROMPTS ---

const getBaseContextPrompt = (description: string, existingResults: Partial<AnalysisResult>): string => `
# CONTEXTO GERAL
${IFSC_CONTEXT}

A análise é sobre um processo do IFSC descrito como: "${description || 'Não fornecido'}".
Os seguintes artefatos já foram gerados e devem ser usados como base para a sua tarefa. Se um artefato estiver vazio, significa que ainda não foi gerado.
\`\`\`json
${JSON.stringify(existingResults, null, 2)}
\`\`\`
`;

const getVisualPrompt = (): string => `
# ROLE
Você é um Arquiteto Mestre de Automação IA. Sua tarefa é converter uma descrição de processo (texto, imagem, ou Bizagi) em um modelo visual BPMN 2.0.

# TASK
Analise a entrada do usuário e gere o XML para o processo visual. Sua resposta DEVE focar EXCLUSIVAMENTE na geração do BPMN. O artefato DMN não deve ser gerado.

### REGRAS CRÍTICAS E OBRIGATÓRIAS PARA GERAÇÃO DE BPMN (LEIA COM ATENÇÃO)
O XML do BPMN 2.0 gerado DEVE ser 100% válido e visualmente renderizável. A falha em seguir estas regras resultará em um diagrama que não pode ser desenhado.
#### Regra 0: DOCUMENTO BEM FORMADO (A MAIS IMPORTANTE)
- O output DEVE começar SEMPRE com a declaração XML: \`<?xml version="1.0" encoding="UTF-8"?>\`.
- O elemento raiz do documento DEVE ser SEMPRE \`<bpmn:definitions>\`.
- O namespace principal do BPMN DEVE ser \`http://www.omg.org/spec/BPMN/20100524/MODEL\`.
#### VALIDAÇÃO LÓGICA (A ESTRUTURA):
1. REFERÊNCIAS COMPLETAS: Todo \`<bpmn:sequenceFlow>\` e \`<bpmn:messageFlow>\` DEVE OBRIGATÓRIO ter os atributos \`sourceRef\` e \`targetRef\` preenchidos com IDs válidos de elementos existentes no modelo. É PROIBIDO omitir qualquer um desses atributos.
2. FLUXOS DE MENSAGEM: \`<bpmn:messageFlow>\` só pode conectar elementos em PARTICIPANTES (\`<bpmn:participant>\`) diferentes.
#### VALIDAÇÃO VISUAL (O DESENHO - BPMNDI):
1. SEÇÃO BPMNDI OBRIGATÓRIA: A seção completa \`<bpmndi:BPMNDiagram>\` com um \`<bpmndi:BPMNPlane>\` é OBRIGATÓRIA.
2. DESENHE TUDO (1 PARA 1): Para CADA elemento lógico definido na seção \`<bpmn:process>\` ou \`<bpmn:collaboration>\`, DEVE haver um elemento visual correspondente dentro do \`<bpmndi:BPMNPlane>\`.
3. IDS CONSISTENTES: O atributo \`bpmnElement\` em cada \`BPMNShape\` e \`BPMNEdge\` DEVE corresponder ao \`id\` do elemento lógico que ele representa.

// ### REGRAS CRÍTICAS E OBRIGATÓRIAS PARA GERAÇÃO DE DMN 1.3 (SE APLICÁVEL)
// Comentado para desabilitar a funcionalidade DMN
// O valor para "dmn_xml" DEVE ser \`null\`.

# OUTPUT_FORMAT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido contendo a chave "processo_visual". O valor da chave "dmn_xml" DEVE ser sempre \`null\`.
{
  "processo_visual": { "bpmn_xml": "<?xml ...>", "dmn_xml": null }
}`;

const getAnalysisPrompt = (description: string, results: Partial<AnalysisResult>): string => `
# ROLE
Você é um Especialista em Conformidade LGPD.
${getBaseContextPrompt(description, results)}

# TASK
Analise o processo para identificar e classificar todos os dados pessoais e sensíveis manipulados. Determine a finalidade de cada um.

### REGRAS ESTRITAS DE FORMATO
Para esta seção, a estrutura JSON DEVE ser EXATAMENTE a seguinte:
- O objeto principal é \`analise_dados_pessoais\`.
- Dentro dele, há duas chaves: \`dados_identificados\` e \`dados_sensiveis_identificados\`.
- Cada uma dessas chaves contém um array de objetos.
- Cada objeto nesse array DEVE ter TRÊS chaves: \`dado\`, \`finalidade\`, \`classificacao\` ("Pessoal" ou "Sensível").

# OUTPUT_FORMAT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido contendo a chave "analise_dados_pessoais".
{
  "analise_dados_pessoais": { "dados_identificados": [], "dados_sensiveis_identificados": [] }
}`;

const getInventoryPrompt = (description: string, results: Partial<AnalysisResult>): string => `
# ROLE
Você é um Especialista em Conformidade LGPD. Sua tarefa é preencher o Inventário de Dados Pessoais (IDP) para o processo descrito.
${getBaseContextPrompt(description, results)}

# TASK
Com base em toda a informação contextual, gere a entrada completa para o Inventário de Dados Pessoais (IDP) seguindo RIGOROSAMENTE a estrutura JSON abaixo. Use as informações institucionais do IFSC para os campos de Controlador e Encarregado (DPO). Analise o processo para identificar operadores e preencher os demais campos. Para arrays vazios, retorne []. Para campos de texto não aplicáveis, use "Não aplicável".

# OUTPUT_FORMAT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido contendo a chave "inventario_idp".
{
  "inventario_idp": {
    "identificacao_servico": {
      "nome_processo": "string",
      "id_referencia": "string (ex: 'IDP-001', se não houver, gere um)",
      "data_criacao": "string (YYYY-MM-DD, data de hoje)",
      "data_atualizacao": "string (YYYY-MM-DD, data de hoje)"
    },
    "agentes_tratamento": {
      "controlador": {
        "nome": "Instituto Federal de Educação, Ciência e Tecnologia de Santa Catarina (IFSC)",
        "natureza_juridica": "Autarquia Federal",
        "cnpj": "11.402.887/0001-60",
        "endereco": "Rua 14 de Julho, 150, Coqueiros - Florianópolis - SC",
        "cep": "88075-010",
        "telefone": "(48) 3877-9000",
        "email": "gabinete.reitoria@ifsc.edu.br"
      },
      "encarregado_dpo": {
        "nome": "Volnei Velleda Rodrigues",
        "contato": "encarregado.lgpd@ifsc.edu.br",
        "previsao_legal": "Art. 41 da Lei nº 13.709/2018 (LGPD)"
      },
      "operadores": [
        {
          "nome": "string (Nome do Operador, ex: Google, ou 'Servidores do IFSC' para processos internos)",
          "endereco": "string", "cep": "string", "telefone": "string", "email": "string"
        }
      ]
    },
    "fases_ciclo_vida": [
      {
        "operador": "string (Nome do Operador)",
        "coleta": "boolean", "retencao": "boolean", "processamento": "boolean", "compartilhamento": "boolean", "eliminacao": "boolean"
      }
    ],
    "descricao_fluxo_tratamento": {
      "coleta": "string (Como os dados são coletados?)",
      "armazenamento": "string (Onde e como são armazenados?)",
      "uso": "string (Para que são usados?)",
      "compartilhamento": "string (Com quem são compartilhados?)",
      "eliminacao": "string (Como são eliminados?)"
    },
    "escopo_natureza_dados": {
      "abrangencia_geografica": "string (ex: Nacional, Estadual)",
      "fonte_dados": "string (ex: Titular dos dados, Fontes públicas)"
    },
    "finalidade_tratamento": {
      "hipotese_tratamento": "string (ex: Execução de políticas públicas, Cumprimento de obrigação legal)",
      "finalidade": "string (Descrição da finalidade principal do tratamento)",
      "previsao_legal": "string (ex: Lei 11.892/2008)",
      "resultados_pretendidos": "string (O que o titular ganha com isso?)",
      "beneficios_esperados": "string (O que o órgão/sociedade ganha?)"
    },
    "categorias_dados_pessoais": [
      {
        "descricao": "string (ex: Nome e e-mail)",
        "tempo_retencao": "string (ex: Indefinido, 5 anos)",
        "fonte_retencao": "string (ex: Planilha eletrônica, Base de dados)"
      }
    ],
    "categorias_dados_sensiveis": [
       {
        "descricao": "string (ex: Dados sobre saúde)",
        "tempo_retencao": "string",
        "fonte_retencao": "string"
      }
    ],
    "frequencia_totalizacao": {
      "frequencia_tratamento": "string (ex: Diário, Sob demanda, 24x7)",
      "quantidade_dados_pessoais": "number",
      "quantidade_dados_sensiveis": "number"
    },
    "categorias_titulares": {
      "categoria": "string (ex: Pessoas, Servidores, Alunos)",
      "descricao": "string (Detalhes sobre a categoria, ex: 'Interessados em estudar no IFSC')",
      "trata_criancas_adolescentes": "boolean",
      "trata_outro_grupo_vulneravel": "boolean"
    },
    "compartilhamento_dados": [
      {
        "instituicao": "string (Nome da instituição com quem os dados são compartilhados)",
        "dados_compartilhados": "string",
        "finalidade": "string"
      }
    ],
    "medidas_seguranca": [
      {
        "tipo_medida": "string (ex: Controle de Acesso e Privacidade)",
        "descricao_controles": "string (ex: Acesso somente por servidores envolvidos, autenticação em dois fatores)"
      }
    ],
    "transferencia_internacional": [
      {
        "organizacao": "string", "pais": "string", "dados_transferidos": "string", "tipo_garantia": "string"
      }
    ],
    "contratos_ti": [
      {
        "numero_processo": "string", "objeto_contrato": "string", "email_gestor": "string"
      }
    ],
    "manter_atualizacao": {
      "politica_atualizacao": "Este documento é 'vivo' e deve ser atualizado sempre que houver mudanças no processo de tratamento de dados.",
      "periodicidade": "Anual ou sob demanda."
    }
  }
}
`;

const getRipdPrompt = (description: string, results: Partial<AnalysisResult>): string => `
# ROLE
Você é um Especialista Sênior em Conformidade e Privacidade de Dados.

${getBaseContextPrompt(description, results)}

# TASK
Sua tarefa é preencher o modelo de Relatório de Impacto à Proteção de Dados (RIPD) abaixo. Utilize as informações dos artefatos já gerados (IDP, Análise de Dados) para preencher CADA campo do modelo de forma precisa e concisa. A estrutura deve seguir o padrão de um documento formal, facilitando a cópia para publicação.

1.  **Avaliação de Risco:** Primeiro, avalie o risco geral do processo. Se 'analise_dados_pessoais.dados_sensiveis_identificados' contiver QUALQUER item, ou se 'inventario_idp.categorias_titulares.trata_criancas_adolescentes' for 'true', o risco é ALTO e você DEVE gerar o relatório completo.
2.  **Geração do Relatório:** Se o risco for alto, preencha o modelo Markdown abaixo. Caso contrário, retorne \`null\`.
3.  **Transposição de Dados:** Preencha os placeholders (ex: {nome do processo}) com os dados exatos do JSON de contexto. Não invente informações. Se uma informação não estiver disponível, indique "Não informado".

# MODELO MARKDOWN (PREENCHA ESTE MODELO)

# RELATÓRIO DE IMPACTO À PROTEÇÃO DE DADOS PESSOAIS (RIPD)

---

## 1. Identificação do Processo de Tratamento de Dados Pessoais

**Nome do Processo:** {inventario_idp.identificacao_servico.nome_processo}
**ID de Referência:** {inventario_idp.identificacao_servico.id_referencia}
**Descrição Breve do Processo:** {description}
**Data de Elaboração/Última Atualização:** {inventario_idp.identificacao_servico.data_atualizacao}

---

## 2. Agentes de Tratamento

**Controlador:**
- **Nome:** Instituto Federal de Educação, Ciência e Tecnologia de Santa Catarina (IFSC)
- **CNPJ:** 11.402.887/0001-60
- **Endereço:** Rua 14 de Julho, 150, Coqueiros - Florianópolis - SC, CEP 88075-010
- **Contato:** (48) 3877-9000, gabinete.reitoria@ifsc.edu.br

**Encarregado (DPO):**
- **Nome:** Volnei Velleda Rodrigues
- **Contato:** encarregado.lgpd@ifsc.edu.br

**Operador(es):**
{Liste os nomes dos operadores de inventario_idp.agentes_tratamento.operadores}

---

## 3. Dados Pessoais Envolvidos

**Categorias de Dados Pessoais:** {Liste as descrições de inventario_idp.categorias_dados_pessoais}
**Categorias de Dados Pessoais Sensíveis:** {Liste as descrições de inventario_idp.categorias_dados_sensiveis, se houver}
**Categorias de Titulares:** {inventario_idp.categorias_titulares.categoria} - {inventario_idp.categorias_titulares.descricao}
**Tratamento de Dados de Crianças e Adolescentes/Grupos Vulneráveis?:**
- **Trata dados de crianças e adolescentes:** {inventario_idp.categorias_titulares.trata_criancas_adolescentes ? 'Sim' : 'Não'}
- **Trata dados de outro grupo vulnerável:** {inventario_idp.categorias_titulares.trata_outro_grupo_vulneravel ? 'Sim' : 'Não'}

---

## 4. Finalidade e Base Legal do Tratamento

**Finalidade(s):** {inventario_idp.finalidade_tratamento.finalidade}
**Base(s) Legal(is):** {inventario_idp.finalidade_tratamento.hipotese_tratamento}
**Previsão Legal Específica:** {inventario_idp.finalidade_tratamento.previsao_legal}

---

## 5. Análise de Riscos e Impactos

**Riscos Identificados:**
- Vazamento, acesso não autorizado ou uso indevido de dados pessoais e, especialmente, dados pessoais sensíveis.
- Reidentificação de titulares em conjuntos de dados, se aplicável.
- Descumprimento de obrigações legais da LGPD.
- Prejuízo à privacidade e aos direitos de grupos vulneráveis, se aplicável.

**Impactos para os Titulares:**
- Danos materiais e morais (e.g., discriminação, fraude, perda de controle sobre informações) em caso de violação de dados.

**Impactos para o Controlador (IFSC):**
- Danos à imagem e reputação institucional.
- Aplicação de sanções administrativas pela ANPD.
- Custos financeiros decorrentes de ações judiciais e remediação de incidentes.

---

## 6. Medidas de Salvaguarda e Mitigação de Riscos

**Medidas Técnicas e Organizacionais:**
{Liste as descrições de inventario_idp.medidas_seguranca}
- **Governança e Conscientização:** Treinamento contínuo em LGPD e segurança da informação para servidores envolvidos.
- **Conformidade com Princípios da LGPD:** O processo é desenhado para garantir a aderência aos princípios da LGPD.
- **Política de Atualização:** O RIPD é um documento vivo e será atualizado anualmente ou sob demanda.

---

## 7. APROVAÇÃO

<br><br>

_________________________________________
**<NOME DO RESPONSÁVEL PELA ELABORAÇÃO>**
*Responsável pela Elaboração do RIPD*

<br><br>

_________________________________________
**Volnei Velleda Rodrigues**
*Encarregado pelo Tratamento de Dados Pessoais (DPO)*

# OUTPUT_FORMAT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido contendo a chave "rascunho_ripd".
{
  "rascunho_ripd": "string em Markdown ou null"
}`;

const getSuggestionsPrompt = (description: string, results: Partial<AnalysisResult>): string => `
# ROLE
Você é um Consultor de Otimização de Processos.
${getBaseContextPrompt(description, results)}

# TASK
Analise o fluxo do processo e o contexto fornecido para identificar gargalos, tarefas manuais ou oportunidades de melhoria. Forneça 2 a 3 sugestões práticas e acionáveis para otimizar ou automatizar o processo.

# OUTPUT_FORMAT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido contendo a chave "sugestoes_automacao".
{
  "sugestoes_automacao": ["Sugestão 1...", "Sugestão 2..."]
}`;

const getLogPrompt = (description: string, results: Partial<AnalysisResult>): string => `
# ROLE
Você é um Auditor de IA Transparente.
${getBaseContextPrompt(description, results)}

# TASK
Forneça um log de transparência sobre sua análise completa até o momento. Descreva os passos que você tomou, as inferências que fez e as fontes de informação que utilizou (texto, BPMN, etc.) para gerar os artefatos.

# OUTPUT_FORMAT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido contendo a chave "log_analise".
{
  "log_analise": "Log da análise..."
}`;

const getRefinePrompt = (previousAnalysis: AnalysisResult, correction: string): string => `
# ROLE
Você é um especialista em conformidade LGPD e modelagem de processos do sez.iO, encarregado de refinar uma análise de processo existente com base no feedback do usuário.

# CONTEXT
O usuário forneceu uma análise de processo gerada anteriormente (no formato JSON) e uma instrução de correção em linguagem natural. Sua tarefa é interpretar a correção e aplicá-la à análise anterior, gerando uma nova versão completa e corrigida de TODOS os artefatos.

# TASK
1.  Analise a Saída JSON Anterior.
2.  Interprete a Instrução de Correção do usuário.
3.  Aplique a Correção em TODOS os artefatos relevantes (BPMN, análise de dados, IDP, RIPD, etc.) para garantir consistência.
4.  Gere uma Nova Saída Completa, retornando um NOVO objeto JSON COMPLETO, mantendo a mesma estrutura do JSON original, mas com as correções aplicadas.

# REGRAS DE GERAÇÃO PARA ARTEFATOS VISUAIS (BPMN & DMN)
Ao regenerar o artefato \`processo_visual\`, você DEVE seguir as mesmas regras estritas da geração inicial para garantir que os diagramas sejam válidos e renderizáveis. A falha em seguir estas regras resultará em um erro para o usuário.

### REGRAS CRÍTICAS E OBRIGATÓRIAS PARA GERAÇÃO DE BPMN (LEIA COM ATENÇÃO)
O XML do BPMN 2.0 gerado DEVE ser 100% válido e visualmente renderizável. A falha em seguir estas regras resultará em um diagrama que não pode ser desenhado.
#### Regra 0: DOCUMENTO BEM FORMADO (A MAIS IMPORTANTE)
- O output DEVE começar SEMPRE com a declaração XML: \`<?xml version="1.0" encoding="UTF-8"?>\`.
- O elemento raiz do documento DEVE ser SEMPRE \`<bpmn:definitions>\`.
- O namespace principal do BPMN DEVE ser \`http://www.omg.org/spec/BPMN/20100524/MODEL\`.
#### VALIDAÇÃO LÓGICA (A ESTRUTURA):
1. REFERÊNCIAS COMPLETAS: Todo \`<bpmn:sequenceFlow>\` e \`<bpmn:messageFlow>\` DEVE OBRIGATÓRIO ter os atributos \`sourceRef\` e \`targetRef\` preenchidos com IDs válidos de elementos existentes no modelo. É PROIBIDO omitir qualquer um desses atributos.
2. FLUXOS DE MENSAGEM: \`<bpmn:messageFlow>\` só pode conectar elementos em PARTICIPANTES (\`<bpmn:participant>\`) diferentes.
#### VALIDAÇÃO VISUAL (O DESENHO - BPMNDI):
1. SEÇÃO BPMNDI OBRIGATÓRIA: A seção completa \`<bpmndi:BPMNDiagram>\` com um \`<bpmndi:BPMNPlane>\` é OBRIGATÓRIA.
2. DESENHE TUDO (1 PARA 1): Para CADA elemento lógico definido na seção \`<bpmn:process>\` ou \`<bpmn:collaboration>\`, DEVE haver um elemento visual correspondente dentro do \`<bpmndi:BPMNPlane>\`.
3. IDS CONSISTENTES: O atributo \`bpmnElement\` em cada \`BPMNShape\` e \`BPMNEdge\` DEVE corresponder ao \`id\` do elemento lógico que ele representa.

// ### REGRAS CRÍTICAS E OBRIGATÓRIAS PARA GERAÇÃO DE DMN 1.3 (SE APLICÁVEL)
// Comentado para desabilitar a funcionalidade DMN
// O valor para "dmn_xml" DEVE ser \`null\`.


# JSON ANTERIOR (PARA CORRIGIR)
\`\`\`json
${JSON.stringify(previousAnalysis, null, 2)}
\`\`\`

# INSTRUÇÃO DE CORREÇÃO DO USUÁRIO
"${correction}"

# OUTPUT_FORMAT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido, com a estrutura completa da AnalysisResult, contendo as correções solicitadas.
`;

// --- SERVICE FUNCTIONS ---

export const generateVisual = async (input: AnalysisInput, onThinkingUpdate: (update: string) => void): Promise<{ processo_visual: ProcessoVisual }> => {
    const prompt = getVisualPrompt();
    return generateAndParse(prompt, input, onThinkingUpdate, true);
};

export const generateDataAnalysis = async (input: AnalysisInput, results: Partial<AnalysisResult>, onThinkingUpdate: (update: string) => void): Promise<{ analise_dados_pessoais: AnaliseDadosPessoais }> => {
    const prompt = getAnalysisPrompt(input.description, results);
    return generateAndParse(prompt, input, onThinkingUpdate);
};

export const generateInventory = async (input: AnalysisInput, results: Partial<AnalysisResult>, onThinkingUpdate: (update: string) => void): Promise<{ inventario_idp: InventarioIDP }> => {
    const prompt = getInventoryPrompt(input.description, results);
    return generateAndParse(prompt, input, onThinkingUpdate);
};

export const generateRipd = async (input: AnalysisInput, results: Partial<AnalysisResult>, onThinkingUpdate: (update: string) => void): Promise<{ rascunho_ripd: RascunhoRIPD }> => {
    const prompt = getRipdPrompt(input.description, results);
    return generateAndParse(prompt, input, onThinkingUpdate);
};

export const generateSuggestions = async (input: AnalysisInput, results: Partial<AnalysisResult>, onThinkingUpdate: (update: string) => void): Promise<{ sugestoes_automacao: SugestoesAutomacao }> => {
    const prompt = getSuggestionsPrompt(input.description, results);
    return generateAndParse(prompt, input, onThinkingUpdate);
};

export const generateLog = async (input: AnalysisInput, results: Partial<AnalysisResult>, onThinkingUpdate: (update: string) => void): Promise<{ log_analise: LogAnalise }> => {
    const prompt = getLogPrompt(input.description, results);
    return generateAndParse(prompt, input, onThinkingUpdate);
};


export const refineProcess = async (
  previousAnalysis: AnalysisResult,
  correction: string,
  onThinkingUpdate: (thinkingUpdate: string) => void
): Promise<AnalysisResult> => {
   try {
    const fullPrompt = getRefinePrompt(previousAnalysis, correction);
    return await generateAndParse(fullPrompt, { description: '', file: null }, onThinkingUpdate);
  } catch (error) {
    console.error("Error calling Gemini API for refinement:", error);
    throw error instanceof Error ? error : new Error("Falha ao refinar a análise.");
  }
};
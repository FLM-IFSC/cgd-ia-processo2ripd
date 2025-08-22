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
A análise é sobre um processo descrito como: "${description || 'Não fornecido'}".
Os seguintes artefatos já foram gerados e devem ser usados como base para a sua tarefa. Se um artefato estiver vazio, significa que ainda não foi gerado.
\`\`\`json
${JSON.stringify(existingResults, null, 2)}
\`\`\`
`;

const getVisualPrompt = (): string => `
# ROLE
Você é um Arquiteto Mestre de Automação IA. Sua tarefa é converter uma descrição de processo (texto, imagem, ou Bizagi) em um modelo visual BPMN 2.0 e, se aplicável, um modelo de decisão DMN 1.3.

# TASK
Analise a entrada do usuário e gere o XML para o processo visual. Sua resposta DEVE focar EXCLUSIVAMENTE na geração do BPMN e DMN.

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

### REGRAS CRÍTICAS E OBRIGATÓRIAS PARA GERAÇÃO DE DMN 1.3 (SE APLICÁVEL)
Se um modelo de decisão for identificado no processo, você DEVE gerar um XML DMN 1.3 VÁLIDO.
#### Regra 0: GERE QUANDO NECESSÁRIO
- Se o processo contém regras de negócio, condições, ou lógicas que determinam o fluxo (ex: "Se o risco for alto, notificar gerente"), você DEVE modelar isso em um DMN.
- Se não houver absolutamente nenhuma decisão a ser modelada, o valor para "dmn_xml" DEVE ser \`null\`. Não gere um DMN vazio.
#### Regra 1: ESTRUTURA, NAMESPACES E CASING (A MAIS IMPORTANTE)
- O XML DEVE começar com \`<?xml version="1.0" encoding="UTF-8"?>\`.
- O elemento raiz DEVE ser \`<dmn:Definitions>\` (com 'D' maiúsculo). QUALQUER OUTRA COISA, como \`<dmn:definitions>\`, resultará em erro.
- O exemplo abaixo mostra a estrutura COMPLETA, VÁLIDA e com o CASING CORRETO que você DEVE seguir. Preencha os IDs, nomes e regras conforme necessário.
  \`\`\`xml
  <dmn:Definitions
      xmlns:dmn="https://www.omg.org/spec/DMN/20180521/MODEL/"
      xmlns:dmndi="https://www.omg.org/spec/DMN/20180521/DMNDI/"
      xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
      xmlns:di="https://www.omg.org/spec/DMN/20180521/DI/"
      id="Definitions_UNIQUE_ID"
      name="DRD"
      namespace="http://camunda.org/schema/1.0/dmn"
      exporter="sez.iO AI"
      exporterVersion="1.0">
    <dmn:Decision id="Decision_ID" name="Nome da Decisao">
      <dmn:DecisionTable id="DecisionTable_ID">
        <dmn:input id="Input_1" label="Condicao de Entrada">
          <dmn:inputExpression id="InputExpression_1" typeRef="string">
            <dmn:text>variavelDeEntrada</dmn:text>
          </dmn:inputExpression>
        </dmn:input>
        <dmn:output id="Output_1" label="Resultado" name="variavelDeSaida" typeRef="string" />
        <dmn:rule id="Rule_1">
          <dmn:inputEntry id="InputEntry_1">
            <dmn:text>"Valor da Condição"</dmn:text>
          </dmn:inputEntry>
          <dmn:outputEntry id="OutputEntry_1">
            <dmn:text>"Resultado Esperado"</dmn:text>
          </dmn:outputEntry>
        </dmn:rule>
      </dmn:DecisionTable>
    </dmn:Decision>
    <dmndi:DMNDI>
      <dmndi:DMNDiagram id="DMNDiagram_ID">
        <dmndi:DMNShape id="DMNShape_Decision_ID" dmnElementRef="Decision_ID">
          <dc:Bounds height="80" width="180" x="160" y="100" />
        </dmndi:DMNShape>
      </dmndi:DMNDiagram>
    </dmndi:DMNDI>
  </dmn:Definitions>
  \`\`\`
#### Regra 2: CONTEÚDO MÍNIMO LÓGICO
- Dentro de \`<dmn:Definitions>\`, DEVE haver pelo menos um elemento \`<dmn:Decision>\`.
- Cada \`<dmn:Decision>\` DEVE conter uma \`<dmn:DecisionTable>\`.
- A \`<dmn:DecisionTable>\` DEVE ter pelo menos um \`<dmn:input>\`, um \`<dmn:output>\` e uma \`<dmn:rule>\`.
#### Regra 3: CONTEÚDO VISUAL OBRIGATÓRIO (DMNDI)
- A seção \`<dmndi:DMNDI>\` contendo um \`<dmndi:DMNDiagram>\` DEVE ser incluída para que o diagrama seja visualizado.
- Para CADA \`<dmn:Decision>\`, DEVE haver um \`<dmndi:DMNShape>\` correspondente dentro do \`<dmndi:DMNDiagram>\`.
- O atributo \`dmnElementRef\` no elemento \`<dmndi:DMNShape>\` DEVE ser o ID exato do \`<dmn:Decision>\` que ele representa. É PROIBIDO usar \`bpmnElement\` ou qualquer outro atributo.

# OUTPUT_FORMAT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido contendo a chave "processo_visual".
{
  "processo_visual": { "bpmn_xml": "<?xml ...>", "dmn_xml": "<?xml ...> ou null" }
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
Você é um Especialista em Conformidade LGPD.
${getBaseContextPrompt(description, results)}

# TASK
Com base em toda a informação contextual, gere a entrada completa para o Inventário de Dados Pessoais (IDP). Seja objetivo e preencha os campos de forma estruturada.

# OUTPUT_FORMAT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido contendo a chave "inventario_idp".
{
  "inventario_idp": { /* Objeto IDP completo */ }
}`;

const getRipdPrompt = (description: string, results: Partial<AnalysisResult>): string => `
# ROLE
Você é um Especialista em Conformidade LGPD.
${getBaseContextPrompt(description, results)}

# TASK
Avalie o risco do processo. Se o risco for 'Alto', preencha o modelo de Relatório de Impacto à Proteção de Dados (RIPD) em formato Markdown. Sua tarefa é uma transposição de dados: pegue as informações que você já analisou (lista de dados, riscos, finalidade, etc.) e insira-as nos placeholders do modelo. Não gere textos longos e descritivos do zero. Seja conciso e direto. Se o risco não for alto, retorne null.

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

### REGRAS CRÍTICAS E OBRIGATÓRIAS PARA GERAÇÃO DE DMN 1.3 (SE APLICÁVEL)
Se um modelo de decisão for identificado no processo, você DEVE gerar um XML DMN 1.3 VÁLIDO.
#### Regra 0: GERE QUANDO NECESSÁRIO
- Se o processo contém regras de negócio, condições, ou lógicas que determinam o fluxo (ex: "Se o risco for alto, notificar gerente"), você DEVE modelar isso em um DMN.
- Se não houver absolutamente nenhuma decisão a ser modelada, o valor para "dmn_xml" DEVE ser \`null\`. Não gere um DMN vazio.
#### Regra 1: ESTRUTURA, NAMESPACES E CASING (A MAIS IMPORTANTE)
- O XML DEVE começar com \`<?xml version="1.0" encoding="UTF-8"?>\`.
- O elemento raiz DEVE ser \`<dmn:Definitions>\` (com 'D' maiúsculo). QUALQUER OUTRA COISA, como \`<dmn:definitions>\`, resultará em erro.
- O exemplo abaixo mostra a estrutura COMPLETA, VÁLIDA e com o CASING CORRETO que você DEVE seguir. Preencha os IDs, nomes e regras conforme necessário.
  \`\`\`xml
  <dmn:Definitions
      xmlns:dmn="https://www.omg.org/spec/DMN/20180521/MODEL/"
      xmlns:dmndi="https://www.omg.org/spec/DMN/20180521/DMNDI/"
      xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
      xmlns:di="https://www.omg.org/spec/DMN/20180521/DI/"
      id="Definitions_UNIQUE_ID"
      name="DRD"
      namespace="http://camunda.org/schema/1.0/dmn"
      exporter="sez.iO AI"
      exporterVersion="1.0">
    <dmn:Decision id="Decision_ID" name="Nome da Decisao">
      <dmn:DecisionTable id="DecisionTable_ID">
        <dmn:input id="Input_1" label="Condicao de Entrada">
          <dmn:inputExpression id="InputExpression_1" typeRef="string">
            <dmn:text>variavelDeEntrada</dmn:text>
          </dmn:inputExpression>
        </dmn:input>
        <dmn:output id="Output_1" label="Resultado" name="variavelDeSaida" typeRef="string" />
        <dmn:rule id="Rule_1">
          <dmn:inputEntry id="InputEntry_1">
            <dmn:text>"Valor da Condição"</dmn:text>
          </dmn:inputEntry>
          <dmn:outputEntry id="OutputEntry_1">
            <dmn:text>"Resultado Esperado"</dmn:text>
          </dmn:outputEntry>
        </dmn:rule>
      </dmn:DecisionTable>
    </dmn:Decision>
    <dmndi:DMNDI>
      <dmndi:DMNDiagram id="DMNDiagram_ID">
        <dmndi:DMNShape id="DMNShape_Decision_ID" dmnElementRef="Decision_ID">
          <dc:Bounds height="80" width="180" x="160" y="100" />
        </dmndi:DMNShape>
      </dmndi:DMNDiagram>
    </dmndi:DMNDI>
  </dmn:Definitions>
  \`\`\`
#### Regra 2: CONTEÚDO MÍNIMO LÓGICO
- Dentro de \`<dmn:Definitions>\`, DEVE haver pelo menos um elemento \`<dmn:Decision>\`.
- Cada \`<dmn:Decision>\` DEVE conter uma \`<dmn:DecisionTable>\`.
- A \`<dmn:DecisionTable>\` DEVE ter pelo menos um \`<dmn:input>\`, um \`<dmn:output>\` e uma \`<dmn:rule>\`.
#### Regra 3: CONTEÚDO VISUAL OBRIGATÓRIO (DMNDI)
- A seção \`<dmndi:DMNDI>\` contendo um \`<dmndi:DMNDiagram>\` DEVE ser incluída para que o diagrama seja visualizado.
- Para CADA \`<dmn:Decision>\`, DEVE haver um \`<dmndi:DMNShape>\` correspondente dentro do \`<dmndi:DMNDiagram>\`.
- O atributo \`dmnElementRef\` no elemento \`<dmndi:DMNShape>\` DEVE ser o ID exato do \`<dmn:Decision>\` que ele representa. É PROIBIDO usar \`bpmnElement\` ou qualquer outro atributo.

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
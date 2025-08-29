import { AnalysisResult } from '../types/index';

export const IFSC_CONTEXT = `
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

export const getBaseContextPrompt = (description: string, existingResults: Partial<AnalysisResult>): string => `
# CONTEXTO GERAL
${IFSC_CONTEXT}

A análise é sobre um processo do IFSC descrito como: "${description || 'Não fornecido'}".
Os seguintes artefatos já foram gerados e devem ser usados como base para a sua tarefa. Se um artefato estiver vazio, significa que ainda não foi gerado.
\`\`\`json
${JSON.stringify(existingResults, null, 2)}
\`\`\`
`;

export const getVisualPrompt = (): string => `
# ROLE
Você é um Arquiteto Mestre de Automação e Especialista em Padrões da OMG, focado na geração de artefatos BPMN 2.0 e DMN 1.3 perfeitamente formatados e válidos.

# TASK
Analise a entrada do usuário (texto, imagem, XML) e gere um objeto JSON contendo dois artefatos: "bpmn_xml" e "dmn_xml".

---
## PARTE 1: Geração de XML BPMN 2.0

Sua primeira tarefa é converter a descrição do processo em um modelo visual BPMN 2.0.

### REGRAS CRÍTICAS E OBRIGATÓRIAS PARA GERAÇÃO DE BPMN (LEIA COM ATENÇÃO)
O XML do BPMN 2.0 gerado DEVE ser 100% válido e visualmente renderizável. A falha em seguir estas regras resultará em um diagrama que não pode ser desenhado.

#### Regra 0: DOCUMENTO BEM FORMADO (A MAIS IMPORTANTE)
- O output DEVE começar SEMPRE com a declaração XML: \`<?xml version="1.0" encoding="UTF-8"?>\`.
- O elemento raiz do documento DEVE ser SEMPRE \`<bpmn:definitions>\`.
- O namespace principal do BPMN DEVE ser \`http://www.omg.org/spec/BPMN/20100524/MODEL\`.

#### Regra 1: VALIDAÇÃO LÓGICA (A ESTRUTURA)
- **REFERÊNCIAS COMPLETAS (ABSOLUTAMENTE OBRIGATÓRIO)**: CADA \`<bpmn:sequenceFlow>\` e CADA \`<bpmn:messageFlow>\` DEVE OBRIGATORIAMENTE ter os atributos \`sourceRef\` e \`targetRef\` preenchidos. Os valores para estes atributos DEVEM ser IDs válidos de elementos existentes no modelo. É ESTRITAMENTE PROIBIDO omitir \`sourceRef\` ou \`targetRef\`. A ausência de qualquer um deles é um erro fatal.
- **FLUXOS DE MENSAGEM**: \`<bpmn:messageFlow>\` só pode conectar elementos em PARTICIPANTES (\`<bpmn:participant>\`) diferentes.

#### Regra 2: VALIDAÇÃO VISUAL (O DESENHO - BPMNDI)
- **SEÇÃO BPMNDI OBRIGATÓRIA**: A seção completa \`<bpmndi:BPMNDiagram>\` com um \`<bpmndi:BPMNPlane>\` é OBRIGATÓRIA.
- **DESENHE TUDO (1 PARA 1)**: Para CADA elemento lógico definido na seção \`<bpmn:process>\` ou \`<bpmn:collaboration>\` (como tasks, gateways, events), DEVE haver um elemento visual correspondente (\`BPMNShape\` ou \`BPMNEdge\`) dentro do \`<bpmndi:BPMNPlane>\`.
- **IDS CONSISTENTES**: O atributo \`bpmnElement\` em cada \`BPMNShape\` e \`BPMNEdge\` DEVE corresponder ao \`id\` do elemento lógico que ele representa.

---
## PARTE 2: Geração de XML DMN 1.3 (Opcional)

Sua segunda tarefa é identificar se o processo descrito contém um ponto de decisão claro e baseado em regras.

### TAREFA DMN
- **SE** a descrição do processo contiver uma decisão explícita (ex: "SE condição X E condição Y, ENTÃO resultado A"), você DEVE gerar o XML da tabela de decisão.
- **SE NÃO** houver uma decisão clara ou baseada em regras descrita, o valor para "dmn_xml" no output final DEVE ser \`null\`.

### REGRAS RÍGIDAS DE FORMATAÇÃO XML DMN (ESSENCIAL PARA A VALIDAÇÃO):
- **VERSÃO DO DMN**: O XML deve seguir estritamente o padrão DMN 1.3.
- **NAMESPACES**: O elemento raiz \`<definitions>\` OBRIGATORIAMENTE deve conter os seguintes namespaces:
\`\`\`xml
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/"
             id="definitions_1" name="decisao" namespace="http://camunda.org/schema/1.0/dmn">
\`\`\`
- **ESTRUTURA HIERÁQUICA**: A estrutura deve ser: \`<definitions> -> <decision> -> <decisionTable>\`.
- **COLUNAS (INPUT/OUTPUT)**: As colunas são definidas pelas tags \`<input>\` e \`<output>\`. Cada uma deve ter um \`id\` e \`label\`. O \`<input>\` também precisa de um \`<inputExpression>\`.
- **REGRAS (RULE)**: Cada linha da tabela é uma tag \`<rule>\` com um \`id\` único.
- **CÉLULAS (ENTRY)**: As células dentro de uma regra são definidas pelas tags \`<inputEntry>\` e \`<outputEntry>\`.
- **CONTEÚDO DA CÉLULA (TEXT)**: O valor de cada célula DEVE estar dentro de uma tag \`<text>\`. Exemplo: \`<inputEntry><text>"Condição A"</text></inputEntry>\`.

---
# FORMATO DO OUTPUT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido contendo a chave "processo_visual". O valor de "dmn_xml" deve ser uma string XML válida ou \`null\`.
{
  "processo_visual": {
    "bpmn_xml": "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>...",
    "dmn_xml": "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>..."
  }
}`;

export const getAnalysisPrompt = (description: string, results: Partial<AnalysisResult>): string => `
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

export const getInventoryPrompt = (description: string, results: Partial<AnalysisResult>): string => `
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

export const getRipdPrompt = (description: string, results: Partial<AnalysisResult>): string => `
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



_________________________________________
**<NOME DO RESPONSÁVEL PELA ELABORAÇÃO>**
*Responsável pela Elaboração do RIPD*



_________________________________________
**Volnei Velleda Rodrigues**
*Encarregado pelo Tratamento de Dados Pessoais (DPO)*
# OUTPUT_FORMAT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido contendo a chave "rascunho_ripd".
{
  "rascunho_ripd": "string em Markdown ou null"
}`;

export const getSuggestionsPrompt = (description: string, results: Partial<AnalysisResult>): string => `
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

export const getLogPrompt = (description: string, results: Partial<AnalysisResult>): string => `
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

const getBaseRefinePrompt = (previousAnalysis: AnalysisResult, correction: string, targetArtifact: keyof AnalysisResult, instructions: string): string => `
# ROLE
Você é um especialista em conformidade LGPD e modelagem de processos do sez.iO, focado em refinar um artefato específico com base no feedback do usuário.

# CONTEXT
O usuário forneceu uma análise de processo gerada anteriormente (no formato JSON) e uma instrução de correção em linguagem natural. Sua tarefa é interpretar a correção e aplicá-la APENAS ao artefato alvo, gerando uma nova versão SOMENTE desse artefato. Use o restante do JSON como contexto, mas NÃO o modifique.

# JSON ANTERIOR (PARA CONTEXTO)
\`\`\`json
${JSON.stringify(previousAnalysis, null, 2)}
\`\`\`

# INSTRUÇÃO DE CORREÇÃO DO USUÁRIO
"${correction}"

# TASK
1. Analise o JSON de contexto e a instrução de correção.
2. Regenere a nova versão do artefato **${targetArtifact}**.
${instructions}

# OUTPUT_FORMAT
Sua resposta DEVE SER ESTRITAMENTE um único objeto JSON válido, contendo APENAS a chave do artefato corrigido: "${targetArtifact}".
`;

export const getRefineVisualPrompt = (previousAnalysis: AnalysisResult, correction: string): string => {
    const instructions = `
### REGRAS CRÍTICAS E OBRIGATÓRIAS PARA GERAÇÃO DE BPMN (LEIA COM ATENÇÃO)
- **REFERÊNCIAS COMPLETAS (ABSOLUTAMENTE OBRIGATÓRIO)**: CADA \`<bpmn:sequenceFlow>\` e CADA \`<bpmn:messageFlow>\` DEVE OBRIGATORIAMENTE ter os atributos \`sourceRef\` e \`targetRef\` preenchidos com IDs válidos. É ESTRITAMENTE PROIBIDO omitir qualquer um deles.
- **SEÇÃO BPMNDI OBRIGATÓRIA**: CADA elemento lógico DEVE ter um elemento visual correspondente em \`<bpmndi:BPMNPlane>\`.

### REGRAS CRÍTICAS E OBRIGATÓRIAS PARA GERAÇÃO DE DMN 1.3 (SE APLICÁVEL)
- Se a correção introduzir/modificar uma decisão, gere o XML DMN 1.3. Se a correção remover a decisão ou se não houver nenhuma, o valor para "dmn_xml" DEVE ser \`null\`.
`;
    return getBaseRefinePrompt(previousAnalysis, correction, 'processo_visual', instructions);
};

export const getRefineAnalysisPrompt = (previousAnalysis: AnalysisResult, correction: string): string => {
    const instructions = `
- A estrutura do objeto "analise_dados_pessoais" DEVE ser EXATAMENTE a mesma da geração original, contendo as chaves "dados_identificados" e "dados_sensiveis_identificados".
- Cada item nos arrays DEVE ter as chaves "dado", "finalidade", e "classificacao".
`;
    return getBaseRefinePrompt(previousAnalysis, correction, 'analise_dados_pessoais', instructions);
};

export const getRefineInventoryPrompt = (previousAnalysis: AnalysisResult, correction: string): string => {
    const instructions = `
- A estrutura do objeto "inventario_idp" DEVE ser EXATAMENTE a mesma da geração original. Preencha todos os campos conforme o novo contexto da correção.
`;
    return getBaseRefinePrompt(previousAnalysis, correction, 'inventario_idp', instructions);
};

export const getRefineRipdPrompt = (previousAnalysis: AnalysisResult, correction: string): string => {
    const instructions = `
- Regenere o relatório "rascunho_ripd" em formato Markdown.
- Se a correção resultar em um processo de baixo risco (sem dados sensíveis ou de crianças/adolescentes), o valor da chave "rascunho_ripd" DEVE ser \`null\`.
`;
    return getBaseRefinePrompt(previousAnalysis, correction, 'rascunho_ripd', instructions);
};

export const getRefineSuggestionsPrompt = (previousAnalysis: AnalysisResult, correction: string): string => {
    const instructions = `
- O valor de "sugestoes_automacao" DEVE ser um array de strings.
`;
    return getBaseRefinePrompt(previousAnalysis, correction, 'sugestoes_automacao', instructions);
};

export const getRefineLogPrompt = (previousAnalysis: AnalysisResult, correction: string): string => {
    const instructions = `
- Gere um novo log de análise que reflita o processo após a correção.
- O valor de "log_analise" DEVE ser uma única string.
`;
    return getBaseRefinePrompt(previousAnalysis, correction, 'log_analise', instructions);
};

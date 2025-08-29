import { GoogleGenAI } from "@google/genai";
import JSZip from 'jszip';
import { AnalysisResult, AnaliseDadosPessoais, InventarioIDP, LogAnalise, ProcessoVisual, RascunhoRIPD, SugestoesAutomacao } from '../types/index';
import * as prompts from './prompts';

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

type ArtifactKey = keyof AnalysisResult;


/**
 * Extracts text content from process files (.xpdl, .bpmn, .xml).
 * It also sanitizes the text by removing the BOM.
 */
const getTextContentFromFile = async (file: File): Promise<string> => {
    const sanitize = (text: string) => {
        // Remove Byte Order Mark if present
        if (text.charCodeAt(0) === 0xFEFF) {
            return text.substring(1);
        }
        return text;
    };
    
    // Handle .xpdl, .bpmn, .xml files
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(sanitize(e.target?.result as string));
        reader.onerror = () => reject(reader.error || new Error("File reading failed"));
        reader.readAsText(file);
    });
};


/**
 * Converts an image File object to the GoogleGenerativeAI.Part format.
 * Throws an error for non-image files, as they should be handled as text.
 */
const fileToImagePart = async (file: File): Promise<{inlineData: { mimeType: string, data: string }}> => {
  if (!file.type.startsWith('image/')) {
    throw new Error(`Tipo de arquivo '${file.type}' não é uma imagem. Arquivos de processo devem ser lidos como texto.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      try {
        const result = (reader.result as string);
        const data = result.split(',')[1];
        resolve({ inlineData: { mimeType: file.type, data } });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Generic function to call the Gemini API with a streaming response and parse the JSON result.
 * Includes robust JSON cleaning and a retry mechanism for API calls.
 */
const streamAndParse = async <T>(
  contents: { parts: any[] },
  onThinkingUpdate: (update: string) => void,
  retries = 3
): Promise<T> => {
  try {
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
      let jsonString = accumulatedJson.trim();

      // Clean markdown fences
      if (jsonString.startsWith('```json')) {
        jsonString = jsonString.substring(7);
        if (jsonString.endsWith('```')) {
          jsonString = jsonString.slice(0, -3);
        }
      } else if (jsonString.startsWith('```')) {
        jsonString = jsonString.substring(3);
        if (jsonString.endsWith('```')) {
          jsonString = jsonString.slice(0, -3);
        }
      }
      jsonString = jsonString.trim();

      const startIndex = jsonString.indexOf('{');
      const endIndex = jsonString.lastIndexOf('}');
      if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        throw new Error("Não foi possível encontrar um objeto JSON válido na resposta da IA.");
      }
      jsonString = jsonString.substring(startIndex, endIndex + 1);

      // Fix for observed invalid escape sequences from the model
      jsonString = jsonString.replace(/\\>/g, '>');

      return JSON.parse(jsonString) as T;
    } catch (e) {
      console.error("Falha ao parsear a resposta JSON:", accumulatedJson);
      throw new Error(`A resposta da IA não é um JSON válido. Resposta recebida: ${accumulatedJson}`);
    }
  } catch (apiError) {
    if (retries > 1) {
      console.warn(`API call failed, retrying... (${retries - 1} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5s delay
      return streamAndParse(contents, onThinkingUpdate, retries - 1);
    }
    console.error("API call failed after multiple retries:", apiError);
    // Re-throw the original error to be handled by the caller
    throw apiError instanceof Error ? apiError : new Error('An unknown API error occurred after retries.');
  }
};


// --- SERVICE FUNCTIONS ---

export const generateVisual = async (input: AnalysisInput, onThinkingUpdate: (update: string) => void): Promise<{ processo_visual: ProcessoVisual }> => {
    const prompt = prompts.getVisualPrompt();
    const parts: any[] = [];
    const textBasedExtensions = ['.xpdl', '.bpmn', '.xml'];

    let finalPrompt = prompt;

    if (input.file) {
        const fileName = input.file.name.toLowerCase();
        const isTextBased = textBasedExtensions.some(ext => fileName.endsWith(ext));
        
        if (isTextBased) {
            const fileContent = await getTextContentFromFile(input.file);
            finalPrompt = `${prompt}\n\n# CONTEÚDO DO ARQUIVO FORNECIDO (${fileName}):\n\`\`\`xml\n${fileContent}\n\`\`\``;
        } else {
            parts.push(await fileToImagePart(input.file));
        }
    }

    if (input.description) {
        finalPrompt += `\n\n# CONTEXTO ADICIONAL (LINGUAGEM NATURAL)\n${input.description}`;
    }
    
    parts.push({ text: finalPrompt });

    return streamAndParse({ parts }, onThinkingUpdate);
};

const createStandardParts = (prompt: string): any[] => {
    return [{ text: prompt }];
};

export const generateDataAnalysis = async (input: AnalysisInput, results: Partial<AnalysisResult>, onThinkingUpdate: (update: string) => void): Promise<{ analise_dados_pessoais: AnaliseDadosPessoais }> => {
    const prompt = prompts.getAnalysisPrompt(input.description, results);
    return streamAndParse({ parts: createStandardParts(prompt) }, onThinkingUpdate);
};

export const generateInventory = async (input: AnalysisInput, results: Partial<AnalysisResult>, onThinkingUpdate: (update: string) => void): Promise<{ inventario_idp: InventarioIDP }> => {
    const prompt = prompts.getInventoryPrompt(input.description, results);
    return streamAndParse({ parts: createStandardParts(prompt) }, onThinkingUpdate);
};

export const generateRipd = async (input: AnalysisInput, results: Partial<AnalysisResult>, onThinkingUpdate: (update: string) => void): Promise<{ rascunho_ripd: RascunhoRIPD }> => {
    const prompt = prompts.getRipdPrompt(input.description, results);
    return streamAndParse({ parts: createStandardParts(prompt) }, onThinkingUpdate);
};

export const generateSuggestions = async (input: AnalysisInput, results: Partial<AnalysisResult>, onThinkingUpdate: (update: string) => void): Promise<{ sugestoes_automacao: SugestoesAutomacao }> => {
    const prompt = prompts.getSuggestionsPrompt(input.description, results);
    return streamAndParse({ parts: createStandardParts(prompt) }, onThinkingUpdate);
};

export const generateLog = async (input: AnalysisInput, results: Partial<AnalysisResult>, onThinkingUpdate: (update: string) => void): Promise<{ log_analise: LogAnalise }> => {
    const prompt = prompts.getLogPrompt(input.description, results);
    return streamAndParse({ parts: createStandardParts(prompt) }, onThinkingUpdate);
};


export const refineArtifact = async (
  artifact: ArtifactKey,
  previousAnalysis: AnalysisResult,
  correction: string,
  onThinkingUpdate: (thinkingUpdate: string) => void
): Promise<Partial<AnalysisResult>> => {
  let prompt;
  switch (artifact) {
    case 'processo_visual':
      prompt = prompts.getRefineVisualPrompt(previousAnalysis, correction);
      break;
    case 'analise_dados_pessoais':
      prompt = prompts.getRefineAnalysisPrompt(previousAnalysis, correction);
      break;
    case 'inventario_idp':
      prompt = prompts.getRefineInventoryPrompt(previousAnalysis, correction);
      break;
    case 'rascunho_ripd':
      prompt = prompts.getRefineRipdPrompt(previousAnalysis, correction);
      break;
    case 'sugestoes_automacao':
      prompt = prompts.getRefineSuggestionsPrompt(previousAnalysis, correction);
      break;
    case 'log_analise':
      prompt = prompts.getRefineLogPrompt(previousAnalysis, correction);
      break;
    default:
      throw new Error(`Refinement for artifact type "${artifact}" is not implemented.`);
  }

  try {
    const parts = [{ text: prompt }];
    return await streamAndParse({ parts }, onThinkingUpdate);
  } catch (error) {
    console.error(`Error calling Gemini API for ${artifact} refinement:`, error);
    throw error instanceof Error ? error : new Error(`Falha ao refinar o artefato: ${artifact}.`);
  }
};

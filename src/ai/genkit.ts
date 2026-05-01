
import 'dotenv/config';
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Inicialização do Genkit.
 * Suporta tanto a chave padrão do Genkit quanto a GEMINI_API_KEY configurada no console.
 * O 'dotenv/config' garante a leitura do arquivo .env localmente.
 */
export const ai = genkit({
  plugins: [googleAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY
  })],
  model: 'googleai/gemini-1.5-flash',
});

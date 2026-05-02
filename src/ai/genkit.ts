
import 'dotenv/config';
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Inicialização do Genkit com configuração robusta de chaves.
 * O modelo flash é ideal para respostas rápidas no chat.
 */
export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY 
    })
  ],
  model: 'googleai/gemini-1.5-flash',
});

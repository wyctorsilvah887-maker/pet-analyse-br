
import 'dotenv/config';
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Inicialização do Genkit.
 * Configuramos o plugin para aceitar tanto GEMINI_API_KEY quanto GOOGLE_GENAI_API_KEY,
 * garantindo compatibilidade com os Secrets configurados no App Hosting.
 */
export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY 
    })
  ],
  model: 'googleai/gemini-1.5-flash',
});

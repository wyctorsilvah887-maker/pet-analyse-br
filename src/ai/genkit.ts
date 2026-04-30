
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Inicialização do Genkit.
 * A chave de API é consumida automaticamente da variável de ambiente GOOGLE_GENAI_API_KEY.
 * Em produção (App Hosting), esta chave deve ser configurada como um 'Secret'.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});

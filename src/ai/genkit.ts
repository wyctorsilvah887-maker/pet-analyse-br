
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * Inicialização do Genkit.
 * A chave de API deve ser fornecida via variável de ambiente GOOGLE_GENAI_API_KEY.
 * NUNCA coloque a chave diretamente neste arquivo.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});

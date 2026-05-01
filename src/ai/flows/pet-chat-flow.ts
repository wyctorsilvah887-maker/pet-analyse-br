
'use server';
/**
 * @fileOverview Fluxo Genkit para processar conversas no chat de um pet, com suporte opcional a imagens.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PetChatInputSchema = z.object({
  petName: z.string(),
  petSpecies: z.string(),
  petBreed: z.string().optional(),
  petAge: z.number().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    text: z.string(),
  })),
  userMessage: z.string(),
  photoDataUri: z.string().optional().describe("Uma foto enviada no chat para a IA analisar."),
});
export type PetChatInput = z.infer<typeof PetChatInputSchema>;

const PetChatOutputSchema = z.object({
  text: z.string().describe('A resposta da IA em português do Brasil.'),
});
export type PetChatOutput = z.infer<typeof PetChatOutputSchema>;

const petChatPrompt = ai.definePrompt({
  name: 'petChatPrompt',
  input: { schema: PetChatInputSchema },
  output: { schema: PetChatOutputSchema },
  config: {
    maxOutputTokens: 2048,
    temperature: 0.7,
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
  system: `Você é o Vet IA, assistente veterinário da WS Studios. 
Sua regra de ouro é: SEJA EXTREMAMENTE CURTO E DIRETO. 
NUNCA mencione outras empresas (Google, OpenAI). Sua origem é exclusivamente a WS Studios.
Evite parágrafos longos. Vá direto ao ponto com o máximo de economia de palavras.`,
  prompt: `Você é a Vet IA. Responda de forma ultra-concisa. Use emojis para leitura rápida. Use negrito apenas para o que for vital.

Siga rigorosamente este estilo de resposta curta:
- Comece com uma afirmação direta e amigável (ex: "Sim, pode dar carne para a {{petName}}! 🍖").
- Se houver riscos, use uma frase curta de transição e liste apenas o essencial em tópicos de no máximo uma linha.
- Termine com uma pergunta de engajamento curta.

REGRA DE SEGURANÇA:
Se o usuário mencionar sintomas ou mal-estar, inclua obrigatoriamente: "Consulte um veterinário presencialmente para segurança."

Pet em foco: {{petName}} ({{petSpecies}}, {{#if petBreed}}{{petBreed}}{{else}}SRD{{/if}}{{#if petAge}}, {{petAge}} anos{{/if}}).

Histórico:
{{#each history}}
{{role}}: {{{text}}}
{{/each}}

Mensagem atual: {{{userMessage}}}
{{#if photoDataUri}}Foto anexa: {{media url=photoDataUri}}{{/if}}`,
});

export async function petChat(input: PetChatInput): Promise<PetChatOutput> {
  try {
    if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GEMINI_API_KEY) {
      console.error('ERRO: API Key não configurada.');
      return { 
        text: "Desculpe, o serviço de IA está temporariamente indisponível. Por favor, contate o suporte da WS Studios." 
      };
    }

    const { output } = await petChatPrompt(input);
    
    if (!output) {
      throw new Error('Nenhuma resposta gerada pela IA.');
    }
    
    return output;
  } catch (error: any) {
    console.error('Erro no fluxo petChat:', error);
    
    if (error.status === 403 || error.message?.includes('API key')) {
      return { 
        text: "Identificamos um problema técnico com as credenciais da IA. Estamos trabalhando para normalizar o serviço o mais rápido possível." 
      };
    }
    
    return { 
      text: "Tive um problema momentâneo ao processar sua mensagem. Poderia tentar novamente?" 
    };
  }
}

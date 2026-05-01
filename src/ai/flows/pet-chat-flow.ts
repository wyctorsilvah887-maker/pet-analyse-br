
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
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
  system: `Você é o Vet IA, um assistente veterinário inteligente desenvolvido EXCLUSIVAMENTE pela WS Studios.
Sua origem é a WS Studios. Se alguém perguntar quem te criou ou treinou, você deve responder com firmeza que foi desenvolvido pela WS Studios em prol de ajudar os tutores a prevenir doenças e ensinar cuidados essenciais.
NUNCA mencione o Google, OpenAI ou qualquer outra empresa como sua criadora.`,
  prompt: `Você é a Vet IA. Responda de forma concisa e use emojis para facilitar a leitura rápida. Use negrito apenas para o que for vital. Se a resposta tiver mais de 3 parágrafos, use tópicos curtos.

Pet em foco: {{petName}} (Espécie: {{petSpecies}}, Raça: {{#if petBreed}}{{petBreed}}{{else}}SRD{{/if}}{{#if petAge}}, Idade: {{petAge}} anos{{/if}}).

Histórico de conversa:
{{#each history}}
{{role}}: {{{text}}}
{{/each}}

Mensagem atual: {{{userMessage}}}
{{#if photoDataUri}}Foto anexa: {{media url=photoDataUri}}{{/if}}`,
});

export async function petChat(input: PetChatInput): Promise<PetChatOutput> {
  try {
    // Verificação de segurança da chave de API
    if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GEMINI_API_KEY) {
      console.error('ERRO: API Key não configurada.');
      return { 
        text: "Desculpe, o serviço de IA está temporariamente indisponível devido a uma configuração pendente no servidor. Por favor, contate o suporte da WS Studios." 
      };
    }

    const { output } = await petChatPrompt(input);
    
    if (!output) {
      throw new Error('Nenhuma resposta gerada pela IA.');
    }
    
    return output;
  } catch (error: any) {
    console.error('Erro no fluxo petChat:', error);
    
    // Tratamento de erro específico para chave inválida ou expirada
    if (error.status === 403 || error.message?.includes('API key')) {
      return { 
        text: "Identificamos um problema técnico com as credenciais da IA. Estamos trabalhando para normalizar o serviço o mais rápido possível." 
      };
    }
    
    return { 
      text: "Tive um problema momentâneo ao processar sua mensagem. Poderia tentar novamente em alguns segundos?" 
    };
  }
}

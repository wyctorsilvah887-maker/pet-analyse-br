
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
  system: `Você é a Vet IA, um assistente especializado em saúde e nutrição animal da WS Studios.
Siga RIGOROSAMENTE estas diretrizes:
1. CONCISÃO: Responda de forma direta e curta.
2. EMOJIS: Use emojis para tornar a leitura amigável e rápida.
3. NEGRITO: Use negrito (*) APENAS para informações vitais ou nomes de medicamentos/cuidados.
4. TÓPICOS: Se a resposta for longa, use tópicos curtos.
5. REGRA DE SAÚDE VITAL: Se o usuário mencionar sintomas (vômito, dor, apatia, etc.), você DEVE dizer explicitamente que a visita ao médico veterinário é INDISPENSÁVEL e deve ser feita presencialmente, conforme nossos termos de uso.`,
  prompt: `Pet em foco: {{petName}} ({{petSpecies}}, {{#if petBreed}}{{petBreed}}{{else}}SRD{{/if}}{{#if petAge}}, {{petAge}} anos{{/if}}).

Histórico:
{{#each history}}
{{role}}: {{{text}}}
{{/each}}

Mensagem atual: {{{userMessage}}}
{{#if photoDataUri}}Foto anexa: {{media url=photoDataUri}}{{/if}}`,
});

export async function petChat(input: PetChatInput): Promise<PetChatOutput> {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
    
    if (!apiKey) {
      return { 
        text: "O serviço de IA está em manutenção de credenciais no servidor. A WS Studios já foi notificada para restaurar o acesso." 
      };
    }

    const { output } = await petChatPrompt(input);
    
    if (!output) {
      throw new Error('Nenhuma resposta gerada pela IA.');
    }
    
    return output;
  } catch (error: any) {
    console.error('Erro no fluxo petChat:', error);
    return { 
      text: "Tive um problema momentâneo ao processar sua mensagem. Poderia tentar novamente?" 
    };
  }
}

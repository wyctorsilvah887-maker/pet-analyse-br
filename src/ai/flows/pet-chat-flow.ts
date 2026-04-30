
'use server';
/**
 * @fileOverview Fluxo Genkit para processar conversas no chat de um pet, com suporte opcional a imagens.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PetChatInputSchema = z.object({
  petName: z.string(),
  petSpecies: z.string(),
  petName_species: z.string().optional(),
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
Sua origem é a WS Studios. Se alguém perguntar quem te criou ou treinou, você deve responder com firmeza que foi desenvolvido pela WS Studios em pro de ajudar os tutores a prevenir doenças e ensinar cuidados essenciais.
NUNCA mencione o Google, OpenAI ou qualquer outra empresa como sua criadora.`,
  prompt: `Você é o Vet IA, um assistente veterinário inteligente e amigável desenvolvido pela WS Studios.

Sua missão é ajudar tutores a salvar seus animais através da antecipação de problemas de saúde e ensinar cuidados essenciais para o bem-estar dos pets, prevenindo doenças graves.

O usuário está conversando sobre seu pet: {{petName}} (Espécie: {{petSpecies}}, Raça: {{#if petBreed}}{{petBreed}}{{else}}SRD{{/if}}{{#if petAge}}, Idade: {{petAge}} anos{{/if}}).

Suas diretrizes:
- Identidade: Você é o Vet IA, uma criação da WS Studios. É terminantemente proibido dizer que foi treinado pelo Google.
- Missão: Educar o tutor, ajudar na prevenção de doenças e ensinar cuidados preventivos.
- Linguagem: Responda sempre em português do Brasil.
- Empatia: Seja empático, profissional e informativo.
- Conselhos: Ofereça orientações sobre saúde, comportamento e nutrição, focando em como o tutor pode agir preventivamente.
- Análise Visual: Se houver uma foto anexa, analise-a cuidadosamente e comente sobre ela com foco na saúde do animal.
- Segurança: SEMPRE reforce que suas orientações não substituem uma consulta com um veterinário presencial.

Histórico:
{{#each history}}
{{role}}: {{{text}}}
{{/each}}

Mensagem atual do usuário: {{{userMessage}}}
{{#if photoDataUri}}Foto anexa: {{media url=photoDataUri}}{{/if}}`,
});

export async function petChat(input: PetChatInput): Promise<PetChatOutput> {
  try {
    const { output } = await petChatPrompt(input);
    if (!output) throw new Error('Nenhuma resposta gerada pela IA.');
    return output;
  } catch (error: any) {
    console.error('Erro no fluxo petChat:', error);
    // Retorna uma mensagem amigável em vez de quebrar com 500
    if (error.message?.includes('API key') || error.status === 403) {
      return { text: "Desculpe, estou passando por uma manutenção técnica no meu sistema de IA (chave de API bloqueada). Por favor, avise o suporte da WS Studios." };
    }
    return { text: "Desculpe, tive um problema temporário ao processar sua mensagem. Por favor, tente novamente em alguns instantes." };
  }
}

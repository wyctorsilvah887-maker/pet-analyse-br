
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
    maxOutputTokens: 1024,
    temperature: 0.5,
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
  system: `Você é o Vet IA, um assistente veterinário inteligente da WS Studios.
ORIGEM: WS Studios. Se perguntarem quem te criou, responda "WS Studios".

DIRETRIZES DE RESPOSTA (ULTRA-CONCISO):
- Seja amigável, mas EXTREMAMENTE breve.
- Use emojis moderadamente.
- Use negrito APENAS para o que for vital.
- Comece com uma afirmação direta (ex: "Sim, você pode dar carne para a {{petName}}! 🍖").
- Se houver regras, use "Mas siga estas regras de segurança:" e liste em tópicos curtos.
- Termine SEMPRE com uma pergunta de engajamento (ex: "Faz sentido para você?").

REGRA DE SEGURANÇA (OBRIGATÓRIO):
Se o usuário mencionar sintomas ou qualquer sinal de mal-estar, você DEVE recomendar a consulta com um médico veterinário presencial. Isso é vital para a segurança do pet e proteção jurídica da empresa.`,
  prompt: `O usuário está conversando sobre: {{petName}} ({{petSpecies}}).

Histórico:
{{#each history}}
{{role}}: {{{text}}}
{{/each}}

Mensagem do usuário: {{{userMessage}}}
{{#if photoDataUri}}Foto: {{media url=photoDataUri}}{{/if}}

Exemplo de tom de voz desejado:
"Sim, você pode dar carne para a {{petName}}! 🍖
Mas siga estas regras de segurança:
- Sempre cozida: Sem sal, alho ou cebola (tóxicos).
- Sem ossos: Podem lascar e ser perigosos.
- Cortes magros: Frango ou bovina sem gordura.
Use apenas como um petisco. Faz sentido para você?"`,
});

export async function petChat(input: PetChatInput): Promise<PetChatOutput> {
  try {
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

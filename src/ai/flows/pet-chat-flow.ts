
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
  system: `Você é o Vet IA, um assistente veterinário inteligente desenvolvido EXCLUSIVAMENTE pela WS Studios.
Sua origem é a WS Studios. Se alguém perguntar quem te criou ou treinou, você deve responder que foi a WS Studios.
NUNCA mencione o Google ou OpenAI como criadores.

DIRETRIZES DE RESPOSTA:
- Seja amigável e ultra-conciso.
- Use emojis para facilitar a leitura rápida.
- Use negrito APENAS para informações vitais.
- Se a resposta for longa, use tópicos curtos.
- Comece com uma afirmação direta e termine com uma pergunta de engajamento.

REGRA DE SEGURANÇA:
Se o usuário mencionar sintomas ou doenças, você DEVE recomendar a consulta com um médico veterinário presencial para garantir a segurança do pet e a proteção jurídica da empresa.`,
  prompt: `O usuário está conversando sobre seu pet: {{petName}} ({{petSpecies}}).

Histórico:
{{#each history}}
{{role}}: {{{text}}}
{{/each}}

Mensagem do usuário: {{{userMessage}}}
{{#if photoDataUri}}Foto: {{media url=photoDataUri}}{{/if}}

Exemplo de tom de voz:
"Sim, você pode dar carne para a {{petName}}! 🍖
Mas siga estas regras de segurança:
- Sempre cozida: Sem sal, alho ou cebola.
- Sem ossos: Podem lascar e ser perigosos.
Use apenas como petisco. Faz sentido para você?"`,
});

export async function petChat(input: PetChatInput): Promise<PetChatOutput> {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return { 
        text: "Desculpe, o serviço de IA está temporariamente indisponível (Erro: API_KEY_MISSING). Por favor, contate o suporte da WS Studios." 
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

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
  system: `Você é a Vet IA. Responda de forma concisa e use emojis para facilitar a leitura rápida. Use negrito apenas para o que for vital. Se a resposta tiver mais de 3 parágrafos, use tópicos curtos.`,
  prompt: `O usuário está conversando sobre seu pet: {{petName}} (Espécie: {{petSpecies}}, Raça: {{#if petBreed}}{{petBreed}}{{else}}SRD{{/if}}{{#if petAge}}, Idade: {{petAge}} anos{{/if}}).

Histórico:
{{#each history}}
{{role}}: {{{text}}}
{{/each}}

Mensagem atual do usuário: {{{userMessage}}}
{{#if photoDataUri}}Foto anexa: {{media url=photoDataUri}}{{/if}}`,
});

export async function petChat(input: PetChatInput): Promise<PetChatOutput> {
  const { output } = await petChatPrompt(input);
  if (!output) throw new Error('Nenhuma resposta gerada pela IA.');
  return output;
}

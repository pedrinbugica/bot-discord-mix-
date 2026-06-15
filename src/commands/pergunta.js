import { SlashCommandBuilder } from 'discord.js';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Você é um assistente especialista em Counter-Strike 2 (CS2) integrado a um bot de Discord para organizar partidas mix (5v5 entre jogadores da comunidade).

Seu papel é ajudar os jogadores com:
- Dicas de gameplay: miras, posicionamento, economia, granadas, rotações
- Informações sobre mapas, armas e mecânicas do jogo
- Como usar os comandos do bot (ex: /mix para entrar na fila, /win para registrar vitória, /historico para ver partidas)
- Dúvidas gerais sobre CS2

Responda sempre em português, de forma direta e amigável. Se a pergunta não for sobre CS2 ou sobre o bot, redirecione educadamente para esses tópicos.`;

export const data = new SlashCommandBuilder()
  .setName('pergunta')
  .setDescription('Pergunta para a IA especialista em CS2.')
  .addStringOption((opt) =>
    opt.setName('texto').setDescription('Sua pergunta').setRequired(true)
  );

export async function execute(interaction) {
  const pergunta = interaction.options.getString('texto');

  await interaction.deferReply();

  const resposta = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: pergunta },
    ],
    max_tokens: 1000,
  });

  const texto = resposta.choices[0].message.content.trim();

  // Discord tem limite de 2000 caracteres por mensagem
  if (texto.length <= 2000) {
    await interaction.editReply(texto);
  } else {
    await interaction.editReply(texto.slice(0, 1997) + '…');
  }
}

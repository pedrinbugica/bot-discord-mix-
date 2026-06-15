# Bot Discord Mix — CS2

Bot de Discord para organizar **mix de CS2** com fila, sorteio de times, votação de capitães, veto de mapas BO3, registro de resultados e **assistente de IA integrado**.

---

## Funcionalidades

### Mix (5v5)
- **/mix panel** — publica painel com botões **Entrar / Sair** para a fila
- Quando a fila enche:
  - Sorteia **Time A** e **Time B**
  - Abre **votação de capitão** por time
  - Inicia **veto de mapas BO3** (ban → pick → ban → ban → decider)
  - Move jogadores para os canais de voz dos times (se configurado)
- **/mix reset** — limpa fila e remove painel antigo (staff/admin)
- Limpeza automática de mensagens temporárias após delay configurável

### Resultados e Histórico
- **/win** — capitães registram o resultado do BO3 (placar de mapas)
- **/historico** — lista partidas anteriores com paginação, filtrável por jogador

### Inteligência Artificial
- **/pergunta** — assistente de IA especialista em CS2 e no próprio bot

O comando `/pergunta` usa a **API da OpenAI (modelo `gpt-4o-mini`)** para responder dúvidas dos jogadores em tempo real no Discord. O assistente é configurado com um *system prompt* focado em:
- Dicas de gameplay (mira, economia, granadas, posicionamento)
- Informações sobre mapas, armas e mecânicas do CS2
- Como usar os comandos do bot

### Configuração
- **/configurar** — define os canais de voz dos times por servidor

---

## Tecnologias

- **Node.js 18+** com ES Modules
- **Discord.js v14** — interação com a API do Discord (slash commands, botões, embeds)
- **OpenAI API** (`gpt-4o-mini`) — respostas de IA via chat completions
- **dotenv** — gerenciamento seguro de variáveis de ambiente

---

## Como configurar

### 1. Clone o repositório

```bash
git clone https://github.com/pedrinbugica/bot-discord-mix-.git
cd bot-discord-mix-
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo de exemplo e preencha com seus valores:

```bash
cp .env.example .env
```

Edite o `.env` com:

| Variável | Descrição |
|---|---|
| `DISCORD_TOKEN` | Token do bot (Discord Developer Portal → Bot) |
| `DISCORD_CLIENT_ID` | ID da aplicação (Discord Developer Portal → General) |
| `DISCORD_GUILD_ID` | ID do servidor para testes (deixe vazio para registro global) |
| `OPENAI_API_KEY` | Chave da API da OpenAI (platform.openai.com/api-keys) |

> As demais variáveis do `.env.example` são opcionais e controlam comportamentos do mix.

### 4. Registre os slash commands

```bash
npm run deploy
```

### 5. Inicie o bot

```bash
npm start
```

---

## Requisitos do bot no Discord

- Permissões: Enviar mensagens, Ler histórico, Inserir links (embeds), Gerenciar mensagens
- Para mover jogadores de voz: Ver canais, Conectar, Mover membros (nos canais dos times)
- Intents necessários: `Guilds`, `GuildVoiceStates`

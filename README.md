<div align="center">

# Bot Discord Mix — CS2

**Bot de Discord para organizar partidas 5v5 de CS2 com fila inteligente, veto de mapas BO3 e assistente de IA integrado.**

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991?style=for-the-badge&logo=openai&logoColor=white)

</div>

---

## Sobre o projeto

Este bot foi criado para comunidades de CS2 que organizam partidas **mix 5v5** — onde jogadores entram numa fila e o bot cuida de tudo: sorteia os times, elege capitães por votação, conduz o veto de mapas em formato BO3 e move os jogadores para os canais de voz certos.

O diferencial é o comando **/pergunta**, que integra a **API da OpenAI (gpt-4o-mini)** diretamente no Discord. Os jogadores podem tirar dúvidas sobre o bot ou sobre o próprio jogo sem sair do chat — o assistente responde em português, com contexto específico de CS2 e dos comandos disponíveis.

<!-- adicionar screenshot -->

---

## Funcionalidades

| Comando | Descrição |
|---|---|
| `/mix panel` | Publica o painel com botões **Entrar / Sair** da fila |
| `/mix reset` | Limpa a fila e remove o painel antigo (staff/admin) |
| `/win` | Capitão registra o resultado do BO3 com placar de mapas |
| `/historico` | Exibe histórico de partidas com paginação, filtrável por jogador |
| `/pergunta` | Faz uma pergunta à IA especialista em CS2 e nos comandos do bot |
| `/configurar` | Define os canais de voz dos times por servidor |

### Fluxo completo de uma partida

1. Staff publica o painel com `/mix panel`
2. Jogadores clicam em **Entrar** até a fila encher (padrão: 10 jogadores)
3. O bot sorteia **Time A** e **Time B** automaticamente
4. Abre **votação de capitão** por time (timeout configurável)
5. Capitões conduzem o **veto de mapas BO3** (ban → pick → ban → ban → decider)
6. Jogadores são movidos para os canais de voz dos respectivos times
7. Ao terminar, um dos capitães registra o resultado com `/win`

---

## Tecnologias

- **[Node.js](https://nodejs.org/) 18+** com ES Modules
- **[Discord.js v14](https://discord.js.org/)** — slash commands, botões, embeds e interações em tempo real
- **[OpenAI API](https://platform.openai.com/)** (`gpt-4o-mini`) — respostas de IA via chat completions
- **[dotenv](https://github.com/motdotla/dotenv)** — gerenciamento seguro de variáveis de ambiente

---

## Como rodar localmente

### Pré-requisitos

- Node.js 18 ou superior
- Conta no [Discord Developer Portal](https://discord.com/developers/applications) com um bot criado
- Chave da [OpenAI API](https://platform.openai.com/api-keys)

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

```bash
cp .env.example .env
```

Preencha o `.env` com seus valores (veja a seção abaixo).

### 4. Registre os slash commands no Discord

```bash
npm run deploy
```

### 5. Inicie o bot

```bash
npm start
```

---

## Variáveis de ambiente

Copie o `.env.example` e preencha conforme necessário:

```env
# OpenAI (obrigatório para o comando /pergunta)
OPENAI_API_KEY=

# Discord (obrigatório)
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=

# Mix: staff — quem pode usar /mix reset sem ser admin (ID do cargo). Opcional.
MIX_ADMIN_ROLE_ID=

# Visual do painel (opcional)
MIX_EMBED_COLOR=5865f2
MIX_EMBED_THUMB_URL=

# Aviso quando a fila enche (opcional)
MIX_PING_ROLE_ID=
MIX_PING_HERE=

# Tamanho da fila (padrão 10; use 2 para testes)
MIX_QUEUE_MAX=10

# Delay antes de mover para voz (ms)
MIX_QUEUE_FULL_DELAY_MS=3000

# Delay para apagar mensagens temporárias após o veto (ms)
MIX_CLEANUP_DELAY_MS=30000

# Canais de voz dos times (opcional — necessário para mover jogadores)
MIX_VOICE_LOBBY_ID=
MIX_VOICE_TEAM_A_ID=
MIX_VOICE_TEAM_B_ID=
MIX_SPLIT_MODE=shuffle
```

> **Dica:** As únicas variáveis obrigatórias são `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` e `OPENAI_API_KEY`. As demais são opcionais e ativam funcionalidades extras.

---

## Permissões necessárias no Discord

- **Bot:** Enviar mensagens, Ler histórico de mensagens, Inserir links (embeds), Gerenciar mensagens
- **Para mover de voz:** Ver canais, Conectar, Mover membros (nos canais dos times)
- **Intents:** `Guilds`, `GuildVoiceStates`

---

<div align="center">
  <sub>Feito com Node.js, Discord.js e OpenAI API</sub>
</div>

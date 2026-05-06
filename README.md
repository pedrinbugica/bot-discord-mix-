# Bot Discord Mix (CS2) — beta v1.0.1

Bot de Discord para organizar **mix de CS2** com fila, sorteio de times, votação de capitães, veto de mapas BO3 e registro de resultados/Histórico.

## O que esse bot faz
- **/mix panel**: publica um painel com botões **Entrar / Sair** para a fila do mix.
- Quando a fila enche:
  - sorteia **Time A** e **Time B**
  - abre **votação de capitão** para cada time (só quem está no time vota)
  - depois inicia **veto de mapas BO3** (A ban → B ban → A pick → B pick → A ban → B ban → sobra 1 decider)
  - move os jogadores para os canais de voz dos times (se configurado)
- **Limpeza automática do chat**: mensagens temporárias do fluxo (times, votação, veto, etc.) são apagadas depois de um delay configurável.
- **/win**: capitães registram o resultado do BO3 (placar de mapas).
- **/historico**: lista partidas anteriores (com paginação).

## Comandos
- `/mix panel` — cria o painel da fila
- `/mix reset` — limpa fila e remove painel antigo (staff/admin)
- `/win time:<A|B> mapas_a:<0..2> mapas_b:<0..2>` — registra o vencedor (só capitães)
  - Exemplo: `time:B mapas_a:2 mapas_b:0` (o bot ajusta automaticamente pro lado do vencedor)
  - A mensagem do resultado some após **10s**
- `/historico [jogador:@user]` — mostra histórico do servidor ou filtrado por jogador

## Requisitos
- Node.js **18+**
- Bot no servidor com permissões:
  - Enviar mensagens, Ler histórico, Inserir links (embeds)
  - Para limpar mensagens: **Manage Messages** (recomendado)
  - Para mover voz: Ver canais, Conectar, Mover membros (nos canais de voz dos times).

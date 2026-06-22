# Expor o jogo com Cloudflare Tunnel

O `cloudflared` abre uma conexao **outbound-only** da sua maquina ate a borda da
Cloudflare — sem abrir portas no roteador, sem IP publico, com WSS e protecao DDoS.

## Modo gerenciado (recomendado)
1. No dashboard **Zero Trust → Networks → Tunnels → Create a tunnel**.
2. Rode o `cloudflared` com o token que o dashboard fornece.
3. Em **Public Hostname**, aponte `jogos.seudominio.com` → `http://localhost:3000`.

## Modo local (alternativo)
Use o `config.example.yml` deste diretorio (copie para `config.yml` e ajuste o UUID/hostname).

## Frontend
Conecte sempre via `wss://` em producao — o socket.io faz isso automaticamente
quando a pagina e servida por HTTPS.

## Camada extra opcional (Cloudflare Access)
Se quiser exigir login (Google/OTP) **antes** de chegar ao app, aplique uma policy
de Access ao hostname. Para um jogo casual com login por sala costuma ser
desnecessario e atrapalha amigos sem conta.

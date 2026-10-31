# Status do PetLive

Página pública que mostra se o PetLive está funcionando: app e banco, login,
fotos e arquivos, pagamentos por Pix, funções do servidor e o site.

É separada do site (`apps/web`) de propósito: fica de pé mesmo quando o site
ou o servidor caem. São só arquivos estáticos, sem build.

| Arquivo | O que é |
|---|---|
| `index.html` | A página (estilos junto) |
| `status.js` | Consulta a cada 60 s e desenha |
| `config.js` | Endereços: função `status` e site |
| `logo.png` | Logo |

## Como funciona

- A página chama a função pública `status` (`supabase/functions/status`), que
  confere cada parte e responde operante, lenta ou fora, com o tempo de resposta.
- Se a própria função não responde, a página mostra **fora do ar**.
- O site é conferido direto do navegador.
- A **manutenção planejada** é ligada pela equipe com `admin_manutencao(true, 'mensagem', previsão)`
  (papel super). Aparece aqui e no app, que mostra a tela de manutenção.
- As últimas 30 verificações ficam só no navegador de quem abre a página.

## Publicar

Qualquer hospedagem estática serve, de preferência **fora** do servidor do site
(para continuar no ar se ele cair): Cloudflare Pages, Netlify, GitHub Pages ou
um subdomínio no nginx da VPS, como `status.petlive.app`.

1. Ajuste `config.js` com os endereços de produção.
2. Publique a pasta inteira.
3. No app, defina `EXPO_PUBLIC_STATUS_URL` com o endereço da página: o botão
   "Ver o status do PetLive" da tela de manutenção abre ela.

Para ver localmente: `python -m http.server 3040 --directory apps/status`.

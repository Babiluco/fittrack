# FitTrack — Guia de Responsividade

Este documento registra a estratégia mobile-first do app: o que já existia, o que foi corrigido nesta auditoria, e a referência pra manter consistência daqui pra frente.

## Estratégia geral

O app já nasceu mobile-first (menu inferior + navegação por abas, cards empilhados verticalmente por padrão). Esta auditoria não mudou essa base — focou em **encontrar e corrigir os pontos que realmente quebravam ou ficavam apertados** em telas pequenas, sem alterar a experiência de desktop.

## Breakpoints

O CSS usa 3 pontos de corte reais, que mapeiam bem pra escala de referência do mercado:

| Breakpoint do app | Equivale a | O que muda |
|---|---|---|
| `max-width: 880px` | Tablet/Laptop → Mobile | Esconde a barra lateral, mostra o menu inferior |
| `max-width: 720px` | Tablet → Mobile | Modal sobe do rodapé em vez de centralizar; grade da semana vai de 7 pra 4 colunas |
| `max-width: 400px` | Celulares pequenos (320–400px) | Ajustes finos de espaçamento |

Não criei breakpoints novos pra 320/360/375/390/414/430px individualmente — nenhum desses tamanhos precisa de regra própria, porque o layout já usa `fr` (grid) e `flex` em vez de larguras fixas na maioria dos componentes, então eles se ajustam continuamente entre os 3 pontos de corte acima, sem quebrar em nenhum tamanho intermediário.

## Problemas encontrados e corrigidos

| # | Problema | Onde quebrava | Correção |
|---|---|---|---|
| 1 | **Overflow horizontal real** — o aviso (toast) no canto superior tinha `right:16px` + `max-width:320px` fixo. Numa tela de 320px, isso pede 336px de espaço — 16px a mais do que existe. | Qualquer tela ≤336px (iPhone SE e simila­res) | Trocado por `left:16px; right:16px` com `max-width` como teto, não valor fixo — agora se ajusta ao espaço real disponível |
| 2 | Botões de ícone (fechar, notificação, tema) em 40px | Todo o app | Aumentado pra 48×48px — o mínimo pedido, e o mesmo tamanho que os outros controles críticos (marcar série) já usavam |
| 3 | Botão de pular série no treino em 44px | Tela de treino ativo | Aumentado pra 48×48px |
| 4 | Botão de remover exercício (editor) em 32px | Editar Treinos | Aumentado pra 48×48px |

## O que já estava correto (verifiquei, não precisou mexer)

- **Gráficos**: já usam `viewBox` + `width="100%"` no SVG — se redimensionam sozinhos, sem cortar rótulo nem estourar largura, em qualquer tela.
- **Grades responsivas** (`.week-grid`, `.cal-grid`, `.photo-grid`, `.grid-2/3/4`): todas usam `fr` ou `repeat()`, nunca largura fixa — não têm como estourar horizontalmente.
- **Formulários**: campos lado a lado (`.field-row`) já usam `minmax(0,1fr)`, o que evita o clássico bug de input forçando overflow do container.
- **Botão principal do treino ativo**: já fica fixo no rodapé da tela (zona do polegar), não precisa rolar até ele.
- **Áreas seguras (notch/status bar)**: já tratadas via `env(safe-area-inset-top/bottom)` no cabeçalho principal e no treino ativo.

## Tabelas

O app não tem nenhuma tabela HTML tradicional (`<table>`) — listas de dados (histórico, medidas, exercícios) já são construídas como cards empilhados, que naturalmente não têm o problema de overflow horizontal que tabelas têm. Onde existe conteúdo naturalmente mais largo que a tela (o heatmap de constância), já está dentro de um contêiner com `overflow-x:auto`.

## Componentes reutilizáveis já responsivos

- `.card`, `.stat-card`, `.list-row` — sem largura fixa, sempre 100% do container
- `.chip-row` — `flex-wrap:wrap`, nunca força scroll horizontal
- `.grid-2/3/4` — todas colapsam pra 2 colunas em telas ≤880px automaticamente

## Recomendações futuras

- Se o app ganhar imagens carregadas de fora (hoje só há as fotos de progresso, já comprimidas e em base64), vale considerar `srcset` para diferentes densidades de tela.
- Se novas telas adicionarem tabelas de dados de verdade no futuro, seguir o padrão já usado aqui: card empilhado no mobile, nunca `<table>` com scroll horizontal forçado.

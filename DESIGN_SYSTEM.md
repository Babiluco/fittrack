# FitTrack — Design System

Este documento descreve a linguagem visual que já existe no app — não é uma proposta de redesign, é o registro do que está implementado em `css/style.css`, pra manter consistência daqui pra frente.

## Cores

Todas em variáveis CSS (`:root`), com uma variante clara em `body.light`.

| Token | Valor (escuro) | Uso |
|---|---|---|
| `--bg` | `#0A0A0E` | Fundo da página |
| `--bg-elevated` | `#141419` | Sidebar, cabeçalhos de modal |
| `--bg-card` | `#1A1A21` | Cards, inputs |
| `--bg-card-hover` | `#212129` | Hover de cards/botões ghost |
| `--border` | `#2B2B35` | Bordas padrão |
| `--text` / `--text-dim` / `--text-faint` | `#F7F7FC` / `#9A9AAC` / `#848499` | Hierarquia de texto (título / corpo secundário / legenda) |
| `--blue` | `#3355FF` | Cor primária da marca |
| `--purple` | `#A66FFC` | Cor secundária (gradiente, destaques) |
| `--accent-text` | `#5C79FF` | Azul mais claro — **só** pra texto pequeno sobre fundo escuro (o `--blue` puro não passa no contraste mínimo como texto) |
| `--green` / `--red` | `#22C55E` / `#EF4444` | Sucesso / erro (nunca é o único indicador — sempre acompanhado de ícone ou texto) |

**Regra**: `--blue` é usado como fundo/borda à vontade, mas como cor de *texto* só via `--accent-text`.

## Tipografia

Fonte única: **Poppins** (títulos e corpo, pesos 400–800).

O tamanho de fonte no app varia bastante (11px a 26px) porque cresceu organicamente ao longo do projeto. Pra manter consistência a partir de agora, esta é a escala de referência — todo texto novo deve se encaixar num desses valores, não inventar um novo:

| Papel | Tamanho | Peso |
|---|---|---|
| Título de tela (`h1`) | 24–28px | 800 |
| Título de card/seção | 14.5–16px | 700 |
| Corpo | 13–14px | 400–600 |
| Legenda / metadado | 11–12.5px | 500–700 |
| Número em destaque (`stat-value`) | 18–26px | 800, `font-display` |

## Espaçamento

Sem um token formal de espaçamento ainda (é a maior dívida técnica visual do projeto) — os valores mais usados na prática são `6px, 8px, 10px, 12px, 14px, 16px, 18px, 20px, 24px`. Escala recomendada pra novo código, dos menores aos maiores:

```
--space-1: 4px    (gap entre ícone e texto muito próximos)
--space-2: 8px    (padding interno pequeno)
--space-3: 12px   (gap padrão entre itens de uma lista)
--space-4: 16px   (padding interno padrão de card)
--space-5: 20px   (respiro entre seções)
--space-6: 24px   (padding de cards de destaque / hero)
```
Esses tokens **ainda não existem no CSS** — essa auditoria não trocou os valores existentes (risco alto, ganho baixo), só deixou a régua documentada pra quem for escrever CSS novo.

## Cantos e sombra

```
--radius-sm: 10px   → inputs, chips pequenos
--radius:    16px   → cards padrão
--radius-lg: 24px   → hero cards, modais
--radius-pill: 999px → chips, botões pill, badges
```
Sombra: `--shadow-sm` (repouso) → `--shadow` (elevado/hover) → `--shadow-lg` (modal, elemento arrastando).

## Botões

| Classe | Uso | Feedback |
|---|---|---|
| `.btn-primary` | Ação principal da tela (uma por tela, geralmente) | hover escurece leve, `:active` encolhe 3% |
| `.btn-ghost` | Ação secundária | hover clareia o fundo, `:active` encolhe 3% *(corrigido nesta auditoria — antes não tinha feedback de toque)* |
| `.btn-danger` | Ação destrutiva (excluir) | hover clareia, `:active` encolhe *(corrigido nesta auditoria — antes não tinha hover nem active)* |
| `.btn-success` | Confirmação positiva (concluir treino) | mesma família visual do primary |
| `.btn-sm` / `.btn-block` | Modificadores de tamanho, combináveis com qualquer variante acima | — |

**Regra de hierarquia**: nunca mais de um `btn-primary` visível ao mesmo tempo na mesma tela/modal.

## Cards

`.card` é o bloco base (fundo `--bg-card`, borda `--border`, raio `--radius`). Variantes:
- `.card.interactive` — quando o card inteiro é clicável (soma `cursor:pointer` + leve elevação no hover)
- `.hero-card` — card de destaque com gradiente sutil e brilho decorativo (só a Home usa)
- `.stat-card` — par label/valor centralizado

## Inputs e formulários

- Todo campo é `.field` (label + input, `gap:6px`).
- Campos lado a lado usam `.field-row` (grid de 2 colunas que colapsa em uma no mobile).
- **Estado de erro** (`.field.invalid`) — borda vermelha + `.field-error` com a mensagem abaixo do campo. *Novo nesta auditoria*: antes, todo erro de formulário só aparecia como toast, sem indicar qual campo estava errado. Aplicado aos formulários de peso rápido e meta corporal; recomendado pra qualquer formulário novo.

## Modais

`.overlay` (fundo escurecido) + `.modal` (o card branco/escuro que sobe de baixo). Sempre tem `.modal-close` no canto superior direito — círculo de 34px, com hover/active *(corrigido nesta auditoria — antes não tinha nenhum feedback)*. Conteúdo interno é livre (não há um grid fixo), mas por convenção sempre começa com `<h2>` + um parágrafo de contexto opcional.

## Ícones

Duas famílias coexistem **de propósito**, não por inconsistência:
- **SVG de linha** (`js/icons.js`, função `icon()`) — navegação principal e qualquer botão só-de-ícone (fechar, notificação, lixeira, tema). Herdam `currentColor`, funcionam em claro/escuro sem duplicar código.
- **Emoji** — grupos musculares, conquistas, humor, celebração. Decisão tomada cedo no projeto: criar ícones de linha genéricos pra "glúteo" ou "costas" sem referência visual real arriscava ficar pior que o emoji.

Nunca misturar as duas famílias pro **mesmo tipo de elemento** (ex.: não usar emoji num botão de fechar, não usar SVG num badge de conquista).

## Estados

| Estado | Padrão |
|---|---|
| Vazio | `.empty-state` — emoji + frase curta, opcionalmente um botão de ação |
| Sucesso | `showToast()` (canto superior, 3 variantes de ícone) + confete (`launchConfetti()`) só em momentos de celebração real (fim de treino, subir de nível) |
| Erro | Toast + (desde esta auditoria) destaque visual no campo específico quando é erro de formulário |
| Carregamento | Só existem dois: a tela de abertura do app (spinner full-screen) e o processamento de foto (spinner no próprio tile) — o resto do app é local/síncrono, então não há mais nada assíncrono que precise de indicador |

## Acessibilidade (já implementada)

- Todo elemento interativo (incluindo `<div>`s que viram clicáveis) tem `:focus-visible` com anel de contorno, só aparece em navegação por teclado
- Alvo mínimo de toque: 44×44px em ações de treino/toque frequente; 40px (`.icon-btn` padrão) no resto
- Cor nunca é o único indicador de status — sempre acompanhada de ícone, texto ou padrão

## Animação e movimento

Toda transição usa a mesma curva (`--ease: cubic-bezier(.22,1,.36,1)`), pra manter o "peso" do movimento consistente. Padrão:
- Hover: muda cor/fundo, ~0.2s
- Toque (`:active`): `transform:scale(.92–.97)`, ~0.15s — presente em **todo** elemento clicável desde esta auditoria
- Entrada de tela cheia (runner, overlay de descanso): `translateY`, 0.3–0.4s 

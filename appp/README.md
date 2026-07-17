# FitForAll — Treinos Personalizados

App pessoal de acompanhamento de treinos: organize sua semana de treino, acompanhe progresso, defina metas e use o cronômetro de descanso durante os exercícios.

## 🚀 Como colocar no ar (GitHub Pages)

1. Suba todo o conteúdo desta pasta para um repositório novo no GitHub, mantendo a estrutura de arquivos como está (não mude os nomes das pastas `css/` e `js/`).
2. No repositório, vá em **Settings → Pages**.
3. Em **Source**, selecione a branch `main` (ou `master`) e a pasta `/root`.
4. Salve. Em alguns minutos o app estará disponível em:
   `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`
5. No celular, abra esse link e use "Adicionar à tela inicial" no navegador. Como o app agora tem um `manifest.json`, ele abre em tela cheia com ícone próprio, como um app instalado de verdade.

## 🖥️ Como testar localmente

Basta abrir o arquivo `index.html` num navegador (de preferência **Chrome**). Não precisa de servidor nem instalação.

Se preferir um único arquivo (sem pastas), use o `FitForAll.html` — ele já tem tudo embutido. Só o ícone personalizado do PWA não funciona nessa versão (precisa da pasta `icons/` e do `manifest.json` ao lado, que só existem na versão com pastas).

## 📁 Estrutura

```
index.html         → página principal
manifest.json       → configuração do PWA (ícone, nome, tela cheia)
icons/               → ícones do app (192px, 512px, apple-touch-icon)
favicon.ico          → ícone da aba do navegador
css/style.css        → estilos (tema, cores, layout)
js/storage.js        → persistência dos dados (localStorage)
js/data.js           → dados padrão (treinos, exercícios)
js/icons.js          → biblioteca de ícones SVG (navegação e botões)
js/timer.js          → cronômetro de descanso
js/charts.js         → gráficos (barras, linha, anel de progresso)
js/app.js            → lógica principal da aplicação
FitForAll.html        → versão única, tudo embutido (alternativa ao index.html + pastas)
```

## ✨ O que dá pra fazer no app

- Cronograma semanal editável (aba "Editar Treinos")
- Criar exercícios novos e adicionar/remover de qualquer treino
- Duplicar um treino existente como base pra criar um personalizado (renomear/excluir também)
- Registrar peso rapidamente e acompanhar num gráfico (aba "Estatísticas")
- Registrar medidas corporais (braço, cintura, quadril, coxa)

## ⚠️ Sobre os dados

O app salva o progresso no `localStorage` do navegador — ou seja, os dados ficam **no aparelho/navegador em que você usa**, não sincronizam automaticamente entre computador e celular.

## 🎨 Estilo

Paleta escura com gradiente azul → roxo e tipografia Poppins, seguindo o design system e os ícones oficiais do FitForAll.

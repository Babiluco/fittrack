# FitTrack — Treinos e Progresso

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

## 📁 Estrutura

```
index.html         → página principal
manifest.json       → configuração do PWA (ícone, nome, tela cheia)
icons/               → ícones do app (192px, 512px, apple-touch-icon)
favicon.ico          → ícone da aba do navegador
css/style.css        → estilos (tema, cores, layout)
js/config.js         → configuração central (nome, versão, ambiente, debug, chave do storage)
js/utils.js          → funções puras reutilizadas em todo o app (datas, texto, id)
js/storage.js        → persistência dos dados (localStorage)
js/database.js       → camada de acesso a dados (saveWorkout, loadProfile etc.) — hoje usa localStorage por baixo, preparada pra trocar por um backend depois
js/api.js            → cliente de API simulado (mock) — ainda não conecta em lugar nenhum
js/auth.js           → arquitetura de login (login/logout/isLogged) — ainda mock, sem login real
js/sync.js           → sincronização em nuvem (mock) — app continua 100% offline por enquanto
js/data.js           → dados padrão (treinos, exercícios)
js/icons.js          → biblioteca de ícones SVG (navegação e botões)
js/analytics.js      → sistema inteligente de progresso (recordes, tendências, platôs, resumos)
js/calendar.js       → planejador e calendário inteligente (mês, heatmap, remarcação, arrastar treinos)
js/photos.js         → fotos de progresso, medidas expandidas, antes/depois, marcos de transformação
js/photos.js         → fotos de progresso, medidas expandidas, antes/depois, marcos e metas corporais
js/timer.js          → cronômetro de descanso
js/charts.js         → gráficos (barras, linha, anel de progresso)
js/app.js            → lógica principal da aplicação (telas, navegação, interações)
```

## 🏗️ Arquitetura (preparado pra crescer)

O app continua 100% offline, em Vanilla JS — sem framework, sem build step. Mas o `js/` agora tem uma separação clara de responsabilidades, pensando em uma futura migração pra um backend (ex: Supabase):

- **`database.js`** é o único lugar que deveria crescer quando o app ganhar um servidor de verdade — hoje ele já funciona (não é decoração), só que por baixo dos panos ainda salva tudo no `localStorage`.
- **`api.js`**, **`auth.js`** e **`sync.js`** existem como esqueleto: todos os métodos já têm o nome e o formato de resposta que vão ter no futuro, mas nenhum se conecta a nada ainda — são só simulações (`mock:true` na resposta).
- O resto do app (`app.js`) continua funcionando exatamente como antes; a migração pra usar `database.js` em vez de acessar os dados direto pode ser feita aos poucos, tela por tela, sem pressa.

## ✨ O que dá pra fazer no app

- Cronograma semanal editável (aba "Editar Treinos")
- Criar exercícios novos e adicionar/remover de qualquer treino
- Duplicar um treino existente como base pra criar um personalizado (renomear/excluir também)
- Registrar peso rapidamente e acompanhar num gráfico (aba "Estatísticas")
- Registrar medidas corporais (braço, cintura, quadril, coxa)

## ⚠️ Sobre os dados

O app salva o progresso no `localStorage` do navegador — ou seja, os dados ficam **no aparelho/navegador em que você usa**, não sincronizam automaticamente entre computador e celular.

## 🎨 Estilo

Paleta escura com gradiente azul → roxo e tipografia Poppins, seguindo o design system e os ícones oficiais do FitTrack. 

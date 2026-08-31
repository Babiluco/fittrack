# FitTrack — Treinos e Progresso

FitTrack é um aplicativo pessoal de acompanhamento de treinos, progresso corporal, metas, sono e rotina fitness. Ele funciona como PWA, pode ser instalado na tela inicial do celular e mantém os dados salvos localmente, com sincronização parcial via Supabase quando a conta está conectada.

## Como colocar no ar com GitHub Pages

1. Suba todo o conteúdo desta pasta para um repositório no GitHub, mantendo a estrutura atual de arquivos.
2. No repositório, vá em **Settings > Pages**.
3. Em **Source**, selecione a branch `main` e a pasta `/root`.
4. Salve as alterações.
5. Depois da publicação, o app ficará disponível em:

```text
https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/
```

No celular, abra o link pelo navegador e use a opção **Adicionar à Tela de Início**. O app possui `manifest.json`, ícones e `service worker`, então pode abrir em tela cheia como aplicativo instalado.

## Como testar localmente

Abra o arquivo `index.html` diretamente no navegador. Para testar comportamento de PWA, cache e service worker com mais fidelidade, use uma publicação no GitHub Pages ou um servidor local.

## Estrutura do projeto

```text
index.html          Página principal do app
offline.html        Tela exibida quando o app não consegue carregar online
manifest.json       Configuração do PWA
sw.js               Service worker e controle de cache
favicon.ico         Ícone da aba do navegador

css/
  style.css         Estilos, responsividade, temas e layout

icons/
  icon-192.png
  icon-512.png
  apple-touch-icon.png

js/
  config.js         Configurações centrais do app
  utils.js          Funções utilitárias
  storage.js        Estrutura padrão dos dados e persistência local
  database.js       Camada de acesso aos dados locais
  supabase.js       Cliente Supabase
  auth.js           Login, cadastro e sessão
  profile.js        Perfil do usuário no Supabase
  sync.js           Sincronização de treinos e metas
  data.js           Biblioteca de exercícios e treinos padrão
  icons.js          Ícones SVG usados na interface
  analytics.js      Indicadores, progresso, recordes e insights
  calendar.js       Agenda, calendário, remarcação e consistência
  photos.js         Fotos de progresso e evolução corporal
  timer.js          Cronômetro
  charts.js         Gráficos
  app.js            Telas, navegação e interações principais
```

## Funcionalidades principais

- Login e cadastro com Supabase.
- Perfil com dados pessoais, objetivo, altura, peso e preferências.
- Home com resumo de IMC, objetivos do dia, status de atividades, sono e progresso.
- Agenda semanal de treino.
- Calendário mensal com status dos treinos.
- Remarcação de treinos perdidos.
- Editor de treinos.
- Criação de exercícios personalizados.
- Biblioteca de exercícios com descrição, execução, erros comuns e alternativas.
- Execução de treino com séries, descanso e retomada de treino pausado.
- Histórico de treinos.
- Metas com sincronização no Supabase.
- Registro de peso, medidas e fotos de progresso.
- Página de sono com registros manuais.
- Área de smartband/Apple Saúde para cadastrar manualmente dados da Mi Band.
- Exportação e importação de histórico em JSON.
- Modo claro e modo escuro.
- Funcionamento offline básico via PWA.

## Supabase

O app usa Supabase para autenticação e sincronização parcial dos dados.

Tabelas usadas atualmente:

```text
profiles
workouts
workout_exercises
workout_sets
goals
measurements
exercises
```

Sincronização atual:

- Perfil: salvo localmente e enviado ao Supabase quando possível.
- Treinos concluídos: salvos localmente e enviados ao Supabase.
- Metas: salvas localmente e sincronizadas com Supabase.
- Medidas, fotos, sono e dados de smartband: ainda ficam principalmente no aparelho.

Se a internet falhar ou o Supabase recusar algum envio, o app mantém os dados locais e deixa itens pendentes para nova tentativa.

## Dados da Mi Band e Apple Saúde

No iPhone, o FitTrack PWA não consegue ler diretamente o Apple Saúde/HealthKit. Essa é uma limitação do iOS para sites e PWAs.

Fluxo esperado no iPhone:

```text
Mi Band > Mi Fitness ou Zepp Life > Apple Saúde > FitTrack iOS nativo
```

No app atual, já existe uma seção em **Perfil > Configurações > Smartband e Apple Saúde** para cadastrar manualmente:

- passos;
- calorias ativas;
- horas de sono;
- batimento médio;
- batimento máximo;
- treinos detectados.

Esses dados aparecem no resumo da Home e, quando houver horas de sono, também entram nos registros de sono.

Para integração automática com Apple Saúde, o próximo passo técnico é transformar o projeto em app iOS usando uma camada nativa, como Capacitor, e integrar HealthKit.

## PWA e cache

O app possui:

- `manifest.json`;
- ícones para instalação;
- `offline.html`;
- `sw.js` para cache do app shell;
- versão de cache controlada por `CACHE_VERSION`.

Sempre que alterar arquivos importantes como `index.html`, `css/style.css` ou arquivos dentro de `js/`, atualize a versão do cache em `sw.js` para forçar o celular a baixar a versão nova.

Exemplo:

```js
const CACHE_VERSION = 'fittrack-v1.0.26';
```

## Dados locais

Os dados são mantidos no `localStorage` do navegador. Isso permite usar o app mesmo sem internet, mas também significa que:

- limpar dados do navegador pode apagar informações locais;
- trocar de navegador ou aparelho não leva automaticamente todos os dados;
- sincronização no Supabase depende das tabelas e permissões estarem corretas.

Use a opção de exportar histórico como backup adicional.

## Desenvolvimento

O app é feito em HTML, CSS e JavaScript puro, sem framework e sem etapa obrigatória de build.

Ao alterar o projeto:

- preserve a estrutura das pastas `css/`, `js/`, `icons/` e `assets/`;
- evite renomear arquivos referenciados pelo `index.html` e pelo `sw.js`;
- atualize o `CACHE_VERSION` quando subir mudanças para o GitHub Pages;
- teste no celular depois do deploy, principalmente telas com formulário, imagens e cache.

## Status atual

Versão atual de cache:

```text
fittrack-v1.0.26
```

Estado das principais áreas:

- Home: resumo visual baseado no mockup.
- Perfil: edição de dados pessoais disponível diretamente.
- Treino do dia: imagem maior, informações do treino e lista de exercícios limpa.
- Sono: registro manual e visualização no app.
- Smartband: cadastro manual preparado para futura integração iOS.
- Supabase: perfil, treinos e metas com sincronização.

## Próximos passos recomendados

1. Transformar o PWA em app mobile com Capacitor.
2. Criar versão iOS com integração HealthKit.
3. Criar sincronização para sono, medidas e dados de smartband.
4. Melhorar o backup/restauração entre aparelhos.
5. Revisar permissões e políticas RLS do Supabase antes de uso com várias contas.

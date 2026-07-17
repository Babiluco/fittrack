/* ==========================================================================
   FitForAll — Dados semente (biblioteca de exercícios, treinos, conquistas)
   ========================================================================== */

const MUSCLE_ICONS = {
  peito:'💪', costas:'🏋️', pernas:'🦵', gluteos:'🍑', ombros:'🤸',
  biceps:'💪', triceps:'💪', abdomen:'🔥', cardio:'🏃'
};

const EXERCISE_LIBRARY = [
  {id:'ex_supino', name:'Supino Reto', muscle:'peito', desc:'Exercício composto para desenvolvimento do peitoral maior, usando barra ou halteres deitado no banco.',
    execution:'Deite no banco, pés firmes no chão, desça a barra até tocar levemente o peito e empurre de volta explosivamente, sem travar os cotovelos.',
    mistakes:'Arquear demais a lombar, descer a barra rápido demais e usar amplitude incompleta.'},
  {id:'ex_supino_halteres', name:'Supino com Halteres', muscle:'peito', desc:'Variação do supino com halteres, permite maior amplitude e ativação estabilizadora.',
    execution:'Deitado no banco, desça os halteres ao lado do peito controlando o movimento e empurre para cima sem travar os cotovelos.',
    mistakes:'Deixar os halteres se chocarem no topo e perder o alinhamento dos punhos.'},
  {id:'ex_supino_maquina', name:'Supino Máquina', muscle:'peito', desc:'Exercício guiado para peitoral com menor exigência de estabilização.',
    execution:'Ajuste o banco na altura correta, empurre os manípulos à frente sem travar os cotovelos e retorne controlado.',
    mistakes:'Ajustar o banco na altura errada, sobrecarregando o ombro.'},
  {id:'ex_supino_inclinado', name:'Supino Inclinado', muscle:'peito', desc:'Trabalha a porção superior do peitoral com o banco inclinado entre 30-45°.',
    execution:'Ajuste o banco a 30-45°, controle a descida até a linha da clavícula e empurre para cima.',
    mistakes:'Inclinar demais o banco (vira ombro) e usar carga excessiva perdendo a técnica.'},
  {id:'ex_crucifixo', name:'Crucifixo', muscle:'peito', desc:'Isolamento do peitoral com halteres, foco no alongamento e contração.',
    execution:'Braços levemente flexionados, abra os halteres em arco até sentir alongamento e retorne contraindo o peito.',
    mistakes:'Flexionar totalmente o cotovelo (vira supino) e descer além do conforto do ombro.'},
  {id:'ex_crucifixo_maquina', name:'Crucifixo Máquina (Peck Deck)', muscle:'peito', desc:'Isolamento do peitoral em máquina, ótimo para controlar a amplitude com segurança.',
    execution:'Sentado, junte os apoios à frente do peito contraindo o peitoral e retorne controlado até o alongamento.',
    mistakes:'Usar impulso do tronco para frente e amplitude excessiva forçando o ombro.'},
  {id:'ex_puxada', name:'Puxada Frontal', muscle:'costas', desc:'Exercício de puxada vertical para desenvolvimento do latíssimo do dorso.',
    execution:'Puxe a barra em direção à parte superior do peito, contraindo as escápulas, e controle a subida.',
    mistakes:'Usar impulso do corpo e puxar atrás da nuca, o que sobrecarrega o ombro.'},
  {id:'ex_remada', name:'Remada Curvada', muscle:'costas', desc:'Trabalha espessura das costas com barra ou halteres em posição inclinada.',
    execution:'Tronco inclinado a 45°, puxe o peso em direção ao abdômen mantendo a coluna neutra.',
    mistakes:'Arredondar as costas e usar balanço excessivo do tronco.'},
  {id:'ex_remada_baixa', name:'Remada Baixa', muscle:'costas', desc:'Exercício de puxada horizontal em polia baixa para espessura das costas.',
    execution:'Sentado, puxe o cabo até o abdômen mantendo o tronco ereto e escápulas retraídas.',
    mistakes:'Balançar o tronco para trás e encolher os ombros durante o movimento.'},
  {id:'ex_remada_unilateral', name:'Remada Unilateral', muscle:'costas', desc:'Exercício com halter apoiado no banco, permite foco individual em cada lado das costas.',
    execution:'Apoie joelho e mão no banco, puxe o halter em direção ao quadril mantendo o cotovelo próximo ao corpo.',
    mistakes:'Girar o tronco para ajudar o movimento em vez de usar as costas.'},
  {id:'ex_pullover_cabo', name:'Pullover no Cabo', muscle:'costas', desc:'Exercício de isolamento para o latíssimo do dorso usando a polia alta.',
    execution:'Com os braços quase estendidos, puxe o cabo em arco até a altura das coxas contraindo as costas.',
    mistakes:'Flexionar demais os cotovelos, transformando o movimento em exercício de tríceps.'},
  {id:'ex_agachamento', name:'Agachamento Livre', muscle:'pernas', desc:'Exercício fundamental para quadríceps, glúteos e posteriores.',
    execution:'Pés na largura dos ombros, desça controlando o quadril para trás até coxas paralelas ao chão e suba.',
    mistakes:'Joelhos colapsando para dentro e perder a curvatura natural da lombar.'},
  {id:'ex_agachamento_smith', name:'Agachamento no Smith', muscle:'pernas', desc:'Agachamento guiado pela máquina Smith, com maior estabilidade e segurança de carga.',
    execution:'Posicione a barra sobre os trapézios, desça controlado até 90° de joelho e suba sem travar.',
    mistakes:'Posicionar os pés muito próximos da barra, sobrecarregando os joelhos.'},
  {id:'ex_agachamento_sumo', name:'Agachamento Sumô', muscle:'gluteos', desc:'Variação com pernas afastadas e pés rotacionados, prioriza glúteos e adutores.',
    execution:'Pés bem afastados e rotacionados para fora, desça mantendo os joelhos alinhados com os pés e suba contraindo o glúteo.',
    mistakes:'Deixar o tronco inclinar demais para frente e joelhos ultrapassarem a linha dos pés.'},
  {id:'ex_agachamento_bulgaro', name:'Agachamento Búlgaro', muscle:'gluteos', desc:'Exercício unilateral com o pé de trás apoiado, forte estímulo de glúteo e quadríceps.',
    execution:'Apoie o peito do pé de trás em um banco, desça o joelho da frente controlado e suba contraindo o glúteo.',
    mistakes:'Dar um passo curto demais, sobrecarregando o joelho da frente.'},
  {id:'ex_leg_press', name:'Leg Press', muscle:'pernas', desc:'Exercício guiado para quadríceps e glúteos com menor exigência de estabilização.',
    execution:'Posicione os pés na plataforma, desça controlado até 90° de flexão de joelho e empurre sem travar.',
    mistakes:'Descer demais tirando o quadril do encosto e travar os joelhos no topo.'},
  {id:'ex_cadeira_extensora', name:'Cadeira Extensora', muscle:'pernas', desc:'Isolamento do quadríceps na máquina extensora.',
    execution:'Sentado, estenda os joelhos contraindo o quadríceps no topo e desça controlado sem soltar o peso.',
    mistakes:'Usar impulso e soltar a carga rapidamente na descida.'},
  {id:'ex_stiff', name:'Stiff', muscle:'pernas', desc:'Exercício de cadeia posterior para posteriores de coxa e glúteos, feito com barra ou halteres.',
    execution:'Pernas levemente flexionadas, desça o peso próximo às pernas mantendo a coluna reta até sentir alongamento.',
    mistakes:'Curvar as costas e afastar demais o peso do corpo.'},
  {id:'ex_levantamento_romeno', name:'Levantamento Terra Romeno (RDL)', muscle:'pernas', desc:'Variação do stiff com maior amplitude no quadril, foco em posteriores e glúteos.',
    execution:'Empurre o quadril para trás mantendo a barra próxima às pernas, desça até sentir alongamento no posterior e retorne contraindo o glúteo.',
    mistakes:'Perder a curvatura neutra da coluna e flexionar demais os joelhos.'},
  {id:'ex_mesa_flexora', name:'Mesa Flexora', muscle:'pernas', desc:'Isolamento dos posteriores de coxa deitado na máquina flexora.',
    execution:'Deitado de bruços, flexione os joelhos trazendo o rolo em direção ao glúteo e desça controlado.',
    mistakes:'Elevar o quadril da mesa durante o movimento para compensar a carga.'},
  {id:'ex_cadeira_flexora', name:'Cadeira Flexora', muscle:'pernas', desc:'Isolamento dos posteriores de coxa sentado na máquina flexora.',
    execution:'Sentado, flexione os joelhos puxando o rolo para baixo e retorne controlado até a extensão.',
    mistakes:'Usar amplitude incompleta e soltar o peso rapidamente na volta.'},
  {id:'ex_afundo', name:'Afundo', muscle:'gluteos', desc:'Exercício unilateral para glúteos e quadríceps, ótimo para equilíbrio muscular.',
    execution:'De pé, dê um passo à frente e desça o joelho de trás quase tocando o chão, volte à posição inicial.',
    mistakes:'Deixar o joelho da frente ultrapassar muito a ponta do pé de forma instável.'},
  {id:'ex_afundo_andando', name:'Afundo Andando', muscle:'gluteos', desc:'Variação dinâmica do afundo, alternando as pernas a cada passo.',
    execution:'Dê um passo à frente descendo o joelho de trás, suba e continue andando alternando as pernas.',
    mistakes:'Dar passos muito curtos, perdendo a ativação do glúteo.'},
  {id:'ex_elevacao_pelvica', name:'Elevação Pélvica', muscle:'gluteos', desc:'Isolamento de glúteos com apoio nas escápulas no banco.',
    execution:'Apoie as escápulas no banco, eleve o quadril contraindo os glúteos no topo e desça controlado.',
    mistakes:'Hiperextender a lombar no topo do movimento em vez de usar os glúteos.'},
  {id:'ex_hip_thrust', name:'Hip Thrust', muscle:'gluteos', desc:'Um dos exercícios mais eficazes para hipertrofia de glúteos, feito com barra sobre o quadril.',
    execution:'Costas superiores apoiadas no banco, empurre o quadril para cima contraindo os glúteos no topo e desça controlado.',
    mistakes:'Hiperextender a lombar em vez de contrair o glúteo e posicionar a barra no lugar errado do quadril.'},
  {id:'ex_abdutora', name:'Cadeira Abdutora', muscle:'gluteos', desc:'Isolamento do glúteo médio abrindo as pernas contra a resistência da máquina.',
    execution:'Sentado, abra as pernas contra a resistência contraindo o glúteo médio e retorne controlado.',
    mistakes:'Usar impulso do tronco e amplitude muito curta.'},
  {id:'ex_kickback', name:'Glúteo no Cabo (Kickback)', muscle:'gluteos', desc:'Isolamento unilateral de glúteo levando a perna para trás contra o cabo.',
    execution:'Com o cabo preso ao tornozelo, leve a perna para trás contraindo o glúteo, sem arquear a lombar.',
    mistakes:'Usar a lombar para gerar o movimento em vez do glúteo.'},
  {id:'ex_panturrilha_pe', name:'Panturrilha em Pé', muscle:'pernas', desc:'Exercício para a panturrilha (gastrocnêmio) realizado em pé.',
    execution:'Em pé na plataforma, eleve os calcanhares o máximo possível e desça controlado até alongar.',
    mistakes:'Fazer o movimento rápido demais, sem controlar a fase excêntrica.'},
  {id:'ex_panturrilha_sentada', name:'Panturrilha Sentada', muscle:'pernas', desc:'Exercício para a panturrilha (sóleo) realizado sentado.',
    execution:'Sentado, eleve os calcanhares contraindo a panturrilha e desça controlado até o alongamento.',
    mistakes:'Usar amplitude incompleta e não pausar na contração máxima.'},
  {id:'ex_desenvolvimento', name:'Desenvolvimento com Halteres', muscle:'ombros', desc:'Exercício composto para deltoides, com foco na porção anterior e lateral.',
    execution:'Sentado ou em pé, empurre os halteres para cima até quase estender o cotovelo, sem travar.',
    mistakes:'Arquear as costas e usar impulso das pernas para levantar o peso.'},
  {id:'ex_desenvolvimento_maquina', name:'Desenvolvimento Máquina', muscle:'ombros', desc:'Exercício guiado para deltoides, com menor exigência de estabilização.',
    execution:'Sentado com as costas apoiadas, empurre os manípulos para cima sem travar os cotovelos e desça controlado.',
    mistakes:'Ajustar o assento muito baixo ou alto, sobrecarregando o ombro.'},
  {id:'ex_elevacao_lateral', name:'Elevação Lateral', muscle:'ombros', desc:'Isolamento do deltoide lateral para largura de ombros.',
    execution:'Eleve os halteres lateralmente até a altura dos ombros, cotovelos levemente flexionados.',
    mistakes:'Usar impulso do corpo e elevar acima da linha dos ombros com carga excessiva.'},
  {id:'ex_rosca_direta', name:'Rosca Direta', muscle:'biceps', desc:'Exercício clássico de isolamento do bíceps braquial.',
    execution:'Cotovelos fixos ao lado do corpo, flexione o antebraço contraindo o bíceps e desça controlado.',
    mistakes:'Balançar o tronco para ajudar o movimento e mover os cotovelos para frente.'},
  {id:'ex_rosca_alternada', name:'Rosca Alternada', muscle:'biceps', desc:'Variação unilateral que permite maior foco em cada braço.',
    execution:'Alterne a flexão de cada braço, girando o punho levemente ao subir (supinação).',
    mistakes:'Usar embalo do ombro e não controlar a fase excêntrica.'},
  {id:'ex_rosca_martelo', name:'Rosca Martelo', muscle:'biceps', desc:'Variação com pegada neutra, trabalha bíceps e antebraço.',
    execution:'Com as palmas voltadas uma para a outra, flexione os cotovelos sem girar o punho.',
    mistakes:'Balançar o tronco e usar impulso do ombro para levantar o peso.'},
  {id:'ex_triceps_corda', name:'Tríceps Corda', muscle:'triceps', desc:'Exercício de isolamento do tríceps na polia alta com corda.',
    execution:'Cotovelos fixos junto ao corpo, estenda os braços separando a corda no final do movimento.',
    mistakes:'Afastar os cotovelos do corpo e usar o peso do tronco para empurrar.'},
  {id:'ex_triceps_testa', name:'Tríceps Testa', muscle:'triceps', desc:'Exercício com barra deitado, foco na cabeça longa do tríceps.',
    execution:'Deitado, flexione os cotovelos levando a barra em direção à testa e estenda de volta.',
    mistakes:'Abrir os cotovelos durante a descida e usar amplitude excessiva na cervical.'},
  {id:'ex_triceps_frances', name:'Tríceps Francês', muscle:'triceps', desc:'Exercício com halter atrás da cabeça, foco na cabeça longa do tríceps.',
    execution:'Segure o halter com as duas mãos atrás da cabeça, estenda os cotovelos para cima e desça controlado.',
    mistakes:'Abrir demais os cotovelos e descer o peso rápido demais atrás da cabeça.'},
  {id:'ex_abdominal', name:'Abdominal Supra', muscle:'abdomen', desc:'Exercício clássico para reto abdominal.',
    execution:'Deitado, flexione o tronco em direção aos joelhos contraindo o abdômen, sem puxar o pescoço.',
    mistakes:'Puxar a cabeça com as mãos e usar impulso em vez de contração abdominal.'},
  {id:'ex_abdominal_infra', name:'Abdominal Infra', muscle:'abdomen', desc:'Exercício focado na porção inferior do reto abdominal.',
    execution:'Deitado, eleve o quadril do chão levando os joelhos em direção ao peito contraindo o abdômen inferior.',
    mistakes:'Usar embalo das pernas em vez de contração abdominal.'},
  {id:'ex_elevacao_pernas', name:'Elevação de Pernas', muscle:'abdomen', desc:'Exercício para abdômen inferior, elevando as pernas estendidas ou flexionadas.',
    execution:'Deitado ou suspenso, eleve as pernas contraindo o abdômen e desça controlado sem tocar o chão.',
    mistakes:'Usar embalo e arquear a lombar durante a descida.'},
  {id:'ex_prancha', name:'Prancha Isométrica', muscle:'abdomen', desc:'Exercício isométrico para estabilidade do core.',
    execution:'Apoie antebraços e pontas dos pés, mantenha o corpo alinhado contraindo abdômen e glúteos.',
    mistakes:'Deixar o quadril cair ou subir demais, perdendo o alinhamento corporal.'},
  {id:'ex_prancha_lateral', name:'Prancha Lateral', muscle:'abdomen', desc:'Exercício isométrico para os oblíquos e estabilidade lateral do core.',
    execution:'Apoie um antebraço e a lateral do pé no chão, eleve o quadril mantendo o corpo alinhado.',
    mistakes:'Deixar o quadril cair para baixo, perdendo a ativação do oblíquo.'},
  {id:'ex_esteira', name:'Corrida na Esteira', muscle:'cardio', desc:'Atividade cardiovascular contínua para condicionamento e queima calórica.',
    execution:'Mantenha ritmo constante, postura ereta e respiração controlada durante todo o percurso.',
    mistakes:'Segurar no corrimão o tempo todo e usar passadas muito longas.'},
  {id:'ex_caminhada_inclinada', name:'Caminhada Inclinada', muscle:'cardio', desc:'Caminhada na esteira com inclinação, ótima para queima calórica com baixo impacto.',
    execution:'Ajuste a inclinação, caminhe em ritmo constante mantendo a postura ereta sem se apoiar no corrimão.',
    mistakes:'Segurar no corrimão, o que reduz o gasto calórico real do exercício.'},
  {id:'ex_bike', name:'Bicicleta Ergométrica', muscle:'cardio', desc:'Exercício cardiovascular de baixo impacto para pernas e sistema cardiorrespiratório.',
    execution:'Ajuste o selim na altura do quadril, pedale em ritmo constante controlando a resistência.',
    mistakes:'Selim muito baixo (sobrecarrega joelho) e postura curvada nas costas.'},
  {id:'ex_eliptico', name:'Elíptico', muscle:'cardio', desc:'Exercício cardiovascular de baixo impacto que trabalha membros superiores e inferiores.',
    execution:'Mantenha a postura ereta, pedale em movimento fluido usando também os braços nos apoios.',
    mistakes:'Apoiar todo o peso nos braços em vez de usar as pernas para o movimento.'},
  {id:'ex_escada', name:'Escada (Stairmaster)', muscle:'cardio', desc:'Exercício cardiovascular intenso que simula subir escadas continuamente.',
    execution:'Mantenha a postura ereta e passos curtos e constantes, evitando apoiar o peso todo nos braços.',
    mistakes:'Debruçar sobre o painel, reduzindo o trabalho das pernas.'},
  {id:'ex_pular_corda', name:'Pular Corda', muscle:'cardio', desc:'Exercício cardiovascular de alta intensidade que também trabalha coordenação.',
    execution:'Salte de forma leve, usando principalmente o movimento do punho para girar a corda.',
    mistakes:'Saltar muito alto gastando energia à toa e usar o ombro para girar a corda.'},
];

function findExercise(id){
  return EXERCISE_LIBRARY.find(e=>e.id===id) ||
    (typeof state!=='undefined' && state.customExercises && state.customExercises.find(e=>e.id===id));
}

// Modelos de treino padrão (usados na agenda semanal)
// Programa com ênfase estética em glúteos e pernas: 3 estímulos de glúteo,
// 1 dia forte de quadríceps, 2 dias de posterior, 1 de costas, 1 de peito,
// 1 de ombros, 1 de braços e abdômen 3x/semana.
const WORKOUT_TEMPLATES = {
  gluteo_posterior:{
    id:'gluteo_posterior', name:'Glúteo + Posterior', muscle:'gluteos', estimatedTime:70,
    description:'Treino de glúteo e posterior de coxa, primeiro dos 3 estímulos de glúteo da semana.',
    warmup:'5–10 min de caminhada + mobilidade de quadril e tornozelo.',
    rir:'Termine cada série com 2–3 repetições de reserva (RIR).',
    exercises:[
      {exerciseId:'ex_hip_thrust', sets:4, reps:10, load:40, rest:90},
      {exerciseId:'ex_stiff', sets:3, reps:10, load:20, rest:75},
      {exerciseId:'ex_mesa_flexora', sets:3, reps:12, load:22, rest:60},
      {exerciseId:'ex_agachamento_bulgaro', sets:3, reps:10, load:10, rest:75, note:'cada perna'},
      {exerciseId:'ex_abdutora', sets:3, reps:18, load:25, rest:45},
      {exerciseId:'ex_kickback', sets:2, reps:15, load:8, rest:45},
      {exerciseId:'ex_caminhada_inclinada', sets:1, reps:18, load:0, rest:0, timeUnit:'min'},
    ]
  },
  costas_biceps_abdomen:{
    id:'costas_biceps_abdomen', name:'Costas + Bíceps + Abdômen', muscle:'costas', estimatedTime:65,
    description:'Treino de puxar com foco em dorsais e bíceps, finalizando com core.',
    warmup:'5–10 min de caminhada + mobilidade de ombro e escápula.',
    rir:'Termine cada série com 2–3 repetições de reserva (RIR).',
    exercises:[
      {exerciseId:'ex_puxada', sets:3, reps:10, load:42, rest:75},
      {exerciseId:'ex_remada_baixa', sets:3, reps:10, load:38, rest:75},
      {exerciseId:'ex_remada_unilateral', sets:3, reps:12, load:14, rest:60},
      {exerciseId:'ex_pullover_cabo', sets:2, reps:12, load:16, rest:60},
      {exerciseId:'ex_rosca_direta', sets:3, reps:10, load:12, rest:60},
      {exerciseId:'ex_rosca_martelo', sets:2, reps:12, load:10, rest:60},
      {exerciseId:'ex_prancha', sets:3, reps:35, load:0, rest:45, timeUnit:'seg'},
      {exerciseId:'ex_elevacao_pernas', sets:3, reps:12, load:0, rest:45},
      {exerciseId:'ex_bike', sets:1, reps:15, load:0, rest:0, timeUnit:'min'},
    ]
  },
  quadriceps_panturrilha:{
    id:'quadriceps_panturrilha', name:'Quadríceps + Panturrilha', muscle:'pernas', estimatedTime:65,
    description:'Único dia forte de quadríceps da semana, finalizando com panturrilha.',
    warmup:'5–10 min de caminhada + mobilidade de quadril e joelho.',
    rir:'Termine cada série com 2–3 repetições de reserva (RIR).',
    exercises:[
      {exerciseId:'ex_agachamento_smith', sets:4, reps:10, load:45, rest:100},
      {exerciseId:'ex_leg_press', sets:3, reps:12, load:100, rest:90},
      {exerciseId:'ex_cadeira_extensora', sets:3, reps:12, load:28, rest:60},
      {exerciseId:'ex_afundo_andando', sets:2, reps:12, load:8, rest:60, note:'cada perna'},
      {exerciseId:'ex_panturrilha_pe', sets:4, reps:18, load:30, rest:45},
      {exerciseId:'ex_panturrilha_sentada', sets:3, reps:15, load:20, rest:45},
      {exerciseId:'ex_escada', sets:1, reps:15, load:0, rest:0, timeUnit:'min'},
    ]
  },
  peito_ombro_triceps:{
    id:'peito_ombro_triceps', name:'Peito + Ombro + Tríceps', muscle:'peito', estimatedTime:60,
    description:'Treino de empurrar, cobrindo peito, ombros e tríceps em uma sessão.',
    warmup:'5–10 min de caminhada + mobilidade de ombro.',
    rir:'Termine cada série com 2–3 repetições de reserva (RIR).',
    exercises:[
      {exerciseId:'ex_supino_halteres', sets:3, reps:10, load:16, rest:75},
      {exerciseId:'ex_crucifixo_maquina', sets:3, reps:12, load:20, rest:60},
      {exerciseId:'ex_desenvolvimento', sets:3, reps:10, load:12, rest:75},
      {exerciseId:'ex_elevacao_lateral', sets:3, reps:15, load:6, rest:45},
      {exerciseId:'ex_triceps_corda', sets:3, reps:12, load:18, rest:60},
      {exerciseId:'ex_triceps_frances', sets:2, reps:12, load:8, rest:60},
      {exerciseId:'ex_eliptico', sets:1, reps:18, load:0, rest:0, timeUnit:'min'},
    ]
  },
  gluteo_enfase:{
    id:'gluteo_enfase', name:'Glúteo (Ênfase) + Posterior', muscle:'gluteos', estimatedTime:70,
    description:'Segundo dia de glúteo com cargas mais pesadas, terceiro estímulo direto na sexta-feira.',
    warmup:'5–10 min de caminhada + mobilidade de quadril.',
    rir:'Nesta sessão pode chegar mais perto da falha nos exercícios principais (1–2 RIR).',
    exercises:[
      {exerciseId:'ex_hip_thrust', sets:4, reps:9, load:45, rest:100, note:'carga mais pesada'},
      {exerciseId:'ex_levantamento_romeno', sets:3, reps:10, load:22, rest:90},
      {exerciseId:'ex_cadeira_flexora', sets:3, reps:12, load:24, rest:60},
      {exerciseId:'ex_agachamento_sumo', sets:3, reps:12, load:20, rest:75},
      {exerciseId:'ex_abdutora', sets:3, reps:20, load:28, rest:45, note:'drop set na última série'},
      {exerciseId:'ex_kickback', sets:3, reps:15, load:8, rest:45},
      {exerciseId:'ex_prancha_lateral', sets:3, reps:30, load:0, rest:45, timeUnit:'seg'},
      {exerciseId:'ex_abdominal_infra', sets:3, reps:15, load:0, rest:45},
      {exerciseId:'ex_caminhada_inclinada', sets:1, reps:20, load:0, rest:0, timeUnit:'min'},
    ]
  },
  full_body_condicionamento:{
    id:'full_body_condicionamento', name:'Full Body + Condicionamento', muscle:'pernas', estimatedTime:55,
    description:'Treino mais leve de corpo inteiro para aumentar o gasto calórico e melhorar o condicionamento.',
    warmup:'5–10 min de caminhada leve + mobilidade geral.',
    rir:'Sessão leve — priorize execução fluida, sem chegar perto da falha.',
    exercises:[
      {exerciseId:'ex_leg_press', sets:3, reps:15, load:70, rest:60},
      {exerciseId:'ex_puxada', sets:3, reps:12, load:32, rest:60},
      {exerciseId:'ex_supino_maquina', sets:3, reps:12, load:22, rest:60},
      {exerciseId:'ex_desenvolvimento_maquina', sets:3, reps:12, load:18, rest:60},
      {exerciseId:'ex_mesa_flexora', sets:3, reps:15, load:18, rest:60},
      {exerciseId:'ex_abdutora', sets:3, reps:20, load:22, rest:45},
      {exerciseId:'ex_bike', sets:1, reps:25, load:0, rest:0, timeUnit:'min', note:'finalize com bicicleta ou caminhada rápida'},
    ]
  },
  descanso:{
    id:'descanso', name:'Descanso', muscle:null, estimatedTime:0,
    description:'Dia de recuperação ativa: caminhada leve, alongamentos, mobilidade e liberação miofascial.',
    exercises:[]
  }
};

// Cronograma semanal padrão (0=Domingo ... 6=Sábado)
const DEFAULT_WEEK_PLAN = {
  1:'gluteo_posterior',           // Segunda — Glúteo + Posterior
  2:'costas_biceps_abdomen',      // Terça — Costas + Bíceps + Abdômen
  3:'quadriceps_panturrilha',     // Quarta — Quadríceps + Panturrilha
  4:'peito_ombro_triceps',        // Quinta — Peito + Ombro + Tríceps
  5:'gluteo_enfase',              // Sexta — Glúteo (ênfase) + Posterior
  6:'full_body_condicionamento',  // Sábado — Full Body + Condicionamento
  0:'descanso'                     // Domingo — Descanso ativo
};

// Informações gerais do programa (aquecimento, RIR, descanso, cardio, progressão)
const PROGRAM_INFO = {
  general:[
    {label:'Aquecimento', value:'5–10 min de caminhada + mobilidade da articulação treinada.', icon:'🔥'},
    {label:'Carga inicial', value:'60–70% da carga que você usava antes.', icon:'⚖️'},
    {label:'RIR (reserva)', value:'Termine cada série sentindo que daria 2–3 repetições a mais.', icon:'🎯'},
    {label:'Descanso entre séries', value:'60–90 segundos.', icon:'⏱'},
    {label:'Cardio', value:'15–20 minutos após o treino de força.', icon:'🏃'},
    {label:'Duração total', value:'60–75 minutos por sessão.', icon:'🕐'},
  ],
  volumeDistribution:[
    {label:'Glúteos', value:'3 estímulos (segunda, sexta e sábado leve)', icon:'🍑'},
    {label:'Quadríceps', value:'1 dia forte', icon:'🦵'},
    {label:'Posterior', value:'2 dias', icon:'🍗'},
    {label:'Costas', value:'1 dia', icon:'💪'},
    {label:'Peito', value:'1 dia', icon:'🩷'},
    {label:'Ombros', value:'1 dia', icon:'🟣'},
    {label:'Braços', value:'1 dia', icon:'💥'},
    {label:'Abdômen', value:'3 vezes por semana', icon:'🔥'},
  ],
  progression:[
    {phase:'Semanas 1–2', points:['Priorize a técnica.','Não treine até a falha.','Use carga leve.']},
    {phase:'Semanas 3–4', points:['Aumente 5–10% da carga.','Pode adicionar uma série nos exercícios principais.']},
    {phase:'Semanas 5–6', points:['Treine próximo da falha (1–2 repetições de reserva).','Cardio de 20–25 minutos.']},
  ]
};

const WEEKDAY_NAMES = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const WEEKDAY_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const ACHIEVEMENTS = [
  {id:'first_workout', emoji:'🏅', name:'Primeiro Treino', desc:'Complete seu 1º treino', check:s=>s.history.length>=1},
  {id:'ten_workouts', emoji:'🏆', name:'10 Treinos', desc:'Complete 10 treinos', check:s=>s.history.length>=10},
  {id:'streak_30', emoji:'🔥', name:'30 Dias Seguidos', desc:'Mantenha 30 dias de streak', check:s=>s.streak>=30},
  {id:'load_100', emoji:'💪', name:'Levantar 100kg', desc:'Registre uma carga de 100kg ou mais', check:s=>s.history.some(h=>h.exercisesLog?.some(el=>el.sets?.some(st=>Number(st.weight)>=100)))},
  {id:'full_weeks', emoji:'⭐', name:'Semana Completa', desc:'Complete todos os treinos de uma semana', check:s=>s.fullWeeksCompleted>=1},
];

const MOODS = [
  {id:'excellent', emoji:'😀', label:'Excelente'},
  {id:'good', emoji:'🙂', label:'Bem'},
  {id:'tired', emoji:'😐', label:'Cansado'},
  {id:'exhausted', emoji:'😫', label:'Muito cansado'},
];
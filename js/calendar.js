/* ==========================================================================
   FitTrack — Planejador e Calendário Inteligente
   ==========================================================================
   Responsabilidade: resolver "o que está planejado pra um dia específico",
   permitir mover treinos entre dias (arrastar), sugerir remarcação de
   treinos perdidos, e gerar o heatmap/stats do calendário.

   MODELO DE DADOS: o cronograma continua sendo o padrão semanal recorrente
   que já existia (state.weekPlan, editado em Editar Treinos). O que este
   módulo adiciona é uma CAMADA DE EXCEÇÕES por data específica
   (state.scheduleOverrides) — só usada quando um dia precisa fugir do
   padrão da semana (ex: você moveu o treino de terça pra quarta só dessa
   vez, ou marcou um dia como cardio). Nada do histórico de treinos já
   realizados (state.history) é duplicado ou reescrito por isso.

   CACHE: os cálculos de mês (grade do calendário, heatmap, consistência)
   variam com o mês/ano pedido — o cache guarda o último resultado por
   chave "ano-mês" e só recalcula se o histórico mudou desde então (mesma
   técnica de fingerprint usada em analytics.js).
   ========================================================================== */

const Calendar = (function(){
  let cache = {};
  let cacheFingerprint = null;

  function fingerprint(){
    const loadsCount = Object.values(state.exerciseLoads||{}).reduce((a,l)=>a+l.length,0);
    return [
      state.history.length, loadsCount,
      Object.keys(state.completedDates||{}).length,
      Object.keys(state.scheduleOverrides||{}).length,
    ].join('|');
  }
  function memo(key, fn){
    const fp = fingerprint();
    if(fp!==cacheFingerprint){ cache={}; cacheFingerprint=fp; }
    if(!(key in cache)) cache[key]=fn();
    return cache[key];
  }

  const DAY_TYPE_META = {
    workout:  {label:'Treino',      icon:'dumbbell'},
    rest:     {label:'Descanso',    icon:'moon'},
    cardio:   {label:'Cardio',      icon:'trending-up'},
    mobility: {label:'Mobilidade',  icon:'check'},
    custom:   {label:'Atividade',   icon:'plus'},
  };

  /* O que está planejado pra uma data específica: prioriza a exceção
     (scheduleOverrides), cai pro padrão semanal recorrente (weekPlan). */
  function getDayPlan(dateKey){
    const override = state.scheduleOverrides[dateKey];
    if(override){
      if(override.type==='workout'){
        const tpl = getTemplate(override.templateId);
        return {type:'workout', templateId:override.templateId, tpl, label:tpl?tpl.name:'Treino', isOverride:true};
      }
      return Object.assign({isOverride:true, label:override.label||DAY_TYPE_META[override.type]?.label}, override);
    }
    const d = new Date(dateKey+'T00:00:00');
    const planId = state.weekPlan[d.getDay()];
    const tpl = getTemplate(planId);
    if(!tpl || tpl.id==='descanso') return {type:'rest', label:'Descanso', isOverride:false};
    return {type:'workout', templateId:planId, tpl, label:tpl.name, isOverride:false};
  }

  /* Move um treino planejado de um dia pra outro (arrastar-e-soltar).
     Não duplica: o dia de origem vira descanso, o de destino recebe o
     plano. O histórico de sessões já concluídas nunca é alterado. */
  function moveWorkout(fromDateKey, toDateKey){
    const plan = getDayPlan(fromDateKey);
    if(plan.type!=='workout') return false;
    const destPlan = getDayPlan(toDateKey);
    if(destPlan.type==='workout') return false; // nunca sobrescreve outro treino já agendado
    state.scheduleOverrides[toDateKey] = {type:'workout', templateId:plan.templateId};
    state.scheduleOverrides[fromDateKey] = {type:'rest'};
    persist();
    return true;
  }

  /* Treinos perdidos recentes (planejados, no passado, não concluídos, e
     que a pessoa ainda não dispensou a sugestão de remarcar). */
  function missedWorkouts(){
    return memo('missed', ()=>{
      const missed = [];
      for(let i=1;i<=6;i++){
        const d = new Date(); d.setDate(d.getDate()-i);
        const key = todayKey(d);
        if(state.rescheduleDismissed[key]) continue;
        const plan = getDayPlan(key);
        if(plan.type==='workout' && !state.completedDates[key]){
          missed.push({dateKey:key, date:d, plan});
        }
      }
      return missed;
    });
  }

  /* Próximo dia livre (sem treino já agendado) a partir de hoje — usado
     pra sugerir onde remarcar um treino perdido. */
  function nextAvailableDay(fromDate){
    for(let i=0;i<=7;i++){
      const d = new Date(fromDate||new Date()); d.setDate(d.getDate()+i);
      const key = todayKey(d);
      const plan = getDayPlan(key);
      if(plan.type!=='workout') return key;
    }
    return todayKey(new Date());
  }

  /* ------------------------------------------------------------------ */
  /* Grade do calendário mensal                                          */
  /* ------------------------------------------------------------------ */
  function monthGrid(year, month){
    return memo(`grid:${year}-${month}`, ()=>{
      const first = new Date(year, month, 1);
      const startOffset = first.getDay();
      const daysInMonth = new Date(year, month+1, 0).getDate();
      const cells = [];
      for(let i=0;i<startOffset;i++) cells.push(null);
      const todayK = todayKey();
      for(let day=1; day<=daysInMonth; day++){
        const d = new Date(year, month, day);
        const key = todayKey(d);
        const plan = getDayPlan(key);
        const done = !!state.completedDates[key];
        const isPast = key<todayK;
        const isToday = key===todayK;
        let status;
        if(plan.type!=='workout') status = plan.type; // rest/cardio/mobility/custom
        else if(done) status = 'done';
        else if(isPast) status = 'missed';
        else status = 'scheduled';
        cells.push({date:d, dateKey:key, plan, status, isToday, done});
      }
      return cells;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Heatmap estilo GitHub — intensidade por dia, últimas N semanas       */
  /* ------------------------------------------------------------------ */
  function heatmapData(weeksBack){
    weeksBack = weeksBack||12;
    return memo('heatmap:'+weeksBack, ()=>{
      const end = startOfWeek(new Date());
      end.setDate(end.getDate()+7);
      const start = new Date(end.getTime()-weeksBack*7*86400000);
      const volumeByDate = {};
      state.history.forEach(h=>{ volumeByDate[h.date] = (volumeByDate[h.date]||0)+h.volume; });
      const maxVol = Math.max(1, ...Object.values(volumeByDate));
      const days = [];
      for(let d=new Date(start); d<end; d.setDate(d.getDate()+1)){
        const key = todayKey(d);
        const vol = volumeByDate[key]||0;
        let level = 0;
        if(vol>0) level = vol>=maxVol*0.66 ? 3 : vol>=maxVol*0.33 ? 2 : 1;
        days.push({dateKey:key, date:new Date(d), level, volume:vol});
      }
      return days;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Streak & consistência                                               */
  /* ------------------------------------------------------------------ */
  function consistencyStats(){
    return memo('consistency', ()=>{
      const streak = computeStreak(state.completedDates);
      const best = state.bestStreak||0;
      const wp = weekProgress();
      const now = new Date();
      const monthStart = todayKey(new Date(now.getFullYear(), now.getMonth(), 1));
      const monthEnd = todayKey(new Date(now.getFullYear(), now.getMonth()+1, 1));
      let plannedThisMonth=0, doneThisMonth=0;
      for(let d=new Date(now.getFullYear(),now.getMonth(),1); todayKey(d)<monthEnd; d.setDate(d.getDate()+1)){
        const key = todayKey(d);
        if(key>todayKey()) continue; // só conta dias já passados/hoje
        const plan = getDayPlan(key);
        if(plan.type==='workout'){ plannedThisMonth++; if(state.completedDates[key]) doneThisMonth++; }
      }
      return {
        streak, best,
        weekDone: wp.done, weekTotal: wp.total,
        monthDone: doneThisMonth, monthPlanned: plannedThisMonth,
        monthPct: plannedThisMonth ? Math.round(doneThisMonth/plannedThisMonth*100) : 0,
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Recuperação por grupo muscular — só a semana atual                  */
  /* ------------------------------------------------------------------ */
  function weekMuscleRecovery(){
    return memo('weekMuscle', ()=>{
      const start = startOfWeek(new Date());
      const musclesToday = {};
      for(let i=0;i<7;i++){
        const d = new Date(start); d.setDate(start.getDate()+i);
        const key = todayKey(d);
        const plan = getDayPlan(key);
        if(plan.type==='workout' && plan.tpl){
          if(!musclesToday[plan.tpl.muscle]) musclesToday[plan.tpl.muscle]=[];
          musclesToday[plan.tpl.muscle].push(key);
        }
      }
      return Object.keys(musclesToday).map(muscle=>({
        muscle, label: MUSCLE_LABELS[muscle]||muscle,
        days: musclesToday[muscle].length,
        warning: musclesToday[muscle].length>=3,
      }));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sugestões específicas do calendário (complementam Analytics)        */
  /* ------------------------------------------------------------------ */
  function smartSuggestions(){
    return memo('suggestions', ()=>{
      const out = [];
      const cons = consistencyStats();
      if(cons.streak>=4) out.push(`Você treinou ${cons.streak} dias seguidos. Considere um dia de recuperação.`);

      // dia da semana com melhor aproveitamento
      const doneByWeekday = [0,0,0,0,0,0,0], plannedByWeekday=[0,0,0,0,0,0,0];
      Object.keys(state.completedDates).forEach(key=>{
        const wd = new Date(key+'T00:00:00').getDay();
        doneByWeekday[wd]++;
      });
      state.history.forEach(h=>{ /* já contado via completedDates */ });
      for(let wd=0; wd<7; wd++){
        const tpl = getTemplate(state.weekPlan[wd]);
        if(tpl && tpl.id!=='descanso') plannedByWeekday[wd]++;
      }
      let bestDay=-1, bestRatio=0;
      doneByWeekday.forEach((count,wd)=>{
        if(count>bestRatio){ bestRatio=count; bestDay=wd; }
      });
      if(bestDay>=0 && bestRatio>=3) out.push(`Você rende melhor às ${WEEKDAY_NAMES[bestDay]}s — é quando mais completa treinos.`);

      // duração média
      if(state.history.length>=3){
        const avgDur = Math.round(state.history.reduce((a,h)=>a+h.duration,0)/state.history.length);
        out.push(`Sua duração média de treino é ${avgDur} minutos.`);
      }

      // grupo muscular pulado
      const missed = missedWorkouts();
      const missedMuscles = {};
      missed.forEach(m=>{ if(m.plan.tpl) missedMuscles[m.plan.tpl.muscle]=(missedMuscles[m.plan.tpl.muscle]||0)+1; });
      Object.entries(missedMuscles).forEach(([muscle,count])=>{
        if(count>=2) out.push(`Treino de ${MUSCLE_LABELS[muscle]||muscle} foi perdido ${count}x recentemente.`);
      });

      return out.slice(0,4);
    });
  }

  return {
    DAY_TYPE_META, getDayPlan, moveWorkout, missedWorkouts, nextAvailableDay,
    monthGrid, heatmapData, consistencyStats, weekMuscleRecovery, smartSuggestions,
  };
})();

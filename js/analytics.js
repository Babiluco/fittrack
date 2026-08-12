/* ==========================================================================
   FitTrack — Sistema Inteligente de Progresso
   ==========================================================================
   Responsabilidade: transformar o histórico de treinos já salvo (state.history,
   state.exerciseLoads, state.completedDates, state.weightLog) em recordes,
   tendências, alertas de platô, sugestões de progressão e resumos — tudo
   calculado localmente, sem rede e sem IA.

   CACHE: os cálculos aqui percorrem todo o histórico, o que fica mais caro
   conforme a pessoa treina mais. Pra não refazer isso a cada render, os
   resultados ficam guardados em memória e só são recalculados quando o
   histórico realmente muda (ver getCache/invalidateIfStale abaixo).
   ========================================================================== */

const Analytics = (function(){
  let cache = {};
  let cacheFingerprint = null;

  /* "Fingerprint" barato dos dados que afetam os cálculos — se nada disso
     mudou desde a última vez, reaproveita o resultado guardado em vez de
     recalcular tudo de novo. */
  function fingerprint(){
    const loadsCount = Object.values(state.exerciseLoads||{}).reduce((a,l)=>a+l.length,0);
    return [
      state.history.length,
      loadsCount,
      (state.weightLog||[]).length,
      Object.keys(state.completedDates||{}).length,
    ].join('|');
  }

  function memo(key, fn){
    const fp = fingerprint();
    if(fp !== cacheFingerprint){ cache = {}; cacheFingerprint = fp; }
    if(!(key in cache)) cache[key] = fn();
    return cache[key];
  }

  /* Fórmula de Epley — estimativa padrão de 1RM (carga pra 1 repetição
     máxima) a partir de uma carga e repetições já realizadas. */
  function estimated1RM(weight, reps){
    if(!weight || !reps) return 0;
    return Math.round(weight * (1 + reps/30));
  }

  function exerciseLogs(exerciseId){
    return [...(state.exerciseLoads[exerciseId]||[])].sort((a,b)=>a.date.localeCompare(b.date));
  }

  /* ------------------------------------------------------------------ */
  /* FEATURE 1 — Recordes pessoais                                       */
  /* ------------------------------------------------------------------ */
  function detectPRs(){
    return memo('prs', ()=>{
      const prs = [];

      // Maior carga e maior 1RM estimado, por exercício
      Object.keys(state.exerciseLoads).forEach(exId=>{
        const logs = exerciseLogs(exId);
        if(logs.length===0) return;
        const e = findExercise(exId);
        const name = e?e.name:exId;
        let maxWeight=0, maxWeightDate=null, max1RM=0, max1RMDate=null, maxReps=0, maxRepsDate=null;
        logs.forEach(l=>{
          if(l.weight>maxWeight){ maxWeight=l.weight; maxWeightDate=l.date; }
          const rm = estimated1RM(l.weight, l.reps||1);
          if(rm>max1RM){ max1RM=rm; max1RMDate=l.date; }
          if((l.reps||0)>maxReps){ maxReps=l.reps; maxRepsDate=l.date; }
        });
        if(maxWeight>0) prs.push({type:'weight', exerciseId:exId, label:`Maior carga · ${name}`, value:`${maxWeight}kg`, date:maxWeightDate});
        if(max1RM>0) prs.push({type:'1rm', exerciseId:exId, label:`Maior 1RM estimado · ${name}`, value:`${max1RM}kg`, date:max1RMDate});
        if(maxReps>0) prs.push({type:'reps', exerciseId:exId, label:`Mais repetições · ${name}`, value:`${maxReps} reps`, date:maxRepsDate});
      });

      // Maior volume de treino e treino mais longo, entre as sessões
      let maxVolume=0, maxVolumeDate=null, maxDuration=0, maxDurationDate=null;
      state.history.forEach(h=>{
        if(h.volume>maxVolume){ maxVolume=h.volume; maxVolumeDate=h.date; }
        if(h.duration>maxDuration){ maxDuration=h.duration; maxDurationDate=h.date; }
      });
      if(maxVolume>0) prs.push({type:'volume', label:'Maior volume de treino', value:`${maxVolume}kg`, date:maxVolumeDate});
      if(maxDuration>0) prs.push({type:'duration', label:'Treino mais longo', value:`${maxDuration} min`, date:maxDurationDate});

      // Mais treinos completados em uma semana
      const byWeek = {};
      Object.keys(state.completedDates).forEach(dateKey=>{
        const wk = todayKey(startOfWeek(new Date(dateKey+'T00:00:00')));
        byWeek[wk] = (byWeek[wk]||0)+1;
      });
      let bestWeekCount=0, bestWeekKey=null;
      Object.entries(byWeek).forEach(([wk,count])=>{
        if(count>bestWeekCount){ bestWeekCount=count; bestWeekKey=wk; }
      });
      if(bestWeekCount>0) prs.push({type:'weekly_count', label:'Mais treinos em uma semana', value:`${bestWeekCount} treinos`, date:bestWeekKey});

      return prs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    });
  }

  /* O recorde mais recente entre todos — pra mostrar como badge de
     celebração no Dashboard. */
  function latestPR(){
    const prs = detectPRs();
    return prs.length ? prs[0] : null;
  }

  /* ------------------------------------------------------------------ */
  /* FEATURE 2 — Detecção de progresso por exercício                     */
  /* ------------------------------------------------------------------ */
  function windowAvgWeight(logs, fromDate){
    const filtered = fromDate ? logs.filter(l=>l.date>=fromDate) : logs;
    if(filtered.length===0) return null;
    return filtered.reduce((a,l)=>a+l.weight,0)/filtered.length;
  }

  function exerciseTrend(exerciseId){
    return memo('trend:'+exerciseId, ()=>{
      const logs = exerciseLogs(exerciseId);
      if(logs.length<2) return {status:'insufficient', logs};
      const now = new Date();
      const d30 = todayKey(new Date(now.getTime()-30*86400000));
      const d90 = todayKey(new Date(now.getTime()-90*86400000));

      const last = logs[logs.length-1].weight;
      const prev = logs[logs.length-2].weight;
      const avg30 = windowAvgWeight(logs, d30);
      const avg90 = windowAvgWeight(logs, d90);
      const avgAll = windowAvgWeight(logs, null);
      const first = logs[0].weight;

      function trendSymbol(current, baseline){
        if(baseline==null || current==null) return '▬';
        const diffPct = ((current-baseline)/baseline)*100;
        if(diffPct>=3) return '▲';
        if(diffPct<=-3) return '▼';
        return '▬';
      }

      return {
        status:'ok',
        lastVsPrevious: trendSymbol(last, prev),
        last30Days: trendSymbol(avg30, avgAll),
        last90Days: trendSymbol(avg90, avgAll),
        allTime: trendSymbol(last, first),
        current:last, previous:prev, avg30, avg90, avgAll, first,
      };
    });
  }

  /* ------------------------------------------------------------------ */
  /* FEATURE 3 — Detecção de platô                                       */
  /* ------------------------------------------------------------------ */
  function detectPlateau(exerciseId){
    return memo('plateau:'+exerciseId, ()=>{
      const logs = exerciseLogs(exerciseId);
      if(logs.length<6) return null;
      const recent = logs.slice(-6);
      const sameWeight = recent.every(l=>l.weight===recent[0].weight);
      const sameReps = recent.every(l=>l.reps===recent[0].reps);
      const same1RM = recent.every(l=>estimated1RM(l.weight,l.reps)===estimated1RM(recent[0].weight,recent[0].reps));
      if(sameWeight || sameReps || same1RM){
        const e = findExercise(exerciseId);
        return {
          exerciseId, exerciseName: e?e.name:exerciseId,
          reason: sameWeight?'mesma carga':sameReps?'mesmas repetições':'mesmo 1RM estimado',
          sessions: recent.length,
          suggestions:['Aumentar repetições','Aumentar carga','Trocar a variação do exercício','Fazer uma semana de deload'],
        };
      }
      return null;
    });
  }

  function allPlateaus(){
    return memo('allPlateaus', ()=>{
      return Object.keys(state.exerciseLoads).map(exId=>detectPlateau(exId)).filter(Boolean);
    });
  }

  /* ------------------------------------------------------------------ */
  /* FEATURE 4 — Sugestão de sobrecarga progressiva                      */
  /* ------------------------------------------------------------------ */
  function overloadSuggestion(exerciseId){
    return memo('overload:'+exerciseId, ()=>{
      // últimas sessões (na ordem) em que esse exercício apareceu no histórico
      const sessions = state.history
        .filter(h=>h.exercisesLog.some(el=>el.exerciseId===exerciseId))
        .sort((a,b)=>a.date.localeCompare(b.date))
        .slice(-3);
      if(sessions.length<3) return null;
      const allCompleted = sessions.every(h=>{
        const el = h.exercisesLog.find(x=>x.exerciseId===exerciseId);
        return el && el.sets.length>0 && el.sets.every(s=>s.done && !s.skipped);
      });
      if(!allCompleted) return null;
      const logs = exerciseLogs(exerciseId);
      const lastWeight = logs[logs.length-1]?.weight||0;
      const e = findExercise(exerciseId);
      return {
        exerciseId, exerciseName: e?e.name:exerciseId,
        message:`Você completou todas as séries de ${e?e.name:exerciseId} nas últimas 3 sessões. Que tal +2.5kg (ou +1 repetição) na próxima?`,
        suggestedWeight: lastWeight ? Math.round((lastWeight+2.5)*10)/10 : null,
      };
    });
  }

  function allOverloadSuggestions(){
    return memo('allOverload', ()=>{
      return Object.keys(state.exerciseLoads).map(exId=>overloadSuggestion(exId)).filter(Boolean);
    });
  }

  /* ------------------------------------------------------------------ */
  /* FEATURE 5 / 6 — Resumo semanal e mensal                              */
  /* ------------------------------------------------------------------ */
  function summaryForRange(fromDate, toDate){
    const sessions = state.history.filter(h=>h.date>=fromDate && h.date<toDate);
    const volume = sessions.reduce((a,h)=>a+h.volume,0);
    const calories = sessions.reduce((a,h)=>a+h.calories,0);
    const avgDuration = sessions.length ? Math.round(sessions.reduce((a,h)=>a+h.duration,0)/sessions.length) : 0;
    const muscleCounts = {};
    sessions.forEach(h=>{
      const tpl = getTemplate(h.templateId);
      if(tpl) muscleCounts[tpl.muscle] = (muscleCounts[tpl.muscle]||0)+1;
    });
    const topMuscle = Object.entries(muscleCounts).sort((a,b)=>b[1]-a[1])[0];
    const exercisesSet = new Set();
    sessions.forEach(h=>h.exercisesLog.forEach(el=>exercisesSet.add(el.exerciseId)));
    const bestSession = sessions.reduce((best,h)=>(!best||h.volume>best.volume)?h:best, null);
    const prsInRange = detectPRs().filter(p=>p.date>=fromDate && p.date<toDate);
    return {
      workouts: sessions.length,
      exercisesPerformed: exercisesSet.size,
      volume, calories, avgDuration,
      topMuscle: topMuscle ? MUSCLE_LABELS[topMuscle[0]]||topMuscle[0] : null,
      bestSession,
      newPRs: prsInRange.length,
      streak: computeStreak(state.completedDates),
    };
  }

  function weeklySummary(){
    return memo('weekly', ()=>{
      const start = todayKey(startOfWeek(new Date()));
      const end = todayKey(new Date(startOfWeek(new Date()).getTime()+7*86400000));
      return summaryForRange(start, end);
    });
  }

  function monthlySummary(){
    return memo('monthly', ()=>{
      const now = new Date();
      const start = todayKey(new Date(now.getFullYear(), now.getMonth(), 1));
      const end = todayKey(new Date(now.getFullYear(), now.getMonth()+1, 1));
      const base = summaryForRange(start, end);
      const weightLog = [...(state.weightLog||[])].filter(l=>l.date>=start && l.date<end).sort((a,b)=>a.date.localeCompare(b.date));
      const weightTrend = weightLog.length>=2 ? (weightLog[weightLog.length-1].weight - weightLog[0].weight) : null;
      // top exercícios do mês por volume
      const volumeByExercise = {};
      state.history.filter(h=>h.date>=start && h.date<end).forEach(h=>{
        h.exercisesLog.forEach(el=>{
          const vol = el.sets.filter(s=>s.done).reduce((a,s)=>a+s.weight*s.reps,0);
          volumeByExercise[el.exerciseId] = (volumeByExercise[el.exerciseId]||0)+vol;
        });
      });
      const topExercises = Object.entries(volumeByExercise).sort((a,b)=>b[1]-a[1]).slice(0,3)
        .map(([exId,vol])=>({name: (findExercise(exId)||{}).name||exId, volume:vol}));
      return Object.assign(base, {weightTrend, topExercises});
    });
  }

  /* ------------------------------------------------------------------ */
  /* FEATURE 7 — Equilíbrio muscular                                     */
  /* ------------------------------------------------------------------ */
  function muscleBalance(){
    return memo('muscleBalance', ()=>{
      const start = todayKey(new Date(Date.now()-28*86400000)); // últimas 4 semanas
      const setsPerMuscle = {};
      state.history.filter(h=>h.date>=start).forEach(h=>{
        h.exercisesLog.forEach(el=>{
          const e = findExercise(el.exerciseId);
          if(!e) return;
          const doneSets = el.sets.filter(s=>s.done).length;
          setsPerMuscle[e.muscle] = (setsPerMuscle[e.muscle]||0) + doneSets;
        });
      });
      // média semanal (últimas 4 semanas)
      const weeklyAvg = {};
      Object.keys(setsPerMuscle).forEach(m=>{ weeklyAvg[m] = Math.round(setsPerMuscle[m]/4*10)/10; });

      return Object.keys(MUSCLE_LABELS).filter(m=>m!=='todos').map(muscle=>{
        const sets = weeklyAvg[muscle]||0;
        let status = 'balanced';
        if(sets===0) status='none';
        else if(sets<4) status='under';
        else if(sets>14) status='over';
        return {muscle, label:MUSCLE_LABELS[muscle], weeklySets:sets, status};
      }).sort((a,b)=>b.weeklySets-a.weeklySets);
    });
  }

  /* ------------------------------------------------------------------ */
  /* FEATURE 8 — Insights de recuperação                                  */
  /* ------------------------------------------------------------------ */
  function recoveryInsight(){
    return memo('recovery', ()=>{
      const sortedDates = Object.keys(state.completedDates).sort();
      if(sortedDates.length===0) return null;
      // dias consecutivos treinados até hoje
      const streak = computeStreak(state.completedDates);
      if(streak>=6){
        return {level:'warning', message:`Você já treinou ${streak} dias seguidos sem folga. Considere um dia de descanso pra recuperar.`};
      }
      // mesmo grupo muscular em dias consecutivos
      const last3 = sortedDates.slice(-3).map(k=>{
        const tplId = state.completedDates[k];
        const tpl = getTemplate(tplId);
        return tpl?tpl.muscle:null;
      });
      if(last3.length===3 && last3[0] && last3[0]===last3[1] && last3[1]===last3[2]){
        return {level:'info', message:`${MUSCLE_LABELS[last3[0]]||last3[0]} foi treinado 3 vezes seguidas. Um intervalo maior ajuda na recuperação muscular.`};
      }
      return null;
    });
  }

  /* ------------------------------------------------------------------ */
  /* FEATURE 9 — Insights curtos e diretos                                */
  /* ------------------------------------------------------------------ */
  function smartInsights(){
    return memo('smartInsights', ()=>{
      const insights = [];
      const streak = computeStreak(state.completedDates);
      if(streak>=3) insights.push(`Você está treinando há ${streak} dias seguidos.`);

      // maior progressão de carga no mês
      let best=null;
      Object.keys(state.exerciseLoads).forEach(exId=>{
        const t = exerciseTrend(exId);
        if(t.status!=='ok' || !t.avgAll) return;
        const pct = ((t.current-t.first)/t.first)*100;
        if(pct>=8 && (!best||pct>best.pct)){
          const e = findExercise(exId);
          best = {pct, name:e?e.name:exId};
        }
      });
      if(best) insights.push(`Você aumentou ${best.name} em ${Math.round(best.pct)}% desde que começou a registrar.`);

      // grupo muscular mais forte (maior 1RM médio relativo)
      const balance = muscleBalance().filter(m=>m.weeklySets>0);
      if(balance.length){
        insights.push(`${balance[0].label} é o grupo muscular que você mais treina atualmente.`);
      }

      // volume caindo
      const thisWeek = weeklySummary();
      const lastWeekStart = todayKey(new Date(startOfWeek(new Date()).getTime()-7*86400000));
      const lastWeekEnd = todayKey(startOfWeek(new Date()));
      const lastWeek = summaryForRange(lastWeekStart, lastWeekEnd);
      if(lastWeek.volume>0){
        const diffPct = Math.round(((thisWeek.volume-lastWeek.volume)/lastWeek.volume)*100);
        if(diffPct<=-15) insights.push(`Seu volume de treino caiu ${Math.abs(diffPct)}% em relação à semana passada.`);
        else if(diffPct>=15) insights.push(`Seu volume de treino subiu ${diffPct}% em relação à semana passada!`);
      }

      return insights.slice(0,4);
    });
  }

  return {
    estimated1RM, detectPRs, latestPR,
    exerciseTrend, detectPlateau, allPlateaus,
    overloadSuggestion, allOverloadSuggestions,
    weeklySummary, monthlySummary, muscleBalance, recoveryInsight, smartInsights,
    exerciseLogs,
  };
})();

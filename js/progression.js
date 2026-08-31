/* ==========================================================================
   FitTrack — Progressão e recordes durante o treino
   ========================================================================== */

const WorkoutProgression = (function(){
  const cache = new WeakMap();

  function doneSets(sets){
    return (sets||[]).filter(s=>
      s && s.done && !s.skipped &&
      s.weight !== undefined && s.weight !== null && s.weight !== '' &&
      Number(s.weight)>=0 && Number(s.reps)>0
    );
  }

  function setVolume(set){
    return Number(set.weight||0) * Number(set.reps||0);
  }

  function estimatedOneRepMax(set){
    const weight = Number(set.weight)||0;
    const reps = Number(set.reps)||0;
    if(weight<=0 || reps<=0) return 0;
    return weight * (1 + reps / 30);
  }

  function dateLabel(date){
    if(typeof fmtDate==='function') return fmtDate(date);
    return date || '';
  }

  function sessionId(session, index){
    return session.id || `${session.date || 'sem-data'}-${index}`;
  }

  function sessionSetMetrics(sets){
    const validSets = doneSets(sets);
    const totalLoad = validSets.reduce((sum,set)=>sum+(Number(set.weight)||0),0);
    const totalReps = validSets.reduce((sum,set)=>sum+(Number(set.reps)||0),0);
    const volume = validSets.reduce((sum,set)=>sum+setVolume(set),0);
    const bestWeight = Math.max(0, ...validSets.map(set=>Number(set.weight)||0));
    const bestReps = Math.max(0, ...validSets.map(set=>Number(set.reps)||0));
    const bestOneRm = Math.max(0, ...validSets.map(estimatedOneRepMax));
    return {validSets, totalLoad, totalReps, volume, bestWeight, bestReps, bestOneRm};
  }

  function stateCache(stateRef){
    if(!stateRef || typeof stateRef!=='object') return null;
    let entry = cache.get(stateRef);
    const historyLength = Array.isArray(stateRef.history) ? stateRef.history.length : 0;
    const loadCount = Object.values(stateRef.exerciseLoads||{}).reduce((sum,logs)=>sum+(Array.isArray(logs)?logs.length:0),0);
    const signature = `${historyLength}:${loadCount}`;
    if(!entry || entry.signature!==signature){
      entry = {signature, byExercise:{}};
      cache.set(stateRef, entry);
    }
    return entry;
  }

  function getExerciseHistory(stateRef, exerciseId){
    const entry = stateCache(stateRef);
    if(entry && entry.byExercise[exerciseId]) return entry.byExercise[exerciseId];

    const sessions = [];
    (stateRef?.history||[]).forEach((session,index)=>{
      const exerciseLog = (session.exercisesLog||[]).find(el=>el && el.exerciseId===exerciseId);
      if(!exerciseLog) return;
      const metrics = sessionSetMetrics(exerciseLog.sets);
      if(!metrics.validSets.length) return;
      sessions.push({
        id: sessionId(session,index),
        date: session.date || '',
        templateId: session.templateId,
        workoutName: session.name || '',
        sets: metrics.validSets.map(set=>({
          weight: Number(set.weight)||0,
          reps: Number(set.reps)||0,
          done: true,
          skipped: false,
          notes: set.notes || '',
        })),
        totalLoad: metrics.totalLoad,
        totalReps: metrics.totalReps,
        trainingVolume: metrics.volume,
        volume: metrics.volume,
        bestWeight: metrics.bestWeight,
        bestReps: metrics.bestReps,
        bestOneRm: metrics.bestOneRm,
      });
    });

    if(!sessions.length && stateRef?.exerciseLoads && Array.isArray(stateRef.exerciseLoads[exerciseId])){
      stateRef.exerciseLoads[exerciseId].forEach((log,index)=>{
        const weight = Number(log.weight)||0;
        const reps = Number(log.reps)||0;
        if(weight<=0 || reps<=0) return;
        const set = {weight, reps, done:true};
        sessions.push({
          id: `legacy-${log.date || index}`,
          date: log.date || '',
          templateId: null,
          workoutName: 'Registro antigo',
          sets: [set],
          totalLoad: weight,
          totalReps: reps,
          trainingVolume: setVolume(set),
          volume: setVolume(set),
          bestWeight: weight,
          bestReps: reps,
          bestOneRm: estimatedOneRepMax(set),
          legacy: true,
        });
      });
    }

    sessions.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    if(entry) entry.byExercise[exerciseId] = sessions;
    return sessions;
  }

  function getExerciseStats(stateRef, exerciseId){
    const sessions = getExerciseHistory(stateRef, exerciseId);
    const allSets = sessions.flatMap(session=>session.sets.map(set=>Object.assign({date:session.date}, set)));
    const totalLoad = sessions.reduce((sum,session)=>sum+(session.totalLoad||0),0);
    const totalReps = sessions.reduce((sum,session)=>sum+(session.totalReps||0),0);
    const totalVolume = sessions.reduce((sum,session)=>sum+session.volume,0);
    const bestWeightSet = allSets.reduce((best,set)=>(!best || set.weight>best.weight)?set:best, null);
    const bestRepsSet = allSets.reduce((best,set)=>(!best || set.reps>best.reps)?set:best, null);
    const bestOneRmSet = allSets.reduce((best,set)=>(!best || estimatedOneRepMax(set)>estimatedOneRepMax(best))?set:best, null);
    const bestSessionVolume = sessions.reduce((best,session)=>(!best || session.volume>best.volume)?session:best, null);
    return {
      sessionsCount: sessions.length,
      lastPerformed: sessions.length ? sessions[sessions.length-1].date : null,
      bestWeight: bestWeightSet ? bestWeightSet.weight : 0,
      bestReps: bestRepsSet ? bestRepsSet.reps : 0,
      bestOneRm: bestOneRmSet ? estimatedOneRepMax(bestOneRmSet) : 0,
      totalLoad,
      totalReps,
      totalVolume,
      bestSessionVolume: bestSessionVolume ? bestSessionVolume.volume : 0,
      lastPerformance: sessions.length ? sessions[sessions.length-1] : null,
    };
  }

  function getExercisePRs(stateRef, exerciseId){
    const sessions = getExerciseHistory(stateRef, exerciseId);
    const allSets = sessions.flatMap(session=>session.sets.map(set=>Object.assign({date:session.date}, set)));
    const highestWeight = allSets.reduce((best,set)=>(!best || set.weight>best.weight)?set:best, null);
    const highestReps = allSets.reduce((best,set)=>(!best || set.reps>best.reps)?set:best, null);
    const highestOneRm = allSets.reduce((best,set)=>(!best || estimatedOneRepMax(set)>estimatedOneRepMax(best))?set:best, null);
    const highestVolume = sessions.reduce((best,session)=>(!best || session.volume>best.volume)?session:best, null);
    return [
      highestWeight && {type:'weight', label:'Maior carga', value:`${formatNumber(highestWeight.weight)} kg`, date:highestWeight.date},
      highestReps && {type:'reps', label:'Mais repetições', value:`${highestReps.reps} reps`, date:highestReps.date},
      highestOneRm && {type:'oneRm', label:'1RM estimado', value:`${formatNumber(estimatedOneRepMax(highestOneRm))} kg`, date:highestOneRm.date},
      highestVolume && {type:'sessionVolume', label:'Maior volume de sessão', value:`${formatNumber(highestVolume.volume)} kg`, date:highestVolume.date},
    ].filter(Boolean);
  }

  function getExerciseTrend(stateRef, exerciseId){
    const sessions = getExerciseHistory(stateRef, exerciseId);
    if(sessions.length<4) return {status:'insufficient', label:'Dados insuficientes'};
    const metric = session=>session.bestOneRm || session.bestWeight || session.volume;
    const recent = sessions.slice(-2).map(metric);
    const previous = sessions.slice(-4,-2).map(metric);
    if(recent.length<2 || previous.length<2) return {status:'insufficient', label:'Dados insuficientes'};
    const recentAvg = recent.reduce((a,b)=>a+b,0)/recent.length;
    const previousAvg = previous.reduce((a,b)=>a+b,0)/previous.length;
    if(previousAvg<=0) return {status:'insufficient', label:'Dados insuficientes'};
    const deltaPct = ((recentAvg-previousAvg)/previousAvg)*100;
    if(deltaPct>=3) return {status:'up', label:'↑ Melhorando', deltaPct, current:recentAvg, previous:previousAvg};
    const consistentDrop = recent.every(value=>value <= previousAvg*0.94);
    if(deltaPct<=-6 && consistentDrop) return {status:'down', label:'↓ Em queda', deltaPct, current:recentAvg, previous:previousAvg};
    return {status:'stable', label:'→ Estável', deltaPct, current:recentAvg, previous:previousAvg};
  }

  function getExerciseProgress(stateRef, exerciseId){
    const sessions = getExerciseHistory(stateRef, exerciseId);
    if(sessions.length<2) return null;
    const first = sessions[0];
    const last = sessions[sessions.length-1];
    function compare(label, from, to, unit){
      if(!from || !to) return null;
      return {
        label,
        from,
        to,
        unit,
        pct: ((to-from)/from)*100,
        text:`${formatNumber(from)}${unit} → ${formatNumber(to)}${unit}`,
      };
    }
    return [
      compare('Carga', first.bestWeight, last.bestWeight, ' kg'),
      compare('1RM estimado', first.bestOneRm, last.bestOneRm, ' kg'),
      compare('Volume de treino', first.trainingVolume||first.volume, last.trainingVolume||last.volume, ' kg'),
    ].filter(Boolean);
  }

  function rangeStart(range, now){
    if(range==='all') return null;
    const days = {d7:7, d30:30, d90:90, m6:183, y1:365}[range] || 30;
    const date = new Date((now || new Date()).getTime() - days*86400000);
    return date.toISOString().slice(0,10);
  }

  function getExerciseChartPoints(stateRef, exerciseId, metric, range){
    const from = rangeStart(range);
    return getExerciseHistory(stateRef, exerciseId)
      .filter(session=>!from || session.date>=from)
      .map(session=>{
        let value = session.bestWeight;
        if(metric==='reps') value = session.bestReps;
        if(metric==='volume') value = session.volume;
        if(metric==='oneRm') value = session.bestOneRm;
        return {label:dateLabel(session.date).slice(0,5), value:Math.round(value*10)/10};
      })
      .filter(point=>point.value>0);
  }

  function exerciseSessions(history, exerciseId, beforeDate){
    return (history||[])
      .filter(session=>!beforeDate || session.date < beforeDate)
      .map(session=>{
        const exerciseLog = (session.exercisesLog||[]).find(el=>el.exerciseId===exerciseId);
        if(!exerciseLog) return null;
        const sets = doneSets(exerciseLog.sets);
        if(!sets.length) return null;
        return {
          date: session.date,
          sets,
          volume: sets.reduce((sum,set)=>sum+setVolume(set),0),
        };
      })
      .filter(Boolean)
      .sort((a,b)=>a.date.localeCompare(b.date));
  }

  function previousPerformance(history, exerciseId, beforeDate){
    const sessions = exerciseSessions(history, exerciseId, beforeDate);
    return sessions.length ? sessions[sessions.length-1] : null;
  }

  function mostRecentValidSet(history, exerciseId, beforeDate){
    const previous = previousPerformance(history, exerciseId, beforeDate);
    if(!previous) return null;
    return previous.sets[previous.sets.length-1] || null;
  }

  function inferWeightStep(exerciseDef, previous){
    const samples = [];
    if(exerciseDef && Number(exerciseDef.load)>0) samples.push(Number(exerciseDef.load));
    if(previous) previous.sets.forEach(set=>samples.push(Number(set.weight)||0));
    return samples.some(value=>Math.abs(value*2 - Math.round(value*2)) < 0.001 && Math.abs(value - Math.round(value)) > 0.001) ? 0.5 : 1;
  }

  function progressionIncrement(exercise){
    if(!exercise) return 1;
    if(exercise.muscle==='biceps' || exercise.muscle==='triceps' || exercise.muscle==='ombros') return 1;
    if(exercise.muscle==='cardio' || exercise.muscle==='abdomen') return 0;
    return 2.5;
  }

  function detectSetPR(history, exerciseId, completedSet, currentSets, beforeDate){
    const previous = exerciseSessions(history, exerciseId, beforeDate);
    const previousSets = previous.flatMap(session=>session.sets);
    const currentDone = doneSets(currentSets);
    const weight = Number(completedSet.weight)||0;
    const reps = Number(completedSet.reps)||0;
    if(weight<=0 || reps<=0) return null;

    const prs = [];
    const maxWeight = Math.max(0, ...previousSets.map(s=>Number(s.weight)||0));
    if(maxWeight>0 && weight>maxWeight) prs.push({type:'weight', label:'Maior carga', value:`${formatNumber(weight)} kg`});

    const sameWeightReps = Math.max(0, ...previousSets.filter(s=>Number(s.weight)===weight).map(s=>Number(s.reps)||0));
    if(sameWeightReps>0 && reps>sameWeightReps) prs.push({type:'repsAtWeight', label:'Mais reps nessa carga', value:`${reps} reps com ${formatNumber(weight)} kg`});

    const previousOneRm = Math.max(0, ...previousSets.map(estimatedOneRepMax));
    const currentOneRm = estimatedOneRepMax(completedSet);
    if(previousOneRm>0 && currentOneRm>previousOneRm) prs.push({type:'oneRm', label:'1RM estimado', value:`${formatNumber(currentOneRm)} kg`});

    const previousSessionVolume = Math.max(0, ...previous.map(session=>session.volume));
    const currentVolume = currentDone.reduce((sum,set)=>sum+setVolume(set),0);
    if(previousSessionVolume>0 && currentVolume>previousSessionVolume) prs.push({type:'sessionVolume', label:'Volume da sessão', value:`${formatNumber(currentVolume)} kg`});

    return prs.length ? prs[0] : null;
  }

  function progressionSuggestion({history, exerciseId, exercise, exerciseDef, currentSets, beforeDate}){
    const completed = doneSets(currentSets);
    const targetSets = Number(exerciseDef?.sets)||completed.length;
    const targetReps = Number(exerciseDef?.reps)||0;
    if(!targetSets || !targetReps || completed.length < targetSets) return null;
    if(!completed.slice(0,targetSets).every(set=>Number(set.reps)>=targetReps)) return null;

    const previous = exerciseSessions(history, exerciseId, beforeDate).slice(-2);
    if(previous.length<2) return null;
    const comparable = previous.every(session=>
      session.sets.length>=targetSets &&
      session.sets.slice(0,targetSets).every(set=>Number(set.reps)>=targetReps)
    );
    if(!comparable) return null;

    const baseWeight = Math.min(...completed.slice(0,targetSets).map(set=>Number(set.weight)||0));
    const increment = progressionIncrement(exercise);
    if(baseWeight<=0 || increment<=0) return null;
    return {
      message:'Você completou todas as séries.',
      next:`Próximo treino: considere ${formatNumber(baseWeight + increment)} kg.`,
      suggestedWeight: baseWeight + increment,
    };
  }

  function exerciseSummary(history, exerciseId, currentSets, beforeDate){
    const completed = doneSets(currentSets);
    const totalLoad = completed.reduce((sum,set)=>sum+(Number(set.weight)||0),0);
    const currentVolume = completed.reduce((sum,set)=>sum+setVolume(set),0);
    const currentReps = completed.reduce((sum,set)=>sum+(Number(set.reps)||0),0);
    const previous = previousPerformance(history, exerciseId, beforeDate);
    const previousVolume = previous ? previous.volume : 0;
    const deltaPct = previousVolume>0 ? ((currentVolume - previousVolume) / previousVolume) * 100 : null;
    return {
      setsCompleted: completed.length,
      totalLoad,
      totalReps: currentReps,
      trainingVolume: currentVolume,
      currentVolume,
      previousVolume,
      deltaPct,
    };
  }

  function formatNumber(value){
    return Number(value||0).toLocaleString('pt-BR', {maximumFractionDigits:1});
  }

  function formatKg(value, zeroLabel){
    const number = Number(value)||0;
    if(number===0 && zeroLabel) return zeroLabel;
    return `${formatNumber(number)} kg`;
  }

  return {
    previousPerformance,
    mostRecentValidSet,
    inferWeightStep,
    detectSetPR,
    progressionSuggestion,
    exerciseSummary,
    estimatedOneRepMax,
    getExerciseHistory,
    getExerciseStats,
    getExercisePRs,
    getExerciseTrend,
    getExerciseProgress,
    getExerciseChartPoints,
    formatNumber,
    formatKg,
  };
})();

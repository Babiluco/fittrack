/* ==========================================================================
   FitTrack — Fotos de Progresso e Transformação Corporal
   ==========================================================================
   Responsabilidade: fotos de progresso (com compressão antes de salvar),
   medidas corporais expandidas, comparação antes/depois, linha do tempo,
   marcos de transformação, metas corporais e insights motivacionais.

   ARMAZENAMENTO: tudo continua 100% local (localStorage, via state/persist()
   já existentes) — nenhuma foto sai do aparelho. Fotos são comprimidas
   (redimensionadas + reexportadas em JPEG) ANTES de entrar no estado, já
   que localStorage tem limite de espaço (geralmente 5-10MB) e imagens cruas
   estourariam isso rápido.
   ========================================================================== */

const BodyProgress = (function(){
  let cache = {};
  let cacheFingerprint = null;
  function fingerprint(){
    return [
      (state.progressPhotos||[]).length,
      (state.measurements||[]).length,
      (state.weightLog||[]).length,
      (state.bodyGoals||[]).length,
      (state.unlockedMilestones||[]).length,
    ].join('|');
  }
  function memo(key, fn){
    const fp = fingerprint();
    if(fp!==cacheFingerprint){ cache={}; cacheFingerprint=fp; }
    if(!(key in cache)) cache[key]=fn();
    return cache[key];
  }

  /* ------------------------------------------------------------------ */
  /* Compressão de imagem — redimensiona pro maior lado ficar em no      */
  /* máximo maxDim px e reexporta em JPEG com qualidade reduzida, tudo   */
  /* via <canvas>, antes de virar uma string (data URL) que vai pro      */
  /* localStorage.                                                      */
  /* ------------------------------------------------------------------ */
  function compressImage(file, maxDim, quality){
    maxDim = maxDim||900; quality = quality||0.72;
    return new Promise((resolve, reject)=>{
      const reader = new FileReader();
      reader.onerror = ()=>reject(new Error('Não foi possível ler o arquivo'));
      reader.onload = ()=>{
        const img = new Image();
        img.onerror = ()=>reject(new Error('Arquivo não é uma imagem válida'));
        img.onload = ()=>{
          let {width, height} = img;
          if(width>height && width>maxDim){ height = Math.round(height*maxDim/width); width = maxDim; }
          else if(height>maxDim){ width = Math.round(width*maxDim/height); height = maxDim; }
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Getters de medida com fallback pros campos antigos (arm/hips/thigh) */
  /* ------------------------------------------------------------------ */
  function getHip(m){ return m.hip ?? m.hips ?? null; }
  function getArmAvg(m){
    if(m.armL!=null && m.armR!=null) return (m.armL+m.armR)/2;
    return m.armL ?? m.armR ?? m.arm ?? null;
  }
  function getThighAvg(m){
    if(m.thighL!=null && m.thighR!=null) return (m.thighL+m.thighR)/2;
    return m.thighL ?? m.thighR ?? m.thigh ?? null;
  }
  function getCalfAvg(m){
    if(m.calfL!=null && m.calfR!=null) return (m.calfL+m.calfR)/2;
    return m.calfL ?? m.calfR ?? null;
  }
  function computeBMI(weight){
    const h = (state.user.height||170)/100;
    return weight && h ? Math.round((weight/(h*h))*10)/10 : null;
  }
  function computeLeanMass(weight, bodyFat){
    if(!weight || bodyFat==null) return null;
    return Math.round(weight*(1-bodyFat/100)*10)/10;
  }

  const METRIC_GETTERS = {
    weight: m=>m.weight, bodyFat: m=>m.bodyFat, chest: m=>m.chest, waist: m=>m.waist,
    hip: getHip, shoulders: m=>m.shoulders, neck: m=>m.neck,
    arm: getArmAvg, thigh: getThighAvg, calf: getCalfAvg,
    bmi: m=>m.weight?computeBMI(m.weight):null,
    leanMass: m=>(m.weight&&m.bodyFat!=null)?computeLeanMass(m.weight,m.bodyFat):null,
  };
  const METRIC_LABELS = {
    weight:'Peso', bodyFat:'% Gordura', chest:'Peito', waist:'Cintura', hip:'Quadril',
    shoulders:'Ombros', neck:'Pescoço', arm:'Braço', thigh:'Coxa', calf:'Panturrilha',
    bmi:'IMC', leanMass:'Massa magra',
  };

  const RANGE_DAYS = {'7d':7,'30d':30,'90d':90,'1y':365,'all':null};

  function metricSeries(metric, rangeKey){
    return memo(`series:${metric}:${rangeKey}`, ()=>{
      const getter = METRIC_GETTERS[metric];
      if(!getter) return [];
      const days = RANGE_DAYS[rangeKey];
      const cutoff = days ? todayKey(new Date(Date.now()-days*86400000)) : null;
      const rows = [...(state.measurements||[])]
        .filter(m=>!cutoff || m.date>=cutoff)
        .sort((a,b)=>a.date.localeCompare(b.date))
        .map(m=>({label:fmtDate(m.date).slice(0,5), value:getter(m), date:m.date}))
        .filter(r=>r.value!=null);
      return rows;
    });
  }

  /* ------------------------------------------------------------------ */
  /* Fotos                                                                */
  /* ------------------------------------------------------------------ */
  function visiblePhotos(includeHidden){
    return [...(state.progressPhotos||[])]
      .filter(p=>includeHidden || !p.hidden)
      .sort((a,b)=>b.date.localeCompare(a.date));
  }
  function photosByAngle(angle, includeHidden){
    return visiblePhotos(includeHidden).filter(p=>p.angle===angle);
  }
  function closestPhotoTo(dateKey, angle){
    const candidates = visiblePhotos(true).filter(p=>!angle || p.angle===angle);
    if(candidates.length===0) return null;
    return candidates.reduce((best,p)=>{
      const d1 = Math.abs(new Date(p.date)-new Date(dateKey));
      const d2 = best ? Math.abs(new Date(best.date)-new Date(dateKey)) : Infinity;
      return d1<d2 ? p : best;
    }, null);
  }
  function closestMeasurementTo(dateKey){
    const list = [...(state.measurements||[])];
    if(list.length===0) return null;
    return list.reduce((best,m)=>{
      const d1 = Math.abs(new Date(m.date)-new Date(dateKey));
      const d2 = best ? Math.abs(new Date(best.date)-new Date(dateKey)) : Infinity;
      return d1<d2 ? m : best;
    }, null);
  }

  /* ------------------------------------------------------------------ */
  /* Comparação antes/depois                                              */
  /* ------------------------------------------------------------------ */
  function compare(dateA, dateB){
    const mA = closestMeasurementTo(dateA), mB = closestMeasurementTo(dateB);
    const photoA = closestPhotoTo(dateA,'front')||closestPhotoTo(dateA);
    const photoB = closestPhotoTo(dateB,'front')||closestPhotoTo(dateB);
    const days = Math.round(Math.abs(new Date(dateB)-new Date(dateA))/86400000);
    function diff(key, getter){
      const a = mA?getter(mA):null, b = mB?getter(mB):null;
      if(a==null||b==null) return null;
      return Math.round((b-a)*10)/10;
    }
    return {
      photoA, photoB, days,
      weightDiff: diff('weight', METRIC_GETTERS.weight),
      bodyFatDiff: diff('bodyFat', METRIC_GETTERS.bodyFat),
      waistDiff: diff('waist', METRIC_GETTERS.waist),
      chestDiff: diff('chest', METRIC_GETTERS.chest),
      armDiff: diff('arm', getArmAvg),
      thighDiff: diff('thigh', getThighAvg),
    };
  }

  /* ------------------------------------------------------------------ */
  /* Linha do tempo — junta fotos, medidas, conquistas, recordes         */
  /* ------------------------------------------------------------------ */
  function timelineFeed(){
    return memo('timeline', ()=>{
      const items = [];
      visiblePhotos(false).forEach(p=>items.push({date:p.date, type:'photo', data:p}));
      (state.measurements||[]).forEach(m=>items.push({date:m.date, type:'measurement', data:m}));
      (state.unlockedMilestones||[]).forEach(id=>{
        const ms = MILESTONES.find(x=>x.id===id);
        if(ms) items.push({date: state.milestoneDates?.[id] || todayKey(), type:'milestone', data:ms});
      });
      Analytics.detectPRs().forEach(pr=>{ if(pr.date) items.push({date:pr.date, type:'pr', data:pr}); });
      return items.sort((a,b)=>b.date.localeCompare(a.date));
    });
  }

  /* ------------------------------------------------------------------ */
  /* Marcos de transformação                                             */
  /* ------------------------------------------------------------------ */
  function checkMilestones(){
    const newly = [];
    MILESTONES.forEach(ms=>{
      if(state.unlockedMilestones.includes(ms.id)) return;
      if(ms.check()){
        state.unlockedMilestones.push(ms.id);
        state.milestoneDates = state.milestoneDates||{};
        state.milestoneDates[ms.id] = todayKey();
        newly.push(ms);
      }
    });
    if(newly.length) persist();
    return newly;
  }

  const MILESTONES = [
    {id:'first_photo', label:'Primeira foto de progresso', emoji:'📸', check:()=>(state.progressPhotos||[]).length>=1},
    {id:'30_days', label:'30 dias treinando', emoji:'📅', check:()=>{
      const first = [...state.history].sort((a,b)=>a.date.localeCompare(b.date))[0];
      return first && (Date.now()-new Date(first.date).getTime())>=30*86400000;
    }},
    {id:'lost_5kg', label:'Perdeu 5kg', emoji:'⬇️', check:()=>{
      const log = [...(state.weightLog||[])].sort((a,b)=>a.date.localeCompare(b.date));
      return log.length>=2 && (log[0].weight-log[log.length-1].weight)>=5;
    }},
    {id:'gained_5kg', label:'Ganhou 5kg', emoji:'⬆️', check:()=>{
      const log = [...(state.weightLog||[])].sort((a,b)=>a.date.localeCompare(b.date));
      return log.length>=2 && (log[log.length-1].weight-log[0].weight)>=5;
    }},
    {id:'100_workouts', label:'100 treinos concluídos', emoji:'💯', check:()=>state.history.length>=100},
    {id:'streak_365', label:'365 dias de sequência', emoji:'🔥', check:()=>(state.bestStreak||0)>=365},
  ];

  /* ------------------------------------------------------------------ */
  /* Metas corporais                                                     */
  /* ------------------------------------------------------------------ */
  function goalProgress(goal){
    const latestMeasurement = closestMeasurementTo(todayKey());
    const current = (goal.metric && latestMeasurement) ? (METRIC_GETTERS[goal.metric]?.(latestMeasurement) ?? goal.startValue) : goal.startValue;
    const total = goal.targetValue-goal.startValue;
    if(total===0) return 100;
    const done = current-goal.startValue;
    return Math.max(0, Math.min(100, Math.round(done/total*100)));
  }

  /* ------------------------------------------------------------------ */
  /* Insights motivacionais                                              */
  /* ------------------------------------------------------------------ */
  function bodyInsights(){
    return memo('insights', ()=>{
      const out = [];
      const weightLog = [...(state.weightLog||[])].sort((a,b)=>a.date.localeCompare(b.date));
      if(weightLog.length>=2){
        const first = weightLog[0], last = weightLog[weightLog.length-1];
        const days = Math.round((new Date(last.date)-new Date(first.date))/86400000);
        const delta = Math.round((last.weight-first.weight)*10)/10;
        if(Math.abs(delta)>=0.5 && days>0){
          out.push(`Você ${delta<0?'perdeu':'ganhou'} ${Math.abs(delta)}kg em ${days} dias.`);
        }
      }
      const measurements = [...(state.measurements||[])].sort((a,b)=>a.date.localeCompare(b.date));
      if(measurements.length>=2){
        const first = measurements[0], last = measurements[measurements.length-1];
        const w1 = getHip(first), w2 = getHip(last);
        const waistDiff = (first.waist!=null && last.waist!=null) ? Math.round((last.waist-first.waist)*10)/10 : null;
        if(waistDiff!=null && Math.abs(waistDiff)>=1){
          out.push(`Cintura ${waistDiff<0?'reduziu':'aumentou'} ${Math.abs(waistDiff)}cm.`);
        }
        const lm1 = computeLeanMass(first.weight, first.bodyFat), lm2 = computeLeanMass(last.weight, last.bodyFat);
        if(lm1!=null && lm2!=null){
          const lmDiff = Math.round((lm2-lm1)*10)/10;
          if(Math.abs(lmDiff)>=0.5) out.push(`Massa magra ${lmDiff>0?'aumentou':'diminuiu'} ${Math.abs(lmDiff)}kg.`);
        }
      }
      const streak = computeStreak(state.completedDates);
      const weeksConsistent = Math.floor(streak/7);
      if(weeksConsistent>=1) out.push(`Você está consistente há ${weeksConsistent} semana${weeksConsistent>1?'s':''}.`);
      return out.slice(0,4);
    });
  }

  return {
    compressImage, getHip, getArmAvg, getThighAvg, getCalfAvg, computeBMI, computeLeanMass,
    METRIC_LABELS, RANGE_DAYS, metricSeries,
    visiblePhotos, photosByAngle, closestPhotoTo, closestMeasurementTo,
    compare, timelineFeed, checkMilestones, MILESTONES, goalProgress, bodyInsights,
  };
})();

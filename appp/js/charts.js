/* ==========================================================================
   FitForAll — Gráficos simples (sem dependências externas)
   ========================================================================== */

function renderBarChart(container, items){
  // items: [{label, value}]
  const max = Math.max(1, ...items.map(i=>i.value));
  container.innerHTML = `<div class="bar-chart">
    ${items.map(i=>`
      <div class="bar-col">
        <div style="font-size:10px;color:var(--text-dim);font-weight:700;">${i.value}</div>
        <div class="bar" style="height:0%" data-h="${Math.max(4,(i.value/max)*100)}"></div>
        <div class="bar-label">${i.label}</div>
      </div>`).join('')}
  </div>`;
  requestAnimationFrame(()=>{
    container.querySelectorAll('.bar').forEach(b=>{ b.style.height = b.dataset.h+'%'; });
  });
}

function renderLineChart(container, points, opts){
  opts = opts||{};
  const w = opts.width||560, h = opts.height||160, pad=24;
  if(points.length===0){
    container.innerHTML = `<div class="empty-state"><span class="emoji">📈</span>Sem dados suficientes ainda.</div>`;
    return;
  }
  const values = points.map(p=>p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max-min)||1;
  const stepX = points.length>1 ? (w-pad*2)/(points.length-1) : 0;
  const coords = points.map((p,i)=>{
    const x = pad + i*stepX;
    const y = h-pad - ((p.value-min)/range)*(h-pad*2);
    return [x,y];
  });
  const pathD = coords.map((c,i)=>(i===0?'M':'L')+c[0].toFixed(1)+','+c[1].toFixed(1)).join(' ');
  const areaD = pathD + ` L${coords[coords.length-1][0].toFixed(1)},${h-pad} L${coords[0][0].toFixed(1)},${h-pad} Z`;
  container.innerHTML = `
    <div class="line-chart-wrap">
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--blue)" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="var(--blue)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#lg)" stroke="none"></path>
      <path d="${pathD}" fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path>
      ${coords.map(c=>`<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="3.5" fill="var(--bg)" stroke="var(--blue)" stroke-width="2"></circle>`).join('')}
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);margin-top:4px;">
      <span>${points[0].label}</span><span>${points[points.length-1].label}</span>
    </div>
    </div>`;
}

function renderRing(container, percent, label){
  const r = 32, c = 2*Math.PI*r;
  const offset = c - (Math.min(100,percent)/100)*c;
  container.innerHTML = `
    <div class="ring">
      <svg width="78" height="78" viewBox="0 0 78 78">
        <circle class="bg" cx="39" cy="39" r="${r}"></circle>
        <circle class="fg" cx="39" cy="39" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c}"></circle>
      </svg>
      <div class="ring-label">${label}</div>
    </div>`;
  requestAnimationFrame(()=>{
    container.querySelector('.fg').style.strokeDashoffset = offset;
  });
}

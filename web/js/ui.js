// Shared UI primitives
const { useState, useEffect, useRef, useMemo, useCallback } = React;

function ScoreRing({ value, size=56, stroke=5 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * (value / 100);
  const color = value >= 80 ? 'var(--success)' : value >= 60 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} stroke="hsl(var(--border))" strokeWidth={stroke} fill="none"/>
        <circle cx={size/2} cy={size/2} r={r} stroke={`hsl(${color})`} strokeWidth={stroke} fill="none"
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
      </svg>
      <div className="score-val" style={{ color: `hsl(${color})` }}>{value}</div>
    </div>
  );
}

function Spark({ points = [], width=80, height=28, color='var(--b-accent)' }) {
  if (!points.length) return null;
  const max = Math.max(...points), min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const path = points.map((p, i) => `${i===0?'M':'L'}${i*step},${height - ((p-min)/range)*height}`).join(' ');
  return (
    <svg width={width} height={height}>
      <path d={`${path} L${width},${height} L0,${height} Z`} fill={`hsl(${color} / .15)`}/>
      <path d={path} fill="none" stroke={`hsl(${color})`} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function Bars({ data = [], height=120, color='var(--b-accent)' }) {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div style={{display:'flex', alignItems:'flex-end', gap:6, height, paddingTop:8}}>
      {data.map((d,i) => (
        <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
          <div style={{width:'100%', height:`${(d.v/max)*100}%`, background:`hsl(${color} / ${0.4 + 0.6*(d.v/max)})`, borderRadius:'4px 4px 0 0', minHeight:2, transition:'height .3s'}}/>
          <div style={{fontSize:10, color:'hsl(var(--fg-faint))'}}>{d.l}</div>
        </div>
      ))}
    </div>
  );
}

function Avatar({ name, size=28, color }) {
  const initials = (name || '?').split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
  const hues = [210, 260, 180, 20, 340, 150];
  const hue = color ?? hues[(name || '?').charCodeAt(0) % hues.length];
  return (
    <div className="avatar" style={{
      width:size, height:size, borderRadius:'50%',
      background:`linear-gradient(135deg, hsl(${hue} 70% 52%), hsl(${hue+30} 70% 45%))`,
      color:'white', display:'grid', placeItems:'center',
      fontWeight:700, fontSize: size*0.38, flex:'0 0 auto'
    }}>{initials}</div>
  );
}

window.UI = { ScoreRing, Spark, Bars, Avatar };

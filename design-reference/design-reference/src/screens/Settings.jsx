// Settings — configurações do CRM (integrações, IA, equipe)
// Bradata CRM — screen module
// Globals expected: React, window.DATA, window.I (icons), window.UI (primitives)

function Settings() {
  return (
    <>
      <div className="page-head">
        <h1 className="page-title">Configurações</h1>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><div className="card-title">Integração PNCP</div><span className="chip success"><I.check size={10}/>Ativa</span></div>
          <div className="card-p">
            <div className="setting-row"><div><strong>Endpoint API</strong><div className="muted" style={{fontSize:11.5}}>pncp.gov.br/api/consulta</div></div><span className="chip">v1.2</span></div>
            <div className="setting-row"><div><strong>Frequência de sync</strong><div className="muted" style={{fontSize:11.5}}>A cada 15 minutos</div></div><button className="btn btn-xs btn-ghost">Alterar</button></div>
            <div className="setting-row"><div><strong>Última sync</strong><div className="muted" style={{fontSize:11.5}}>há 8 min · 127 novos contratos</div></div><button className="btn btn-xs btn-ghost"><I.refresh size={10}/>Agora</button></div>
            <div className="setting-row" style={{borderBottom:'none'}}><div><strong>Filtros ativos</strong><div className="muted" style={{fontSize:11.5}}>TI · 100MM+ · todas UFs</div></div><button className="btn btn-xs btn-ghost">Editar</button></div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Bradata AI</div><span className="chip primary"><I.sparkle size={10}/>Claude Haiku</span></div>
          <div className="card-p">
            <div className="setting-row"><div><strong>Scoring automático</strong><div className="muted" style={{fontSize:11.5}}>Re-calcula a cada lead novo</div></div><Toggle on={true}/></div>
            <div className="setting-row"><div><strong>Resumo de contas</strong><div className="muted" style={{fontSize:11.5}}>Gera briefing antes de calls</div></div><Toggle on={true}/></div>
            <div className="setting-row"><div><strong>Alertas inteligentes</strong><div className="muted" style={{fontSize:11.5}}>SLA, follow-ups, riscos</div></div><Toggle on={true}/></div>
            <div className="setting-row" style={{borderBottom:'none'}}><div><strong>Sugestão de cadência</strong><div className="muted" style={{fontSize:11.5}}>Próximo passo ideal por lead</div></div><Toggle on={false}/></div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Equipe</div><button className="btn btn-xs btn-accent"><I.plus size={10}/>Convidar</button></div>
          <div className="card-p" style={{padding:0}}>
            {[
              {n:'Rafael Marques', r:'Admin · Founder', e:'rafael@bradata.com.br'},
              {n:'Amanda Costa', r:'Sales Lead', e:'amanda@bradata.com.br'},
              {n:'Tiago Alencar', r:'AE', e:'tiago@bradata.com.br'},
              {n:'Bianca Lima', r:'SDR', e:'bianca@bradata.com.br'},
            ].map((p,i,a) => (
              <div key={p.n} style={{display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:i<a.length-1?'1px solid hsl(var(--border))':'none'}}>
                <UI.Avatar name={p.n} size={32}/>
                <div style={{flex:1}}>
                  <strong style={{fontSize:13}}>{p.n}</strong>
                  <div className="muted" style={{fontSize:11}}>{p.r} · {p.e}</div>
                </div>
                <button className="icon-btn"><I.more size={14}/></button>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Aparência</div></div>
          <div className="card-p">
            <div className="setting-row"><div><strong>Tema</strong><div className="muted" style={{fontSize:11.5}}>Claro / Escuro (no topo da sidebar)</div></div></div>
            <div className="setting-row" style={{borderBottom:'none'}}><div><strong>Densidade</strong><div className="muted" style={{fontSize:11.5}}>Confortável (ajustável via Tweaks)</div></div></div>
          </div>
        </div>
      </div>
    </>
  );
}

window.Settings = Settings;

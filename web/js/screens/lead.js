function LeadDetail({ companyId, onBack }) {
  const { fmt, COMPANIES, PNCP_CONTRACTS, DEALS } = window.DATA;
  const c = COMPANIES[companyId] || Object.values(COMPANIES)[0];
  const [contatos, setContatos] = React.useState([]);
  const [loadingC, setLoadingC] = React.useState(false);
  const [enriching, setEnriching] = React.useState(false);
  const [enrichMsg, setEnrichMsg] = React.useState(null);
  const [emailFor, setEmailFor] = React.useState(null);   // contato selecionado para envio
  const [timeline, setTimeline] = React.useState([]);
  const [loadingTl, setLoadingTl] = React.useState(false);
  const [full, setFull] = React.useState(null);
  const [loadingFull, setLoadingFull] = React.useState(false);
  const [autoEnrichTried, setAutoEnrichTried] = React.useState(false);

  const loadContatos = React.useCallback(() => {
    if (!c?.id) return;
    setLoadingC(true);
    window.API.api(`/empresas/${c.id}/contatos`)
      .then(xs => { setContatos(xs || []); setLoadingC(false); })
      .catch(() => setLoadingC(false));
  }, [c?.id]);
  React.useEffect(loadContatos, [loadContatos]);

  const loadTimeline = React.useCallback(() => {
    if (!c?.id) return;
    setLoadingTl(true);
    window.API.api(`/empresas/${c.id}/timeline?limit=80`)
      .then(items => { setTimeline(items || []); setLoadingTl(false); })
      .catch(() => setLoadingTl(false));
  }, [c?.id]);
  React.useEffect(loadTimeline, [loadTimeline]);

  const loadFull = React.useCallback(() => {
    if (!c?.id) return;
    setLoadingFull(true);
    window.API.api(`/empresas/${c.id}/full`)
      .then(d => { setFull(d); setLoadingFull(false); })
      .catch(() => setLoadingFull(false));
  }, [c?.id]);
  React.useEffect(loadFull, [loadFull]);

  // Auto-enrich CNPJ.WS se a empresa ainda não foi enriquecida
  React.useEffect(() => {
    if (!full || autoEnrichTried || full.dados_enriquecidos) return;
    setAutoEnrichTried(true);
    const t = setTimeout(() => {
      window.API.api(`/empresas/${c.id}/enriquecer`, { method: 'POST' })
        .then(() => loadFull())
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [full, autoEnrichTried, c?.id, loadFull]);

  if (!c) {
    return (
      <div className="page-head">
        <div>
          <button className="btn btn-xs btn-ghost" onClick={onBack}>Voltar</button>
          <h1 className="page-title">Nenhuma empresa selecionada</h1>
          <div className="page-sub">Abra a aba Contas para escolher um lead.</div>
        </div>
      </div>
    );
  }

  const contracts = PNCP_CONTRACTS.filter(p => p.cnpj_fornecedor === c.cnpj);
  const deals = DEALS.filter(d => String(d.company) === String(c.id));
  const totalPncp = contracts.reduce((s,p)=>s+(p.valor||0),0);

  const enriquecerLusha = async () => {
    setEnriching(true);
    setEnrichMsg(null);
    try {
      const r = await window.API.api(`/empresas/${c.id}/enriquecer-lusha`, { method: 'POST' });
      if (r.erro) {
        setEnrichMsg({ tone: 'warn', text: `Lusha: ${r.erro} (domínio tentado: ${r.dominio || '—'})` });
      } else {
        setEnrichMsg({
          tone: 'success',
          text: `Lusha: ${r.novos} novo${r.novos===1?'':'s'} contato${r.novos===1?'':'s'}, ${r.ja_existentes} já existente${r.ja_existentes===1?'':'s'} (domínio: ${r.dominio}).`,
        });
      }
      loadContatos();
    } catch (e) {
      setEnrichMsg({ tone: 'danger', text: e.message });
    } finally {
      setEnriching(false);
    }
  };

  const enriquecerCnpj = async () => {
    setEnriching(true);
    setEnrichMsg(null);
    try {
      const r = await window.API.api(`/empresas/${c.id}/enriquecer`, { method: 'POST' });
      if (r.website || r.email) {
        setEnrichMsg({ tone: 'success', text: `CNPJ.WS: dados básicos preenchidos. Website: ${r.website || '—'}` });
        await window.API.refresh(); // recarrega DATA pra mostrar website
      } else {
        setEnrichMsg({ tone: 'warn', text: 'CNPJ.WS retornou sem website nem email — empresa pode não ter cadastro ativo.' });
      }
    } catch (e) {
      setEnrichMsg({ tone: 'danger', text: e.message });
    } finally {
      setEnriching(false);
    }
  };

  const semDominio = !c.website;

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn btn-xs btn-ghost" onClick={onBack} style={{marginBottom:8}}><I.chevron size={10} style={{transform:'rotate(180deg)'}}/>Voltar</button>
          <div className="row" style={{gap:16}}>
            <UI.Avatar name={c.name} size={56}/>
            <div>
              <div className="row" style={{gap:10, alignItems:'center', flexWrap:'wrap'}}>
                <h1 className="page-title" style={{margin:0}}>{c.name}</h1>
                <OriginChip full={full}/>
              </div>
              <div className="row" style={{gap:8, marginTop:4, flexWrap:'wrap'}}>
                <span className="mono muted" style={{fontSize:12}}>{fmt.cnpj(c.cnpj)}</span>
                <span className="muted">·</span>
                <span className="muted" style={{fontSize:13}}>{c.city}, {c.uf}</span>
                {c.website && <><span className="muted">·</span><a href={`https://${c.website}`} target="_blank" rel="noreferrer" style={{color:'hsl(var(--b-accent))', fontSize:13}}>{c.website}</a></>}
                {full && full.totalContratos > 0 && (
                  <>
                    <span className="muted">·</span>
                    <span className="chip success" style={{fontSize:10.5}}>
                      {full.totalContratos} contrato{full.totalContratos===1?'':'s'} PNCP
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="actions">
          {semDominio && (
            <button className="btn btn-ghost btn-sm" onClick={enriquecerCnpj} disabled={enriching}>
              <I.refresh size={12}/>{enriching ? 'Buscando…' : 'Buscar dados na Receita (CNPJ.WS)'}
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={enriquecerLusha} disabled={enriching || semDominio} title={semDominio ? 'Enriqueça o CNPJ primeiro pra ter o domínio' : ''}>
            <I.phone size={12}/>{enriching ? 'Buscando…' : 'Enriquecer contatos (Lusha)'}
          </button>
          <button className="btn btn-accent btn-sm"><I.plus size={12}/>Nova oportunidade</button>
        </div>
      </div>

      {/* Card resumo CNPJ — KPIs do topo */}
      <CnpjSummaryCard
        full={full}
        loading={loadingFull}
        onRefresh={() => {
          window.API.api(`/empresas/${c.id}/enriquecer`, { method:'POST' })
            .then(() => loadFull())
            .catch(()=>{});
        }}
      />

      {/* 6 KPIs de Contratos */}
      <ContractsKpiGrid full={full}/>

      {/* Análise IA + Informações + Tipos de Serviço + Prioridades */}
      <ContractsAnalysisGrid full={full}/>

      {semDominio && !enrichMsg && (
        <div style={{
          padding:'12px 16px', marginBottom:'var(--gap)', borderRadius:10, fontSize:13,
          background:'hsl(var(--warning-soft))', color:'hsl(var(--warning))',
          border:'1px solid hsl(var(--warning) / .3)', display:'flex', gap:10, alignItems:'center'
        }}>
          <I.sparkle size={14}/>
          <div style={{flex:1}}>
            Esta empresa veio do PNCP sem website/email. <strong>Enriqueça com a Receita Federal (CNPJ.WS)</strong> primeiro — depois a Lusha consegue achar contatos.
          </div>
          <button className="btn btn-xs btn-accent" onClick={enriquecerCnpj} disabled={enriching}>
            Enriquecer agora
          </button>
        </div>
      )}

      {enrichMsg && (
        <div style={{
          padding:'12px 16px', marginBottom:'var(--gap)', borderRadius:10, fontSize:13,
          background: enrichMsg.tone==='success' ? 'hsl(var(--success-soft))' :
                      enrichMsg.tone==='danger'  ? 'hsl(var(--danger-soft))' :
                                                    'hsl(var(--warning-soft))',
          color: enrichMsg.tone==='success' ? 'hsl(var(--success))' :
                 enrichMsg.tone==='danger'  ? 'hsl(var(--danger))' :
                                               'hsl(var(--warning))',
          border: `1px solid ${enrichMsg.tone==='success' ? 'hsl(var(--success) / .25)' : enrichMsg.tone==='danger' ? 'hsl(var(--danger) / .25)' : 'hsl(var(--warning) / .25)'}`,
        }}>{enrichMsg.text}</div>
      )}

      <div className="grid-dash">
        <div style={{display:'flex', flexDirection:'column', gap:'var(--gap)'}}>
          {/* Dados da empresa (FornecedorInfoCard) */}
          <FornecedorInfoCard full={full} c={c}/>

          {/* Contatos */}
          <div className="card">
            <div className="card-head">
              <div><div className="card-title">Contatos</div><div className="card-sub">{contatos.length} no banco · Lusha cache permanente</div></div>
              <button className="btn btn-xs btn-ghost" onClick={enriquecerLusha} disabled={enriching}><I.sparkle size={10}/>{enriching ? '…' : 'Buscar Lusha'}</button>
            </div>
            <div className="card-p" style={{padding:0}}>
              {loadingC && <div style={{padding:20, textAlign:'center', color:'hsl(var(--fg-muted))'}}>Carregando…</div>}
              {!loadingC && contatos.length === 0 && (
                <div style={{padding:24, textAlign:'center'}}>
                  <div className="muted" style={{marginBottom:10}}>Nenhum contato ainda.</div>
                  <button className="btn btn-sm btn-accent" onClick={enriquecerLusha} disabled={enriching}>
                    <I.sparkle size={12}/>{enriching ? 'Buscando…' : 'Enriquecer com Lusha'}
                  </button>
                </div>
              )}
              {contatos.map(p => (
                <div key={p.id} style={{padding:'14px 24px', borderBottom:'1px solid hsl(var(--border))', display:'grid', gridTemplateColumns:'36px 1fr auto', gap:14, alignItems:'center'}}>
                  <UI.Avatar name={p.nome} size={36}/>
                  <div style={{minWidth:0}}>
                    <div className="row" style={{gap:8}}>
                      <strong style={{fontSize:13.5}}>{p.nome}</strong>
                      {p.decisor && <span className="chip warn" style={{fontSize:9.5, padding:'1px 6px'}}>decisor</span>}
                      {p.fonte === 'lusha' && <span className="chip primary" style={{fontSize:9.5, padding:'1px 6px'}}>Lusha</span>}
                    </div>
                    <div className="muted" style={{fontSize:12, marginTop:2}}>{p.cargo || '—'}</div>
                    <div className="row" style={{gap:14, marginTop:4, fontSize:11.5, flexWrap:'wrap'}}>
                      {p.email && <span className="mono">{p.email}</span>}
                      {p.telefone && <span className="mono">📞 {p.telefone}</span>}
                      {p.celular && <span className="mono">📱 {p.celular}</span>}
                    </div>
                  </div>
                  <div className="row" style={{gap:4}}>
                    {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="icon-btn" title="LinkedIn"><I.linkedin size={14}/></a>}
                    {p.email && <button className="icon-btn" title="Enviar e-mail (SMTP)" onClick={() => setEmailFor(p)}><I.mail size={14}/></button>}
                    {p.email && <a href={`mailto:${p.email}`} className="icon-btn" title="Abrir cliente de e-mail"><I.send size={14}/></a>}
                    {p.telefone && <a href={`tel:${p.telefone}`} className="icon-btn" title="Ligar"><I.phone size={14}/></a>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Candidates Lusha (lista pré-revelação) */}
          <LushaCandidatesCard empresaId={c.id} onRevealed={loadContatos}/>

          {/* Tabela completa de Contratos PNCP */}
          <ContratosTable full={full}/>

          {/* Timeline 360° */}
          <TimelinePanel
            items={timeline}
            loading={loadingTl}
            onReload={loadTimeline}
            empresaId={c.id}
          />
        </div>

        <div style={{display:'flex', flexDirection:'column', gap:'var(--gap)'}}>
          <div className="card halo">
            <div className="card-p" style={{textAlign:'center'}}>
              <div className="card-section-title">Bradata Score</div>
              <UI.ScoreRing value={c.score} size={100} stroke={8}/>
              <div style={{marginTop:10, fontWeight:700, fontSize:13, color: c.score>=80?'hsl(var(--success))':c.score>=60?'hsl(var(--warning))':'hsl(var(--fg-muted))'}}>
                {c.score >= 80 ? '🔥 Lead prioritário' : c.score >= 60 ? 'Potencial médio' : 'Baixa prioridade'}
              </div>
            </div>
          </div>

          {deals.length>0 && (
            <div className="card">
              <div className="card-head"><div className="card-title">Oportunidades</div><span className="chip">{deals.length}</span></div>
              <div className="card-p" style={{padding:0}}>
                {deals.map(d => (
                  <div key={d.id} style={{padding:'14px 24px', borderBottom:'1px solid hsl(var(--border))'}}>
                    <div style={{fontSize:12.5, fontWeight:600}}>{d.title}</div>
                    <div className="row-between" style={{fontSize:11.5, marginTop:4}}>
                      <span className="chip" style={{fontSize:10}}>{window.DATA.STAGES.find(s=>s.id===d.stage)?.label}</span>
                      <strong className="mono">{fmt.brlK(d.value)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {emailFor && (
        <EmailModal contato={emailFor} empresa={c} onClose={() => setEmailFor(null)} onSent={() => { setEmailFor(null); loadContatos(); }}/>
      )}
    </>
  );
}

function EmailModal({ contato, empresa, onClose, onSent }) {
  const [templates, setTemplates] = React.useState([]);
  const [tplId, setTplId] = React.useState('');
  const [assunto, setAssunto] = React.useState('');
  const [corpo, setCorpo] = React.useState('');
  const [html, setHtml] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [msg, setMsg] = React.useState(null);
  const [preview, setPreview] = React.useState(null);

  React.useEffect(() => {
    window.API.api('/automacoes?kind=template_email&ativo=true')
      .then(setTemplates).catch(()=>{});
  }, []);

  const applyTemplate = (id) => {
    setTplId(id);
    const t = templates.find(x => String(x.id) === String(id));
    if (t) { setAssunto(t.assunto || ''); setCorpo(t.corpo || ''); }
  };

  const doPreview = async () => {
    setMsg(null);
    try {
      const r = await window.API.api(`/contatos/${contato.id}/preview-email`, {
        method: 'POST',
        body: JSON.stringify({
          automacao_id: tplId ? Number(tplId) : null,
          assunto, corpo,
        }),
      });
      setPreview(r);
    } catch (e) { setMsg({ tone:'danger', text: e.message }); }
  };

  const doSend = async () => {
    setSending(true); setMsg(null);
    try {
      const r = await window.API.api(`/contatos/${contato.id}/enviar-email`, {
        method: 'POST',
        body: JSON.stringify({
          automacao_id: tplId ? Number(tplId) : null,
          assunto, corpo, html,
        }),
      });
      setMsg({ tone:'success', text:`Enviado para ${r.para}` });
      setTimeout(onSent, 800);
    } catch (e) {
      setMsg({ tone:'danger', text: e.message || 'Falha no envio' });
    } finally { setSending(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:680}}>
        <div className="modal-head">
          <div>
            <div className="card-title">Enviar e-mail</div>
            <div className="muted" style={{fontSize:12}}>Para: <strong>{contato.nome}</strong> &lt;{contato.email}&gt; · {empresa?.name}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><I.x size={16}/></button>
        </div>
        <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:12}}>
          <div>
            <label className="card-section-title">Template (opcional)</label>
            <select className="input" value={tplId} onChange={e => applyTemplate(e.target.value)}>
              <option value="">— sem template —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="card-section-title">Assunto</label>
            <input className="input" value={assunto} onChange={e=>setAssunto(e.target.value)} placeholder="Olá {{nome}}, ..."/>
          </div>
          <div>
            <label className="card-section-title">Corpo · use {`{{nome}}`}, {`{{empresa}}`}, {`{{cargo}}`}, {`{{remetente}}`}</label>
            <textarea className="input" rows={10} value={corpo} onChange={e=>setCorpo(e.target.value)} placeholder="Oi {{nome}}, vi que a {{empresa}} ..."/>
          </div>
          <label className="row" style={{gap:6, fontSize:12}}>
            <input type="checkbox" checked={html} onChange={e=>setHtml(e.target.checked)}/> corpo é HTML
          </label>
          {preview && (
            <div className="card" style={{padding:12, background:'hsl(var(--bg-soft))'}}>
              <div className="card-section-title">Preview renderizado</div>
              <div style={{fontWeight:700, fontSize:13}}>{preview.assunto}</div>
              <pre style={{whiteSpace:'pre-wrap', fontSize:12, marginTop:6}}>{preview.corpo}</pre>
            </div>
          )}
          {msg && (
            <div style={{
              padding:'10px 12px', borderRadius:8, fontSize:12.5,
              background: msg.tone==='success'?'hsl(var(--success-soft))':'hsl(var(--danger-soft))',
              color: msg.tone==='success'?'hsl(var(--success))':'hsl(var(--danger))',
            }}>{msg.text}</div>
          )}
        </div>
        <div className="modal-foot" style={{display:'flex', justifyContent:'space-between'}}>
          <button className="btn btn-sm btn-ghost" onClick={doPreview} disabled={sending || !corpo}>Preview</button>
          <div className="row" style={{gap:8}}>
            <button className="btn btn-sm btn-ghost" onClick={onClose}>Cancelar</button>
            <button className="btn btn-sm btn-accent" onClick={doSend} disabled={sending || !corpo}>
              <I.send size={12}/>{sending ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, hot }) {
  return (
    <div>
      <div className="card-section-title" style={{marginBottom:4}}>{label}</div>
      <div style={{fontSize:15, fontWeight:700, color: hot?'hsl(var(--b-accent))':'hsl(var(--fg))'}}>
        {value || '—'} {hot && <I.fire size={12} style={{display:'inline', verticalAlign:'middle'}}/>}
      </div>
    </div>
  );
}

function TimelinePanel({ items, loading, onReload, empresaId }) {
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [filter, setFilter] = React.useState('all');  // all | atividade | nota | historico

  const addNota = async () => {
    const txt = draft.trim();
    if (!txt) return;
    setSaving(true);
    try {
      await window.API.api('/notas', {
        method: 'POST',
        body: JSON.stringify({ conteudo: txt, empresa_id: empresaId }),
      });
      setDraft('');
      onReload();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  const filtered = items.filter(ev => filter === 'all' || ev.kind === filter);
  const counts = items.reduce((acc, ev) => { acc[ev.kind] = (acc[ev.kind] || 0) + 1; return acc; }, {});

  // Agrupa por mês (yyyy-MM)
  const groupedByMonth = React.useMemo(() => {
    const groups = new Map();
    filtered.forEach(ev => {
      const d = new Date(ev.ts);
      if (isNaN(d.getTime())) return;
      const key = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ev);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>
            <I.clock size={14}/>Timeline 360°
            <span className="chip" style={{fontSize:10}}>{items.length}</span>
          </div>
          <div className="card-sub">Tudo que aconteceu — atividades, notas, oportunidades</div>
        </div>
        <button className="btn btn-xs btn-ghost" onClick={onReload} title="Recarregar"><I.refresh size={10}/></button>
      </div>

      {/* Caixa de nota inline */}
      <div style={{padding:'14px 24px', borderBottom:'1px solid hsl(var(--border))'}}>
        <div className="row" style={{gap:8, alignItems:'flex-start'}}>
          <div style={{
            width:32, height:32, borderRadius:'50%',
            background:'hsl(var(--warning) / .15)', color:'hsl(var(--warning))',
            display:'grid', placeItems:'center', flex:'0 0 auto',
          }}><I.doc size={14}/></div>
          <div style={{flex:1, minWidth:0}}>
            <textarea
              className="input"
              placeholder="Adicionar uma nota… (Ctrl+Enter envia)"
              rows={2}
              value={draft}
              onChange={e=>setDraft(e.target.value)}
              onKeyDown={e=>{ if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addNota(); } }}
              style={{resize:'vertical', fontSize:13, fontFamily:'inherit'}}
            />
            <div className="row-between" style={{marginTop:6}}>
              <span className="muted" style={{fontSize:11}}>Visível pra todo o time</span>
              <button className="btn btn-xs btn-accent" onClick={addNota} disabled={saving || !draft.trim()}>
                {saving ? 'Salvando…' : 'Adicionar nota'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros segmentados */}
      {items.length > 0 && (
        <div style={{padding:'10px 24px', borderBottom:'1px solid hsl(var(--border))', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
          <I.target size={11} style={{color:'hsl(var(--fg-muted))'}}/>
          <div className="segment-ctrl" style={{flexWrap:'wrap'}}>
            <button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>
              Todos <span style={{opacity:.6, marginLeft:4}}>{items.length}</span>
            </button>
            {counts.atividade > 0 && <button className={filter==='atividade'?'active':''} onClick={()=>setFilter('atividade')}>Atividades <span style={{opacity:.6, marginLeft:4}}>{counts.atividade}</span></button>}
            {counts.nota > 0 && <button className={filter==='nota'?'active':''} onClick={()=>setFilter('nota')}>Notas <span style={{opacity:.6, marginLeft:4}}>{counts.nota}</span></button>}
            {counts.historico > 0 && <button className={filter==='historico'?'active':''} onClick={()=>setFilter('historico')}>Eventos <span style={{opacity:.6, marginLeft:4}}>{counts.historico}</span></button>}
          </div>
        </div>
      )}

      <div style={{padding:0, maxHeight:600, overflowY:'auto'}}>
        {loading && <div style={{padding:20, textAlign:'center'}} className="muted">Carregando…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{padding:24, textAlign:'center'}} className="muted">
            Nenhum evento ainda. Comece adicionando uma nota acima.
          </div>
        )}
        {!loading && Array.from(groupedByMonth.entries()).map(([month, evs]) => (
          <div key={month}>
            <div style={{
              position:'sticky', top:0, zIndex:1,
              padding:'8px 24px',
              background:'hsl(var(--surface-2, var(--surface)) / .95)',
              backdropFilter:'blur(8px)',
              borderBottom:'1px solid hsl(var(--border))',
              fontSize:10, fontWeight:700,
              textTransform:'uppercase', letterSpacing:'.08em',
              color:'hsl(var(--fg-muted))',
              display:'flex', justifyContent:'space-between', alignItems:'center',
            }}>
              <span>{month}</span>
              <span className="muted" style={{fontWeight:500, letterSpacing:0, textTransform:'none'}}>
                {evs.length} {evs.length === 1 ? 'evento' : 'eventos'}
              </span>
            </div>
            {evs.map((ev, i) => <TimelineRow key={`${ev.kind}-${ev.id}-${i}`} ev={ev}/>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineRow({ ev }) {
  const { fmt } = window.DATA;
  const ts = new Date(ev.ts);
  const dateStr = ts.toLocaleString('pt-BR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });

  let icon, color, title, body;
  if (ev.kind === 'atividade') {
    const d = ev.data;
    const tipoIcon = { ligacao:'phone', email:'mail', reuniao:'users', whatsapp:'phone', visita:'building', linkedin:'linkedin', tarefa:'check', outro:'sparkle' };
    icon = I[tipoIcon[d.tipo] || 'check'];
    color = d.status === 'concluida' ? 'hsl(var(--success))' :
            d.prioridade === 'alta' || d.prioridade === 'urgente' ? 'hsl(var(--danger))' :
            'hsl(var(--info))';
    title = d.titulo;
    body = (
      <>
        <span className="chip" style={{fontSize:10, padding:'1px 5px'}}>{d.tipo}</span>
        <span className="chip" style={{fontSize:10, padding:'1px 5px',
          background: d.status === 'concluida' ? 'hsl(var(--success-soft))' : 'hsl(var(--surface-2))',
          color: d.status === 'concluida' ? 'hsl(var(--success))' : 'inherit'}}>{d.status}</span>
        {d.descricao && <span className="muted" style={{fontSize:11.5}}>{d.descricao.slice(0, 120)}</span>}
      </>
    );
  } else if (ev.kind === 'nota') {
    const d = ev.data;
    icon = I.doc;
    color = 'hsl(var(--warning))';
    title = 'Nota';
    body = (
      <span style={{fontSize:12.5, whiteSpace:'pre-wrap', lineHeight:1.5}}>
        {(d.conteudo || d.texto || '').slice(0, 400)}
      </span>
    );
  } else if (ev.kind === 'historico') {
    const d = ev.data;
    icon = d.acao.startsWith('fechou_ganha') ? I.check :
           d.acao.startsWith('fechou_perdida') ? I.x :
           d.acao.includes('estagio') ? I.kanban : I.sparkle;
    color = d.acao.includes('ganha') ? 'hsl(var(--success))' :
            d.acao.includes('perdida') || d.acao.includes('excluiu') ? 'hsl(var(--danger))' :
            'hsl(var(--b-accent))';
    title = formatHistoricoAcao(d.acao, d.entity_type);
    const changes = d.changes || {};
    const parts = [];
    if (changes.titulo) parts.push(`"${changes.titulo}"`);
    if (changes.valor || changes.valor_estimado) parts.push(fmt.brlK(changes.valor || changes.valor_estimado));
    if (changes.motivo) parts.push(`motivo: ${changes.motivo}`);
    if (changes.de_estagio_id != null && changes.para_estagio_id != null) {
      const stages = window.DATA.STAGES;
      const de = stages.find(s => String(s.id) === String(changes.de_estagio_id))?.label || changes.de_estagio_id;
      const para = stages.find(s => String(s.id) === String(changes.para_estagio_id))?.label || changes.para_estagio_id;
      parts.push(`${de} → ${para}`);
    }
    if (changes.campos) parts.push(changes.campos.join(', '));
    body = (
      <>
        {d.user_nome && <span className="muted" style={{fontSize:11.5}}>{d.user_nome}</span>}
        {parts.length > 0 && <span className="mono" style={{fontSize:11.5}}>{parts.join(' · ')}</span>}
      </>
    );
  } else {
    icon = I.sparkle; color = 'hsl(var(--fg-muted))'; title = ev.kind; body = null;
  }

  return (
    <div style={{display:'grid', gridTemplateColumns:'32px 1fr auto', gap:12, padding:'14px 24px', borderBottom:'1px solid hsl(var(--border))'}}>
      <div style={{
        width:32, height:32, borderRadius:'50%', background:`${color}22`, color,
        display:'grid', placeItems:'center', flex:'0 0 auto',
      }}>
        {React.createElement(icon, { size: 14 })}
      </div>
      <div style={{minWidth:0}}>
        <div style={{fontSize:13, fontWeight:600, marginBottom:3}}>{title}</div>
        <div className="row" style={{gap:8, flexWrap:'wrap', alignItems:'center'}}>{body}</div>
      </div>
      <div className="muted" style={{fontSize:11, textAlign:'right', whiteSpace:'nowrap'}}>{dateStr}</div>
    </div>
  );
}

function formatHistoricoAcao(acao, entity_type) {
  const map = {
    'criou': 'Oportunidade criada',
    'mudou_estagio': 'Mudou de estágio',
    'reatribuiu': 'Reatribuída',
    'atualizou': 'Editada',
    'fechou_ganha': '🎉 Fechada como GANHA',
    'fechou_perdida': 'Fechada como perdida',
    'excluiu': 'Excluída',
    'status_concluida': 'Atividade concluída',
    'status_cancelada': 'Atividade cancelada',
    'status_em_andamento': 'Em andamento',
    'status_pendente': 'Rependente',
    'status_enviada': 'Proposta enviada',
    'status_aceita': '✓ Proposta aceita',
    'status_rejeitada': 'Proposta rejeitada',
    'status_em_analise': 'Em análise',
    'status_expirada': 'Expirada',
  };
  const t = entity_type === 'oportunidade' ? '' :
            entity_type === 'proposta' ? 'Proposta: ' :
            entity_type === 'atividade' ? 'Atividade: ' : '';
  return t + (map[acao] || acao);
}

// =================================================================
// CnpjSummaryCard — KPIs do topo (anos, porte, setor, faturamento, etc)
// =================================================================
function CnpjSummaryCard({ full, loading, onRefresh }) {
  const { fmt } = window.DATA;
  const [refreshing, setRefreshing] = React.useState(false);

  if (loading && !full) {
    return (
      <div className="card" style={{padding:14, marginBottom:'var(--gap)'}}>
        <div className="muted" style={{fontSize:12.5, textAlign:'center'}}>Carregando dados do CNPJ…</div>
      </div>
    );
  }
  if (!full) return null;

  const enriched = full.dados_enriquecidos;
  const dataEnriq = full.data_enriquecimento ? new Date(full.data_enriquecimento) : null;
  const ageYears = full.data_abertura
    ? Math.max(0, Math.floor((Date.now() - new Date(full.data_abertura).getTime()) / (365.25 * 86400000)))
    : null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try { await onRefresh?.(); } finally { setRefreshing(false); }
  };

  // Estado: ainda não enriquecido — mostra warning + botão buscar
  if (!enriched) {
    return (
      <div className="card" style={{
        padding:14, marginBottom:'var(--gap)',
        background:'hsl(var(--warning-soft))',
        border:'1px solid hsl(var(--warning) / .3)',
      }}>
        <div className="row-between" style={{flexWrap:'wrap', gap:10}}>
          <div className="row" style={{gap:10, alignItems:'center'}}>
            <I.sparkle size={16} style={{color:'hsl(var(--warning))'}}/>
            <span style={{color:'hsl(var(--warning))', fontSize:13.5}}>
              Dados do CNPJ ainda não foram enriquecidos
            </span>
          </div>
          <button className="btn btn-xs" onClick={handleRefresh} disabled={refreshing}
            style={{borderColor:'hsl(var(--warning))', color:'hsl(var(--warning))', background:'transparent'}}>
            <I.refresh size={11}/>{refreshing ? 'Buscando…' : 'Buscar dados CNPJ'}
          </button>
        </div>
      </div>
    );
  }

  // KPIs visuais
  const kpis = [
    ageYears != null && {
      icon: I.clock, color:'hsl(var(--b-accent))',
      value: ageYears, label: ageYears === 1 ? 'ano' : 'anos',
    },
    full.porte && {
      icon: I.building, color:'hsl(var(--warning))',
      value: full.porte.replace('Empresa de ', '').replace(' Porte', ''), label:'porte',
    },
    full.setor && {
      icon: I.target, color:'hsl(var(--success))',
      value: full.setor, label:'setor', truncate: true,
    },
    full.faixa_faturamento && {
      icon: I.chart, color:'hsl(var(--info))',
      value: full.faixa_faturamento, label:'faturamento', truncate: true, small: true,
    },
    full.capital_social && {
      icon: I.money, color:'hsl(var(--b-accent))',
      value: fmt.brlK(full.capital_social), label:'capital',
    },
    (full.socios && full.socios.length > 0) && {
      icon: I.users, color:'hsl(var(--warning))',
      value: full.socios.length, label: full.socios.length === 1 ? 'sócio' : 'sócios',
    },
  ].filter(Boolean);

  return (
    <div className="card" style={{padding:14, marginBottom:'var(--gap)'}}>
      {/* Header — status + botão refresh */}
      <div className="row-between" style={{marginBottom:12, flexWrap:'wrap', gap:8}}>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <I.check size={13} style={{color:'hsl(var(--success))'}}/>
          <span className="muted" style={{fontSize:11.5}}>
            Dados atualizados{dataEnriq && ` em ${dataEnriq.toLocaleDateString('pt-BR', {day:'2-digit', month:'2-digit', year:'2-digit'})}`}
          </span>
        </div>
        <button className="icon-btn" onClick={handleRefresh} disabled={refreshing} title="Atualizar dados CNPJ"
          style={{width:28, height:28}}>
          <I.refresh size={12} style={refreshing ? {animation:'spin 0.8s linear infinite'} : {}}/>
        </button>
      </div>

      {/* Grid de KPIs */}
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:10}}>
        {kpis.map((k, i) => (
          <div key={i} style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'10px 12px', borderRadius:8,
            background:'hsl(var(--surface-2, var(--surface)))',
            border:'1px solid hsl(var(--border))',
            minWidth:0,
          }}>
            <div style={{
              width:34, height:34, borderRadius:8,
              background:`${k.color}22`, color: k.color,
              display:'grid', placeItems:'center', flex:'0 0 auto',
            }}>
              {React.createElement(k.icon, { size:14 })}
            </div>
            <div style={{minWidth:0, flex:1}}>
              <div style={{
                fontSize: k.small ? 11.5 : 16,
                fontWeight: 700,
                color:'hsl(var(--fg))',
                lineHeight: 1.2,
                ...(k.truncate ? { overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } : {}),
              }} title={k.truncate ? k.value : undefined}>
                {k.value}
              </div>
              <div className="muted" style={{fontSize:10.5, marginTop:2}}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Linha de status — situação cadastral, regime, natureza */}
      {(full.situacao_cadastral || full.regime_tributario || full.natureza_juridica) && (
        <div className="row" style={{gap:8, marginTop:12, flexWrap:'wrap', alignItems:'center'}}>
          {full.situacao_cadastral && (
            <span className={`chip ${full.situacao_cadastral.toLowerCase() === 'ativa' ? 'success' : 'danger'}`}
              style={{fontSize:10.5}}>
              {full.situacao_cadastral}
            </span>
          )}
          {full.regime_tributario && (
            <span className="chip" style={{fontSize:10.5}}>{full.regime_tributario}</span>
          )}
          {full.natureza_juridica && (
            <span className="muted" style={{fontSize:11.5, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:280}}
              title={full.natureza_juridica}>
              {full.natureza_juridica}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// =================================================================
// ContractsKpiGrid — 6 KPIs (Contratos / Valor / Ticket / Órgãos / Relevância IA / Vigência)
// =================================================================
function ContractsKpiGrid({ full }) {
  const { fmt } = window.DATA;
  if (!full) return null;
  const contratos = full.contratos || [];
  const total = full.totalContratos || contratos.length || 0;
  // Empresa sem contratos PNCP (provavelmente cliente cadastrado manualmente):
  // não mostra esse bloco — evita 6 cards vazios poluindo a tela
  if (total === 0) return null;
  const valor = full.valorTotal || 0;
  const ticket = total > 0 ? valor / total : 0;
  const orgaosUnicos = new Set(contratos.map(c => c.orgao_nome).filter(Boolean));
  const relevantes = contratos.filter(c => c.classificacao_ia === 'SIM' || c.classificacao_ia === 'sim').length;
  const taxaRelevancia = total > 0 ? Math.round((relevantes / total) * 100) : 0;
  const dias = contratos.map(c => c.dias_vigencia).filter(d => d != null && d > 0);
  const mediaVigencia = dias.length > 0 ? Math.round(dias.reduce((s, d) => s + d, 0) / dias.length) : 0;

  const cards = [
    { label:'Contratos', value: total, icon: I.doc, color:'hsl(var(--b-accent))' },
    { label:'Valor Total', value: fmt.brlK(valor), icon: I.money, color:'hsl(var(--success))' },
    { label:'Ticket Médio', value: fmt.brlK(ticket), icon: I.chart, color:'hsl(var(--info))' },
    { label:'Órgãos', value: orgaosUnicos.size, icon: I.building, color:'hsl(var(--warning))' },
    { label:'Relevância IA', value: `${taxaRelevancia}%`, icon: I.target, color:'hsl(var(--b-accent))' },
    { label:'Dias Méd. Vigência', value: mediaVigencia || '—', icon: I.clock, color:'hsl(var(--success))' },
  ];

  return (
    <div style={{
      display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))',
      gap:10, marginBottom:'var(--gap)',
    }}>
      {cards.map((k, i) => (
        <div key={i} className="card" style={{padding:14}}>
          <div className="row" style={{gap:10, alignItems:'center'}}>
            <div style={{
              width:36, height:36, borderRadius:8,
              background:`${k.color}22`, color: k.color,
              display:'grid', placeItems:'center', flex:'0 0 auto',
            }}>
              {React.createElement(k.icon, {size:16})}
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:18, fontWeight:800, lineHeight:1.1, color:'hsl(var(--fg))'}}>
                {k.value}
              </div>
              <div className="muted" style={{fontSize:10.5, marginTop:2}}>{k.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// =================================================================
// ContractsAnalysisGrid — 4 cards (Classificação IA / Informações / Serviços / Prioridades)
// =================================================================
function ContractsAnalysisGrid({ full }) {
  const { fmt } = window.DATA;
  if (!full) return null;
  const contratos = full.contratos || [];
  const total = full.totalContratos || contratos.length || 0;
  // Mesmo critério: sem contratos = sem análise PNCP
  if (total === 0) return null;

  const relevantes = contratos.filter(c => (c.classificacao_ia || '').toUpperCase() === 'SIM').length;
  const naoRelevantes = contratos.filter(c => ['NAO','NÃO'].includes((c.classificacao_ia||'').toUpperCase())).length;
  const pendentes = total - relevantes - naoRelevantes;
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0;

  const valores = contratos.map(c => c.valor_global || 0).filter(v => v > 0);
  const maior = valores.length ? Math.max(...valores) : 0;
  const menor = valores.length ? Math.min(...valores) : 0;
  const esferas = [...new Set(contratos.map(c => c.esfera_nome).filter(Boolean))];
  const anos = [...new Set(contratos.map(c => c.ano).filter(Boolean))].sort();
  const tipos = [...new Set(contratos.map(c => c.tipo_servico_identificado).filter(Boolean))];
  const modalidades = [...new Set(contratos.map(c => c.modalidade_licitacao_nome).filter(Boolean))];

  // Prioridade — extraída do tipo de serviço se for bodyshop, ou do classificacao
  const prioridadeMap = contratos.reduce((acc, c) => {
    let p = 'NA';
    if ((c.classificacao_ia||'').toUpperCase() === 'SIM') p = 'MEDIA';
    if ((c.classificacao_ia||'').toUpperCase() === 'SIM' && (c.valor_global||0) >= 500_000) p = 'ALTA';
    acc[p] = (acc[p] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{
      display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))',
      gap:'var(--gap)', marginBottom:'var(--gap)',
    }}>
      {/* Classificação IA */}
      <div className="card">
        <div className="card-head">
          <div className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>
            <I.chart size={14}/>Classificação IA
          </div>
        </div>
        <div className="card-p" style={{display:'flex', flexDirection:'column', gap:14}}>
          {[
            { label:'Relevantes', n: relevantes, color:'hsl(var(--success))', icon:I.check },
            { label:'Não Relevantes', n: naoRelevantes, color:'hsl(var(--danger))', icon:I.x },
            { label:'Pendentes', n: pendentes, color:'hsl(var(--warning))', icon:I.sparkle },
          ].map(row => (
            <div key={row.label}>
              <div className="row-between" style={{fontSize:12.5, marginBottom:5}}>
                <span className="row" style={{gap:6, alignItems:'center'}}>
                  {React.createElement(row.icon, {size:12, style:{color:row.color}})}
                  {row.label}
                </span>
                <strong style={{color:row.color}}>
                  {row.n}<span className="muted" style={{fontSize:10.5, fontWeight:400, marginLeft:4}}>({pct(row.n)}%)</span>
                </strong>
              </div>
              <div className="progress" style={{height:6}}>
                <span style={{width:`${pct(row.n)}%`, background:row.color}}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Informações */}
      <div className="card">
        <div className="card-head">
          <div className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>
            <I.star size={14}/>Informações
          </div>
        </div>
        <div className="card-p" style={{display:'flex', flexDirection:'column', gap:10}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
            <div>
              <div className="card-section-title" style={{marginBottom:2}}>Primeiro</div>
              <div style={{fontSize:12.5, fontWeight:600}}>{full.primeiroContrato ? new Date(full.primeiroContrato).toLocaleDateString('pt-BR') : '—'}</div>
            </div>
            <div>
              <div className="card-section-title" style={{marginBottom:2}}>Último</div>
              <div style={{fontSize:12.5, fontWeight:600}}>{full.ultimoContrato ? new Date(full.ultimoContrato).toLocaleDateString('pt-BR') : '—'}</div>
            </div>
            <div>
              <div className="card-section-title" style={{marginBottom:2}}>Maior</div>
              <div style={{fontSize:12.5, fontWeight:600, color:'hsl(var(--success))'}}>{maior > 0 ? fmt.brlK(maior) : '—'}</div>
            </div>
            <div>
              <div className="card-section-title" style={{marginBottom:2}}>Menor</div>
              <div style={{fontSize:12.5, fontWeight:600}}>{menor > 0 ? fmt.brlK(menor) : '—'}</div>
            </div>
          </div>
          {esferas.length > 0 && (
            <div style={{borderTop:'1px solid hsl(var(--border))', paddingTop:8}}>
              <div className="card-section-title" style={{marginBottom:6}}>Esferas</div>
              <div className="row" style={{gap:4, flexWrap:'wrap'}}>
                {esferas.map(e => <span key={e} className="chip" style={{fontSize:10.5, textTransform:'capitalize'}}>{e}</span>)}
              </div>
            </div>
          )}
          {anos.length > 0 && (
            <div style={{borderTop:'1px solid hsl(var(--border))', paddingTop:8}}>
              <div className="card-section-title" style={{marginBottom:6}}>Anos</div>
              <div className="row" style={{gap:4, flexWrap:'wrap'}}>
                {anos.map(a => <span key={a} className="chip" style={{fontSize:10.5}}>{a}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Serviços */}
      <div className="card">
        <div className="card-head">
          <div className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>
            <I.briefcase size={14}/>Serviços
          </div>
        </div>
        <div className="card-p" style={{maxHeight:220, overflowY:'auto'}}>
          <div className="card-section-title" style={{marginBottom:6}}>Tipos de Serviço ({tipos.length})</div>
          <div className="row" style={{gap:4, flexWrap:'wrap', marginBottom:10}}>
            {tipos.length > 0 ? tipos.map(t => (
              <span key={t} className="chip primary" style={{fontSize:10.5, padding:'2px 7px'}} title={t}>
                {t.length > 50 ? t.slice(0, 50) + '…' : t}
              </span>
            )) : <span className="muted" style={{fontSize:11.5}}>Nenhum identificado</span>}
          </div>
          {modalidades.length > 0 && (
            <>
              <div className="card-section-title" style={{marginBottom:6, marginTop:8}}>Modalidades ({modalidades.length})</div>
              <div className="row" style={{gap:4, flexWrap:'wrap'}}>
                {modalidades.map(m => <span key={m} className="chip" style={{fontSize:10.5}}>{m}</span>)}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Prioridades */}
      <div className="card">
        <div className="card-head">
          <div className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>
            <I.target size={14}/>Prioridades
          </div>
        </div>
        <div className="card-p" style={{display:'flex', flexDirection:'column', gap:8}}>
          {Object.keys(prioridadeMap).length === 0 ? (
            <span className="muted" style={{fontSize:11.5}}>Sem prioridades calculadas</span>
          ) : (
            Object.entries(prioridadeMap)
              .sort((a, b) => b[1] - a[1])
              .map(([prio, n]) => {
                const cls = prio === 'ALTA' ? 'danger' : prio === 'MEDIA' ? 'warn' : '';
                return (
                  <div key={prio} className="row-between" style={{padding:'6px 0', borderBottom:'1px solid hsl(var(--border))'}}>
                    <span className={`chip ${cls}`} style={{fontSize:10.5}}>{prio}</span>
                    <strong style={{fontSize:13}}>{n}</strong>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// FornecedorInfoCard — Dados da Empresa (CNPJ, contato, endereço,
// info, atividade econômica, dados fiscais, sócios collapsible)
// =================================================================
function FornecedorInfoCard({ full, c }) {
  const { fmt } = window.DATA;
  const [showSocios, setShowSocios] = React.useState(false);
  if (!full) return null;
  const enriched = full.dados_enriquecidos;

  const Section = ({ title, children, icon }) => (
    <div style={{padding:'14px 0', borderBottom:'1px solid hsl(var(--border))'}}>
      <div className="card-section-title" style={{display:'flex', alignItems:'center', gap:6, marginBottom:8}}>
        {icon && React.createElement(icon, {size:11})}{title}
      </div>
      {children}
    </div>
  );

  const Field = ({ label, value, mono, span }) => (
    <div style={{minWidth:0, gridColumn: span ? `span ${span}` : undefined}}>
      <div className="card-section-title" style={{marginBottom:2}}>{label}</div>
      <div style={{
        fontSize:13, fontWeight:500, color:'hsl(var(--fg))',
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
        wordBreak: 'break-word',
      }}>{value || <span className="muted">—</span>}</div>
    </div>
  );

  const cnaeSec = full.atividades_secundarias || [];

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>
          <I.building size={14}/>Dados da Empresa
        </div>
        <div className="row" style={{gap:6}}>
          <span className="chip" style={{fontSize:10}}>{full.status}</span>
          {enriched && <span className="chip success" style={{fontSize:10}}><I.check size={10}/>CNPJ.ws</span>}
        </div>
      </div>
      <div style={{padding:'0 var(--card-p)'}}>

        {/* Identificação */}
        <Section title="Identificação">
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14}}>
            <Field label="CNPJ" value={fmt.cnpj(full.cnpj)} mono/>
            <Field label="Razão Social" value={full.razao_social} span={2}/>
            <Field label="Nome Fantasia" value={full.nome_fantasia}/>
          </div>
        </Section>

        {/* Contato */}
        <Section title="Contato" icon={I.phone}>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14}}>
            <Field label="Telefone" value={full.telefone} mono/>
            <Field label="E-mail" value={full.email} mono/>
            <Field label="Website" value={full.website ? <a href={`https://${full.website}`} target="_blank" rel="noreferrer" style={{color:'hsl(var(--b-accent))'}}>{full.website}</a> : null}/>
            <Field label="LinkedIn" value={full.linkedin ? <a href={full.linkedin} target="_blank" rel="noreferrer" style={{color:'hsl(var(--b-accent))'}}>Ver perfil</a> : null}/>
          </div>
        </Section>

        {/* Endereço */}
        <Section title="Endereço" icon={I.target}>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:14}}>
            <Field label="Logradouro" value={full.endereco} span={2}/>
            <Field label="Cidade / UF" value={full.cidade && full.estado ? `${full.cidade} - ${full.estado}` : (full.cidade || full.estado)}/>
            <Field label="CEP" value={full.cep} mono/>
          </div>
        </Section>

        {/* Informações da Empresa */}
        {enriched && (full.porte || full.natureza_juridica || full.situacao_cadastral) && (
          <Section title="Informações da Empresa" icon={I.briefcase}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14}}>
              <Field label="Porte" value={full.porte}/>
              <Field label="Natureza Jurídica" value={full.natureza_juridica}/>
              <Field label="Situação" value={
                full.situacao_cadastral
                  ? <span className={`chip ${full.situacao_cadastral.toLowerCase()==='ativa' ? 'success' : 'danger'}`} style={{fontSize:10.5}}>
                      {full.situacao_cadastral}
                    </span>
                  : null
              }/>
            </div>
          </Section>
        )}

        {/* Atividade Econômica */}
        {enriched && (full.setor || full.atividade_principal_codigo) && (
          <Section title="Atividade Econômica" icon={I.target}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14}}>
              <Field label="Setor" value={full.setor}/>
              <Field label="CNAE Principal" value={
                full.atividade_principal_codigo
                  ? <><span className="mono">{full.atividade_principal_codigo}</span>{full.atividade_principal && <div className="muted" style={{fontSize:11.5, marginTop:2}}>{full.atividade_principal}</div>}</>
                  : null
              } span={2}/>
            </div>
            {cnaeSec.length > 0 && (
              <div style={{marginTop:12}}>
                <div className="card-section-title" style={{marginBottom:6}}>Atividades Secundárias ({cnaeSec.length})</div>
                <div style={{maxHeight:120, overflowY:'auto', display:'flex', flexDirection:'column', gap:4}}>
                  {cnaeSec.slice(0, 8).map((a, i) => (
                    <div key={i} style={{fontSize:11.5, lineHeight:1.5}}>
                      <span className="mono muted">{a.codigo}</span>
                      {a.descricao && <span style={{marginLeft:6}}>{a.descricao}</span>}
                    </div>
                  ))}
                  {cnaeSec.length > 8 && <span className="muted" style={{fontSize:11}}>+{cnaeSec.length - 8} mais</span>}
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Dados Fiscais */}
        {enriched && (full.capital_social || full.regime_tributario || full.faixa_faturamento || full.data_abertura) && (
          <Section title="Dados Fiscais" icon={I.money}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14}}>
              <Field label="Capital Social" value={full.capital_social ? fmt.brlK(full.capital_social) : null}/>
              <Field label="Faixa de Faturamento" value={full.faixa_faturamento}/>
              <Field label="Regime Tributário" value={full.regime_tributario}/>
              <Field label="Data de Abertura" value={full.data_abertura ? new Date(full.data_abertura).toLocaleDateString('pt-BR') : null}/>
            </div>
          </Section>
        )}

        {/* Sócios collapsible */}
        {full.socios && full.socios.length > 0 && (
          <div style={{padding:'14px 0', borderBottom:'1px solid hsl(var(--border))'}}>
            <button
              onClick={() => setShowSocios(s => !s)}
              style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                width:'100%', padding:0, background:'none', border:0, cursor:'pointer',
              }}
            >
              <span className="card-section-title" style={{display:'flex', alignItems:'center', gap:6, margin:0}}>
                <I.users size={11}/>Sócios ({full.socios.length})
              </span>
              <I.chevron size={11} style={{transform: showSocios ? 'rotate(90deg)' : 'rotate(0deg)', transition:'.15s', color:'hsl(var(--fg-muted))'}}/>
            </button>
            {showSocios ? (
              <div style={{marginTop:10, display:'flex', flexDirection:'column', gap:8}}>
                {full.socios.map((s, i) => (
                  <div key={i} style={{borderLeft:'2px solid hsl(var(--b-accent) / .4)', paddingLeft:10}}>
                    <div style={{fontSize:13, fontWeight:600}}>{s.nome}</div>
                    {s.qualificacao && <div className="muted" style={{fontSize:11.5}}>{s.qualificacao}</div>}
                    {(s.tipo || s.data_entrada) && (
                      <div className="muted" style={{fontSize:10.5, marginTop:2}}>
                        {s.tipo && <span>{s.tipo}</span>}
                        {s.tipo && s.data_entrada && <span> · </span>}
                        {s.data_entrada && <span>desde {new Date(s.data_entrada).toLocaleDateString('pt-BR')}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{marginTop:8, fontSize:12.5, color:'hsl(var(--fg))'}}>
                {full.socios[0].nome}
                {full.socios.length > 1 && <span className="muted"> +{full.socios.length - 1} outros</span>}
              </div>
            )}
          </div>
        )}

        {/* Fonte */}
        {enriched && full.data_enriquecimento && (
          <div className="muted" style={{fontSize:11, padding:'12px 0', display:'flex', alignItems:'center', gap:6}}>
            <I.check size={11} style={{color:'hsl(var(--success))'}}/>
            Atualizado via CNPJ.WS em {new Date(full.data_enriquecimento).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})}
          </div>
        )}

      </div>
    </div>
  );
}

// =================================================================
// ContratosTable — Tabela completa de contratos PNCP do fornecedor
// =================================================================
function ContratosTable({ full }) {
  const { fmt } = window.DATA;
  const [sortField, setSortField] = React.useState('valor_global');
  const [sortOrder, setSortOrder] = React.useState('desc');
  const [pageSize] = React.useState(20);
  const [page, setPage] = React.useState(1);

  if (!full) return null;
  const contratos = full.contratos || [];
  if (contratos.length === 0) return null;

  const sorted = [...contratos].sort((a, b) => {
    const av = a[sortField];
    const bv = b[sortField];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    let cmp;
    if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
    else cmp = String(av).localeCompare(String(bv));
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const total = sorted.length;
  const totalPages = Math.ceil(total / pageSize);
  const visible = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (f) => {
    if (sortField === f) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortOrder('desc'); }
    setPage(1);
  };

  const SortHead = ({ field, children, align }) => (
    <th onClick={()=>handleSort(field)} style={{cursor:'pointer', textAlign: align || 'left', userSelect:'none'}}>
      <span style={{display:'inline-flex', alignItems:'center', gap:4}}>
        {children}
        {sortField === field
          ? <I.chevron size={9} style={{transform: sortOrder==='asc' ? 'rotate(-90deg)' : 'rotate(90deg)'}}/>
          : <span style={{opacity:.3, fontSize:9}}>⇅</span>}
      </span>
    </th>
  );

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  const iaConfig = {
    SIM:      { label:'Relevante',     cls:'success' },
    sim:      { label:'Relevante',     cls:'success' },
    NAO:      { label:'Não Relevante', cls:'' },
    'NÃO':    { label:'Não Relevante', cls:'' },
    PENDENTE: { label:'Analisando',    cls:'primary' },
  };

  const getVigenciaColor = (dias) => {
    if (dias == null) return 'hsl(var(--fg-muted))';
    if (dias < 30) return 'hsl(var(--danger))';
    if (dias < 90) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  return (
    <div className="card">
      <div className="card-head">
        <div className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>
          <I.doc size={14}/>Contratos
          <span className="chip" style={{fontSize:10}}>{total}</span>
        </div>
        <span className="muted" style={{fontSize:11.5}}>
          Total: <strong className="mono">{fmt.brlK(full.valorTotal || 0)}</strong>
        </span>
      </div>
      <div style={{maxHeight:480, overflowY:'auto'}}>
        <table className="table">
          <thead style={{position:'sticky', top:0, background:'hsl(var(--surface))', zIndex:1}}>
            <tr>
              <SortHead field="title">Título / Órgão</SortHead>
              <SortHead field="data_inicio_vigencia">Vigência</SortHead>
              <SortHead field="valor_global" align="right">Valor</SortHead>
              <SortHead field="uf" align="center">UF</SortHead>
              <SortHead field="classificacao_ia" align="center">IA</SortHead>
              <th style={{textAlign:'center'}}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map(c => {
              const ia = c.classificacao_ia ? iaConfig[c.classificacao_ia] : null;
              const dias = c.dias_ate_fim_vigencia;
              return (
                <tr key={c.id}>
                  <td style={{maxWidth:280}}>
                    <div style={{fontSize:12.5, fontWeight:600}}>{c.title || '—'}</div>
                    <div className="row" style={{gap:4, marginTop:2, alignItems:'center'}}>
                      <I.building size={9} style={{color:'hsl(var(--fg-muted))'}}/>
                      <span className="muted" style={{fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                        {c.orgao_nome || 'Órgão não informado'}
                      </span>
                    </div>
                  </td>
                  <td style={{fontSize:11.5}}>
                    <div className="muted">
                      {formatDate(c.data_inicio_vigencia)} {c.data_fim_vigencia && `→ ${formatDate(c.data_fim_vigencia)}`}
                    </div>
                    {dias != null && dias > 0 && (
                      <span className="chip" style={{
                        fontSize:9.5, marginTop:3, padding:'1px 6px',
                        background: `${getVigenciaColor(dias)}22`, color: getVigenciaColor(dias),
                        borderColor: `${getVigenciaColor(dias)} / .3`,
                      }}>
                        {dias} dias restantes
                      </span>
                    )}
                  </td>
                  <td style={{textAlign:'right'}}>
                    <strong className="mono" style={{color:'hsl(var(--b-accent))', fontSize:12.5}}>
                      {fmt.brlK(c.valor_global || 0)}
                    </strong>
                  </td>
                  <td style={{textAlign:'center'}}>
                    <span className="chip" style={{fontSize:10}}>{c.uf || '—'}</span>
                  </td>
                  <td style={{textAlign:'center'}}>
                    {ia
                      ? <span className={`chip ${ia.cls}`} style={{fontSize:9.5}}>{ia.label}</span>
                      : <span className="chip" style={{fontSize:9.5}}>Pendente</span>}
                  </td>
                  <td style={{textAlign:'center'}}>
                    {c.url_contrato && (
                      <a href={c.url_contrato} target="_blank" rel="noreferrer" className="icon-btn" title="Abrir no PNCP">
                        <I.refresh size={12}/>
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="row-between" style={{padding:'10px 14px', borderTop:'1px solid hsl(var(--border))'}}>
          <span className="muted" style={{fontSize:11.5}}>
            {(page-1)*pageSize + 1}–{Math.min(page*pageSize, total)} de {total}
          </span>
          <div className="row" style={{gap:4}}>
            <button className="btn btn-xs btn-ghost" disabled={page===1} onClick={()=>setPage(p=>p-1)}>
              <I.chevron size={10} style={{transform:'rotate(180deg)'}}/>
            </button>
            <span className="muted" style={{fontSize:11.5, padding:'0 8px'}}>{page} / {totalPages}</span>
            <button className="btn btn-xs btn-ghost" disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}>
              <I.chevron size={10}/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =================================================================
// LushaCandidatesCard — lista de candidatos Lusha pré-revelação
// User vê quem existe (nome + cargo + flags has_email/phone) e
// escolhe quem revelar (consome 1 crédito por reveal)
// =================================================================
function LushaCandidatesCard({ empresaId, onRevealed }) {
  const [candidates, setCandidates] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const [revealingIds, setRevealingIds] = React.useState(new Set());
  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState('all'); // all | revealed | pending
  const [searchMsg, setSearchMsg] = React.useState(null);

  const load = React.useCallback(() => {
    if (!empresaId) return;
    setLoading(true);
    window.API.api(`/empresas/${empresaId}/lusha/candidates`)
      .then(setCandidates)
      .finally(() => setLoading(false));
  }, [empresaId]);

  React.useEffect(load, [load]);

  const buscar = async () => {
    setSearching(true);
    setSearchMsg(null);
    try {
      const r = await window.API.api(`/empresas/${empresaId}/lusha/search`, { method: 'POST' });
      if (r.error) {
        setSearchMsg({ tone: 'danger', text: r.error });
      } else {
        setSearchMsg({
          tone: 'success',
          text: `${(r.contacts || []).length} contatos no domínio ${r.domain || '?'}`,
        });
      }
      load();
    } catch (e) {
      setSearchMsg({ tone: 'danger', text: e.message });
    } finally {
      setSearching(false);
    }
  };

  const revelar = async (cand) => {
    if (!confirm(`Revelar ${cand.nome}? Isso consome 1 crédito Lusha.`)) return;
    setRevealingIds(prev => new Set(prev).add(cand.id));
    try {
      await window.API.api(`/empresas/lusha/candidates/${cand.id}/revelar`, { method: 'POST' });
      load();
      onRevealed?.();
    } catch (e) {
      alert(e.message);
    } finally {
      setRevealingIds(prev => { const s = new Set(prev); s.delete(cand.id); return s; });
    }
  };

  const revelarSelecionados = async (ids) => {
    if (ids.length === 0) return;
    if (!confirm(`Revelar ${ids.length} contatos? Consome ${ids.length} créditos Lusha.`)) return;
    setRevealingIds(prev => new Set([...prev, ...ids]));
    try {
      const candsByPersonId = {};
      candidates.forEach(c => candsByPersonId[c.lusha_person_id] = c);
      const personIds = ids.map(id => candsByPersonId[candidates.find(c => c.id === id)?.lusha_person_id || '']?.lusha_person_id).filter(Boolean);
      // backend aceita /enrich-batch com contact_ids = lusha_person_ids
      const lushaPersonIds = candidates.filter(c => ids.includes(c.id)).map(c => c.lusha_person_id);
      await window.API.api(`/empresas/${empresaId}/lusha/enrich-batch`, {
        method: 'POST',
        body: { contact_ids: lushaPersonIds },
      });
      load();
      onRevealed?.();
    } catch (e) { alert(e.message); }
    finally { setRevealingIds(new Set()); }
  };

  const q = search.trim().toLowerCase();
  const filtered = candidates.filter(c => {
    if (q && !(c.nome || '').toLowerCase().includes(q) && !(c.cargo || '').toLowerCase().includes(q)) return false;
    if (filter === 'revealed' && !c.revelado_em) return false;
    if (filter === 'pending' && c.revelado_em) return false;
    return true;
  });

  const totalRev = candidates.filter(c => c.revelado_em).length;
  const totalPend = candidates.length - totalRev;

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title" style={{display:'flex', alignItems:'center', gap:8}}>
            <I.sparkle size={14}/>Contatos Lusha
            <span className="chip" style={{fontSize:10}}>{candidates.length}</span>
          </div>
          <div className="card-sub" style={{display:'flex', gap:8, alignItems:'center', marginTop:4}}>
            <span className="chip success" style={{fontSize:10}}><I.check size={9}/>{totalRev} revelados</span>
            <span className="chip" style={{fontSize:10}}>{totalPend} pendentes</span>
          </div>
        </div>
        <button className="btn btn-xs btn-ghost" onClick={buscar} disabled={searching}>
          <I.search size={11}/>{searching ? 'Buscando…' : 'Buscar Lusha'}
        </button>
      </div>

      {searchMsg && (
        <div style={{
          padding:'10px 14px', fontSize:12.5, marginBottom:0,
          background: searchMsg.tone === 'success' ? 'hsl(var(--success-soft))' : 'hsl(var(--danger-soft))',
          color: searchMsg.tone === 'success' ? 'hsl(var(--success))' : 'hsl(var(--danger))',
          borderBottom: '1px solid hsl(var(--border))',
        }}>{searchMsg.text}</div>
      )}

      {candidates.length === 0 && !loading && (
        <div style={{padding:24, textAlign:'center'}}>
          <div className="muted" style={{marginBottom:10, fontSize:13}}>
            Nenhum candidato Lusha buscado ainda.
          </div>
          <button className="btn btn-sm btn-accent" onClick={buscar} disabled={searching}>
            <I.search size={12}/>{searching ? 'Buscando…' : 'Buscar contatos no Lusha'}
          </button>
          <div className="muted" style={{fontSize:11, marginTop:8}}>
            Sem custo — só lista quem existe na empresa.
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <>
          <div style={{padding:'10px 14px', display:'flex', gap:8, alignItems:'center', borderBottom:'1px solid hsl(var(--border))'}}>
            <I.search size={12} style={{color:'hsl(var(--fg-muted))'}}/>
            <input className="input" placeholder="Buscar nome ou cargo…" value={search}
              onChange={e => setSearch(e.target.value)}
              style={{flex:1, height:30, fontSize:12.5}}/>
            <div className="segment-ctrl">
              {[['all','Todos'],['pending','Pendentes'],['revealed','Revelados']].map(([k,l]) => (
                <button key={k} className={filter===k?'active':''} onClick={()=>setFilter(k)}>{l}</button>
              ))}
            </div>
          </div>

          <div style={{maxHeight:480, overflowY:'auto'}}>
            {loading && <div className="muted" style={{padding:20, textAlign:'center'}}>Carregando…</div>}
            {!loading && filtered.length === 0 && (
              <div className="muted" style={{padding:20, textAlign:'center', fontSize:13}}>
                Nenhum candidato com esses filtros.
              </div>
            )}
            {!loading && filtered.map(cand => {
              const isRevealing = revealingIds.has(cand.id);
              const isRevealed = !!cand.revelado_em;
              return (
                <div key={cand.id} style={{
                  padding:'12px 14px',
                  borderBottom:'1px solid hsl(var(--border))',
                  display:'grid', gridTemplateColumns:'36px 1fr auto', gap:12, alignItems:'center',
                  background: isRevealed ? 'hsl(var(--success-soft))' : 'transparent',
                }}>
                  <UI.Avatar name={cand.nome || '?'} size={36}/>
                  <div style={{minWidth:0}}>
                    <div className="row" style={{gap:6, alignItems:'center', flexWrap:'wrap'}}>
                      <strong style={{fontSize:13}}>{cand.nome || '(sem nome)'}</strong>
                      {isRevealed
                        ? <span className="chip success" style={{fontSize:9.5}}><I.check size={9}/>Revelado</span>
                        : <span className="chip" style={{fontSize:9.5}}>Pendente</span>}
                    </div>
                    <div className="muted" style={{fontSize:11.5, marginTop:2}}>{cand.cargo || '—'}{cand.departamento && ` · ${cand.departamento}`}</div>
                    <div className="row" style={{gap:8, marginTop:4, flexWrap:'wrap'}}>
                      {cand.has_phone && <span className="chip" style={{fontSize:9.5, color:'hsl(var(--success))', borderColor:'hsl(var(--success) / .3)'}}><I.phone size={8}/>{cand.n_phones || ''} telefone{cand.n_phones===1?'':'s'}</span>}
                      {cand.has_mobile && <span className="chip" style={{fontSize:9.5, color:'hsl(var(--success))', borderColor:'hsl(var(--success) / .3)'}}>📱 mobile</span>}
                      {cand.has_email && <span className="chip" style={{fontSize:9.5, color:'hsl(var(--info))', borderColor:'hsl(var(--info) / .3)'}}><I.mail size={8}/>{cand.n_emails || ''} email{cand.n_emails===1?'':'s'}</span>}
                      {cand.linkedin_url && <a href={cand.linkedin_url} target="_blank" rel="noreferrer" className="chip" style={{fontSize:9.5, color:'#0077B5', borderColor:'#0077B5 / .3'}}><I.linkedin size={8}/>LinkedIn</a>}
                    </div>
                  </div>
                  <div>
                    {!isRevealed && (
                      <button className="btn btn-xs btn-accent" onClick={() => revelar(cand)} disabled={isRevealing}>
                        {isRevealing ? '…' : <><I.sparkle size={10}/>Revelar</>}
                      </button>
                    )}
                    {isRevealed && cand.contato_id && (
                      <span className="muted" style={{fontSize:11}}>já no CRM</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// =================================================================
// OriginChip — chip discreto que mostra de onde veio a empresa
// =================================================================
function OriginChip({ full }) {
  if (!full?.origem) return null;
  const map = {
    pncp:           { label:'Vinda do PNCP',    icon:'radar',    cls:'primary' },
    manual:         { label:'Cadastro manual',  icon:'plus',     cls:'' },
    import_csv:     { label:'Importada (CSV)',  icon:'doc',      cls:'' },
    enriquecimento: { label:'Enriquecimento',   icon:'sparkle',  cls:'' },
    indicacao:      { label:'Indicação',        icon:'star',     cls:'warn' },
  };
  const m = map[full.origem] || { label: full.origem, icon:'sparkle', cls:'' };
  return (
    <span className={`chip ${m.cls}`} style={{fontSize:10.5, gap:4}}>
      {React.createElement(I[m.icon] || I.sparkle, { size: 10 })}
      {m.label}
    </span>
  );
}

window.LeadDetail = LeadDetail;
window.EmailModal = EmailModal;
window.TimelinePanel = TimelinePanel;
window.CnpjSummaryCard = CnpjSummaryCard;
window.ContractsKpiGrid = ContractsKpiGrid;
window.ContractsAnalysisGrid = ContractsAnalysisGrid;
window.OriginChip = OriginChip;
window.FornecedorInfoCard = FornecedorInfoCard;
window.LushaCandidatesCard = LushaCandidatesCard;
window.ContratosTable = ContratosTable;

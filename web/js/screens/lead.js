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
              <h1 className="page-title" style={{margin:0}}>{c.name}</h1>
              <div className="row" style={{gap:8, marginTop:4}}>
                <span className="mono muted" style={{fontSize:12}}>{fmt.cnpj(c.cnpj)}</span>
                <span className="muted">·</span>
                <span className="muted" style={{fontSize:13}}>{c.city}, {c.uf}</span>
                {c.website && <><span className="muted">·</span><a href={`https://${c.website}`} target="_blank" rel="noreferrer" style={{color:'hsl(var(--b-accent))', fontSize:13}}>{c.website}</a></>}
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
          {/* Perfil enriquecido */}
          <div className="card">
            <div className="card-head"><div className="card-title">Perfil enriquecido</div><span className="chip success"><I.check size={10}/>CNPJ.ws</span></div>
            <div className="card-p" style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:20}}>
              <Info label="Faturamento" value={fmt.brlK(c.revenue)} hot={c.revenue >= 100_000_000}/>
              <Info label="Funcionários" value={fmt.num(c.employees)}/>
              <Info label="Setor" value={c.sector}/>
              <Info label="Contratos PNCP" value={c.contractsPncp}/>
              <Info label="Ativos em Governo" value={c.ativosGov}/>
              <Info label="Ticket médio" value={fmt.brlK(c.ticketMedio)}/>
            </div>
            {(c.stack || []).length > 0 && (
              <div style={{padding:'0 24px 20px'}}>
                <div className="card-section-title">Stack técnica</div>
                <div className="row" style={{gap:6, flexWrap:'wrap'}}>
                  {(c.stack||[]).map(s => <span key={s} className="chip primary">{s}</span>)}
                </div>
              </div>
            )}
          </div>

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

          {/* Histórico PNCP */}
          {contracts.length > 0 && (
            <div className="card">
              <div className="card-head"><div className="card-title">Histórico PNCP</div><span className="chip">{contracts.length} contratos · {fmt.brlK(totalPncp)}</span></div>
              <table className="table">
                <thead><tr><th>Órgão</th><th>Objeto</th><th>Valor</th><th>Publicado</th></tr></thead>
                <tbody>
                  {contracts.map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.orgao}</strong><div className="muted mono" style={{fontSize:10}}>{p.numero}</div></td>
                      <td style={{maxWidth:280, fontSize:12.5}}>{p.objeto}</td>
                      <td><strong className="mono" style={{color:'hsl(var(--b-accent))'}}>{fmt.brlK(p.valor)}</strong></td>
                      <td className="muted">{fmt.date(p.publicado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Timeline 360° */}
          <TimelinePanel items={timeline} loading={loadingTl} onReload={loadTimeline}/>
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

function TimelinePanel({ items, loading, onReload }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Timeline 360°</div>
          <div className="card-sub">Tudo que aconteceu — atividades, notas, oportunidades</div>
        </div>
        <button className="btn btn-xs btn-ghost" onClick={onReload}><I.refresh size={10}/></button>
      </div>
      <div className="card-p" style={{padding:0}}>
        {loading && <div style={{padding:20, textAlign:'center'}} className="muted">Carregando…</div>}
        {!loading && items.length === 0 && (
          <div style={{padding:24, textAlign:'center'}} className="muted">Nenhum evento ainda.</div>
        )}
        {!loading && items.map((ev, i) => <TimelineRow key={`${ev.kind}-${ev.id}-${i}`} ev={ev}/>)}
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
    title = 'Nota adicionada';
    body = <span style={{fontSize:12}}>{(d.texto || d.conteudo || '').slice(0, 200)}</span>;
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

window.LeadDetail = LeadDetail;
window.EmailModal = EmailModal;
window.TimelinePanel = TimelinePanel;

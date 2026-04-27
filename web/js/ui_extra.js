// Shared primitives: FormField, MultiSelect, Skeleton, Toast, ErrorBoundary, useApi.
// Carregado depois do ui.js, antes das telas.

// ============ FormField (label + filho input) ============
function FormField({ label, hint, error, required, children }) {
  return (
    <label style={{display:'flex', flexDirection:'column', gap:6}}>
      {label && (
        <span style={{fontSize:12, fontWeight:600, color:'hsl(var(--fg-muted))'}}>
          {label}{required && <span style={{color:'hsl(var(--danger))', marginLeft:3}}>*</span>}
        </span>
      )}
      {children}
      {error && <span style={{fontSize:11.5, color:'hsl(var(--danger))'}}>{error}</span>}
      {!error && hint && <span style={{fontSize:11.5, color:'hsl(var(--fg-faint))'}}>{hint}</span>}
    </label>
  );
}
window.FormField = FormField;

// ============ MultiSelect (popover com checkbox + busca) ============
function MultiSelect({ label, options, selected, onChange, formatOption, width = 200 }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const ref = React.useRef(null);
  const fmt = formatOption || ((o) => o);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
    else onChange([...selected, opt]);
  };

  const display = selected.length === 0 ? label
    : selected.length === 1 ? fmt(selected[0])
    : `${selected.length} selecionados`;

  const filtered = options.filter(o => !search || fmt(o).toLowerCase().includes(search.toLowerCase()));

  return (
    <div ref={ref} style={{position:'relative', minWidth: width}}>
      <button
        type="button"
        className="filter-input"
        onClick={() => setOpen(v => !v)}
        style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%', cursor:'pointer', textAlign:'left', gap:6}}
      >
        <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color: selected.length ? 'hsl(var(--fg))' : 'hsl(var(--fg-muted))'}}>{display}</span>
        <I.chevron size={12} style={{transform: open ? 'rotate(180deg)' : 'none', transition:'.15s', flex:'0 0 auto'}}/>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 4px)', left:0, zIndex:50,
          width: Math.max(width, 240), maxHeight: 320, overflow:'hidden',
          background:'hsl(var(--surface))', border:'1px solid hsl(var(--border))',
          borderRadius:8, boxShadow:'0 8px 24px -8px hsl(0 0% 0% / .25)',
          display:'flex', flexDirection:'column',
        }}>
          {options.length > 8 && (
            <div style={{padding:8, borderBottom:'1px solid hsl(var(--border))'}}>
              <input
                className="filter-input"
                style={{width:'100%', height:30, fontSize:12}}
                placeholder="Filtrar…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
          )}
          <div style={{overflowY:'auto', flex:1, padding:4}}>
            {filtered.length === 0 && (
              <div style={{padding:'12px 8px', fontSize:12, color:'hsl(var(--fg-muted))', textAlign:'center'}}>Sem opções</div>
            )}
            {filtered.map(opt => (
              <div
                key={opt}
                onClick={() => toggle(opt)}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'7px 10px', cursor:'pointer', borderRadius:6, fontSize:13,
                  background: selected.includes(opt) ? 'hsl(var(--b-accent-soft))' : 'transparent',
                }}
                onMouseEnter={e => { if (!selected.includes(opt)) e.currentTarget.style.background = 'hsl(var(--surface-2))'; }}
                onMouseLeave={e => { if (!selected.includes(opt)) e.currentTarget.style.background = 'transparent'; }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => {}}
                  style={{cursor:'pointer'}}
                />
                <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{fmt(opt)}</span>
              </div>
            ))}
          </div>
          {selected.length > 0 && (
            <div style={{padding:6, borderTop:'1px solid hsl(var(--border))'}}>
              <button className="btn btn-xs btn-ghost" style={{width:'100%'}} onClick={() => onChange([])}>
                Limpar seleção
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
window.MultiSelect = MultiSelect;

// ============ Skeleton ============
function Skeleton({ width = '100%', height = 14, style }) {
  return (
    <div style={{
      width, height, borderRadius: 6,
      background: 'linear-gradient(90deg, hsl(var(--surface-2)) 0%, hsl(var(--border)) 50%, hsl(var(--surface-2)) 100%)',
      backgroundSize: '200% 100%',
      animation: 'sk-wave 1.4s ease-in-out infinite',
      ...style,
    }}/>
  );
}
window.Skeleton = Skeleton;

// Inject skeleton keyframes once.
if (!document.getElementById('sk-anim')) {
  const s = document.createElement('style');
  s.id = 'sk-anim';
  s.textContent = '@keyframes sk-wave { 0%{background-position:200% 0}100%{background-position:-200% 0} }';
  document.head.appendChild(s);
}

// ============ Toast ============
const _toastListeners = new Set();
window.toast = {
  show: (msg, kind = 'info', ms = 3500) => {
    const t = { id: Date.now() + Math.random(), msg, kind, ms };
    _toastListeners.forEach(fn => fn(t));
    return t.id;
  },
  success: (msg, ms) => window.toast.show(msg, 'success', ms),
  error: (msg, ms) => window.toast.show(msg, 'error', ms || 5000),
  warn: (msg, ms) => window.toast.show(msg, 'warn', ms),
  info: (msg, ms) => window.toast.show(msg, 'info', ms),
};

function ToastHost() {
  const [items, setItems] = React.useState([]);
  React.useEffect(() => {
    const onShow = (t) => {
      setItems(prev => [...prev, t]);
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== t.id)), t.ms);
    };
    _toastListeners.add(onShow);
    return () => _toastListeners.delete(onShow);
  }, []);
  const colors = {
    success: { bg: 'hsl(var(--success-soft))', fg: 'hsl(var(--success))', bd: 'hsl(var(--success) / .35)' },
    error:   { bg: 'hsl(var(--danger-soft))',  fg: 'hsl(var(--danger))',  bd: 'hsl(var(--danger) / .35)' },
    warn:    { bg: 'hsl(var(--warning-soft))', fg: 'hsl(var(--warning))', bd: 'hsl(var(--warning) / .35)' },
    info:    { bg: 'hsl(var(--info-soft))',    fg: 'hsl(var(--info))',    bd: 'hsl(var(--info) / .35)' },
  };
  return (
    <div style={{position:'fixed', bottom:24, right:24, display:'flex', flexDirection:'column', gap:10, zIndex:9999, maxWidth:400}}>
      {items.map(t => {
        const c = colors[t.kind] || colors.info;
        return (
          <div
            key={t.id}
            onClick={() => setItems(prev => prev.filter(x => x.id !== t.id))}
            style={{
              padding:'12px 16px', borderRadius:10,
              background: c.bg, color: c.fg, border:`1px solid ${c.bd}`,
              fontSize:13, fontWeight:500, cursor:'pointer',
              boxShadow:'0 8px 24px -8px hsl(0 0% 0% / .25)',
              animation: 'toast-in .2s ease-out',
            }}
          >
            {t.msg}
          </div>
        );
      })}
    </div>
  );
}
window.ToastHost = ToastHost;

if (!document.getElementById('toast-anim')) {
  const s = document.createElement('style');
  s.id = 'toast-anim';
  s.textContent = '@keyframes toast-in { from{opacity:0; transform: translateY(8px)} to{opacity:1; transform:none} }';
  document.head.appendChild(s);
}

// ============ ErrorBoundary ============
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary capturou:', err, info);
  }
  reset = () => { this.setState({ err: null }); if (this.props.onReset) this.props.onReset(); };
  render() {
    if (this.state.err) {
      const msg = this.state.err.message || String(this.state.err);
      return (
        <div className="card" style={{padding:32, margin:24, textAlign:'center'}}>
          <div style={{fontSize:48, marginBottom:12}}>💥</div>
          <h2 style={{fontSize:18, fontWeight:700, marginBottom:8}}>Algo quebrou nessa tela</h2>
          <p style={{color:'hsl(var(--fg-muted))', fontSize:13, marginBottom:8}}>
            Não se preocupe — o restante do sistema continua ok. O erro foi:
          </p>
          <pre style={{
            display:'inline-block', textAlign:'left', maxWidth:'90%', overflow:'auto',
            padding:12, background:'hsl(var(--surface-2))', border:'1px solid hsl(var(--border))',
            borderRadius:8, fontSize:11.5, color:'hsl(var(--danger))', marginBottom:16,
          }}>{msg}</pre>
          <div style={{display:'flex', gap:8, justifyContent:'center'}}>
            <button className="btn btn-ghost btn-sm" onClick={this.reset}>Tentar novamente</button>
            <button className="btn btn-accent btn-sm" onClick={() => { window.location.hash = '#dashboard'; this.reset(); }}>Voltar ao dashboard</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
window.ErrorBoundary = ErrorBoundary;

// ============ Body-scroll lock + Esc enquanto qualquer modal estiver aberto ============
// Conta quantos modais estão montados; ativa lock só quando há ao menos um.
let _modalCount = 0;
function _applyBodyLock() {
  if (_modalCount > 0) document.body.style.overflow = 'hidden';
  else document.body.style.overflow = '';
}
// Auto-instala um observer global que detecta .modal-backdrop entrando/saindo do DOM
// e fecha qualquer modal aberto ao apertar Esc (clicando o backdrop, que já tem onClick
// de fechar nas telas; aqui só sincroniza o lock e oferece atalho).
if (typeof MutationObserver !== 'undefined' && !window.__modalObserverInstalled) {
  window.__modalObserverInstalled = true;
  const recount = () => {
    _modalCount = document.querySelectorAll('.modal-backdrop').length;
    _applyBodyLock();
  };
  new MutationObserver(recount).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const backdrops = document.querySelectorAll('.modal-backdrop');
    if (!backdrops.length) return;
    // Fecha o último (topo da pilha) simulando click no backdrop.
    backdrops[backdrops.length - 1].click();
  });
}

// ============ useApi (loading/error/refetch + abort) ============
function useApi(path, { enabled = true, deps = [] } = {}) {
  const [state, setState] = React.useState({ data: null, loading: !!enabled, error: null });
  const reload = React.useCallback(() => {
    if (!enabled || !path) { setState({ data: null, loading: false, error: null }); return Promise.resolve(null); }
    setState(s => ({ ...s, loading: true, error: null }));
    return window.API.api(path)
      .then(d => { setState({ data: d, loading: false, error: null }); return d; })
      .catch(e => { setState({ data: null, loading: false, error: e.message || String(e) }); throw e; });
  }, [path, enabled]);
  React.useEffect(() => { reload().catch(() => {}); /* eslint-disable-next-line */ }, deps.length ? deps : [path, enabled]);
  return { ...state, reload };
}
window.useApi = useApi;

// ============ SortHeader (clicável, com seta) ============
function SortHeader({ field, current, order, onSort, children, align = 'left' }) {
  const active = field === current;
  return (
    <th
      onClick={() => onSort(field)}
      style={{cursor:'pointer', userSelect:'none', textAlign: align}}
    >
      <span style={{display:'inline-flex', alignItems:'center', gap:4}}>
        {children}
        <span style={{opacity: active ? 1 : 0.3, fontSize:9, transform: active && order === 'asc' ? 'rotate(180deg)' : 'none', transition:'.15s'}}>▼</span>
      </span>
    </th>
  );
}
window.SortHeader = SortHeader;

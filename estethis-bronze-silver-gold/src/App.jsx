// ─────────────────────────────────────────────────────────────
// APP.JSX — Root component (Bronze + Silver + Gold)
//
// Bronze: REST CRUD, validation, auth, routing
// Silver: WebSocket, offline queue, optimistic mutations, generator
// Gold:   Infinite scroll via useInfiniteProducts, Reviews panel
//         wired through DetailView, GraphQL available at /graphql
// ─────────────────────────────────────────────────────────────

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';

import {
  apiCreateProduct, apiUpdateProduct, apiDeleteProduct,
  fetchProductsFiltered, ApiError,
  apiMe, apiLogout, getStoredToken,
} from './data/api';
import { getProduct }           from './data/crud';
import { createRealtimeClient } from './data/realtime';
import { createOfflineQueue }   from './data/offlineQueue';
import { useConnection }        from './hooks/useConnection';
import { useInfiniteProducts }  from './hooks/useInfiniteProducts';

import LoginPage        from './components/LoginPage';
import RegisterPage     from './components/RegisterPage';
import UsersView           from './components/UsersView';
import ObservationListView from './components/ObservationListView';
import ActionLogsView      from './components/ActionLogsView';
import ChatPanel           from './components/ChatPanel';
import PresentationPage from './components/PresentationPage';
import MasterView       from './components/MasterView';
import DetailView       from './components/DetailView';
import StatisticsView   from './components/StatisticsView';
import AtelierMode      from './components/AtelierMode';
import ProductForm      from './components/ProductForm';
import OfflineBanner    from './components/OfflineBanner';
import GeneratorPanel   from './components/GeneratorPanel';
import LiveCharts       from './components/LiveCharts';
import { Toast }        from './components/Shared';

import './data/tests';

let navKey = 0;
function newClientId() {
  return (globalThis.crypto?.randomUUID?.()) || `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function App() {
  // ── Realtime + offline plumbing ──────────────────────────────
  const realtime = useMemo(() => createRealtimeClient(), []);
  useEffect(() => () => realtime.close(), [realtime]);

  const queue = useMemo(() => createOfflineQueue(), []);
  const [queueSize, setQueueSize] = useState(queue.size());
  const [syncing,   setSyncing]   = useState(false);
  useEffect(() => queue.onChange(setQueueSize), [queue]);

  const { online, browserOnline, wsConnected, serverHealthy } = useConnection({ realtime });

  // ── Auth + routing ───────────────────────────────────────────
  // authStage: 'init' (restoring session) | 'login' | 'register' | 'app'
  const [authStage,    setAuthStage]    = useState(() => getStoredToken() ? 'init' : 'login');
  const [currentUser,  setCurrentUser]  = useState(null);
  const [view,         setView]         = useState('landing');
  const [selectedId,   setSelectedId]   = useState(null);
  const [toast,        setToast]        = useState(null);
  const [transKey,     setTransKey]     = useState(0);

  // Restore session from localStorage on first render
  useEffect(() => {
    if (authStage !== 'init') return;
    apiMe().then(user => {
      if (user) { setCurrentUser(user); setAuthStage('app'); }
      else       { setAuthStage('login'); }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = useCallback((user) => {
    setCurrentUser(user);
    setAuthStage('app');
  }, []);

  const handleLogout = useCallback(async () => {
    await apiLogout();
    setCurrentUser(null);
    setAuthStage('login');
    setView('landing');
    setAllProducts([]);
  }, []);

  // ── Inactivity auto-logout (30 min, matches server SESSION_TIMEOUT_MS) ──
  const INACTIVITY_MS = 30 * 60 * 1000;
  const inactivityTimer = useRef(null);
  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => handleLogout(), INACTIVITY_MS);
  }, [handleLogout]);

  useEffect(() => {
    if (authStage !== 'app') { clearTimeout(inactivityTimer.current); return; }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(ev => window.addEventListener(ev, resetInactivityTimer, { passive: true }));
    resetInactivityTimer();
    return () => {
      clearTimeout(inactivityTimer.current);
      events.forEach(ev => window.removeEventListener(ev, resetInactivityTimer));
    };
  }, [authStage, resetInactivityTimer]);

  const notify = useCallback((msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const navigate = useCallback((nextView, opts = {}) => {
    navKey++;
    setTransKey(navKey);
    if (opts.id !== undefined) setSelectedId(opts.id);
    setView(nextView);
  }, []);

  // ── Infinite products (Gold) ─────────────────────────────────
  const [search, setSearch] = useState('');
  const [sort,   setSort]   = useState('');

  const infProducts = useInfiniteProducts({
    fetchFn: fetchProductsFiltered,
    search,
    sort,
    enabled: authStage === 'app' && online,
  });

  // Keep a flat "all products" list for StatisticsView + DetailView
  // (those need a lookup-by-id, not just the current page).
  const [allProducts, setAllProducts] = useState([]);
  useEffect(() => {
    // Keep allProducts in sync with the growing infinite list.
    setAllProducts(prev => {
      const seen = new Set(prev.map(p => p.id));
      const fresh = infProducts.items.filter(p => !seen.has(p.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, [infProducts.items]);

  // ── Live WS merging ──────────────────────────────────────────
  useEffect(() => {
    const offs = [
      realtime.subscribe('product:created', p => {
        infProducts.merge(p);
        setAllProducts(prev => prev.find(x => x.id === p.id) ? prev : [p, ...prev]);
      }),
      realtime.subscribe('product:updated', p => {
        infProducts.merge(p);
        setAllProducts(prev => prev.map(x => x.id === p.id ? p : x));
      }),
      realtime.subscribe('product:deleted', ({ id }) => {
        infProducts.remove(id);
        setAllProducts(prev => prev.filter(p => p.id !== id));
      }),
      realtime.subscribe('product:batch', arr => {
        infProducts.prepend(arr);
        setAllProducts(prev => {
          const seen = new Set(prev.map(p => p.id));
          return [...arr.filter(p => !seen.has(p.id)), ...prev];
        });
      }),
    ];
    return () => offs.forEach(f => f?.());
  }, [realtime, infProducts]);

  // ── Reconnect: flush queue then reload ───────────────────────
  const wasOnline = useRef(online);
  useEffect(() => {
    if (!wasOnline.current && online && auth === 'app') {
      (async () => {
        if (queue.size() > 0) {
          setSyncing(true);
          const res = await queue.flush();
          setSyncing(false);
          if (res?.results) {
            const failed = res.results.filter(r => !r.ok);
            notify(failed.length === 0
              ? `Synced ${res.applied} change${res.applied === 1 ? '' : 's'}.`
              : `${failed.length} change${failed.length === 1 ? '' : 's'} could not sync.`,
              failed.length === 0 ? 'success' : 'danger');
          }
        }
        infProducts.reload();
        setAllProducts([]);
      })();
    }
    wasOnline.current = online;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, authStage]);

  // ── CRUD handlers ────────────────────────────────────────────
  const handleAdd = useCallback(async (data) => {
    if (online) {
      try {
        const created = await apiCreateProduct(data);
        infProducts.merge(created);
        setAllProducts(prev => [created, ...prev]);
        notify('Product added.');
        navigate('master');
        return;
      } catch (err) {
        if (err instanceof ApiError && err.isValidation) { notify(err.message, 'danger'); return; }
      }
    }
    const clientId = newClientId();
    const opt = { ...data, id: clientId, _offline: true,
      colors: data.colors ?? [], sizes: data.sizes ?? [], features: data.features ?? [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    infProducts.merge(opt);
    setAllProducts(prev => [opt, ...prev]);
    queue.enqueue({ op: 'create', clientId, payload: data });
    notify('Saved offline — will sync when reconnected.', 'warn');
    navigate('master');
  }, [online, queue, notify, navigate, infProducts]);

  const handleUpdate = useCallback(async (data) => {
    const id = selectedId;
    if (id == null) return;
    if (online && typeof id === 'number') {
      try {
        const updated = await apiUpdateProduct(id, data);
        infProducts.merge(updated);
        setAllProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
        notify('Product updated.');
        navigate('detail', { id });
        return;
      } catch (err) {
        if (err instanceof ApiError && err.isValidation) { notify(err.message, 'danger'); return; }
      }
    }
    const opt = { ...data, id, updatedAt: new Date().toISOString(), _offline: true };
    infProducts.merge(opt);
    setAllProducts(prev => prev.map(p => p.id === id ? opt : p));
    queue.enqueue({ op: 'update', id, payload: data });
    notify('Saved offline — will sync when reconnected.', 'warn');
    navigate('detail', { id });
  }, [online, selectedId, queue, notify, navigate, infProducts]);

  const handleDelete = useCallback(async (id) => {
    if (online && typeof id === 'number') {
      try {
        await apiDeleteProduct(id);
        infProducts.remove(id);
        setAllProducts(prev => prev.filter(p => p.id !== id));
        notify('Product deleted.', 'danger');
        navigate('master');
        return;
      } catch (err) {
        if (err instanceof ApiError && !err.isNetwork) { notify(err.message, 'danger'); return; }
      }
    }
    infProducts.remove(id);
    setAllProducts(prev => prev.filter(p => p.id !== id));
    queue.enqueue({ op: 'delete', id });
    notify('Deleted offline — will sync when reconnected.', 'warn');
    navigate('master');
  }, [online, queue, notify, navigate, infProducts]);

  const handleDeleteFromStats = useCallback(async (id) => {
    if (online && typeof id === 'number') {
      try {
        await apiDeleteProduct(id);
        infProducts.remove(id);
        setAllProducts(prev => prev.filter(p => p.id !== id));
        notify('Product deleted.', 'danger'); return;
      } catch (err) {
        if (err instanceof ApiError && !err.isNetwork) { notify(err.message, 'danger'); return; }
      }
    }
    infProducts.remove(id);
    setAllProducts(prev => prev.filter(p => p.id !== id));
    queue.enqueue({ op: 'delete', id });
    notify('Deleted offline.', 'warn');
  }, [online, queue, notify, infProducts]);

  const handleEditFromStats = useCallback((id) => {
    setSelectedId(id);
    navigate('editFromStats', { id });
  }, [navigate]);

  const selected = selectedId != null ? getProduct(allProducts, selectedId) : null;

  // ── Auth screens ─────────────────────────────────────────────
  if (authStage === 'init')     return <div className="auth-page page-enter"><div className="auth-left"><div className="auth-left-content"><p style={{color:'#aaa',marginTop:'4rem'}}>Restoring session…</p></div></div></div>;
  if (authStage === 'login')    return <LoginPage    onLogin={handleLogin}     onRegister={() => setAuthStage('register')} />;
  if (authStage === 'register') return <RegisterPage onRegister={handleLogin}  onLogin={() => setAuthStage('login')} />;

  // Permission helpers derived from the current user's role
  const canWrite  = currentUser?.permissions?.includes('products:write')  ?? false;
  const isAdmin   = currentUser?.role === 'admin';

  // ── Authenticated app ────────────────────────────────────────
  return (
    <>
      <OfflineBanner
        browserOnline={browserOnline} wsConnected={wsConnected}
        serverHealthy={serverHealthy} queueSize={queueSize} syncing={syncing}
      />

      {view === 'landing' && (
        <PresentationPage key={transKey} onEnter={() => navigate('master')} />
      )}

      {view === 'master' && (
        <>
          <MasterView
            key={transKey}
            items={infProducts.items}
            hasMore={infProducts.hasMore}
            loading={infProducts.loading}
            total={infProducts.total}
            search={search}
            onSearchChange={setSearch}
            sort={sort}
            onSortChange={setSort}
            onLoadMore={infProducts.loadMore}
            onView={id  => navigate('detail',  { id })}
            onEdit={id  => navigate('edit',    { id })}
            onDelete={handleDelete}
            onAdd={() => navigate('add')}
            onStats={() => navigate('stats')}
            onHome={() => navigate('landing')}
            onAtelier={() => navigate('atelier')}
            onUsers={isAdmin ? () => navigate('users') : null}
            onLogs={isAdmin ? () => navigate('logs') : null}
            onObservation={isAdmin ? () => navigate('observation') : null}
            onLogout={handleLogout}
            canWrite={canWrite}
            currentUser={currentUser}
            sideCharts={<LiveCharts products={infProducts.items} />}
          />
          {isAdmin && <GeneratorPanel realtime={realtime} online={online} />}
        </>
      )}

      {view === 'detail' && selected && (
        <DetailView
          key={transKey}
          product={selected}
          onBack={() => navigate('master')}
          onEdit={id => navigate('edit', { id })}
          onDelete={handleDelete}
          onAtelier={() => navigate('atelier')}
          online={online}
          canWrite={canWrite}
        />
      )}

      {view === 'stats' && (
        <StatisticsView
          key={transKey}
          products={allProducts}
          onBack={() => navigate('master')}
          onAdd={() => navigate('addFromStats')}
          onEdit={handleEditFromStats}
          onDelete={handleDeleteFromStats}
        />
      )}

      {view === 'users' && isAdmin && (
        <UsersView
          key={transKey}
          currentUser={currentUser}
          onBack={() => navigate('master')}
        />
      )}

      {view === 'observation' && isAdmin && (
        <ObservationListView
          key={transKey}
          onBack={() => navigate('master')}
        />
      )}

      {view === 'logs' && isAdmin && (
        <ActionLogsView
          key={transKey}
          onBack={() => navigate('master')}
        />
      )}

      {canWrite && (view === 'add' || view === 'addFromStats') && (
        <div className="form-page page-enter" key={transKey}>
          <div className="form-wrap">
            <button className="form-back-btn"
              onClick={() => navigate(view === 'addFromStats' ? 'stats' : 'master')}>← BACK</button>
            <ProductForm title="New Product" onSave={handleAdd}
              onCancel={() => navigate(view === 'addFromStats' ? 'stats' : 'master')} />
          </div>
        </div>
      )}

      {canWrite && (view === 'edit' || view === 'editFromStats') && selected && (
        <div className="form-page page-enter" key={transKey}>
          <div className="form-wrap">
            <button className="form-back-btn"
              onClick={() => navigate(view === 'editFromStats' ? 'stats' : 'detail', { id: selectedId })}>← BACK</button>
            <ProductForm title={`Edit — ${selected.name}`} initial={selected}
              onSave={handleUpdate}
              onCancel={() => navigate(view === 'editFromStats' ? 'stats' : 'detail', { id: selectedId })} />
          </div>
        </div>
      )}

      {view === 'atelier' && (
        <AtelierMode key={transKey} products={allProducts} onBack={() => navigate('master')} />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Chat — Step 2 (Silver): floating panel for all logged-in users */}
      <ChatPanel realtime={realtime} currentUser={currentUser} />
    </>
  );
}

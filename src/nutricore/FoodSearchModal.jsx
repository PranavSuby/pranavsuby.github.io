import { useState, useEffect } from 'react';
import { Search, ScanLine, X, Star, Globe, Loader } from 'lucide-react';
import { getFoodsPage, getCustomFoods, getRecentFoods, getFavoriteFoods, toggleFavorite, searchFoodsDb } from './db';
import { searchFoods } from './nutrition';
import { searchOFF } from './openfoodfacts';
import useDragToClose from '../ui/useDragToClose';
import useBackClose from '../ui/navStack';
import FoodIcon from './FoodIcon';

const TABS = [['all', 'All'], ['recent', 'Recent'], ['favorites', 'Favorites'], ['custom', 'Custom']];

function sourceLabel(f) {
  if (f.brand === 'Recipe') return 'Meal';
  if (f.isCustom)           return 'Custom';
  if (f.scanned || f.sourceDb === 'custom') return 'Scanned';
  return (f.sourceDb || 'Food').toUpperCase();
}
function servingSub(f) {
  if (f.servingUnit) return `1 ${f.servingUnit}`;
  return `${Math.round(f.servingSizeG || 100)} g`;
}

// The single shared food picker — used both when adding a food to a day (diary) and when
// adding an ingredient to a meal. Tapping a food calls onPick(food). Optional props let
// the diary add online search, a favorite-star toggle, and a footer action bar.
export default function FoodSearchModal({
  onPick, onClose, onScan, title = 'Add Food',
  footer = null, enableOnline = false, onPickOnline,
}) {
  const { panelRef, handleProps, zoneProps } = useDragToClose(onClose);
  useBackClose(onClose);
  const [query, setQuery] = useState('');
  const [tab,   setTab]   = useState('all');
  const [browse,  setBrowse]  = useState([]);  // paged slice of All Foods (empty query)
  const [results, setResults] = useState([]);  // indexed search results (typed query)
  const [customs, setCustoms] = useState([]);
  const [recents, setRecents] = useState([]);
  const [favs,  setFavs]  = useState([]);
  const [favSet, setFavSet] = useState(new Set());
  const [limit, setLimit] = useState(50);
  const [online, setOnline] = useState([]);
  const [onlineState, setOnlineState] = useState('idle'); // idle | loading | done | error

  const q = query.trim();

  useEffect(() => {
    getRecentFoods().then(setRecents);
    getCustomFoods().then(setCustoms);
    getFavoriteFoods().then(fv => { setFavs(fv); setFavSet(new Set(fv.map(f => f.id))); });
  }, []);
  useEffect(() => { setLimit(50); }, [tab, query]);
  useEffect(() => { setOnline([]); setOnlineState('idle'); }, [query]);

  // All tab, no query: browse the store in pages (grown by scrolling) instead of
  // loading every food into state.
  useEffect(() => {
    if (tab !== 'all' || q) return;
    let on = true;
    getFoodsPage(limit).then(f => { if (on) setBrowse(f); });
    return () => { on = false; };
  }, [tab, q, limit]);

  // All tab, typed query: debounced IndexedDB token search.
  useEffect(() => {
    if (tab !== 'all' || !q) { setResults([]); return; }
    let on = true;
    const t = setTimeout(() => {
      searchFoodsDb(q, { limit: 200 }).then(r => { if (on) setResults(r); });
    }, 150);
    return () => { on = false; clearTimeout(t); };
  }, [tab, q]);

  // Recent/Favorites/Custom are small in-memory lists — filter them client-side.
  const base = tab === 'recent'    ? (q ? searchFoods(recents, q) : recents)
             : tab === 'favorites' ? (q ? searchFoods(favs, q)    : favs)
             : tab === 'custom'    ? (q ? searchFoods(customs, q) : customs)
             : q ? results : browse;
  const list = base.slice(0, limit);

  function onScroll(e) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
      setLimit(l => (base.length >= l ? l + 50 : l));
    }
  }

  async function handleSearchOnline() {
    if (!q) return;
    setOnlineState('loading');
    try { setOnline(await searchOFF(q)); setOnlineState('done'); }
    catch { setOnlineState('error'); }
  }

  async function handleToggleFav(e, food) {
    e.stopPropagation();
    const isNowFav = await toggleFavorite(food.id);
    setFavSet(prev => {
      const next = new Set(prev);
      isNowFav ? next.add(food.id) : next.delete(food.id);
      return next;
    });
    setFavs(prev => (isNowFav
      ? [food, ...prev.filter(f => f.id !== food.id)]
      : prev.filter(f => f.id !== food.id)));
  }

  return (
    <div className="nc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nc-picker" ref={panelRef}>
        <div className="nc-sheet-grip" {...handleProps} />
        <div className="nc-picker-header" {...zoneProps}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--nc-text2)', cursor: 'pointer', flexShrink: 0 }}>
              <X size={20} />
            </button>
            <div className="nc-search-bar" style={{ flex: 1, marginBottom: 0 }}>
              <Search size={15} className="nc-search-icon" />
              <input autoFocus placeholder="Search all foods…" value={query} onChange={e => setQuery(e.target.value)} />
              {query && <button className="nc-search-clear" onClick={() => setQuery('')}>✕</button>}
            </div>
            {onScan && (
              <button title="Scan barcode" onClick={onScan}
                style={{ background: 'none', border: 'none', color: 'var(--nc-text2)', cursor: 'pointer', flexShrink: 0, display: 'flex' }}>
                <ScanLine size={21} />
              </button>
            )}
          </div>
          <div className="nc-picker-tabs">
            {TABS.map(([id, label]) => (
              <button key={id} className={`nc-picker-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="nc-picker-list" onScroll={onScroll}>
          {list.length === 0 ? (
            <div className="nc-picker-empty">
              {q ? `No results for "${q}"` : tab === 'recent' ? 'No recently logged foods yet' : tab === 'favorites' ? 'No favorites yet — tap ★ on any food' : tab === 'custom' ? 'No custom or scanned foods yet' : 'No foods'}
            </div>
          ) : list.map(food => (
            <div key={food.id} className="nc-food-row" onClick={() => onPick(food)}>
              <FoodIcon food={food} />
              <div className="nc-food-body">
                <div className="nc-food-name">{food.name}</div>
                <div className="nc-food-brand">{food.brand && food.brand !== 'Recipe' ? `${food.brand} · ` : ''}{servingSub(food)}</div>
              </div>
              <div style={{ fontSize: 10, color: 'var(--nc-text3)', flexShrink: 0, textAlign: 'right', lineHeight: 1.2 }}>
                {sourceLabel(food)}
              </div>
              <button className={`nc-fav-btn${favSet.has(food.id) ? ' active' : ''}`} onClick={e => handleToggleFav(e, food)}>
                <Star size={15} fill={favSet.has(food.id) ? 'currentColor' : 'none'} />
              </button>
            </div>
          ))}

          {/* Online search (Open Food Facts) */}
          {enableOnline && q && (
            <div style={{ padding: '10px 0' }}>
              {onlineState !== 'done' && (
                <button className="nc-add-custom-btn" onClick={handleSearchOnline} disabled={onlineState === 'loading'}
                  style={{ justifyContent: 'center', color: 'var(--nc-accent)' }}>
                  {onlineState === 'loading'
                    ? <><Loader size={16} className="nc-spin" /> Searching online…</>
                    : <><Globe size={16} /> Search Open Food Facts</>}
                </button>
              )}
              {onlineState === 'error' && (
                <div className="nc-picker-empty" style={{ padding: '10px 0' }}>Couldn’t reach Open Food Facts.</div>
              )}
              {onlineState === 'done' && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--nc-text3)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 14px' }}>
                    Online results
                  </div>
                  {online.length === 0 ? (
                    <div className="nc-picker-empty" style={{ padding: '8px 0' }}>No online matches.</div>
                  ) : online.map((food, i) => (
                    <div key={`off-${i}`} className="nc-food-row" onClick={() => (onPickOnline || onPick)(food)}>
                      <div className="nc-food-icon cat-other"><Globe size={15} /></div>
                      <div className="nc-food-body">
                        <div className="nc-food-name">{food.name}</div>
                        {food.brand && <div className="nc-food-brand">{food.brand}</div>}
                      </div>
                      <div className="nc-food-meta">
                        <div className="nc-food-kcal">{Math.round(food.kcal)}</div>
                        <div className="nc-food-per">kcal/100g</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {footer && <div style={{ borderTop: '1px solid var(--nc-border)', flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  );
}

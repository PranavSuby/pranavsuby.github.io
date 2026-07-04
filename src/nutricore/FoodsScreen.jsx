import { useState, useEffect } from 'react';
import { Search, Plus, Pencil } from 'lucide-react';
import { getFoodsPage, getCustomFoods, searchFoodsDb } from './db';
import { searchFoods } from './nutrition';
import CustomFoodModal from './CustomFoodModal';
import RecipeModal from './RecipeModal';
import FoodIcon from './FoodIcon';

const CATEGORY_EMOJI = {
  protein: '🥩', dairy: '🥛', grain: '🌾', vegetable: '🥦',
  fruit: '🍎', fat: '🫒', beverage: '☕', supplement: '💊', other: '🟤',
};

const TABS = [['mine', 'My Foods'], ['meals', 'My Meals'], ['all', 'All Foods']];

export default function FoodsScreen() {
  const [customs, setCustoms] = useState([]);  // user-created foods, scans, and meals
  const [browse,  setBrowse]  = useState([]);  // paged slice of All Foods (empty query)
  const [results, setResults] = useState([]);  // indexed search results (typed query)
  const [query,   setQuery]   = useState('');
  const [tab,     setTab]     = useState('mine');
  const [editing, setEditing] = useState(null);   // food object, 'new', or null
  const [creatingMeal, setCreatingMeal] = useState(false);
  const [limit,   setLimit]   = useState(60);
  const [refresh, setRefresh] = useState(0);

  const q = query.trim();
  const load = () => setRefresh(r => r + 1);

  useEffect(() => { getCustomFoods().then(setCustoms); }, [refresh]);
  useEffect(() => { setLimit(60); }, [tab, query]);

  // All Foods, no query: browse the store in pages (grown by scrolling) instead of
  // holding every food in state.
  useEffect(() => {
    if (tab !== 'all' || q) return;
    let on = true;
    getFoodsPage(limit).then(f => { if (on) setBrowse(f); });
    return () => { on = false; };
  }, [tab, q, limit, refresh]);

  // All Foods, typed query: debounced IndexedDB token search.
  useEffect(() => {
    if (tab !== 'all' || !q) { setResults([]); return; }
    let on = true;
    const t = setTimeout(() => {
      searchFoodsDb(q, { limit: 200 }).then(r => { if (on) setResults(r); });
    }, 150);
    return () => { on = false; clearTimeout(t); };
  }, [tab, q, refresh]);

  const isRecipe = f => f.brand === 'Recipe';
  // "My Foods" = anything the user created or scanned. Custom foods and barcode-scanned
  // products both carry sourceDb 'custom'; bundled foods are 'USDA …'.
  const mine  = customs.filter(f => !isRecipe(f));
  const mealsList = customs.filter(isRecipe);

  const base = tab === 'mine'  ? (q ? searchFoods(mine, q)      : mine)
             : tab === 'meals' ? (q ? searchFoods(mealsList, q) : mealsList)
             : q ? results : browse;
  const list = base.slice(0, limit);
  const editable = tab !== 'all'; // created foods/meals are editable; bundled DB foods aren't

  function onListScroll(e) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 240) {
      setLimit(l => (base.length >= l ? l + 60 : l));
    }
  }

  const emptyMsg = q ? `No results for "${q}"`
    : tab === 'mine'  ? 'No custom foods yet — tap “Create Custom Food”.'
    : tab === 'meals' ? 'No meals yet — tap “Create Meal” to combine foods into one.'
    : 'No foods.';

  return (
    <div className="nc-screen">
      <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
        <div className="nc-search-bar" style={{ marginBottom: 10 }}>
          <Search size={15} className="nc-search-icon" />
          <input placeholder="Search foods…" value={query} onChange={e => setQuery(e.target.value)} />
          {query && <button className="nc-search-clear" onClick={() => setQuery('')}>✕</button>}
        </div>
        <div className="nc-picker-tabs" style={{ padding: 0, borderBottom: 'none' }}>
          {TABS.map(([id, label]) => (
            <button key={id} className={`nc-picker-tab${tab === id ? ' active' : ''}`} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="nc-picker-list" style={{ flex: 1 }} onScroll={onListScroll}>
        {list.length === 0 ? (
          <div className="nc-picker-empty">{emptyMsg}</div>
        ) : list.map(food => (
          <div key={food.id} className="nc-food-row"
            onClick={editable ? () => setEditing(food) : undefined}
            style={editable ? undefined : { cursor: 'default' }}>
            <FoodIcon food={food} />
            <div className="nc-food-body">
              <div className="nc-food-name">{food.name}</div>
              {food.brand && <div className="nc-food-brand">{food.brand}</div>}
            </div>
            <div className="nc-food-meta">
              <div className="nc-food-kcal">{Math.round(food.kcal)}</div>
              <div className="nc-food-per">kcal/100g</div>
            </div>
            {editable && (
              <button className="nc-fav-btn" onClick={e => { e.stopPropagation(); setEditing(food); }}>
                <Pencil size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '8px 16px calc(12px + env(safe-area-inset-bottom, 0px))', flexShrink: 0, borderTop: '1px solid var(--nc-border)' }}>
        {tab === 'meals' ? (
          <button className="nc-add-food-btn" style={{ justifyContent: 'center' }} onClick={() => setCreatingMeal(true)}>
            <Plus size={16} /> Create Meal
          </button>
        ) : (
          <button className="nc-add-food-btn" style={{ justifyContent: 'center' }} onClick={() => setEditing('new')}>
            <Plus size={16} /> Create Custom Food
          </button>
        )}
      </div>

      {editing && editing !== 'new' && isRecipe(editing) ? (
        <RecipeModal
          meal={editing}
          onSaved={() => { setEditing(null); load(); }}
          onClose={() => setEditing(null)}
        />
      ) : editing ? (
        <div className="nc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <CustomFoodModal
            food={editing === 'new' ? null : editing}
            onSaved={() => { setEditing(null); load(); }}
            onClose={() => setEditing(null)}
          />
        </div>
      ) : null}

      {creatingMeal && (
        <RecipeModal
          onSaved={() => { setCreatingMeal(false); load(); }}
          onClose={() => setCreatingMeal(false)}
        />
      )}
    </div>
  );
}

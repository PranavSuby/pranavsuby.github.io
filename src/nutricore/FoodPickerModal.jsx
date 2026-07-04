import { useState } from 'react';
import { Plus, ChefHat, Zap } from 'lucide-react';
import { saveFood } from './db';
import ServingEditorModal from './ServingEditorModal';
import CustomFoodModal from './CustomFoodModal';
import BarcodeScanner from './BarcodeScanner';
import RecipeModal from './RecipeModal';
import QuickAddModal from './QuickAddModal';
import FoodSearchModal from './FoodSearchModal';
import useBackClose from '../ui/navStack';

// Diary "Add Food" flow. The browse UI is the shared FoodSearchModal (same component
// used by the meal builder); this wrapper adds the diary-specific actions: serving
// editor on pick, online lookup, quick-add, create custom food / meal, and scanning.
export default function FoodPickerModal({ meals, defaultMealId, onLog, onClose }) {
  const [selected,   setSelected]   = useState(null);
  const [showCustom, setShowCustom] = useState(false);
  const [showScan,   setShowScan]   = useState(false);
  const [showRecipe, setShowRecipe] = useState(false);
  const [showQuick,  setShowQuick]  = useState(false);

  // The scan branch renders inline (not a self-registering child), so wire its Back here.
  // The other branches render components that register themselves with the nav stack.
  useBackClose(() => setShowScan(false), showScan);

  // Online (Open Food Facts) and scanned results arrive without an id; they're only
  // persisted when the user actually logs them (see handleLog), so backing out of the
  // editor doesn't pollute the foods store.
  async function handleLog(entryData) {
    let data = entryData;
    if (selected && selected.id == null) {
      const id = await saveFood(selected);
      data = { ...data, foodId: id };
    }
    await onLog(data);
    setSelected(null);
  }

  function handleCustomSaved(food) {
    setShowCustom(false);
    if (food) setSelected(food);
  }

  function handleRecipeSaved(food, info) {
    setShowRecipe(false);
    if (!food) return;            // deleted
    if (info?.logged) return;     // already added to the diary via onLog
    setSelected(food);            // not logged — open the serving editor to log it
  }

  function handleBarcodeFound(food) {
    setShowScan(false);
    setSelected(food);
  }

  // Sub-modal: barcode
  if (showScan) {
    return (
      <div className="nc-modal-overlay">
        <div className="nc-picker">
          <div className="nc-picker-header">
            <div className="nc-picker-title-row">
              <span className="nc-picker-title">Scan Barcode</span>
              <button className="nc-picker-close" onClick={() => setShowScan(false)}>✕</button>
            </div>
          </div>
          <div className="nc-picker-list">
            <BarcodeScanner onFound={handleBarcodeFound} onNotFound={() => { setShowScan(false); setShowCustom(true); }} />
          </div>
        </div>
      </div>
    );
  }

  // Sub-modal: custom food
  if (showCustom) {
    return (
      <div className="nc-modal-overlay">
        <CustomFoodModal meals={meals} onSaved={handleCustomSaved} onClose={() => setShowCustom(false)} />
      </div>
    );
  }

  // Sub-modal: meal builder
  if (showRecipe) {
    return <RecipeModal onClose={() => setShowRecipe(false)} onSaved={handleRecipeSaved} onLog={onLog} />;
  }

  // Sub-modal: quick add
  if (showQuick) {
    return (
      <QuickAddModal
        meals={meals}
        defaultMealId={defaultMealId}
        onLog={async (ed) => { await onLog(ed); setShowQuick(false); }}
        onClose={() => setShowQuick(false)}
      />
    );
  }

  // Sub-modal: serving editor
  if (selected) {
    return (
      <div className="nc-modal-overlay">
        <ServingEditorModal
          food={selected}
          meals={meals}
          defaultMealId={defaultMealId}
          onLog={handleLog}
          onBack={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <FoodSearchModal
      title="Add Food"
      onPick={setSelected}
      onClose={onClose}
      onScan={() => setShowScan(true)}
      enableOnline
      footer={
        <>
          <button className="nc-add-custom-btn" onClick={() => setShowQuick(true)}>
            <Zap size={16} /> Quick Add Calories
          </button>
          <button className="nc-add-custom-btn" onClick={() => setShowRecipe(true)}>
            <ChefHat size={16} /> Create Meal
          </button>
          <button className="nc-add-custom-btn" onClick={() => setShowCustom(true)}>
            <Plus size={16} /> Create Custom Food
          </button>
        </>
      }
    />
  );
}

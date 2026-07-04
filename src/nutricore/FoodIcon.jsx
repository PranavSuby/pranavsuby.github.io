import { Barcode } from 'lucide-react';

const CATEGORY_EMOJI = {
  protein: '🥩', dairy: '🥛', grain: '🌾', vegetable: '🥦',
  fruit: '🍎', fat: '🫒', beverage: '☕', supplement: '💊', other: '🟤',
};

// Round food avatar. Barcode-scanned products get a distinct barcode glyph + teal
// chip instead of the generic category emoji.
export default function FoodIcon({ food, className = 'nc-food-icon', size = 17 }) {
  if (food?.scanned) {
    return (
      <div className={`${className} cat-scanned`}>
        <Barcode size={size} />
      </div>
    );
  }
  return (
    <div className={`${className} cat-${food?.category || 'other'}`}>
      {CATEGORY_EMOJI[food?.category] || '🍽️'}
    </div>
  );
}

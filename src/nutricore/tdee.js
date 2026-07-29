// Mifflin-St Jeor BMR + activity multiplier + goal adjustment (per spec §9.1)

export const ACTIVITY_LEVELS = [
  { value: 'sedentary',         label: 'Sedentary',           multiplier: 1.2,   desc: 'Little or no exercise' },
  { value: 'lightlyActive',     label: 'Lightly Active',      multiplier: 1.375, desc: 'Light exercise 1–3 days/week' },
  { value: 'moderatelyActive',  label: 'Moderately Active',   multiplier: 1.55,  desc: 'Moderate exercise 3–5 days/week' },
  { value: 'veryActive',        label: 'Very Active',         multiplier: 1.725, desc: 'Hard exercise 6–7 days/week' },
  { value: 'extraActive',       label: 'Extra Active',        multiplier: 1.9,   desc: 'Very hard exercise & physical job' },
];

export const GOAL_TYPES = [
  { value: 'lose',     label: 'Lose Weight',     pPct: 0.35, cPct: 0.35, fPct: 0.30 },
  { value: 'maintain', label: 'Maintain Weight', pPct: 0.30, cPct: 0.40, fPct: 0.30 },
  { value: 'gain',     label: 'Gain Weight',     pPct: 0.30, cPct: 0.45, fPct: 0.25 },
];

export function computeBMR({ sex, ageYears, heightCm, weightKg }) {
  const male   = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  const female = 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
  const base = sex === 'female' ? female : sex === 'male' ? male : (male + female) / 2;
  return Math.max(1000, base);
}

// Daily calorie + macro targets for a given expenditure. Works for both the
// formula TDEE and the adaptive (observed) TDEE, so coached weekly adjustments
// produce the same macro split the Goals screen shows.
export function computeTargetsFromTdee(profile, tdee) {
  const { goalType = 'maintain', goalRateKgWeek = 0 } = profile;

  const kcalPerKg    = 7700;
  const weeklyDelta  = (goalRateKgWeek || 0) * kcalPerKg;
  const dailyDelta   = weeklyDelta / 7;

  let targetKcal;
  if (goalType === 'lose')     targetKcal = Math.max(1200, tdee - dailyDelta);
  else if (goalType === 'gain') targetKcal = tdee + dailyDelta;
  else                          targetKcal = tdee;

  const goalObj = GOAL_TYPES.find(g => g.value === goalType) || GOAL_TYPES[1];

  return {
    kcal:     Math.round(targetKcal),
    proteinG: Math.round((targetKcal * goalObj.pPct) / 4),
    carbsG:   Math.round((targetKcal * goalObj.cPct) / 4),
    fatG:     Math.round((targetKcal * goalObj.fPct) / 9),
  };
}

export function computeTDEE(profile) {
  const {
    sex, dateOfBirth, heightCm, weightKg,
    activityLevel = 'moderatelyActive',
  } = profile;

  const ageYears = dateOfBirth
    ? Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
    : 30;

  const bmr  = computeBMR({ sex: sex || 'male', ageYears, heightCm: heightCm || 175, weightKg: weightKg || 75 });
  const actObj = ACTIVITY_LEVELS.find(a => a.value === activityLevel) || ACTIVITY_LEVELS[2];
  const tdee = bmr * actObj.multiplier;

  return {
    ...computeTargetsFromTdee(profile, tdee),
    tdee: Math.round(tdee),
    bmr:  Math.round(bmr),
  };
}

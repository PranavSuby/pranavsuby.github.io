// Dietary Reference Intakes — NIH/USDA 2020 guidelines, per day

export function getDRI(profile) {
  const sex = profile?.sex || 'male';
  const isMale = sex !== 'female';
  const age = profile?.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth)) / (365.25 * 24 * 3600 * 1000))
    : 30;
  const older = age >= 51;

  return {
    fiberG:        isMale ? 38 : 25,
    omega3G:       isMale ? 1.6 : 1.1,
    omega6G:       isMale ? 17 : 12,
    calciumMg:     older ? 1200 : 1000,
    ironMg:        isMale ? 8 : (older ? 8 : 18),
    magnesiumMg:   isMale ? (older ? 420 : 400) : (older ? 320 : 310),
    potassiumMg:   isMale ? 3400 : 2600,
    sodiumMg:      2300,
    zincMg:        isMale ? 11 : 8,
    copperMg:      0.9,
    seleniumMcg:   55,
    vitaminAMcg:   isMale ? 900 : 700,
    vitaminCMg:    isMale ? 90 : 75,
    vitaminDMcg:   15,
    vitaminEMg:    15,
    vitaminKMcg:   isMale ? 120 : 90,
    thiamineMg:    isMale ? 1.2 : 1.1,
    riboflavinMg:  isMale ? 1.3 : 1.1,
    niacinMg:      isMale ? 16 : 14,
    b6Mg:          older ? (isMale ? 1.7 : 1.5) : 1.3,
    folateMcg:     400,
    b12Mcg:        2.4,
  };
}

export function computeScores(totals, goals, dri) {
  function p(a, t) { return t > 0 ? Math.min(1, (a || 0) / t) : 0; }
  function avg(pairs) { return Math.round(pairs.reduce((s, [a, t]) => s + p(a, t), 0) / pairs.length * 100); }

  return {
    allTargets: avg([
      [totals.kcal,      goals.kcal],
      [totals.proteinG,  goals.proteinG],
      [totals.carbsG,    goals.carbsG],
      [totals.fatG,      goals.fatG],
      [totals.fiberG,    dri.fiberG],
    ]),
    vitamins: avg([
      [totals.vitaminAMcg, dri.vitaminAMcg], [totals.vitaminCMg,  dri.vitaminCMg],
      [totals.vitaminDMcg, dri.vitaminDMcg], [totals.vitaminEMg,  dri.vitaminEMg],
      [totals.vitaminKMcg, dri.vitaminKMcg], [totals.thiamineMg,  dri.thiamineMg],
      [totals.riboflavinMg,dri.riboflavinMg],[totals.niacinMg,    dri.niacinMg],
      [totals.b6Mg,        dri.b6Mg],        [totals.folateMcg,   dri.folateMcg],
      [totals.b12Mcg,      dri.b12Mcg],
    ]),
    minerals: avg([
      [totals.calciumMg,   dri.calciumMg],   [totals.ironMg,      dri.ironMg],
      [totals.magnesiumMg, dri.magnesiumMg],  [totals.potassiumMg, dri.potassiumMg],
      [totals.zincMg,      dri.zincMg],       [totals.copperMg,    dri.copperMg],
      [totals.seleniumMcg, dri.seleniumMcg],
    ]),
    electrolytes: avg([
      [totals.potassiumMg, dri.potassiumMg],
      [totals.magnesiumMg, dri.magnesiumMg],
      [totals.calciumMg,   dri.calciumMg],
    ]),
    immuneSupport: avg([
      [totals.vitaminCMg,  dri.vitaminCMg],  [totals.vitaminDMcg, dri.vitaminDMcg],
      [totals.vitaminEMg,  dri.vitaminEMg],  [totals.zincMg,      dri.zincMg],
      [totals.ironMg,      dri.ironMg],       [totals.seleniumMcg, dri.seleniumMcg],
    ]),
    antioxidants: avg([
      [totals.vitaminCMg,  dri.vitaminCMg],
      [totals.vitaminEMg,  dri.vitaminEMg],
      [totals.seleniumMcg, dri.seleniumMcg],
    ]),
    boneHealth: avg([
      [totals.calciumMg,   dri.calciumMg],   [totals.vitaminDMcg, dri.vitaminDMcg],
      [totals.vitaminKMcg, dri.vitaminKMcg], [totals.magnesiumMg, dri.magnesiumMg],
    ]),
    metabolismSupport: avg([
      [totals.thiamineMg,   dri.thiamineMg],  [totals.riboflavinMg,dri.riboflavinMg],
      [totals.niacinMg,     dri.niacinMg],    [totals.b6Mg,        dri.b6Mg],
      [totals.b12Mcg,       dri.b12Mcg],      [totals.ironMg,      dri.ironMg],
      [totals.magnesiumMg,  dri.magnesiumMg],
    ]),
  };
}

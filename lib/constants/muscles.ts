export type MuscleRegion = "upper" | "lower" | "foot";

export interface Muscle {
  key: string;
  namePl: string;
  nameLatin: string;
  region: MuscleRegion;
}

/**
 * Versioned FMS muscle catalog (68 muscles) from docs/spec/original-spec.md
 * "Baza mięśni - Diagnostyka FMS (68 mięśni)". Keys are stable identifiers
 * stored in diagnostic_findings.muscle_key; renaming a key is a catalog
 * version bump, not a DB migration.
 */
export const MUSCLES: Muscle[] = [
  // Góra (30)
  { key: "anterior_deltoid", namePl: "Naramienny przedni", nameLatin: "Anterior Deltoid", region: "upper" },
  { key: "lateral_deltoid", namePl: "Naramienny boczny", nameLatin: "Lateral Deltoid", region: "upper" },
  { key: "posterior_deltoid", namePl: "Naramienny tylny", nameLatin: "Posterior Deltoid", region: "upper" },
  { key: "upper_trapezius", namePl: "Czworoboczny górny", nameLatin: "Upper Trapezius", region: "upper" },
  { key: "middle_trapezius", namePl: "Czworoboczny środkowy", nameLatin: "Middle Trapezius", region: "upper" },
  { key: "lower_trapezius", namePl: "Czworoboczny dolny", nameLatin: "Lower Trapezius", region: "upper" },
  { key: "latissimus_dorsi", namePl: "Najszerszy grzbietu", nameLatin: "Latissimus Dorsi", region: "upper" },
  { key: "pectoralis_major", namePl: "Piersiowy większy", nameLatin: "Pectoralis Major", region: "upper" },
  { key: "pectoralis_minor", namePl: "Piersiowy mniejszy", nameLatin: "Pectoralis Minor", region: "upper" },
  { key: "biceps_brachii", namePl: "Dwugłowy ramienia", nameLatin: "Biceps Brachii", region: "upper" },
  { key: "triceps_brachii", namePl: "Trójgłowy ramienia", nameLatin: "Triceps Brachii", region: "upper" },
  { key: "brachioradialis", namePl: "Ramienno-promieniowy", nameLatin: "Brachioradialis", region: "upper" },
  { key: "rhomboid", namePl: "Równoległoboczny", nameLatin: "Rhomboid", region: "upper" },
  { key: "serratus_anterior", namePl: "Zębaty przedni", nameLatin: "Serratus Anterior", region: "upper" },
  { key: "supraspinatus", namePl: "Nadgrzebieniowy", nameLatin: "Supraspinatus", region: "upper" },
  { key: "infraspinatus", namePl: "Podgrzebieniowy", nameLatin: "Infraspinatus", region: "upper" },
  { key: "subscapularis", namePl: "Podłopatkowy", nameLatin: "Subscapularis", region: "upper" },
  { key: "teres_minor", namePl: "Obły mniejszy", nameLatin: "Teres Minor", region: "upper" },
  { key: "teres_major", namePl: "Obły większy", nameLatin: "Teres Major", region: "upper" },
  { key: "levator_scapulae", namePl: "Dźwigacz łopatki", nameLatin: "Levator Scapulae", region: "upper" },
  { key: "erector_spinae", namePl: "Prostowniki grzbietu", nameLatin: "Erector Spinae", region: "upper" },
  { key: "rectus_abdominis", namePl: "Prosty brzucha", nameLatin: "Rectus Abdominis", region: "upper" },
  { key: "external_oblique", namePl: "Skośny zewnętrzny", nameLatin: "External Oblique", region: "upper" },
  { key: "internal_oblique", namePl: "Skośny wewnętrzny", nameLatin: "Internal Oblique", region: "upper" },
  { key: "transversus_abdominis", namePl: "Poprzeczny brzucha", nameLatin: "Transversus Abdominis", region: "upper" },
  { key: "wrist_extensors", namePl: "Prostownik nadgarstka", nameLatin: "Wrist Extensors", region: "upper" },
  { key: "wrist_flexors", namePl: "Zginacz nadgarstka", nameLatin: "Wrist Flexors", region: "upper" },
  { key: "diaphragm", namePl: "Przepona", nameLatin: "Diaphragm", region: "upper" },
  { key: "multifidus", namePl: "Wielodzielny", nameLatin: "Multifidus", region: "upper" },
  { key: "quadratus_lumborum", namePl: "Czworoboczny lędźwi", nameLatin: "Quadratus Lumborum", region: "upper" },

  // Dół (24)
  { key: "rectus_femoris", namePl: "Czworogłowy uda – prosty", nameLatin: "Rectus Femoris", region: "lower" },
  { key: "vastus_lateralis", namePl: "Czworogłowy – boczny", nameLatin: "Vastus Lateralis", region: "lower" },
  { key: "vastus_medialis", namePl: "Czworogłowy – przyśrodkowy", nameLatin: "Vastus Medialis", region: "lower" },
  { key: "vastus_intermedius", namePl: "Czworogłowy – pośredni", nameLatin: "Vastus Intermedius", region: "lower" },
  { key: "biceps_femoris", namePl: "Dwugłowy uda", nameLatin: "Biceps Femoris", region: "lower" },
  { key: "semitendinosus", namePl: "Półścięgnisty", nameLatin: "Semitendinosus", region: "lower" },
  { key: "semimembranosus", namePl: "Półbłoniasty", nameLatin: "Semimembranosus", region: "lower" },
  { key: "gluteus_maximus", namePl: "Pośladkowy wielki", nameLatin: "Gluteus Maximus", region: "lower" },
  { key: "gluteus_medius", namePl: "Pośladkowy średni", nameLatin: "Gluteus Medius", region: "lower" },
  { key: "gluteus_minimus", namePl: "Pośladkowy mały", nameLatin: "Gluteus Minimus", region: "lower" },
  { key: "adductor_longus", namePl: "Przywodziciel długi", nameLatin: "Adductor Longus", region: "lower" },
  { key: "adductor_magnus", namePl: "Przywodziciel wielki", nameLatin: "Adductor Magnus", region: "lower" },
  { key: "adductor_brevis", namePl: "Przywodziciel krótki", nameLatin: "Adductor Brevis", region: "lower" },
  { key: "gracilis", namePl: "Smukły", nameLatin: "Gracilis", region: "lower" },
  { key: "tensor_fasciae_latae", namePl: "Naprężacz powięzi szerokiej (TFL)", nameLatin: "Tensor Fasciae Latae", region: "lower" },
  { key: "iliopsoas", namePl: "Biodrowo-lędźwiowy", nameLatin: "Iliopsoas", region: "lower" },
  { key: "piriformis", namePl: "Gruszkowaty", nameLatin: "Piriformis", region: "lower" },
  { key: "gastrocnemius", namePl: "Brzuchaty łydki", nameLatin: "Gastrocnemius", region: "lower" },
  { key: "soleus", namePl: "Płaszczkowaty", nameLatin: "Soleus", region: "lower" },
  { key: "tibialis_anterior", namePl: "Piszczelowy przedni", nameLatin: "Tibialis Anterior", region: "lower" },
  { key: "peroneus_longus", namePl: "Strzałkowy długi", nameLatin: "Peroneus Longus", region: "lower" },
  { key: "peroneus_brevis", namePl: "Strzałkowy krótki", nameLatin: "Peroneus Brevis", region: "lower" },
  { key: "popliteus", namePl: "Podkolanowy", nameLatin: "Popliteus", region: "lower" },
  { key: "sartorius", namePl: "Krawiecki", nameLatin: "Sartorius", region: "lower" },

  // Stopa (14)
  { key: "flexor_digitorum_brevis", namePl: "Zginacz krótki palców", nameLatin: "Flexor Digitorum Brevis", region: "foot" },
  { key: "flexor_digitorum_longus", namePl: "Zginacz długi palców", nameLatin: "Flexor Digitorum Longus", region: "foot" },
  { key: "abductor_hallucis", namePl: "Odwodziciel palucha", nameLatin: "Abductor Hallucis", region: "foot" },
  { key: "adductor_hallucis", namePl: "Przywodziciel palucha", nameLatin: "Adductor Hallucis", region: "foot" },
  { key: "flexor_hallucis_brevis", namePl: "Zginacz krótki palucha", nameLatin: "Flexor Hallucis Brevis", region: "foot" },
  { key: "flexor_hallucis_longus", namePl: "Zginacz długi palucha", nameLatin: "Flexor Hallucis Longus", region: "foot" },
  { key: "extensor_digitorum_brevis", namePl: "Prostownik krótki palców", nameLatin: "Extensor Digitorum Brevis", region: "foot" },
  { key: "extensor_digitorum_longus", namePl: "Prostownik długi palców", nameLatin: "Extensor Digitorum Longus", region: "foot" },
  { key: "dorsal_interossei", namePl: "Mięśnie międzykostne grzbietowe", nameLatin: "Dorsal Interossei", region: "foot" },
  { key: "plantar_interossei", namePl: "Mięśnie międzykostne podeszwowe", nameLatin: "Plantar Interossei", region: "foot" },
  { key: "lumbricals", namePl: "Robaczkowate stopy", nameLatin: "Lumbricals", region: "foot" },
  { key: "quadratus_plantae", namePl: "Czworoboczny podeszwy", nameLatin: "Quadratus Plantae", region: "foot" },
  { key: "tibialis_posterior", namePl: "Piszczelowy tylny", nameLatin: "Tibialis Posterior", region: "foot" },
  { key: "abductor_digiti_minimi", namePl: "Odwodziciel palca małego", nameLatin: "Abductor Digiti Minimi", region: "foot" },
];

export const MUSCLE_KEYS = MUSCLES.map((muscle) => muscle.key) as [
  string,
  ...string[],
];

export function getMuscleByKey(key: string): Muscle | undefined {
  return MUSCLES.find((muscle) => muscle.key === key);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

export function searchMuscles(query: string): Muscle[] {
  const normalized = normalize(query).trim();
  if (!normalized) return MUSCLES;

  return MUSCLES.filter((muscle) =>
    normalize(`${muscle.namePl} ${muscle.nameLatin}`).includes(normalized),
  );
}
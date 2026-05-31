/**
 * FMS muscle database organized by region.
 * Each muscle has a Polish name and Latin name in parentheses.
 */

export const FMS_REGIONS = ["upper", "lower", "foot"] as const;
export type FmsRegion = (typeof FMS_REGIONS)[number];

export const FMS_SIDES = ["left", "right", "center"] as const;
export type FmsSide = (typeof FMS_SIDES)[number];

export const FMS_SEVERITY_LEVELS = ["weak", "very_weak", "dysfunction"] as const;
export type FmsSeverity = (typeof FMS_SEVERITY_LEVELS)[number];

export interface MuscleDefinition {
  key: string;
  label: string;
  latinName: string;
}

export const MUSCLES_BY_REGION: Record<FmsRegion, MuscleDefinition[]> = {
  upper: [
    { key: "anterior_deltoid", label: "Naramienny przedni", latinName: "Anterior Deltoid" },
    { key: "lateral_deltoid", label: "Naramienny boczny", latinName: "Lateral Deltoid" },
    { key: "posterior_deltoid", label: "Naramienny tylny", latinName: "Posterior Deltoid" },
    { key: "upper_trapezius", label: "Czworoboczny górny", latinName: "Upper Trapezius" },
    { key: "middle_trapezius", label: "Czworoboczny środkowy", latinName: "Middle Trapezius" },
    { key: "lower_trapezius", label: "Czworoboczny dolny", latinName: "Lower Trapezius" },
    { key: "latissimus_dorsi", label: "Najszerszy grzbietu", latinName: "Latissimus Dorsi" },
    { key: "pectoralis_major", label: "Piersiowy większy", latinName: "Pectoralis Major" },
    { key: "pectoralis_minor", label: "Piersiowy mniejszy", latinName: "Pectoralis Minor" },
    { key: "biceps_brachii", label: "Dwugłowy ramienia", latinName: "Biceps Brachii" },
    { key: "triceps_brachii", label: "Trójgłowy ramienia", latinName: "Triceps Brachii" },
    { key: "brachioradialis", label: "Ramienno-promieniowy", latinName: "Brachioradialis" },
    { key: "rhomboid", label: "Równoległoboczny", latinName: "Rhomboid" },
    { key: "serratus_anterior", label: "Zębaty przedni", latinName: "Serratus Anterior" },
    { key: "supraspinatus", label: "Nadgrzebieniowy", latinName: "Supraspinatus" },
    { key: "infraspinatus", label: "Podgrzebieniowy", latinName: "Infraspinatus" },
    { key: "subscapularis", label: "Podłopatkowy", latinName: "Subscapularis" },
    { key: "teres_minor", label: "Obły mniejszy", latinName: "Teres Minor" },
    { key: "teres_major", label: "Obły większy", latinName: "Teres Major" },
    { key: "levator_scapulae", label: "Dźwigacz łopatki", latinName: "Levator Scapulae" },
    { key: "erector_spinae", label: "Prostowniki grzbietu", latinName: "Erector Spinae" },
    { key: "rectus_abdominis", label: "Prosty brzucha", latinName: "Rectus Abdominis" },
    { key: "external_oblique", label: "Skośny zewnętrzny", latinName: "External Oblique" },
    { key: "internal_oblique", label: "Skośny wewnętrzny", latinName: "Internal Oblique" },
    { key: "transversus_abdominis", label: "Poprzeczny brzucha", latinName: "Transversus Abdominis" },
    { key: "wrist_extensors", label: "Prostownik nadgarstka", latinName: "Wrist Extensors" },
    { key: "wrist_flexors", label: "Zginacz nadgarstka", latinName: "Wrist Flexors" },
    { key: "diaphragm", label: "Przepona", latinName: "Diaphragm" },
    { key: "multifidus", label: "Wielodzielny", latinName: "Multifidus" },
    { key: "quadratus_lumborum", label: "Czworoboczny lędźwi", latinName: "Quadratus Lumborum" },
  ],
  lower: [
    { key: "rectus_femoris", label: "Czworogłowy uda – prosty", latinName: "Rectus Femoris" },
    { key: "vastus_lateralis", label: "Czworogłowy – boczny", latinName: "Vastus Lateralis" },
    { key: "vastus_medialis", label: "Czworogłowy – przyśrodkowy", latinName: "Vastus Medialis" },
    { key: "vastus_intermedius", label: "Czworogłowy – pośredni", latinName: "Vastus Intermedius" },
    { key: "biceps_femoris", label: "Dwugłowy uda", latinName: "Biceps Femoris" },
    { key: "semitendinosus", label: "Półścięgnisty", latinName: "Semitendinosus" },
    { key: "semimembranosus", label: "Półbłoniasty", latinName: "Semimembranosus" },
    { key: "gluteus_maximus", label: "Pośladkowy wielki", latinName: "Gluteus Maximus" },
    { key: "gluteus_medius", label: "Pośladkowy średni", latinName: "Gluteus Medius" },
    { key: "gluteus_minimus", label: "Pośladkowy mały", latinName: "Gluteus Minimus" },
    { key: "adductor_longus", label: "Przywodziciel długi", latinName: "Adductor Longus" },
    { key: "adductor_magnus", label: "Przywodziciel wielki", latinName: "Adductor Magnus" },
    { key: "adductor_brevis", label: "Przywodziciel krótki", latinName: "Adductor Brevis" },
    { key: "gracilis", label: "Smukły", latinName: "Gracilis" },
    { key: "tensor_fasciae_latae", label: "Naprężacz powięzi szerokiej", latinName: "Tensor Fasciae Latae" },
    { key: "iliopsoas", label: "Biodrowo-lędźwiowy", latinName: "Iliopsoas" },
    { key: "piriformis", label: "Gruszkowaty", latinName: "Piriformis" },
    { key: "gastrocnemius", label: "Brzuchaty łydki", latinName: "Gastrocnemius" },
    { key: "soleus", label: "Płaszczkowaty", latinName: "Soleus" },
    { key: "tibialis_anterior", label: "Piszczelowy przedni", latinName: "Tibialis Anterior" },
    { key: "peroneus_longus", label: "Strzałkowy długi", latinName: "Peroneus Longus" },
    { key: "peroneus_brevis", label: "Strzałkowy krótki", latinName: "Peroneus Brevis" },
    { key: "popliteus", label: "Podkolanowy", latinName: "Popliteus" },
    { key: "sartorius", label: "Krawiecki", latinName: "Sartorius" },
  ],
  foot: [
    { key: "flexor_digitorum_brevis", label: "Zginacz krótki palców", latinName: "Flexor Digitorum Brevis" },
    { key: "flexor_digitorum_longus", label: "Zginacz długi palców", latinName: "Flexor Digitorum Longus" },
    { key: "abductor_hallucis", label: "Odwodziciel palucha", latinName: "Abductor Hallucis" },
    { key: "adductor_hallucis", label: "Przywodziciel palucha", latinName: "Adductor Hallucis" },
    { key: "flexor_hallucis_brevis", label: "Zginacz krótki palucha", latinName: "Flexor Hallucis Brevis" },
    { key: "flexor_hallucis_longus", label: "Zginacz długi palucha", latinName: "Flexor Hallucis Longus" },
    { key: "extensor_digitorum_brevis", label: "Prostownik krótki palców", latinName: "Extensor Digitorum Brevis" },
    { key: "extensor_digitorum_longus", label: "Prostownik długi palców", latinName: "Extensor Digitorum Longus" },
    { key: "dorsal_interossei", label: "Mięśnie międzykostne grzbietowe", latinName: "Dorsal Interossei" },
    { key: "plantar_interossei", label: "Mięśnie międzykostne podeszwowe", latinName: "Plantar Interossei" },
    { key: "lumbricals", label: "Robaczkowate stopy", latinName: "Lumbricals" },
    { key: "quadratus_plantae", label: "Czworoboczny podeszwy", latinName: "Quadratus Plantae" },
    { key: "tibialis_posterior", label: "Piszczelowy tylny", latinName: "Tibialis Posterior" },
    { key: "abductor_digiti_minimi", label: "Odwodziciel palca małego", latinName: "Abductor Digiti Minimi" },
  ],
};

export const REGION_LABELS: Record<FmsRegion, string> = {
  upper: "Góra",
  lower: "Dół",
  foot: "Stopa",
};

export const SEVERITY_LABELS: Record<FmsSeverity, string> = {
  weak: "Słaby",
  very_weak: "Bardzo słaby",
  dysfunction: "Dysfunkcja",
};

export const SIDE_LABELS: Record<FmsSide, string> = {
  left: "Lewa",
  right: "Prawa",
  center: "Środek",
};

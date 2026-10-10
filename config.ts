/** Registro de parámetros del estimador 2.0. FASE 1: solo declaración; el estimador v1 no los usa.
 *  Etiquetas: EVIDENCIA-ESTRUCTURA (la estructura está respaldada, el valor no) · HEURÍSTICO-PREVIO (valor inicial sin respaldo,
 *  se sustituye por tus datos) · APRENDIDO (se estima de tus datos) · UMBRAL-CONFIGURABLE (decisión de producto, editable). */
export type ParamTag = 'EVIDENCIA-ESTRUCTURA' | 'HEURISTICO-PREVIO' | 'APRENDIDO' | 'UMBRAL-CONFIGURABLE';
export interface EstimatorConfig {
  calibrationMinErrors: number;   // UMBRAL-CONFIGURABLE. NO es una garantía estadística: solo decide cuándo dejar de llamar «orientativo» al rango.
  coverageTolerance: number;      // UMBRAL-CONFIGURABLE: margen aceptado entre cobertura retrospectiva y nominal.
  evidenceItemsLow: number;       // UMBRAL-CONFIGURABLE: ítems independientes mínimos para evidencia «baja».
  evidenceItemsMedium: number;    // idem «media».
  evidenceItemsHigh: number;      // idem «alta».
  selfRatingPseudoItems: number;  // HEURISTICO-PREVIO: peso del autoinforme como previo (en ítems equivalentes).
  speedPriorStrength: number;     // HEURISTICO-PREVIO: n0 de la contracción hacia el previo de velocidad.
  forgettingDays: number;         // HEURISTICO-PREVIO: constante de descuento de evidencia antigua.
  sanityMaxExamMin: number;       // cota de cordura; si se aplica, se informa (`capped`).
  minSpacingDays: number;         // HEURISTICO-PREVIO: días distintos mínimos para repartir recuperación y repaso.
  minValidSessionMin: number;     // UMBRAL-CONFIGURABLE
  targetIndependentSuccess: Record<'aprobar' | 'notable' | 'excelente', number>; // UMBRAL-CONFIGURABLE (criterio de salida)
}
export const DEFAULT_ESTIMATOR_CONFIG: EstimatorConfig = {
  calibrationMinErrors: 10, coverageTolerance: 0.1, evidenceItemsLow: 3, evidenceItemsMedium: 8, evidenceItemsHigh: 15,
  selfRatingPseudoItems: 2, speedPriorStrength: 3, forgettingDays: 30, sanityMaxExamMin: 6000, minSpacingDays: 3, minValidSessionMin: 5,
  targetIndependentSuccess: { aprobar: 0.6, notable: 0.75, excelente: 0.9 },
};
export const PARAM_TAGS: Record<keyof EstimatorConfig, ParamTag> = {
  calibrationMinErrors: 'UMBRAL-CONFIGURABLE', coverageTolerance: 'UMBRAL-CONFIGURABLE', evidenceItemsLow: 'UMBRAL-CONFIGURABLE', evidenceItemsMedium: 'UMBRAL-CONFIGURABLE',
  evidenceItemsHigh: 'UMBRAL-CONFIGURABLE', selfRatingPseudoItems: 'HEURISTICO-PREVIO', speedPriorStrength: 'HEURISTICO-PREVIO', forgettingDays: 'HEURISTICO-PREVIO',
  sanityMaxExamMin: 'UMBRAL-CONFIGURABLE', minSpacingDays: 'HEURISTICO-PREVIO', minValidSessionMin: 'UMBRAL-CONFIGURABLE', targetIndependentSuccess: 'UMBRAL-CONFIGURABLE',
};
/** Unidades prácticas por familia de asignatura. La extensión puede ser DESCONOCIDA (count null): no se inventa. */
export const UNIT_PROFILES: Record<string, { label: string; units: string[]; itemKind: string }> = {
  problemas: { label: 'Problemas y cálculo (Matemáticas, Física, Química)', units: ['tipo de problema', 'apartado del temario', 'página'], itemKind: 'problema resuelto sin ayuda' },
  conceptos: { label: 'Conceptos y desarrollo (Historia, Filosofía, Business)', units: ['apartado', 'concepto o autor', 'página'], itemKind: 'pregunta respondida de memoria' },
  produccion: { label: 'Producción y lengua (Lengua, Catalán, Inglés)', units: ['texto u obra', 'apartado de gramática o léxico', 'página'], itemKind: 'ejercicio o escrito sin ayuda' },
  generico: { label: 'Otra asignatura', units: ['apartado', 'página'], itemKind: 'ítem resuelto sin ayuda' },
};

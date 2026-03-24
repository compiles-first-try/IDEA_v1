export {
  additiveRelation,
  permutationInvariantRelation,
  negationRelation,
  runMetamorphicTests,
  type MetamorphicRelation,
  type MetamorphicResult,
  type Violation,
} from "./metamorphic/index.js";

export {
  runDifferentialTest,
  type VersionedFunction,
  type Divergence,
  type DifferentialResult,
} from "./differential/index.js";

export {
  createConsensusGate,
  createOllamaEvaluator,
  type ConsensusGate,
  type ConsensusResult,
  type Evaluator,
  type EvaluationVerdict,
} from "./consensus/index.js";

export {
  checkIdempotency,
  checkCommutativity,
  checkRangeBound,
  generatePropertyTestCode,
  type PropertyResult,
  type PropertySpec,
} from "./mutation/index.js";

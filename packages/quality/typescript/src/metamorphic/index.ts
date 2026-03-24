/**
 * Metamorphic Testing Framework.
 *
 * Generates and runs metamorphic relations for AI-generated code where
 * the exact expected output is unknown. Instead of checking output values,
 * we check that relationships between transformed inputs and their outputs hold.
 */

export interface MetamorphicRelation<TInput, TOutput> {
  name: string;
  /** Transform a source input into a follow-up input */
  transform: (input: TInput) => TInput;
  /** Verify the relation holds between source and follow-up outputs */
  verify: (
    sourceOutput: TOutput,
    followUpOutput: TOutput,
    sourceInput: TInput,
    followUpInput: TInput
  ) => boolean;
}

export interface Violation {
  relationName: string;
  sourceInput: unknown;
  followUpInput: unknown;
  sourceOutput: unknown;
  followUpOutput: unknown;
}

export interface MetamorphicResult {
  passed: boolean;
  totalRelations: number;
  totalInputs: number;
  violations: Violation[];
}

interface RelationConfig<TInput, TOutput> {
  transform: (input: TInput) => TInput;
  verify: (
    sourceOutput: TOutput,
    followUpOutput: TOutput,
    sourceInput: TInput,
    followUpInput: TInput
  ) => boolean;
  name: string;
}

/**
 * Create an additive relation — input is shifted by a constant.
 * Useful for testing linear functions, sorting with offset, etc.
 */
export function additiveRelation<TInput, TOutput>(
  config: RelationConfig<TInput, TOutput>
): MetamorphicRelation<TInput, TOutput> {
  return { name: config.name, transform: config.transform, verify: config.verify };
}

/**
 * Create a permutation-invariant relation — input order is changed.
 * Useful for testing sorting, set operations, aggregations.
 */
export function permutationInvariantRelation<TInput, TOutput>(
  config: RelationConfig<TInput, TOutput>
): MetamorphicRelation<TInput, TOutput> {
  return { name: config.name, transform: config.transform, verify: config.verify };
}

/**
 * Create a negation relation — input is negated/inverted.
 * Useful for testing abs, even/odd, sign-independent operations.
 */
export function negationRelation<TInput, TOutput>(
  config: RelationConfig<TInput, TOutput>
): MetamorphicRelation<TInput, TOutput> {
  return { name: config.name, transform: config.transform, verify: config.verify };
}

/**
 * Run metamorphic tests: execute a function under test with source inputs
 * and transformed follow-up inputs, then verify all relations hold.
 */
export function runMetamorphicTests<TInput, TOutput>(
  fn: (input: TInput) => TOutput,
  inputs: TInput[],
  relations: MetamorphicRelation<TInput, TOutput>[]
): MetamorphicResult {
  const violations: Violation[] = [];

  for (const relation of relations) {
    for (const sourceInput of inputs) {
      const followUpInput = relation.transform(sourceInput);
      const sourceOutput = fn(sourceInput);
      const followUpOutput = fn(followUpInput);

      if (!relation.verify(sourceOutput, followUpOutput, sourceInput, followUpInput)) {
        violations.push({
          relationName: relation.name,
          sourceInput,
          followUpInput,
          sourceOutput,
          followUpOutput,
        });
      }
    }
  }

  return {
    passed: violations.length === 0,
    totalRelations: relations.length,
    totalInputs: inputs.length,
    violations,
  };
}

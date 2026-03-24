/**
 * Differential Testing Engine (N-version comparison).
 *
 * Generates N versions of the same spec, runs identical inputs through all,
 * and detects output divergence as potential bugs. Uses majority voting
 * to identify likely-correct outputs.
 */

export interface VersionedFunction<TInput, TOutput> {
  name: string;
  fn: (input: TInput) => TOutput;
}

export interface Divergence<TInput> {
  input: TInput;
  outputs: Map<string, { output: unknown; error?: string }>;
  majorityOutput: unknown;
  outlierVersions: string[];
  errors: { version: string; error: string }[];
}

export interface DifferentialResult<TInput> {
  unanimous: boolean;
  totalVersions: number;
  totalInputs: number;
  divergences: Divergence<TInput>[];
}

/**
 * Run differential tests across N function versions with the same inputs.
 * Returns divergence report with majority voting.
 */
export function runDifferentialTest<TInput, TOutput>(
  versions: VersionedFunction<TInput, TOutput>[],
  inputs: TInput[]
): DifferentialResult<TInput> {
  const divergences: Divergence<TInput>[] = [];

  for (const input of inputs) {
    const outputs = new Map<string, { output: unknown; error?: string }>();
    const errors: { version: string; error: string }[] = [];

    // Run each version
    for (const version of versions) {
      try {
        const output = version.fn(input);
        outputs.set(version.name, { output });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        outputs.set(version.name, { output: undefined, error: errorMsg });
        errors.push({ version: version.name, error: errorMsg });
      }
    }

    // Check for divergence — serialize outputs for comparison
    const serializedOutputs = new Map<string, string[]>();
    for (const [name, result] of outputs) {
      const key = result.error ? `__ERROR__:${result.error}` : JSON.stringify(result.output);
      if (!serializedOutputs.has(key)) serializedOutputs.set(key, []);
      serializedOutputs.get(key)!.push(name);
    }

    if (serializedOutputs.size > 1) {
      // Find majority
      let majorityKey = "";
      let majorityCount = 0;
      for (const [key, names] of serializedOutputs) {
        if (names.length > majorityCount) {
          majorityCount = names.length;
          majorityKey = key;
        }
      }

      const majorityOutput = majorityKey.startsWith("__ERROR__")
        ? undefined
        : JSON.parse(majorityKey);

      const outlierVersions: string[] = [];
      for (const [key, names] of serializedOutputs) {
        if (key !== majorityKey) {
          outlierVersions.push(...names);
        }
      }

      divergences.push({
        input,
        outputs,
        majorityOutput,
        outlierVersions,
        errors,
      });
    }
  }

  return {
    unanimous: divergences.length === 0,
    totalVersions: versions.length,
    totalInputs: inputs.length,
    divergences,
  };
}

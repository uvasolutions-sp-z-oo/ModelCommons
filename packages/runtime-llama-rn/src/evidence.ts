// This subpath never imports llama.rn. Counts actual adapter initialization attempts
// in this JavaScript runtime, including failed attempts; it is not a process-wide attestation.
let initializationAttempts = 0;
export function recordLlamaInitialization(): void { initializationAttempts++; }
export function inspectLlamaInitializationAttempts(): number { return initializationAttempts; }

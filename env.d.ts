/// <reference types="expo/types" />

// Types for the EXPO_PUBLIC_* runtime config read via process.env (inlined into
// the bundle at build time). The reference above brings in the `process` global;
// this narrows the one variable we read. Committed so `tsc --noEmit` passes
// standalone (e.g. in CI) without first running Expo, which otherwise generates
// the git-ignored expo-env.d.ts.
declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_API_URL?: string;
  }
}

// vite-env.d.ts
interface ImportMetaEnv {
    readonly VITE_SENTRY_DSN: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

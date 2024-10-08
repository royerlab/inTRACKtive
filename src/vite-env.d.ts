// vite-env.d.ts
interface ImportMetaEnv {
    readonly SENTRY_DSN: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

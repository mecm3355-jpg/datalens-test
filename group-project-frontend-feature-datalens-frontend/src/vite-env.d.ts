/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DATA_MODE?: "demo" | "api";
  readonly VITE_MAX_FILE_SIZE_MB?: string;
  readonly VITE_UPLOAD_MODE?: "server" | "blob";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

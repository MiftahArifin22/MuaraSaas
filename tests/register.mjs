// Memungkinkan `node --test` menjalankan modul TypeScript proyek (impor tanpa ekstensi dan alias "@/").
import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);

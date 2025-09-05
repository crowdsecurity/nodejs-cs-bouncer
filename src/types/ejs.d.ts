// src/types/ejs.d.ts
declare module '*.ejs' {
    /** Raw template text (already UTF-8 decoded). */
    const content: string;
    export default content;
}

/** Espelha --breakpoint-* de tokens.css. Media queries em CSS não aceitam var(),
 *  então use estes valores literais: @media (min-width: 768px). */
export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280 } as const;

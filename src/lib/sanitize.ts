export const stripCRLF = (s: string): string =>
    s.replace(/[\r\n]/g, ' ');
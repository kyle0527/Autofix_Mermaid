export const NormalizeArrows = {
    name: 'NormalizeArrows', priority: 30,
    run(code, ctx) {
        let c = code;
        c = c.replace(/→|—>/g, '-->');
        c = c.replace(/->/g, '-->');
        return { code: c, notes: ['Normalized arrows'] };
    }
};

/*
 * Copyright (C) 2026 Curity AB. All rights reserved.
 *
 * The contents of this file are the property of Curity AB.
 * You may not copy or use this file, in either source code
 * or executable form, except in compliance with terms
 * set by Curity AB.
 *
 * For further information, please contact Curity AB.
 */
import { TokenBindingKind, noTokenBinding } from '../token-binding';

describe('TokenBindingKind', () => {
    // The native bridges decode these raw values by name; a rename here must break this test.
    it('uses exactly the raw values the native bridges decode', () => {
        expect(Object.values(TokenBindingKind).sort()).toEqual(['bound', 'unbound']);
        expect(TokenBindingKind.Unbound).toBe('unbound');
        expect(TokenBindingKind.Bound).toBe('bound');
    });
});

describe('noTokenBinding', () => {
    it('carries only the unbound kind', () => {
        expect(noTokenBinding()).toEqual({ kind: 'unbound' });
        expect(Object.keys(noTokenBinding())).toEqual(['kind']);
    });

    it('crosses the bridge unchanged', () => {
        const value = noTokenBinding();
        expect(JSON.parse(JSON.stringify(value))).toEqual(value);
    });
});

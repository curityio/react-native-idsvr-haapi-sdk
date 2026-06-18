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
import {
    noAuthentication,
    secretAuthentication,
    iOSMtlsAuthentication,
    AndroidMtlsAuthentication,
    iOSMtlsKeyPinningAuthentication,
    AndroidMtlsKeyPinningAuthentication,
    iOSJwtAsymmetricAuthentication,
    AndroidJwtAsymmetricAuthentication,
    jwtSymmetricAuthentication,
    JwtAsymmetricAlgorithm,
    JwtSymmetricAlgorithm,
    ClientAuthenticationKind,
    KeyStoreOption,
} from '../clientAuthenticationMethods';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Client Authentication Method factories', () => {
    // ---- noAuthentication ----

    describe('noAuthentication', () => {
        it('returns an object with kind "none"', () => {
            const result = noAuthentication();
            expect(result).toEqual({ kind: 'none' });
        });

        it('satisfies the discriminated union type', () => {
            const result = noAuthentication();
            expect(result.kind).toBe('none');
        });
    });

    // ---- secretAuthentication ----

    describe('secretAuthentication', () => {
        it('returns an object with kind "secret" and the provided secret', () => {
            const result = secretAuthentication('my-client-secret');
            expect(result).toEqual({ kind: 'secret', secret: 'my-client-secret' });
        });

        it('preserves empty string as a secret value', () => {
            const result = secretAuthentication('');
            expect(result.secret).toBe('');
        });
    });

    // ---- iOSMtlsAuthentication ----

    describe('iOSMtlsAuthentication', () => {
        it('returns an object with kind "mtls" and iOS fields', () => {
            const result = iOSMtlsAuthentication({
                pkcs12Filename: 'client-cert',
                pkcs12Passphrase: 'changeit',
                serverPEMFilename: 'server-cert',
            });
            expect(result.kind).toBe('mtls');
            expect(result.pkcs12Filename).toBe('client-cert');
            expect(result.pkcs12Passphrase).toBe('changeit');
            expect(result.serverPEMFilename).toBe('server-cert');
        });

        it('defaults isValidatingHostname to true', () => {
            const result = iOSMtlsAuthentication({
                pkcs12Filename: 'c',
                pkcs12Passphrase: 'p',
                serverPEMFilename: 's',
            });
            expect(result.isValidatingHostname).toBe(true);
        });

        it('allows overriding isValidatingHostname to false', () => {
            const result = iOSMtlsAuthentication({
                pkcs12Filename: 'c',
                pkcs12Passphrase: 'p',
                serverPEMFilename: 's',
                isValidatingHostname: false,
            });
            expect(result.isValidatingHostname).toBe(false);
        });

        it('defaults bundleOption to "main"', () => {
            const result = iOSMtlsAuthentication({
                pkcs12Filename: 'c',
                pkcs12Passphrase: 'p',
                serverPEMFilename: 's',
            });
            expect(result.bundleOption).toBe('main');
        });
    });

    // ---- AndroidMtlsAuthentication ----

    describe('AndroidMtlsAuthentication', () => {
        it('returns an object with kind "mtls"', () => {
            const result = AndroidMtlsAuthentication({});
            expect(result.kind).toBe('mtls');
        });

        it('defaults clientKeyStoreOption to Client', () => {
            const result = AndroidMtlsAuthentication({});
            expect(result.clientKeyStoreOption).toBe(KeyStoreOption.Client);
        });

        it('defaults serverKeyStoreOption to Server', () => {
            const result = AndroidMtlsAuthentication({});
            expect(result.serverKeyStoreOption).toBe(KeyStoreOption.Server);
        });

        it('accepts custom KeyStoreOptions', () => {
            const result = AndroidMtlsAuthentication({
                clientKeyStoreOption: KeyStoreOption.AlternateClient,
                serverKeyStoreOption: KeyStoreOption.AlternateServer,
            });
            expect(result.clientKeyStoreOption).toBe(KeyStoreOption.AlternateClient);
            expect(result.serverKeyStoreOption).toBe(KeyStoreOption.AlternateServer);
        });
    });

    // ---- iOSMtlsKeyPinningAuthentication ----

    describe('iOSMtlsKeyPinningAuthentication', () => {
        it('returns an object with kind "mtlsKeyPinning" and pinnings', () => {
            const result = iOSMtlsKeyPinningAuthentication({
                pkcs12Filename: 'client-cert',
                pkcs12Passphrase: 'changeit',
                serverKeyPinnings: [
                    { hostname: 'idsvr.example.com', publicKeyHash: 'sha256/abc123==' },
                ],
            });
            expect(result.kind).toBe('mtlsKeyPinning');
            expect(result.serverKeyPinnings).toHaveLength(1);
        });

        it('accepts multiple key pinnings', () => {
            const result = iOSMtlsKeyPinningAuthentication({
                pkcs12Filename: 'cert',
                pkcs12Passphrase: 'pass',
                serverKeyPinnings: [
                    { hostname: 'a.example.com', publicKeyHash: 'hash-a' },
                    { hostname: 'b.example.com', publicKeyHash: 'hash-b' },
                ],
            });
            expect(result.serverKeyPinnings).toHaveLength(2);
        });

        it('throws when serverKeyPinnings is empty', () => {
            expect(() =>
                iOSMtlsKeyPinningAuthentication({
                    pkcs12Filename: 'cert',
                    pkcs12Passphrase: 'pass',
                    serverKeyPinnings: [],
                })
            ).toThrow('serverKeyPinnings cannot be empty');
        });

        it('defaults bundleOption to "main"', () => {
            const result = iOSMtlsKeyPinningAuthentication({
                pkcs12Filename: 'c',
                pkcs12Passphrase: 'p',
                serverKeyPinnings: [{ hostname: 'h', publicKeyHash: 'k' }],
            });
            expect(result.bundleOption).toBe('main');
        });
    });

    // ---- AndroidMtlsKeyPinningAuthentication ----

    describe('AndroidMtlsKeyPinningAuthentication', () => {
        it('returns an object with kind "mtlsKeyPinning" and pinnings', () => {
            const result = AndroidMtlsKeyPinningAuthentication({
                serverKeyPinnings: [
                    { hostname: 'idsvr.example.com', publicKeyHash: 'sha256/abc123==' },
                ],
            });
            expect(result.kind).toBe('mtlsKeyPinning');
            expect(result.serverKeyPinnings).toHaveLength(1);
        });

        it('defaults clientKeyStoreOption to Client', () => {
            const result = AndroidMtlsKeyPinningAuthentication({
                serverKeyPinnings: [{ hostname: 'h', publicKeyHash: 'k' }],
            });
            expect(result.clientKeyStoreOption).toBe(KeyStoreOption.Client);
        });

        it('defaults isValidatingHostname to true', () => {
            const result = AndroidMtlsKeyPinningAuthentication({
                serverKeyPinnings: [{ hostname: 'h', publicKeyHash: 'k' }],
            });
            expect(result.isValidatingHostname).toBe(true);
        });

        it('throws when serverKeyPinnings is empty', () => {
            expect(() =>
                AndroidMtlsKeyPinningAuthentication({
                    serverKeyPinnings: [],
                })
            ).toThrow('serverKeyPinnings cannot be empty');
        });
    });

    // ---- iOSJwtAsymmetricAuthentication ----

    describe('iOSJwtAsymmetricAuthentication', () => {
        it('returns an object with kind "jwtAsymmetric" and iOS fields', () => {
            const result = iOSJwtAsymmetricAuthentication({
                asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES256,
                pemFilename: 'private-key',
            });
            expect(result.kind).toBe('jwtAsymmetric');
            expect(result.asymmetricAlgorithm).toBe('ES256');
            expect(result.pemFilename).toBe('private-key');
        });

        it('defaults bundleOption to "main"', () => {
            const result = iOSJwtAsymmetricAuthentication({
                asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES256,
                pemFilename: 'key',
            });
            expect(result.bundleOption).toBe('main');
        });

        it.each(Object.values(JwtAsymmetricAlgorithm))(
            'accepts algorithm %s',
            (alg) => {
                const result = iOSJwtAsymmetricAuthentication({
                    asymmetricAlgorithm: alg,
                    pemFilename: 'key',
                });
                expect(result.asymmetricAlgorithm).toBe(alg);
            }
        );
    });

    // ---- AndroidJwtAsymmetricAuthentication ----

    describe('AndroidJwtAsymmetricAuthentication', () => {
        it('returns an object with kind "jwtAsymmetric" and Android fields', () => {
            const result = AndroidJwtAsymmetricAuthentication({
                asymmetricAlgorithm: JwtAsymmetricAlgorithm.RS256,
                alias: 'my-key',
            });
            expect(result.kind).toBe('jwtAsymmetric');
            expect(result.asymmetricAlgorithm).toBe('RS256');
            expect(result.alias).toBe('my-key');
        });

        it('defaults clientKeyStoreOption to Client', () => {
            const result = AndroidJwtAsymmetricAuthentication({
                asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES256,
                alias: 'key',
            });
            expect(result.clientKeyStoreOption).toBe(KeyStoreOption.Client);
        });

        it.each(Object.values(JwtAsymmetricAlgorithm))(
            'accepts algorithm %s',
            (alg) => {
                const result = AndroidJwtAsymmetricAuthentication({
                    asymmetricAlgorithm: alg,
                    alias: 'key',
                });
                expect(result.asymmetricAlgorithm).toBe(alg);
            }
        );
    });

    // ---- jwtSymmetricAuthentication ----

    describe('jwtSymmetricAuthentication', () => {
        it('returns an object with kind "jwtSymmetric" and required fields', () => {
            const result = jwtSymmetricAuthentication({
                symmetricAlgorithm: JwtSymmetricAlgorithm.HS256,
                secretKey: 'super-secret-key',
            });
            expect(result).toEqual({
                kind: 'jwtSymmetric',
                symmetricAlgorithm: 'HS256',
                secretKey: 'super-secret-key',
            });
        });

        it.each(Object.values(JwtSymmetricAlgorithm))(
            'accepts algorithm %s',
            (alg) => {
                const result = jwtSymmetricAuthentication({
                    symmetricAlgorithm: alg,
                    secretKey: 'key',
                });
                expect(result.symmetricAlgorithm).toBe(alg);
            }
        );
    });

    // ---- Discriminated union ----

    describe('discriminated union "kind" field', () => {
        it('each factory produces a unique kind value', () => {
            const kinds = [
                noAuthentication().kind,
                secretAuthentication('s').kind,
                iOSMtlsAuthentication({
                    pkcs12Filename: 'c',
                    pkcs12Passphrase: 'p',
                    serverPEMFilename: 's',
                }).kind,
                iOSMtlsKeyPinningAuthentication({
                    pkcs12Filename: 'c',
                    pkcs12Passphrase: 'p',
                    serverKeyPinnings: [{ hostname: 'h', publicKeyHash: 'k' }],
                }).kind,
                iOSJwtAsymmetricAuthentication({
                    asymmetricAlgorithm: JwtAsymmetricAlgorithm.ES256,
                    pemFilename: 'key',
                }).kind,
                jwtSymmetricAuthentication({
                    symmetricAlgorithm: JwtSymmetricAlgorithm.HS256,
                    secretKey: 'k',
                }).kind,
            ];
            const unique = new Set(kinds);
            expect(unique.size).toBe(kinds.length);
        });
    });

    // ---- JSON serializability ----

    describe('JSON serializability', () => {
        it('all variants round-trip through JSON', () => {
            const variants = [
                noAuthentication(),
                secretAuthentication('s'),
                iOSMtlsAuthentication({
                    pkcs12Filename: 'c',
                    pkcs12Passphrase: 'p',
                    serverPEMFilename: 's',
                    isValidatingHostname: true,
                }),
                AndroidMtlsAuthentication({}),
                iOSMtlsKeyPinningAuthentication({
                    pkcs12Filename: 'c',
                    pkcs12Passphrase: 'p',
                    serverKeyPinnings: [{ hostname: 'h', publicKeyHash: 'k' }],
                }),
                AndroidMtlsKeyPinningAuthentication({
                    serverKeyPinnings: [{ hostname: 'h', publicKeyHash: 'k' }],
                }),
                iOSJwtAsymmetricAuthentication({
                    asymmetricAlgorithm: JwtAsymmetricAlgorithm.PS512,
                    pemFilename: 'pem',
                }),
                AndroidJwtAsymmetricAuthentication({
                    asymmetricAlgorithm: JwtAsymmetricAlgorithm.RS256,
                    alias: 'a',
                }),
                jwtSymmetricAuthentication({
                    symmetricAlgorithm: JwtSymmetricAlgorithm.HS512,
                    secretKey: 'k',
                }),
            ];

            for (const variant of variants) {
                const parsed = JSON.parse(JSON.stringify(variant));
                expect(parsed).toEqual(variant);
            }
        });
    });

    // ---- Enum values ----

    describe('JwtAsymmetricAlgorithm enum values', () => {
        it('contains all expected algorithm strings', () => {
            expect(JwtAsymmetricAlgorithm.RS256).toBe('RS256');
            expect(JwtAsymmetricAlgorithm.RS384).toBe('RS384');
            expect(JwtAsymmetricAlgorithm.RS512).toBe('RS512');
            expect(JwtAsymmetricAlgorithm.PS256).toBe('PS256');
            expect(JwtAsymmetricAlgorithm.PS384).toBe('PS384');
            expect(JwtAsymmetricAlgorithm.PS512).toBe('PS512');
            expect(JwtAsymmetricAlgorithm.ES256).toBe('ES256');
            expect(JwtAsymmetricAlgorithm.ES384).toBe('ES384');
            expect(JwtAsymmetricAlgorithm.ES512).toBe('ES512');
        });
    });

    describe('JwtSymmetricAlgorithm enum values', () => {
        it('contains all expected algorithm strings', () => {
            expect(JwtSymmetricAlgorithm.HS256).toBe('HS256');
            expect(JwtSymmetricAlgorithm.HS384).toBe('HS384');
            expect(JwtSymmetricAlgorithm.HS512).toBe('HS512');
        });
    });

    describe('ClientAuthenticationKind enum values', () => {
        it('contains all expected kind strings', () => {
            expect(ClientAuthenticationKind.None).toBe('none');
            expect(ClientAuthenticationKind.Secret).toBe('secret');
            expect(ClientAuthenticationKind.Mtls).toBe('mtls');
            expect(ClientAuthenticationKind.MtlsKeyPinning).toBe('mtlsKeyPinning');
            expect(ClientAuthenticationKind.JwtAsymmetric).toBe('jwtAsymmetric');
            expect(ClientAuthenticationKind.JwtSymmetric).toBe('jwtSymmetric');
        });
    });

    describe('KeyStoreOption enum values', () => {
        it('contains all expected option strings', () => {
            expect(KeyStoreOption.Client).toBe('client');
            expect(KeyStoreOption.Server).toBe('server');
            expect(KeyStoreOption.AlternateClient).toBe('alternateClient');
            expect(KeyStoreOption.AlternateServer).toBe('alternateServer');
        });
    });
});

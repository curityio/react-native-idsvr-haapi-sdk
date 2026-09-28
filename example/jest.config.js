/** @type {import('jest').Config} */
module.exports = {
    displayName: 'example',
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    testPathIgnorePatterns: ['/node_modules/'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    moduleNameMapper: {
        // Must match the published package name exactly. Without this the scoped
        // specifier resolves through example/node_modules/@curity/... to the compiled
        // ESM build/index.js, which this CommonJS Jest run cannot parse.
        '^@curity/identityserver-haapi-react-native-sdk$': '<rootDir>/../src/index',
        '^expo-modules-core$': '<rootDir>/__mocks__/expo-modules-core.js',
    },
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                diagnostics: false,
            },
        ],
    },
};

// Minimal mock for expo-modules-core used by example tests.
// Only the symbols imported by IdsvrHaapiReactNativeSdkModule.ts need stubs.
module.exports = {
    NativeModule: class NativeModule {},
    requireNativeModule: function () { return {}; },
};

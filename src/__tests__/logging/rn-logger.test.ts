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

jest.mock('expo-modules-core', function () {
    return {
        requireNativeModule: function () {
            return {
                addListener: mockAddListener,
                configureLogger: mockConfigureLogger,
            };
        },
        NativeModule: function () {},
    };
});

var mockAddListener = jest.fn(function () {
    return { remove: jest.fn() };
});
var mockConfigureLogger = jest.fn(function () { return Promise.resolve(); });

import { getRNLogger, __resetRNLoggerForTests } from '../../logging/rn-logger';
import { RNLogLevel } from '../../logging/rn-log-level';

var loggerConfig = {
    logLevel: RNLogLevel.Info,
    isSensitiveValueMasked: true,
};

describe('RNLogger', function () {
    var logger;

    beforeEach(function () {
        // Drop the previous singleton (and its native subscription) before
        // each test so per-test mock state starts from a clean slate.
        __resetRNLoggerForTests();
        jest.clearAllMocks();
        logger = getRNLogger(loggerConfig);
    });

    afterEach(function () {
        // Defensive: dispose-and-null in case a test let the singleton
        // survive a failure path. The next test's beforeEach also resets,
        // so this is just belt-and-braces.
        __resetRNLoggerForTests();
    });

    describe('log methods create events with correct level', function () {
        it('debug creates event with Debug level', function () {
            var received = [];
            logger.addLogSink(function (event) { received.push(event); });
            logger.debug('test message');
            expect(received.length).toBe(1);
            expect(received[0].level).toBe(RNLogLevel.Debug);
            expect(received[0].message).toBe('test message');
        });

        it('info creates event with Info level', function () {
            var received = [];
            logger.addLogSink(function (event) { received.push(event); });
            logger.info('info message');
            expect(received.length).toBe(1);
            expect(received[0].level).toBe(RNLogLevel.Info);
        });

        it('warning creates event with Warning level', function () {
            var received = [];
            logger.addLogSink(function (event) { received.push(event); });
            logger.warning('warn message');
            expect(received.length).toBe(1);
            expect(received[0].level).toBe(RNLogLevel.Warning);
        });

        it('error creates event with Error level', function () {
            var received = [];
            logger.addLogSink(function (event) { received.push(event); });
            logger.error('error message');
            expect(received.length).toBe(1);
            expect(received[0].level).toBe(RNLogLevel.Error);
        });
    });

    describe('tag handling', function () {
        it('passes tag when provided', function () {
            var received = [];
            logger.addLogSink(function (event) { received.push(event); });
            logger.info('msg', 'MyTag');
            expect(received[0].tag).toBe('MyTag');
        });

        it('tag is undefined when not provided', function () {
            var received = [];
            logger.addLogSink(function (event) { received.push(event); });
            logger.info('msg');
            expect(received[0].tag).toBeUndefined();
        });
    });

    describe('addLogSink', function () {
        it('dispatches to multiple sinks', function () {
            var count1 = 0;
            var count2 = 0;
            logger.addLogSink(function () { count1++; });
            logger.addLogSink(function () { count2++; });
            logger.info('msg');
            expect(count1).toBe(1);
            expect(count2).toBe(1);
        });

        it('returns unsubscribe function that removes the sink', function () {
            var count = 0;
            var unsubscribe = logger.addLogSink(function () { count++; });
            logger.info('first');
            expect(count).toBe(1);
            unsubscribe();
            logger.info('second');
            expect(count).toBe(1);
        });

        it('unsubscribe only removes the specific sink', function () {
            var countA = 0;
            var countB = 0;
            var unsubA = logger.addLogSink(function () { countA++; });
            logger.addLogSink(function () { countB++; });
            unsubA();
            logger.info('msg');
            expect(countA).toBe(0);
            expect(countB).toBe(1);
        });
    });

    describe('default console sink', function () {
        it('calls console.debug for Debug level', function () {
            var spy = jest.spyOn(console, 'debug').mockImplementation(function () {});
            logger.debug('dbg');
            expect(spy).toHaveBeenCalledWith('dbg');
            spy.mockRestore();
        });

        it('calls console.info for Info level', function () {
            var spy = jest.spyOn(console, 'info').mockImplementation(function () {});
            logger.info('inf');
            expect(spy).toHaveBeenCalledWith('inf');
            spy.mockRestore();
        });

        it('calls console.warn for Warning level', function () {
            var spy = jest.spyOn(console, 'warn').mockImplementation(function () {});
            logger.warning('wrn');
            expect(spy).toHaveBeenCalledWith('wrn');
            spy.mockRestore();
        });

        it('calls console.error for Error level', function () {
            var spy = jest.spyOn(console, 'error').mockImplementation(function () {});
            logger.error('err');
            expect(spy).toHaveBeenCalledWith('err');
            spy.mockRestore();
        });

        it('prepends tag in brackets when present', function () {
            var spy = jest.spyOn(console, 'info').mockImplementation(function () {});
            logger.info('msg', 'Tag');
            expect(spy).toHaveBeenCalledWith('[Tag] msg');
            spy.mockRestore();
        });
    });

    describe('native event listening', function () {
        it('subscribes to onLog event on construction', function () {
            expect(mockAddListener).toHaveBeenCalledWith('onLog', expect.any(Function));
        });

        it('forwards configuration to native via configureLogger on construction', function () {
            expect(mockConfigureLogger).toHaveBeenCalledTimes(1);
            expect(mockConfigureLogger).toHaveBeenCalledWith({
                logLevel: RNLogLevel.Info,
                isSensitiveValueMasked: true,
            });
        });

        it('forwards native events to sinks', function () {
            var nativeCallback = mockAddListener.mock.calls[0][1];
            var received = [];
            logger.addLogSink(function (event) { received.push(event); });

            var nativeEvent = {
                level: RNLogLevel.Warning,
                message: 'native warning',
                tag: 'HaapiSDK',
            };
            nativeCallback(nativeEvent);

            expect(received.length).toBe(1);
            expect(received[0].level).toBe(RNLogLevel.Warning);
            expect(received[0].message).toBe('native warning');
            expect(received[0].tag).toBe('HaapiSDK');
        });
    });

    describe('dispose', function () {
        it('removes native subscription', function () {
            var mockRemove = mockAddListener.mock.results[0].value.remove;
            logger.dispose();
            expect(mockRemove).toHaveBeenCalled();
        });

        it('stops dispatching to sinks after dispose', function () {
            var count = 0;
            logger.addLogSink(function () { count++; });
            logger.dispose();
            logger.info('should not dispatch');
            expect(count).toBe(0);
        });
    });

    // singleton behaviour -----------------------------------------------------

    describe('getRNLogger (singleton)', function () {
        it('returns the same instance across multiple calls', function () {
            var first = getRNLogger(loggerConfig);
            var second = getRNLogger(loggerConfig);
            expect(second).toBe(first);
        });

        it('only opens one native subscription per JS context', function () {
            // beforeEach already constructed the singleton + cleared mocks.
            // Subsequent getRNLogger() calls must NOT re-subscribe.
            getRNLogger(loggerConfig);
            getRNLogger(loggerConfig);
            getRNLogger(loggerConfig);
            expect(mockAddListener).toHaveBeenCalledTimes(1);
        });

        it('subsequent calls ignore the configuration argument (cached instance wins)', function () {
            // beforeEach already constructed the singleton (so configureLogger
            // was called once with `loggerConfig`); clear that bookkeeping
            // before asserting the next call doesn't reach native again.
            jest.clearAllMocks();
            getRNLogger({
                logLevel: RNLogLevel.Debug,
                isSensitiveValueMasked: false,
            });
            expect(mockConfigureLogger).not.toHaveBeenCalled();
        });

        it('dispose evicts the singleton — next getRNLogger constructs a fresh instance', function () {
            var first = getRNLogger(loggerConfig);
            first.dispose();
            // jest.clearAllMocks would mask the assertion below; we want
            // to see the second `addListener` invocation.
            var second = getRNLogger(loggerConfig);
            expect(second).not.toBe(first);
            expect(mockAddListener).toHaveBeenCalledTimes(2);
        });
    });

    describe('__resetRNLoggerForTests', function () {
        it('disposes the cached singleton and clears the handle', function () {
            var instance = getRNLogger(loggerConfig);
            var disposeSpy = jest.spyOn(instance, 'dispose');

            __resetRNLoggerForTests();

            expect(disposeSpy).toHaveBeenCalledTimes(1);
            // After reset, getRNLogger constructs anew (different instance ref).
            var fresh = getRNLogger(loggerConfig);
            expect(fresh).not.toBe(instance);
        });

        it('is a no-op when the singleton has not been constructed yet', function () {
            __resetRNLoggerForTests(); // dispose any state from beforeEach
            // Fresh state — no singleton. Calling reset again must not
            // throw or touch any native handle.
            expect(function () {
                __resetRNLoggerForTests();
            }).not.toThrow();
        });
    });
});

describe('RNLogLevel', function () {
    it('has correct string values', function () {
        expect(RNLogLevel.Debug).toBe('debug');
        expect(RNLogLevel.Info).toBe('info');
        expect(RNLogLevel.Warning).toBe('warning');
        expect(RNLogLevel.Error).toBe('error');
    });

    it('has exactly 4 values', function () {
        expect(Object.keys(RNLogLevel).length).toBe(4);
    });
});

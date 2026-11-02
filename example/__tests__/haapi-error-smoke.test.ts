import {
    ActionType,
    HaapiErrorCode,
    StepType,
    initializeForHaapi,
} from '@curity/identityserver-haapi-react-native-sdk';
import type {
    FormAction,
    HaapiAccessor,
    HaapiError,
    HaapiResponse,
    RNHaapiConfiguration,
} from '@curity/identityserver-haapi-react-native-sdk';

import {formatError, getRetryableHaapiError} from '../error-format';

function makeHaapiError(code: string, category: HaapiError['category']): HaapiError {
    return Object.assign(new Error(code + ' message'), {
        code: code,
        category: category,
        errorDescription: code + ' description',
        recovery: { kind: 'retryable', condition: 'now' },
    }) as HaapiError;
}

function makeRepresentationResponse(): HaapiResponse {
    return {
        responseCategory: 'representation',
        representation: {
            type: 'application/vnd.oidc.haapi+json',
            stepType: StepType.InteractiveForm,
            messages: [],
            actions: [
                {
                    actionType: ActionType.Form,
                    kind: 'continue',
                    model: {
                        fields: [],
                    },
                },
            ],
            links: [],
        },
    } as HaapiResponse;
}

type Stage = 'initialize' | 'start' | 'submit';

async function runScenario(stage: Stage, error: HaapiError): Promise<string> {
    var start = jest.fn().mockResolvedValue(makeRepresentationResponse());
    var submitForm = jest.fn().mockResolvedValue(makeRepresentationResponse());

    if (stage === 'start') {
        start = jest.fn().mockRejectedValue(error);
    }
    if (stage === 'submit') {
        submitForm = jest.fn().mockRejectedValue(error);
    }

    var accessor = {
        haapiManager: {
            start: start,
            submitForm: submitForm,
            followLink: jest.fn(),
        },
        oauthTokenManager: {},
        close: jest.fn(),
    } as unknown as HaapiAccessor;

    var initMock = jest.mocked(initializeForHaapi);
    initMock.mockReset();
    if (stage === 'initialize') {
        initMock.mockRejectedValue(error);
    } else {
        initMock.mockResolvedValue(accessor);
    }

    try {
        var created = await initializeForHaapi({} as RNHaapiConfiguration);
        var started = await created.haapiManager.start();

        if (started.responseCategory !== 'representation') {
            return 'unexpected response category';
        }

        var action = started.representation.actions[0] as FormAction;
        await created.haapiManager.submitForm(action, {});
        return 'ok';
    } catch (caught) {
        return formatError(caught);
    }
}

jest.mock('@curity/identityserver-haapi-react-native-sdk', () => {
    var actual = jest.requireActual('@curity/identityserver-haapi-react-native-sdk');
    return {
        ...actual,
        initializeForHaapi: jest.fn(),
    };
});

describe('E7 integration smoke (TS-only)', function () {
    var scenarios = [
        { code: HaapiErrorCode.AccessorAlreadyInitialized, category: 'bridge' as const, stage: 'initialize' as Stage },
        { code: HaapiErrorCode.Communication, category: 'networking' as const, stage: 'start' as Stage },
        { code: HaapiErrorCode.ServerError, category: 'networking' as const, stage: 'submit' as Stage },
        { code: HaapiErrorCode.AttestationNotSupported, category: 'attestation' as const, stage: 'submit' as Stage },
        { code: HaapiErrorCode.DpopProofFailure, category: 'dpop' as const, stage: 'submit' as Stage },
    ];

    scenarios.forEach(function (scenario) {
        it('formats ' + scenario.code + ' from ' + scenario.stage + ' rejections', async function () {
            var error = makeHaapiError(scenario.code, scenario.category);
            var message = await runScenario(scenario.stage, error);

            expect(message).toContain(scenario.code);
            expect(message).toContain('[' + scenario.category + ']');
        });
    });

    it('exposes retryable helper behavior used by the example retry branch', async function () {
        var error = makeHaapiError(HaapiErrorCode.Communication, 'networking');
        var message = await runScenario('submit', error);

        expect(message).toContain('[recovery: retryable.now]');
        expect(getRetryableHaapiError(error)).toBe(error);
    });
});


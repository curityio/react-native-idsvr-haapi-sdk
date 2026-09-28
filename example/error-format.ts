import {isHaapiError} from '@curity/identityserver-haapi-react-native-sdk';
import type {HaapiError} from '@curity/identityserver-haapi-react-native-sdk';

function formatRecovery(error: HaapiError): string | null {
    if (!error.recovery) {
        return null;
    }
    if (error.recovery.kind === 'retryable') {
        return 'retryable.' + error.recovery.condition;
    }
    if (error.recovery.kind === 'newHaapiFlow') {
        return 'newHaapiFlow';
    }
    return 'unrecoverable.' + error.recovery.action.kind;
}

export function getRetryableHaapiError(error: unknown): HaapiError | null {
    if (!isHaapiError(error) || error.recovery?.kind !== 'retryable') {
        return null;
    }
    return error;
}

export function retryButtonTitle(error: HaapiError): string {
    if (error.recovery?.kind !== 'retryable') {
        return 'Retry';
    }
    return error.recovery.condition === 'whenAppInForeground'
        ? 'Retry (foreground)'
        : 'Retry now';
}

export function formatError(error: unknown): string {
    if (isHaapiError(error)) {
        const recovery = formatRecovery(error);
        const base = error.errorDescription ?? error.message;
        const serverPart = error.serverError
            ? ' [serverError: ' + error.serverError.error + ']'
            : '';
        const recoveryPart = recovery ? ' [recovery: ' + recovery + ']' : '';
        return error.code + ' [' + error.category + ']: ' + base + recoveryPart + serverPart;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}


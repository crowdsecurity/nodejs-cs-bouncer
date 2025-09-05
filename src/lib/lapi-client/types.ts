import { Origin, Scope } from '../types';

export type LapiClientConfigurations = {
    url: string;
    bouncerApiToken: string;
    userAgent?: string;
};

export type GetDecisionsOptions = {
    isFirstFetch?: boolean;
    origins?: Origin[];
    scopes?: Scope[];
    scenariosContaining?: string[];
    scenariosNotContaining?: string[];
};

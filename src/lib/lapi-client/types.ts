import { Origin, Scope } from 'src/lib/types';

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

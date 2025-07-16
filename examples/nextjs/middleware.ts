import { NextResponse } from 'next/server';
import { validateRequestWithCrowdSec } from './libs/crowdsec';

export const middleware = async () => {
    await validateRequestWithCrowdSec();
    return NextResponse.next();
};

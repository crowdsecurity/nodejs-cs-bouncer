import Keyv from 'keyv';

import KeyvAdapter from 'src/lib/cache/libs/keyv-adapter';

const globalStorage = new Keyv();

class InMemory extends KeyvAdapter {
    constructor(storage: Keyv = globalStorage) {
        super(storage);
    }
}

export default InMemory;

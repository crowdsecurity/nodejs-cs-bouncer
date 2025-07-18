import KeyvStore from 'keyv';

import KeyvAdapter from './keyv-adapter';

const globalStorage = new KeyvStore();

class InMemory extends KeyvAdapter {
    constructor(storage: KeyvStore = globalStorage) {
        super(storage);
    }
}

export default InMemory;

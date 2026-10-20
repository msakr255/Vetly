(function () {
    const DEVICE = new Set([
        'wakil_keys',
        'wakil_models',
        'wakil_cloud_project',
        'wakil_cloud_story',
        'wakil_last_page',
        'wakil_custom_providers'
    ]);
    const isData = k => typeof k === 'string' && k.startsWith('wakil_') && !DEVICE.has(k) &&
        !k.startsWith('wakil_model_') && !k.startsWith('wakil_provider_down_') && !k.startsWith('wakil_auto_');

    const storage = window.localStorage;
    const prototype = Storage.prototype;
    const get = prototype.getItem;
    const set = prototype.setItem;
    const remove = prototype.removeItem;
    const memory = {};
    const keys = [];

    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (isData(key)) keys.push(key);
    }
    keys.forEach(key => {
        memory[key] = get.call(storage, key);
        remove.call(storage, key);
    });

    window._wkMem = memory;
    window.wkIsDataKey = isData;
    window._wkLegacyDataPending = Object.keys(memory).length > 0;

    const mine = (self, key) => self === storage && isData(key);

    prototype.getItem = function (key) {
        if (mine(this, key)) {
            return Object.prototype.hasOwnProperty.call(window._wkMem, key) ? window._wkMem[key] : null;
        }
        return get.call(this, key);
    };
    prototype.setItem = function (key, value) {
        if (mine(this, key)) {
            const text = String(value);
            if (window._wkMem[key] !== text) {
                window._wkMem[key] = text;
                if (window._sbSchedule) window._sbSchedule();
            }
            return;
        }
        return set.call(this, key, value);
    };
    prototype.removeItem = function (key) {
        if (mine(this, key)) {
            if (Object.prototype.hasOwnProperty.call(window._wkMem, key)) {
                delete window._wkMem[key];
                if (window._sbSchedule) window._sbSchedule();
            }
            return;
        }
        return remove.call(this, key);
    };
})();

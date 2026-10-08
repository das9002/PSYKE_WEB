(function (window) {
    'use strict';

    const ENTORNOS = {
        local: {
            api: 'http://localhost:8080/api',
            auth: 'http://localhost:8081/api/auth',
            ws: 'ws://localhost:8080/ws/chat'
        },
        produccion: {
            api: window.location.origin + '/proxy/api',
            auth: window.location.origin + '/proxy/auth',
            ws: 'wss://api-service-4d465a47b94c.herokuapp.com/ws/chat'
        }
    };

    const esLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const ENTORNO_ACTIVO = esLocal ? 'local' : 'produccion';

    window.PSYKE_ENV = ENTORNOS[ENTORNO_ACTIVO] || ENTORNOS.local;
})(window);

(function (window) {
    'use strict';

    const ENTORNOS = {
        local: {
            api: 'http://localhost:8080/api',
            auth: 'http://localhost:8081/api/auth'
        },
        produccion: {
            api: 'https://api-service-4d465a47b94c.herokuapp.com/api',
            auth: 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth'
        }
    };

    const esLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const ENTORNO_ACTIVO = esLocal ? 'local' : 'produccion';

    window.PSYKE_ENV = ENTORNOS[ENTORNO_ACTIVO] || ENTORNOS.local;
})(window);

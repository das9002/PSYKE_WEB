(function (global) {
    'use strict';

    var env = global.PSYKE_ENV || {};
    var esLocal = global.location && (global.location.hostname === 'localhost' || global.location.hostname === '127.0.0.1');
    var defaultApi = esLocal ? 'http://localhost:8080/api' : 'https://api-service-4d465a47b94c.herokuapp.com/api';
    var defaultAuth = esLocal ? 'http://localhost:8081/api/auth' : 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth';

    var API_BASE_URL = (env.api || defaultApi).replace(/\/+$/, '');
    var AUTH_API_URL = (env.auth || defaultAuth).replace(/\/+$/, '');

    var REDIRECT_FLAG = 'psyke_redirecting';
    var sesionCerradaEnCurso = false;

    // Obtiene el token sin importar bajo qué nombre se guardó
    function obtenerToken() {
        return localStorage.getItem('psyke_token') || localStorage.getItem('token') || sessionStorage.getItem('psyke_token') || sessionStorage.getItem('token');
    }

    // Obtiene los datos de usuario guardados localmente
    function obtenerUsuario() {
        var raw = localStorage.getItem('psyke_user') || localStorage.getItem('user');
        if (!raw) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
    }

    function normalizarRuta(ruta) {
        var partes = String(ruta || '').split('?');
        var limpia = partes[0].replace(/\/{2,}/g, '/');
        if (!limpia.startsWith('/')) {
            limpia = '/' + limpia;
        }
        return partes.length > 1 ? limpia + '?' + partes.slice(1).join('?') : limpia;
    }

    function normalizarListado(respuesta) {
        if (respuesta === null || respuesta === undefined) return [];
        if (Array.isArray(respuesta)) return respuesta;
        if (respuesta && typeof respuesta === 'object') {
            var contenedores = ['content', 'data', 'citas', 'estudiantes', 'psicologos', 'lista', 'listado', 'resultado', 'result', 'records'];
            for (var i = 0; i < contenedores.length; i++) {
                var clave = contenedores[i];
                if (Array.isArray(respuesta[clave])) return respuesta[clave];
            }
            if (Array.isArray(respuesta._embedded)) return respuesta._embedded;
            if (respuesta._embedded && typeof respuesta._embedded === 'object') {
                var claves = Object.keys(respuesta._embedded);
                if (claves.length > 0 && Array.isArray(respuesta._embedded[claves[0]])) {
                    return respuesta._embedded[claves[0]];
                }
            }
        }
        return [];
    }

    function resolverLogin() {
        var path = window.location.pathname;
        var carpeta = path.substring(0, path.lastIndexOf('/'));
        var profundidad = carpeta.split('/').filter(Boolean).length;
        return profundidad > 0 ? '../index.html' : 'index.html';
    }

    function cerrarSesionGlobal() {
        if (sesionCerradaEnCurso) return;
        sesionCerradaEnCurso = true;

        var yaRedirigido = sessionStorage.getItem(REDIRECT_FLAG);
        
        // Limpiar almacenamiento local y de sesión
        localStorage.clear();
        sessionStorage.clear();

        if (yaRedirigido) return;

        // Establecer flag después de borrar sessionStorage para prevenir bucles de redirección
        sessionStorage.setItem(REDIRECT_FLAG, '1');

        if (typeof Notif !== 'undefined' && Notif.error) {
            Notif.error('Tu sesión ha expirado o el token es inválido. Inicia sesión nuevamente.', 'Sesión expirada');
        }

        setTimeout(function () {
            window.location.replace(resolverLogin());
        }, 900);
    }

    // Peticiones a la API de Servicios Principal (api-service)
    async function apiFetch(ruta, opciones, cuerpoData) {
        if (typeof opciones === 'string') {
            var metodo = opciones;
            opciones = {
                method: metodo,
                body: cuerpoData
            };
        } else {
            opciones = opciones || {};
        }

        var url = API_BASE_URL + normalizarRuta(ruta);
        var headers = {};

        // Manejo automático del Body y Content-Type (evita errores con FormData)
        var body = opciones.body;
        if (body && !(body instanceof FormData) && typeof body === 'object') {
            body = JSON.stringify(body);
            headers['Content-Type'] = 'application/json';
        } else if (typeof body === 'string') {
            headers['Content-Type'] = 'application/json';
        }

        var token = obtenerToken();
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        if (opciones.headers) {
            Object.assign(headers, opciones.headers);
        }

        var respuesta;
        try {
            respuesta = await fetch(url, {
                method: opciones.method || 'GET',
                headers: headers,
                body: body,
                signal: opciones.signal
            });
        } catch (error) {
            var eRed = new Error('No se pudo conectar con el servidor.');
            eRed.tipo = 'RED';
            throw eRed;
        }

        // Manejo de Estado HTTP 401 - Sesión Expirada
        if (respuesta.status === 401) {
            cerrarSesionGlobal();
            var eSesion = new Error('No se proporcionó un token válido o la sesión ha expirado.');
            eSesion.status = 401;
            throw eSesion;
        }

        // Manejo de Estado HTTP 403 - Sin Permisos
        if (respuesta.status === 403) {
            var ePermiso = new Error('No tiene permisos para realizar esta acción.');
            ePermiso.status = 403;
            throw ePermiso;
        }

        // Manejo de Errores 5xx (Server Error / 503 Service Unavailable)
        if (respuesta.status >= 500) {
            var mensajeServidor = respuesta.status === 503 
                ? 'El servicio no está disponible temporalmente (Timeout/503).' 
                : 'Error interno del servidor.';
            
            try {
                var jsonErr = await respuesta.json();
                if (jsonErr.message) mensajeServidor = jsonErr.message;
            } catch (e) { }

            var eServidor = new Error(mensajeServidor);
            eServidor.status = respuesta.status;
            throw eServidor;
        }

        // Manejo de Errores 4xx
        if (!respuesta.ok) {
            var mensaje = 'Ocurrió un error en la petición al servidor.';
            try {
                var cuerpo = await respuesta.json();
                if (cuerpo.message) mensaje = cuerpo.message;
            } catch (e) { }
            var eApi = new Error(mensaje);
            eApi.status = respuesta.status;
            throw eApi;
        }

        if (respuesta.status === 204) return null;

        var texto = await respuesta.text();
        return texto ? JSON.parse(texto) : null;
    }

    // Peticiones a la API de Autenticación (api-auth)
    async function authFetch(ruta, opciones) {
        opciones = opciones || {};
        var url = AUTH_API_URL + normalizarRuta(ruta);
        var headers = {};

        var body = opciones.body;
        if (body && !(body instanceof FormData) && typeof body === 'object') {
            body = JSON.stringify(body);
            headers['Content-Type'] = 'application/json';
        } else if (typeof body === 'string') {
            headers['Content-Type'] = 'application/json';
        }

        var token = obtenerToken();
        if (token) {
            headers['Authorization'] = 'Bearer ' + token;
        }

        if (opciones.headers) {
            Object.assign(headers, opciones.headers);
        }

        return fetch(url, {
            method: opciones.method || 'GET',
            headers: headers,
            body: body
        });
    }

    async function verificarSesion() {
        var token = obtenerToken();
        if (!token) return null;

        try {
            var respuesta = await authFetch('/me');
            if (respuesta.ok) {
                return await respuesta.json();
            }
        } catch (e) {
            // Ignorar errores temporales de red
        }

        // Respaldo de seguridad: si /me falla temporalmente pero los datos locales existen, no expulsar
        return obtenerUsuario();
    }

    function peticionApi(ruta, opciones) {
        return apiFetch(ruta, opciones);
    }

    // Exposición global de utilidades
    global.API_BASE_URL = API_BASE_URL;
    global.AUTH_API_URL = AUTH_API_URL;
    global.obtenerToken = obtenerToken;
    global.obtenerUsuario = obtenerUsuario;
    global.normalizarRuta = normalizarRuta;
    global.cerrarSesionGlobal = cerrarSesionGlobal;
    global.apiFetch = apiFetch;
    global.authFetch = authFetch;
    global.peticionApi = peticionApi;
    global.verificarSesion = verificarSesion;
    global.normalizarListado = normalizarListado;
})(window);

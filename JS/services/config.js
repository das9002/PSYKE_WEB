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

    // Obtiene el token sin importar bajo qué nombre o almacenamiento se guardó
    function obtenerToken() {
        var claves = ['psyke_token', 'token', 'jwt', 'access_token', 'auth_token', 'psyke_jwt'];
        for (var i = 0; i < claves.length; i++) {
            var val = localStorage.getItem(claves[i]) || sessionStorage.getItem(claves[i]);
            if (val) {
                val = String(val).trim();
                // Eliminar comillas dobles si se guardó vía JSON.stringify
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.substring(1, val.length - 1);
                }
                if (val && val !== 'null' && val !== 'undefined') {
                    return val;
                }
            }
        }
        return null;
    }

    // Obtiene los datos de usuario guardados localmente
    function obtenerUsuario() {
        var claves = ['psyke_user', 'user', 'currentUser', 'psyke_usuario', 'usuario'];
        for (var i = 0; i < claves.length; i++) {
            var raw = localStorage.getItem(claves[i]) || sessionStorage.getItem(claves[i]);
            if (raw) {
                try {
                    var parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') return parsed;
                } catch (e) { }
            }
        }
        return null;
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
        return /\/(HTML|btnsEstudiante)\//i.test(window.location.pathname) ? '../index.html' : 'index.html';
    }

    function cerrarSesionGlobal(opciones) {
        var voluntario = Boolean(opciones && opciones.voluntario);
        if (sesionCerradaEnCurso) return;
        sesionCerradaEnCurso = true;

        var yaRedirigido = sessionStorage.getItem(REDIRECT_FLAG);
        var preferencias = ['psyke_dark_mode', 'psyke_cookie_preferences'].map(function (clave) {
            return [clave, localStorage.getItem(clave)];
        });

        localStorage.clear();
        sessionStorage.clear();

        preferencias.forEach(function (par) {
            if (par[1] !== null) localStorage.setItem(par[0], par[1]);
        });

        if (yaRedirigido && !voluntario) return;

        sessionStorage.setItem(REDIRECT_FLAG, '1');

        if (typeof Notif !== 'undefined') {
            if (voluntario) {
                Notif.exito('Has salido de tu cuenta de forma segura.', 'Sesión cerrada');
            } else {
                Notif.error('Tu sesión ha expirado. Inicia sesión nuevamente.', 'Sesión expirada');
            }
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
                credentials: 'include', // Incluir credenciales CORS
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
            body: body,
            credentials: 'include' // Incluir credenciales CORS
        });
    }

    async function verificarSesion() {
        var token = obtenerToken();
        if (!token) return null;

        try {
            var respuesta = await authFetch('/me');
            if (respuesta.ok) {
                var datosUsuario = await respuesta.json();
                if (datosUsuario) {
                    try {
                        localStorage.setItem('psyke_user', JSON.stringify(datosUsuario));
                    } catch (e) { }
                }
                return datosUsuario;
            }
        } catch (e) {
            // Ignorar errores temporales de red
        }

        // Respaldo de seguridad: si /me falla temporalmente pero los datos locales existen, no expulsar
        return obtenerUsuario();
    }

    async function listarTodo(ruta, tamano) {
        var porPagina = tamano || 50;
        var separador = String(ruta).indexOf('?') === -1 ? '?' : '&';
        var base = ruta + separador + 'size=' + porPagina + '&page=';

        var primera = await apiFetch(base + '0');
        if (!primera || Array.isArray(primera) || typeof primera !== 'object' || !Array.isArray(primera.content)) {
            return normalizarListado(primera);
        }

        var totalPaginas = Number(primera.totalPages != null ? primera.totalPages : (primera.page && primera.page.totalPages)) || 1;
        totalPaginas = Math.min(totalPaginas, 200);
        if (totalPaginas <= 1) return primera.content.slice();

        var pendientes = [];
        for (var p = 1; p < totalPaginas; p++) {
            pendientes.push(apiFetch(base + p));
        }
        var resto = await Promise.all(pendientes);
        return resto.reduce(function (acumulado, pagina) {
            return acumulado.concat(normalizarListado(pagina));
        }, primera.content.slice());
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
    global.listarTodo = listarTodo;
    global.verificarSesion = verificarSesion;
    global.normalizarListado = normalizarListado;
})(window);


(function (global) {
    'use strict';

    var env = global.PSYKE_ENV || {};
    var esLocal = global.location && (global.location.hostname === 'localhost' || global.location.hostname === '127.0.0.1');
    var origen = global.location ? global.location.origin : '';
    var defaultApi = esLocal ? 'http://localhost:8080/api' : origen + '/proxy/api';
    var defaultAuth = esLocal ? 'http://localhost:8081/api/auth' : origen + '/proxy/auth';

    var API_BASE_URL = (env.api || defaultApi).replace(/\/+$/, '');
    var AUTH_API_URL = (env.auth || defaultAuth).replace(/\/+$/, '');
    var WS_CHAT_URL = env.ws || (esLocal ? 'ws://localhost:8080/ws/chat' : 'wss://api-service-4d465a47b94c.herokuapp.com/ws/chat');

    var sesionCerradaEnCurso = false;
    var usuarioSesion = null;
    var sesionPendiente = null;

    // Caché de listados en memoria: si varias partes de la misma página piden el mismo listado,
    // se descarga una sola vez. Se vacía en cuanto se guarda, edita o elimina algo.
    var DURACION_CACHE_LISTADOS_MS = 30000;
    var cacheListados = {};
    var listadosEnCurso = {};

    // Caché entre páginas (sessionStorage) para datos que casi no cambian: nombre del perfil,
    // contactos del chat y catálogos. Se borra al cerrar sesión o al guardar cambios.
    var PREFIJO_CACHE_SESION = 'psyke_cache:';
    var RUTAS_QUE_NO_INVALIDAN = /^\/(mensajes|notificaciones|v1\/ai)(\/|\?|$)/;

    function leerCacheSesion(clave) {
        try {
            var texto = global.sessionStorage.getItem(PREFIJO_CACHE_SESION + clave);
            if (!texto) return null;
            var guardado = JSON.parse(texto);
            if (!guardado || guardado.expira <= Date.now()) {
                global.sessionStorage.removeItem(PREFIJO_CACHE_SESION + clave);
                return null;
            }
            return guardado;
        } catch (e) {
            return null;
        }
    }

    function guardarCacheSesion(clave, datos, duracionMs) {
        try {
            global.sessionStorage.setItem(PREFIJO_CACHE_SESION + clave, JSON.stringify({ expira: Date.now() + duracionMs, datos: datos }));
        } catch (e) { }
    }

    function limpiarCaches() {
        cacheListados = {};
        try {
            Object.keys(global.sessionStorage)
                .filter(function (clave) { return clave.indexOf(PREFIJO_CACHE_SESION) === 0; })
                .forEach(function (clave) { global.sessionStorage.removeItem(clave); });
        } catch (e) { }
    }

    async function conCacheDeSesion(clave, duracionMs, cargar) {
        var guardado = leerCacheSesion(clave);
        if (guardado) return guardado.datos;
        var datos = await cargar();
        guardarCacheSesion(clave, datos, duracionMs);
        return datos;
    }

    var Preferencias = {
        leer: function (clave) {
            var patron = new RegExp('(?:^|;\\s*)' + clave + '=([^;]*)');
            var encontrado = document.cookie.match(patron);
            return encontrado ? decodeURIComponent(encontrado[1]) : null;
        },
        guardar: function (clave, valor) {
            var unAnio = 60 * 60 * 24 * 365;
            var seguro = global.location && global.location.protocol === 'https:' ? '; Secure' : '';
            document.cookie = clave + '=' + encodeURIComponent(valor) + '; Max-Age=' + unAnio + '; Path=/; SameSite=Lax' + seguro;
        }
    };

    function obtenerUsuario() {
        return usuarioSesion;
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
        usuarioSesion = null;
        sesionPendiente = null;
        limpiarCaches();

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

        if (opciones.headers) {
            Object.assign(headers, opciones.headers);
        }

        var respuesta;
        try {
            respuesta = await fetch(url, {
                method: opciones.method || 'GET',
                headers: headers,
                body: body,
                credentials: 'include',
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

        // Un cambio (POST, PUT, DELETE...) deja desactualizados los listados guardados. El chat, las
        // notificaciones y la IA no afectan a esos listados, así que no vacían la caché.
        if (String(opciones.method || 'GET').toUpperCase() !== 'GET' && !RUTAS_QUE_NO_INVALIDAN.test(normalizarRuta(ruta))) {
            limpiarCaches();
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

        if (opciones.headers) {
            Object.assign(headers, opciones.headers);
        }

        return fetch(url, {
            method: opciones.method || 'GET',
            headers: headers,
            body: body,
            credentials: 'include'
        });
    }

    function verificarSesion() {
        if (usuarioSesion) return Promise.resolve(usuarioSesion);
        if (sesionPendiente) return sesionPendiente;

        sesionPendiente = authFetch('/me')
            .then(function (respuesta) {
                return respuesta.ok ? respuesta.json() : null;
            })
            .catch(function () {
                return null;
            })
            .then(function (datos) {
                usuarioSesion = datos || null;
                sesionPendiente = null;
                return usuarioSesion;
            });

        return sesionPendiente;
    }

    async function listarTodo(ruta, tamano) {
        var clave = ruta + '|' + (tamano || 50);
        var guardado = cacheListados[clave];
        if (guardado && guardado.expira > Date.now()) {
            return guardado.datos.slice();
        }

        // Si otra parte de la página ya está descargando este listado, se reutiliza esa misma descarga
        if (!listadosEnCurso[clave]) {
            var cacheAlIniciar = cacheListados;
            listadosEnCurso[clave] = descargarPaginas(ruta, tamano)
                .then(function (datos) {
                    // Si mientras tanto se guardó algún cambio, no se guarda este resultado (puede estar viejo)
                    if (cacheListados === cacheAlIniciar) {
                        cacheListados[clave] = { expira: Date.now() + DURACION_CACHE_LISTADOS_MS, datos: datos };
                    }
                    return datos;
                })
                .finally(function () {
                    delete listadosEnCurso[clave];
                });
        }
        var datos = await listadosEnCurso[clave];
        return datos.slice();
    }

    // Las páginas se piden una detrás de otra. Antes se pedían todas a la vez con Promise.all:
    // un listado de 20 páginas eran 20 consultas simultáneas contra un servidor de 512 MB.
    async function descargarPaginas(ruta, tamano) {
        var porPagina = tamano || 50;
        var separador = String(ruta).indexOf('?') === -1 ? '?' : '&';
        var base = ruta + separador + 'size=' + porPagina + '&page=';

        var primera = await apiFetch(base + '0');
        if (!primera || Array.isArray(primera) || typeof primera !== 'object' || !Array.isArray(primera.content)) {
            return normalizarListado(primera);
        }

        var totalPaginas = Number(primera.totalPages != null ? primera.totalPages : (primera.page && primera.page.totalPages)) || 1;
        totalPaginas = Math.min(totalPaginas, 200);

        var resultado = primera.content.slice();
        for (var p = 1; p < totalPaginas; p++) {
            resultado = resultado.concat(normalizarListado(await apiFetch(base + p)));
        }
        return resultado;
    }

    function peticionApi(ruta, opciones) {
        return apiFetch(ruta, opciones);
    }

    // Exposición global de utilidades
    global.API_BASE_URL = API_BASE_URL;
    global.AUTH_API_URL = AUTH_API_URL;
    global.WS_CHAT_URL = WS_CHAT_URL;
    global.obtenerUsuario = obtenerUsuario;
    global.normalizarRuta = normalizarRuta;
    global.cerrarSesionGlobal = cerrarSesionGlobal;
    global.apiFetch = apiFetch;
    global.authFetch = authFetch;
    global.peticionApi = peticionApi;
    global.listarTodo = listarTodo;
    global.conCacheDeSesion = conCacheDeSesion;
    global.limpiarCaches = limpiarCaches;
    global.verificarSesion = verificarSesion;
    global.Preferencias = Preferencias;
    global.normalizarListado = normalizarListado;
})(window);

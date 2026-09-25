
(function (global) {
    'use strict';

    var API_BASE_URL = 'http://localhost:8080/api';
    var AUTH_API_URL = 'http://localhost:8081/api/auth';

    var REDIRECT_FLAG = 'psyke_redirecting';

    var sesionCerradaEnCurso = false;

    function normalizarRuta(ruta) {
        var partes = String(ruta || '').split('?');
        var limpia = partes[0].replace(/\/{2,}/g, '/');
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
        localStorage.clear();
        sessionStorage.clear();

        if (yaRedirigido) return;

        sessionStorage.setItem(REDIRECT_FLAG, '1');

        if (typeof Notif !== 'undefined') {
            Notif.error('Tu sesión ha expirado o el token es inválido. Inicia sesión nuevamente.', 'Sesión expirada');
        }

        setTimeout(function () {
            window.location.replace(resolverLogin());
        }, 900);
    }

    async function apiFetch(ruta, opciones, cuerpoData) {
        if (typeof opciones === 'string') {
            var metodo = opciones;
            opciones = {
                method: metodo,
                body: typeof cuerpoData === 'string' ? cuerpoData : (cuerpoData !== undefined ? JSON.stringify(cuerpoData) : undefined)
            };
        } else {
            opciones = opciones || {};
        }
        var url = API_BASE_URL + normalizarRuta(ruta);

        var headers = { 'Content-Type': 'application/json' };
        if (opciones.headers) Object.assign(headers, opciones.headers);

        var respuesta;
        try {
            respuesta = await fetch(url, {
                method: opciones.method || 'GET',
                headers: headers,
                body: opciones.body,
                signal: opciones.signal,
                credentials: 'include'
            });
        } catch (error) {
            var eRed = new Error('No se pudo conectar con el servidor. Verifique que el backend esté activo en ' + API_BASE_URL + '.');
            eRed.tipo = 'RED';
            throw eRed;
        }

        if (respuesta.status === 401) {
            cerrarSesionGlobal();
            var eSesion = new Error('No se proporcionó un token válido. El token es inválido o expirado.');
            eSesion.status = 401;
            throw eSesion;
        }

        if (respuesta.status === 403) {
            var ePermiso = new Error('No tiene permisos para realizar esta acción.');
            ePermiso.status = 403;
            console.error('[apiFetch] 403 Forbidden:', ePermiso.message);
            throw ePermiso;
        }

        if (respuesta.status >= 500) {
            var eServidor = new Error('Error interno del servidor. Intente nuevamente más tarde.');
            eServidor.status = respuesta.status;
            console.error('[apiFetch] 5xx Server Error:', eServidor.message);
            throw eServidor;
        }

        if (!respuesta.ok) {
            var mensaje = 'Ocurrió un error en la petición al servidor.';
            try {
                var cuerpo = await respuesta.json();
                if (cuerpo.message) {
                    mensaje = cuerpo.message;
                } else if (cuerpo.details && typeof cuerpo.details === 'object') {
                    mensaje = Object.values(cuerpo.details).join('\n');
                }
            } catch (e) { }
            var eApi = new Error(mensaje);
            eApi.status = respuesta.status;
            throw eApi;
        }

        if (respuesta.status === 204) return null;

        var texto = await respuesta.text();
        return texto ? JSON.parse(texto) : null;
    }

    async function verificarSesion() {
        try {
            var url = AUTH_API_URL + '/me';
            var respuesta = await fetch(url, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            if (respuesta.ok) {
                return await respuesta.json();
            }
        } catch (e) {
            // Ignorar errores de red, se manejará en la llamada posterior
        }
        return null;
    }

    function peticionApi(ruta, opciones) {
        return apiFetch(ruta, opciones);
    }

    global.API_BASE_URL = API_BASE_URL;
    global.AUTH_API_URL = AUTH_API_URL;
    global.normalizarRuta = normalizarRuta;
    global.cerrarSesionGlobal = cerrarSesionGlobal;
    global.apiFetch = apiFetch;
    global.peticionApi = peticionApi;
    global.verificarSesion = verificarSesion;
    global.normalizarListado = normalizarListado;
})(window);
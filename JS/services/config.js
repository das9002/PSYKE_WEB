
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
    var ultimoMensajeApi = null;

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
        var porInactividad = Boolean(opciones && opciones.motivo === 'inactividad');
        if (sesionCerradaEnCurso) return;
        sesionCerradaEnCurso = true;
        usuarioSesion = null;
        sesionPendiente = null;
        limpiarCaches();

        if (typeof Notif !== 'undefined') {
            if (voluntario) {
                Notif.exito('Has salido de tu cuenta de forma segura.', 'Sesión cerrada');
            } else if (porInactividad) {
                Notif.advertencia('Tu sesión se cerró porque pasaron 15 minutos sin actividad. Inicia sesión nuevamente.', 'Sesión cerrada por inactividad');
            } else {
                Notif.error('Tu sesión ha expirado. Inicia sesión nuevamente.', 'Sesión expirada');
            }
        }

        setTimeout(function () {
            window.location.replace(resolverLogin());
        }, 900);
    }

    // Las dos APIs responden con ApiResponse: { status, exito, mensaje, data }.
    // Estas funciones sacan los datos y el mensaje para que el resto del frontend no dependa del formato.
    function esApiResponse(cuerpo) {
        return Boolean(cuerpo) && typeof cuerpo === 'object' && !Array.isArray(cuerpo)
            && typeof cuerpo.exito === 'boolean' && 'status' in cuerpo;
    }

    function desempaquetar(cuerpo) {
        if (!esApiResponse(cuerpo)) return cuerpo;
        return cuerpo.data === undefined ? null : cuerpo.data;
    }

    function mensajeDeError(cuerpo, mensajePorDefecto) {
        if (!cuerpo || typeof cuerpo !== 'object') return mensajePorDefecto;
        return cuerpo.mensaje || cuerpo.message || mensajePorDefecto;
    }

    function detallesDeError(cuerpo) {
        if (!cuerpo || typeof cuerpo !== 'object') return {};
        if (esApiResponse(cuerpo) && cuerpo.data && typeof cuerpo.data === 'object') return cuerpo.data;
        return cuerpo.details && typeof cuerpo.details === 'object' ? cuerpo.details : {};
    }

    async function leerCuerpo(respuesta) {
        try {
            const texto = await respuesta.text();
            return texto ? JSON.parse(texto) : null;
        } catch (e) {
            return null;
        }
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
            var cuerpoPermiso = await leerCuerpo(respuesta);
            var ePermiso = new Error(mensajeDeError(cuerpoPermiso, 'No tiene permisos para realizar esta acción.'));
            ePermiso.status = 403;
            throw ePermiso;
        }

        // Manejo de Errores 5xx (Server Error / 503 Service Unavailable)
        if (respuesta.status >= 500) {
            var cuerpoServidor = await leerCuerpo(respuesta);
            var eServidor = new Error(mensajeDeError(cuerpoServidor, respuesta.status === 503
                ? 'El servicio no está disponible temporalmente. Intenta en unos segundos.'
                : 'Ocurrió un error inesperado en el servidor.'));
            eServidor.status = respuesta.status;
            throw eServidor;
        }

        // Manejo de Errores 4xx
        if (!respuesta.ok) {
            var cuerpoError = await leerCuerpo(respuesta);
            var eApi = new Error(mensajeDeError(cuerpoError, 'Ocurrió un error en la petición al servidor.'));
            eApi.status = respuesta.status;
            eApi.detalles = detallesDeError(cuerpoError);
            throw eApi;
        }

        // Un cambio (POST, PUT, DELETE...) deja desactualizados los listados guardados. El chat, las
        // notificaciones y la IA no afectan a esos listados, así que no vacían la caché.
        if (String(opciones.method || 'GET').toUpperCase() !== 'GET' && !RUTAS_QUE_NO_INVALIDAN.test(normalizarRuta(ruta))) {
            limpiarCaches();
        }

        if (respuesta.status === 204) return null;

        var cuerpoOk = await leerCuerpo(respuesta);
        if (esApiResponse(cuerpoOk)) ultimoMensajeApi = cuerpoOk.mensaje || null;
        return desempaquetar(cuerpoOk);
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

    async function consultarSesion() {
        try {
            const respuesta = await authFetch('/me');
            return respuesta.ok ? desempaquetar(await leerCuerpo(respuesta)) : null;
        } catch (e) {
            return null;
        }
    }

    async function verificarSesion() {
        if (usuarioSesion) return usuarioSesion;
        if (!sesionPendiente) sesionPendiente = consultarSesion();
        const datos = await sesionPendiente;
        usuarioSesion = datos || null;
        sesionPendiente = null;
        if (usuarioSesion) iniciarControlDeInactividad();
        return usuarioSesion;
    }

    // ===== Cierre de sesión por inactividad =====
    // La sesión dura 15 minutos, pero mientras la persona usa el sistema se renueva sola.
    // Solo se cierra si pasan 15 minutos sin mover el mouse, escribir, hacer clic o desplazarse.
    var LIMITE_INACTIVIDAD_MS = 15 * 60 * 1000;
    var AVISO_ANTES_MS = 60 * 1000;
    var RENOVAR_CADA_MS = 4 * 60 * 1000;
    var CLAVE_ACTIVIDAD = 'psyke_ultima_actividad';
    var controlIniciado = false;
    var ultimaActividad = Date.now();
    var ultimaRenovacion = Date.now();
    var avisoAbierto = false;
    var renovando = false;

    function leerActividadCompartida() {
        try {
            var valor = Number(global.localStorage.getItem(CLAVE_ACTIVIDAD));
            if (valor > ultimaActividad) ultimaActividad = valor;
        } catch (e) { }
        return ultimaActividad;
    }

    function marcarActividad() {
        var ahora = Date.now();
        if (ahora - ultimaActividad < 5000) return;
        ultimaActividad = ahora;
        // Compartido entre pestañas: si trabaja en otra pestaña, esta tampoco se cierra
        try { global.localStorage.setItem(CLAVE_ACTIVIDAD, String(ahora)); } catch (e) { }
    }

    async function renovarSesion() {
        if (renovando) return;
        renovando = true;
        try {
            var respuesta = await authFetch('/renovar', { method: 'POST' });
            if (respuesta.ok) ultimaRenovacion = Date.now();
        } catch (e) {
        } finally {
            renovando = false;
        }
    }

    async function cerrarPorInactividad() {
        try { await authFetch('/logout', { method: 'POST' }); } catch (e) { }
        if (typeof global.Swal !== 'undefined' && global.Swal.isVisible && global.Swal.isVisible()) global.Swal.close();
        cerrarSesionGlobal({ motivo: 'inactividad' });
    }

    async function mostrarAvisoInactividad() {
        avisoAbierto = true;
        if (typeof global.Swal === 'undefined') return;
        var resultado = await global.Swal.fire({
            icon: 'warning',
            title: '¿Sigues ahí?',
            html: 'Por seguridad, tu sesión se cerrará en <strong id="segundosInactividad">60</strong> segundos por inactividad.',
            confirmButtonText: 'Seguir conectado',
            allowOutsideClick: false,
            timer: AVISO_ANTES_MS,
            timerProgressBar: true,
            customClass: { popup: 'psyke-alerta', confirmButton: 'psyke-alerta-confirmar' },
            didOpen: function () {
                var contador = document.getElementById('segundosInactividad');
                var intervalo = setInterval(function () {
                    var restante = Math.max(0, Math.ceil((leerActividadCompartida() + LIMITE_INACTIVIDAD_MS - Date.now()) / 1000));
                    if (contador) contador.textContent = restante;
                    if (!avisoAbierto) clearInterval(intervalo);
                }, 1000);
            }
        });
        avisoAbierto = false;
        if (resultado && resultado.isConfirmed) {
            ultimaActividad = 0;
            marcarActividad();
            renovarSesion();
        }
    }

    function revisarInactividad() {
        if (sesionCerradaEnCurso) return;
        var inactivo = Date.now() - leerActividadCompartida();
        if (inactivo >= LIMITE_INACTIVIDAD_MS) {
            cerrarPorInactividad();
            return;
        }
        if (inactivo >= LIMITE_INACTIVIDAD_MS - AVISO_ANTES_MS) {
            if (!avisoAbierto) mostrarAvisoInactividad();
            return;
        }
        if (avisoAbierto && typeof global.Swal !== 'undefined') {
            avisoAbierto = false;
            global.Swal.close();
        }
        // Hubo actividad desde la última renovación: se pide un token nuevo antes de que venza
        if (ultimaActividad > ultimaRenovacion && Date.now() - ultimaRenovacion >= RENOVAR_CADA_MS) {
            renovarSesion();
        }
    }

    function iniciarControlDeInactividad() {
        if (controlIniciado) return;
        controlIniciado = true;
        ultimaActividad = Date.now();
        ultimaRenovacion = Date.now();
        try { global.localStorage.setItem(CLAVE_ACTIVIDAD, String(ultimaActividad)); } catch (e) { }
        ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach(function (evento) {
            global.addEventListener(evento, marcarActividad, { passive: true, capture: true });
        });
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible') revisarInactividad();
        });
        setInterval(revisarInactividad, 15000);
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
            listadosEnCurso[clave] = (async function () {
                try {
                    var descargados = await descargarPaginas(ruta, tamano);
                    // Si mientras tanto se guardó algún cambio, no se guarda este resultado (puede estar viejo)
                    if (cacheListados === cacheAlIniciar) {
                        cacheListados[clave] = { expira: Date.now() + DURACION_CACHE_LISTADOS_MS, datos: descargados };
                    }
                    return descargados;
                } finally {
                    delete listadosEnCurso[clave];
                }
            })();
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
    global.desempaquetarApi = desempaquetar;
    global.mensajeDeErrorApi = mensajeDeError;
    global.detallesDeErrorApi = detallesDeError;
    global.leerCuerpoApi = leerCuerpo;
    global.ultimoMensajeApi = function () { return ultimoMensajeApi; };
    global.peticionApi = peticionApi;
    global.listarTodo = listarTodo;
    global.conCacheDeSesion = conCacheDeSesion;
    global.limpiarCaches = limpiarCaches;
    global.verificarSesion = verificarSesion;
    global.Preferencias = Preferencias;
    global.normalizarListado = normalizarListado;
})(window);

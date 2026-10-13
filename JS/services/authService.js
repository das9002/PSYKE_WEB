(function (global) {
    'use strict';

    function urlAuth() {
        return String(global.AUTH_API_URL || '').replace(/\/+$/, '');
    }

    const CLAVES_INTERNAS = ['segundosRestantes', 'intentosRestantes'];

    function mensajeDelCuerpo(cuerpo, mensajePorDefecto) {
        const detalles = global.detallesDeErrorApi(cuerpo);
        const mensajesCampos = Object.entries(detalles)
            .filter(([clave, valor]) => !CLAVES_INTERNAS.includes(clave) && typeof valor === 'string')
            .map(([, valor]) => valor);
        return mensajesCampos.length ? mensajesCampos.join('\n') : global.mensajeDeErrorApi(cuerpo, mensajePorDefecto);
    }

    async function leerMensajeError(respuesta, mensajePorDefecto) {
        return mensajeDelCuerpo(await global.leerCuerpoApi(respuesta), mensajePorDefecto);
    }

    async function postLogin(correo, contrasena) {
        try {
            return await fetch(`${urlAuth()}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, contrasena, origen: 'WEB' }),
                credentials: 'include'
            });
        } catch (error) {
            const e = new Error('No se pudo conectar con el servidor de autenticación.');
            e.tipo = 'RED';
            throw e;
        }
    }

    async function loginUsuario(credenciales) {
        const respuesta = await postLogin(credenciales.correo, credenciales.contrasena);

        if (!respuesta.ok) {
            const mensaje = respuesta.status === 401
                ? 'Correo o contraseña incorrectos.'
                : await leerMensajeError(respuesta, 'No se pudo iniciar sesión. Intenta de nuevo.');
            const error = new Error(mensaje);
            error.status = respuesta.status;
            throw error;
        }

        const datos = global.desempaquetarApi(await global.leerCuerpoApi(respuesta)) || {};
        const usuario = {
            idUsuario: datos.idUsuario,
            correo: datos.correo,
            tipoUsuario: datos.tipoUsuario
        };

        if (usuario.tipoUsuario === 'ESTUDIANTE') {
            const error = new Error('Los estudiantes deben ingresar desde la aplicación móvil.');
            error.status = 403;
            throw error;
        }

        return { datos, usuario };
    }

    async function verificarContrasenaActual(correo, contrasena) {
        const respuesta = await postLogin(correo, contrasena);

        if (respuesta.status === 401) return false;

        if (!respuesta.ok) {
            const error = new Error(await leerMensajeError(respuesta, 'No se pudo verificar la contraseña actual.'));
            error.status = respuesta.status;
            throw error;
        }

        return true;
    }

    async function obtenerSesion() {
        const respuesta = await fetch(`${urlAuth()}/me`, {
            credentials: 'include'
        }).catch(() => null);

        if (!respuesta) {
            const e = new Error('No se pudo conectar con el servidor de autenticación.');
            e.tipo = 'RED';
            throw e;
        }
        if (respuesta.status === 401) {
            const e = new Error('Tu sesión ha expirado.');
            e.status = 401;
            throw e;
        }
        if (!respuesta.ok) {
            const e = new Error(await leerMensajeError(respuesta, 'No se pudo obtener la sesión actual.'));
            e.status = respuesta.status;
            throw e;
        }
        return global.desempaquetarApi(await global.leerCuerpoApi(respuesta));
    }

    async function postPublico(ruta, carga, mensajePorDefecto) {
        let respuesta;
        try {
            respuesta = await fetch(`${urlAuth()}${ruta}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(carga),
                credentials: 'include'
            });
        } catch (e) {
            const error = new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
            error.tipo = 'RED';
            throw error;
        }

        const cuerpo = await global.leerCuerpoApi(respuesta);
        if (!respuesta.ok) {
            const error = new Error(mensajeDelCuerpo(cuerpo, mensajePorDefecto));
            error.status = respuesta.status;
            error.detalles = global.detallesDeErrorApi(cuerpo);
            throw error;
        }
        const datos = global.desempaquetarApi(cuerpo) || {};
        if (cuerpo && cuerpo.mensaje && typeof datos === 'object' && !datos.message) datos.message = cuerpo.mensaje;
        return datos;
    }

    function solicitarCodigoRecuperacion(correo) {
        return postPublico('/recuperar-contrasena', { correo, origen: 'WEB' }, 'No se pudo enviar el código.');
    }

    function verificarCodigoRecuperacion(correo, codigo) {
        return postPublico('/verificar-codigo', { correo, codigo }, 'No se pudo verificar el código.');
    }

    function restablecerContrasena(correo, tokenRestablecimiento, nuevaContrasena) {
        return postPublico('/restablecer-contrasena', { correo, tokenRestablecimiento, nuevaContrasena }, 'No se pudo cambiar la contraseña.');
    }

    function actualizarCuenta(idUsuario, datos) {
        return global.apiFetch(`/usuarios/${idUsuario}`, {
            method: 'PUT',
            body: datos
        });
    }

    async function cerrarSesionServidor() {
        try {
            await fetch(`${urlAuth()}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) { }
    }

    async function logoutUsuario() {
        await cerrarSesionServidor();

        if (typeof global.cerrarSesionGlobal === 'function') {
            global.cerrarSesionGlobal({ voluntario: true });
        } else {
            global.location.replace(/\/(HTML|btnsEstudiante)\//i.test(global.location.pathname) ? '../index.html' : 'index.html');
        }
    }

    global.AuthService = {
        loginUsuario,
        logoutUsuario,
        cerrarSesionServidor,
        actualizarCuenta,
        verificarContrasenaActual,
        solicitarCodigoRecuperacion,
        verificarCodigoRecuperacion,
        restablecerContrasena,
        obtenerSesion
    };
})(window);

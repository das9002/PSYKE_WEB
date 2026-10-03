(function (global) {
    'use strict';

    function urlAuth() {
        return String(global.AUTH_API_URL || '').replace(/\/+$/, '');
    }

    async function leerMensajeError(respuesta, mensajePorDefecto) {
        try {
            const cuerpo = await respuesta.json();
            if (cuerpo.details && typeof cuerpo.details === 'object' && Object.keys(cuerpo.details).length) {
                return Object.values(cuerpo.details).join('\n');
            }
            if (cuerpo.message) return cuerpo.message;
        } catch (e) { }
        return mensajePorDefecto;
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

        const datos = await respuesta.json();
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
        return respuesta.json();
    }

    async function postPublico(ruta, cuerpo, mensajePorDefecto) {
        let respuesta;
        try {
            respuesta = await fetch(`${urlAuth()}${ruta}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cuerpo),
                credentials: 'include'
            });
        } catch (e) {
            const error = new Error('No se pudo conectar con el servidor. Revisa tu conexión.');
            error.tipo = 'RED';
            throw error;
        }

        const datos = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok) {
            const detalles = datos.details && typeof datos.details === 'object' ? datos.details : {};
            const mensajesCampos = Object.entries(detalles)
                .filter(([clave]) => !['segundosRestantes', 'intentosRestantes'].includes(clave))
                .map(([, valor]) => valor);
            const error = new Error(mensajesCampos.length ? mensajesCampos.join('\n') : (datos.message || mensajePorDefecto));
            error.status = respuesta.status;
            error.detalles = detalles;
            throw error;
        }
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

    async function logoutUsuario() {
        try {
            await fetch(`${urlAuth()}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (e) { }

        if (typeof global.cerrarSesionGlobal === 'function') {
            global.cerrarSesionGlobal({ voluntario: true });
        } else {
            global.location.replace(/\/(HTML|btnsEstudiante)\//i.test(global.location.pathname) ? '../index.html' : 'index.html');
        }
    }

    global.AuthService = {
        loginUsuario,
        logoutUsuario,
        verificarContrasenaActual,
        solicitarCodigoRecuperacion,
        verificarCodigoRecuperacion,
        restablecerContrasena,
        obtenerSesion
    };
})(window);

(function (global) {
    'use strict';

    const AUTH_URL_DEFECTO = 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth';

    function urlAuth() {
        return (global.AUTH_API_URL || AUTH_URL_DEFECTO).replace(/\/+$/, '');
    }

    function decodificarToken(token) {
        try {
            if (!token) return null;
            const base64Url = token.split('.')[1];
            if (!base64Url) return null;

            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const json = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            return JSON.parse(json);
        } catch (e) {
            return null;
        }
    }

    function leerToken() {
        if (typeof global.obtenerToken === 'function') {
            return global.obtenerToken();
        }
        return localStorage.getItem('psyke_token') || sessionStorage.getItem('psyke_token');
    }

    function obtenerUsuarioActual() {
        try {
            const raw = localStorage.getItem('psyke_user') || localStorage.getItem('user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function estaAutenticado() {
        const token = leerToken();
        if (!token) return false;
        const payload = decodificarToken(token);
        if (payload && payload.exp) {
            return payload.exp > Math.floor(Date.now() / 1000);
        }
        return true;
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

    function guardarSesion(token, usuario) {
        if (token) {
            localStorage.setItem('psyke_token', token);
            localStorage.setItem('token', token);
        }
        if (usuario) {
            const json = JSON.stringify(usuario);
            localStorage.setItem('psyke_user', json);
            localStorage.setItem('user', json);
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
        const token = datos.token || datos.accessToken;
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

        guardarSesion(token, usuario);
        return { datos, usuario, token };
    }

    async function verificarContrasenaActual(correo, contrasena) {
        const respuesta = await postLogin(correo, contrasena);

        if (respuesta.status === 401) return false;

        if (!respuesta.ok) {
            const error = new Error(await leerMensajeError(respuesta, 'No se pudo verificar la contraseña actual.'));
            error.status = respuesta.status;
            throw error;
        }

        const datos = await respuesta.json().catch(() => null);
        const token = datos && (datos.token || datos.accessToken);
        if (token) guardarSesion(token, null);
        return true;
    }

    async function obtenerSesion() {
        const respuesta = await fetch(`${urlAuth()}/me`, {
            headers: leerToken() ? { 'Authorization': `Bearer ${leerToken()}` } : {},
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
                body: JSON.stringify(cuerpo)
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
        const token = leerToken();
        try {
            await fetch(`${urlAuth()}/logout`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                credentials: 'include'
            });
        } catch (e) { }

        if (typeof global.cerrarSesionGlobal === 'function') {
            global.cerrarSesionGlobal({ voluntario: true });
        } else {
            localStorage.removeItem('psyke_token');
            localStorage.removeItem('token');
            localStorage.removeItem('psyke_user');
            localStorage.removeItem('user');
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
        obtenerSesion,
        obtenerUsuarioActual,
        estaAutenticado,
        decodificarToken
    };
})(window);

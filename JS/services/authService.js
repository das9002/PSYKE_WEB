function decodificarToken(token) {
    try {
        if (!token) return null;
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;
        
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('[AuthService] Error al decodificar el token:', e);
        return null;
    }
}

/**
 * Obtiene el token de autenticación guardado en el cliente.
 * @returns {string|null}
 */
function obtenerToken() {
    return localStorage.getItem('psyke_token') || 
           localStorage.getItem('token') || 
           sessionStorage.getItem('psyke_token') || 
           sessionStorage.getItem('token');
}

/**
 * Obtiene los datos del usuario autenticado guardados en el almacenamiento local.
 * @returns {Object|null}
 */
function obtenerUsuarioActual() {
    try {
        const raw = localStorage.getItem('psyke_user') || localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        console.error('[AuthService] Error al leer usuario de almacenamiento local:', e);
        return null;
    }
}

/**
 * Comprueba si existe un token activo.
 * @returns {boolean}
 */
function estaAutenticado() {
    const token = obtenerToken();
    if (!token) return false;
    
    // Verificar si el token ha expirado leyendo la propiedad 'exp'
    const payload = decodificarToken(token);
    if (payload && payload.exp) {
        const tiempoActual = Math.floor(Date.now() / 1000);
        if (payload.exp < tiempoActual) {
            return false;
        }
    }
    return true;
}

/**
 * Inicia sesión enviando las credenciales al servidor.
 * @param {Object} credentials - Objeto con correo y contraseña
 * @returns {Promise<Object>} Datos devueltos por la API
 */
async function loginUsuario(credentials) {
    const credencialesConOrigen = {
        ...credentials,
        origen: 'WEB'
    };

    // Obtener la URL base evitando barras duplicadas
    const baseUrl = (window.AUTH_API_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth').replace(/\/+$/, '');

    let respuesta;
    try {
        respuesta = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credencialesConOrigen),
            credentials: 'include'
        });
    } catch (error) {
        const e = new Error(`No se pudo conectar con el servidor de autenticación en ${baseUrl}.`);
        e.tipo = 'RED';
        throw e;
    }

    if (!respuesta.ok) {
        let mensaje = 'Credenciales inválidas o servicio fuera de línea.';
        try {
            const cuerpo = await respuesta.json();
            if (cuerpo.message) {
                mensaje = cuerpo.message;
            } else if (cuerpo.details && typeof cuerpo.details === 'object') {
                mensaje = Object.values(cuerpo.details).join('\n');
            }
        } catch (e) { }
        const error = new Error(mensaje);
        error.status = respuesta.status;
        throw error;
    }

    const datos = await respuesta.json();

    // 1. Extraer el token de acceso
    const token = datos?.token || datos?.jwt || datos?.accessToken || datos?.access_token;

    // 2. Extraer o decodificar los datos del usuario
    const datosUsuario = datos?.usuario || datos?.user || decodificarToken(token) || datos;

    // 3. Validar el rol del usuario
    const rol = datosUsuario?.tipoUsuario || datosUsuario?.rol || datosUsuario?.sub || datos?.tipoUsuario || datos?.rol;
    if (rol === 'ESTUDIANTE') {
        try {
            await fetch(`${baseUrl}/logout`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                credentials: 'include'
            });
        } catch (e) { }
        
        const error = new Error('Acceso denegado: Los estudiantes no tienen permiso para ingresar a la plataforma web.');
        error.status = 403;
        throw error;
    }

    // 4. Guardar token y datos del usuario de forma compatible
    if (token) {
        localStorage.setItem('psyke_token', token);
        localStorage.setItem('token', token); // Compatibilidad secundaria
    }

    if (datosUsuario) {
        const jsonUser = JSON.stringify(datosUsuario);
        localStorage.setItem('psyke_user', jsonUser);
        localStorage.setItem('user', jsonUser); // Compatibilidad secundaria
    }

    return { datos, usuario: datosUsuario, token };
}

/**
 * Solicita el restablecimiento de contraseña enviando el correo a la API.
 * IMPORTANTE: No usa authFetch para evitar adjuntar tokens caducados/inválidos que provocan error 401.
 * @param {string} correo - Correo del usuario registrado
 * @returns {Promise<Object>} Datos devueltos por la API
 */
async function recuperarContrasena(correo) {
    const baseUrl = (window.AUTH_API_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth').replace(/\/+$/, '');

    let respuesta;
    try {
        respuesta = await fetch(`${baseUrl}/recuperar-contrasena`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo }),
            credentials: 'include'
        });
    } catch (error) {
        const e = new Error(`No se pudo conectar con el servidor de autenticación en ${baseUrl}.`);
        e.tipo = 'RED';
        throw e;
    }

    if (!respuesta.ok) {
        let mensaje = 'Ocurrió un error al procesar la solicitud.';
        try {
            const cuerpo = await respuesta.json();
            if (cuerpo.message) mensaje = cuerpo.message;
        } catch (e) { }
        const error = new Error(mensaje);
        error.status = respuesta.status;
        throw error;
    }

    return await respuesta.json().catch(() => ({ message: 'Solicitud enviada correctamente.' }));
}

/**
 * Confirma el código enviado al correo y actualiza la contraseña del usuario.
 * @param {string} correo - Correo del usuario
 * @param {string} codigo - Código de verificación de 6 dígitos
 * @param {string} nuevaContrasena - La nueva contraseña elegida
 * @returns {Promise<Object>}
 */
async function restablecerContrasena(correo, codigo, nuevaContrasena) {
    const baseUrl = (window.AUTH_API_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth').replace(/\/+$/, '');

    let respuesta;
    try {
        respuesta = await fetch(`${baseUrl}/restablecer-contrasena`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo, codigo, nuevaContrasena }),
            credentials: 'include'
        });
    } catch (error) {
        const e = new Error(`No se pudo conectar con el servidor de autenticación en ${baseUrl}.`);
        e.tipo = 'RED';
        throw e;
    }

    if (!respuesta.ok) {
        let mensaje = 'Código inválido o expirado.';
        try {
            const cuerpo = await respuesta.json();
            if (cuerpo.message) mensaje = cuerpo.message;
        } catch (e) { }
        const error = new Error(mensaje);
        error.status = respuesta.status;
        throw error;
    }

    return await respuesta.json().catch(() => ({ message: 'Contraseña actualizada exitosamente.' }));
}

/**
 * Cierra la sesión activa en el cliente y notifica al servidor.
 */
async function logoutUsuario() {
    const baseUrl = (window.AUTH_API_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth').replace(/\/+$/, '');
    const token = obtenerToken();

    try {
        if (token) {
            await fetch(`${baseUrl}/logout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });
        }
    } catch (e) {
        console.warn('[AuthService] No se pudo notificar el logout al servidor:', e);
    } finally {
        if (typeof window.cerrarSesionGlobal === 'function') {
            window.cerrarSesionGlobal();
        } else {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = 'index.html';
        }
    }
}

// Objeto principal del servicio
const AuthService = {
    loginUsuario,
    logoutUsuario,
    recuperarContrasena,
    solicitarCodigoRecuperacion: recuperarContrasena,
    restablecerContrasena,
    cambiarContrasenaConCodigo: restablecerContrasena,
    obtenerToken,
    obtenerUsuarioActual,
    estaAutenticado,
    decodificarToken
};

// Exportar globalmente en la ventana del navegador
window.AuthService = AuthService;

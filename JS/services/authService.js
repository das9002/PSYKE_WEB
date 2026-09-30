// JS/services/authService.js

// Función auxiliar para decodificar el payload del token JWT
function decodificarToken(token) {
    try {
        if (!token) return null;
        const payloadBase64 = token.split('.')[1];
        if (!payloadBase64) return null;
        const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(payloadJson);
    } catch (e) {
        console.error('Error al decodificar el token:', e);
        return null;
    }
}

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
        const e = new Error(`No se pudo conectar con el servidor de autenticación. Verifique que el backend esté activo en ${baseUrl}.`);
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

    // 1. Extraer el token
    const token = datos?.token || datos?.jwt || datos?.accessToken;

    // 2. Extraer o decodificar los datos del usuario
    const datosUsuario = datos?.usuario || decodificarToken(token) || datos;

    // 3. Validar el rol
    const rol = datosUsuario?.tipoUsuario || datosUsuario?.rol || datosUsuario?.sub || datos?.tipoUsuario || datos?.rol;
    if (rol === 'ESTUDIANTE') {
        try {
            await fetch(`${baseUrl}/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
        } catch (e) { }
        const error = new Error('Acceso denegado: Los estudiantes no tienen permiso para ingresar a la plataforma web.');
        error.status = 403;
        throw error;
    }

    // 4. Guardar en localStorage
    if (token) {
        localStorage.setItem('psyke_token', token);
    }

    if (datosUsuario) {
        localStorage.setItem('psyke_user', JSON.stringify(datosUsuario));
    }

    return { datos };
}

const AuthService = {
    loginUsuario
};

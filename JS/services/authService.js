// JS/services/authService.js

async function loginUsuario(credentials) {
    const credencialesConOrigen = {
        ...credentials,
        origen: 'WEB'
    };

    // Obtenemos la URL base (que ya contiene '/api/auth') y nos aseguramos de no duplicar barras
    const baseUrl = (window.AUTH_API_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth').replace(/\/+$/, '');

    let respuesta;
    try {
        // CORREGIDO: Se cambió `${AUTH_API_URL}/api/auth/login` a `${baseUrl}/login`
        // para evitar que la URL quede como /api/auth/api/auth/login
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

    const rol = datos?.tipoUsuario || datos?.usuario?.tipoUsuario || datos?.rol;
    if (rol === 'ESTUDIANTE') {
        try {
            // CORREGIDO: Se cambió `${AUTH_API_URL}/api/auth/logout` a `${baseUrl}/logout`
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

    const token = datos?.token || datos?.jwt || datos?.accessToken;
    if (token) {
        localStorage.setItem('psyke_token', token);
    }

    if (datos?.usuario || datos) {
        localStorage.setItem('psyke_user', JSON.stringify(datos.usuario || datos));
    }

    return { datos };
}

const AuthService = {
    loginUsuario
};

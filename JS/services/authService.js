async function loginUsuario(credentials) {
    const credencialesConOrigen = {
        ...credentials,
        origen: 'WEB'
    };

    let respuesta;
    try {
        // CORREGIDO: Se agregó la ruta completa /api/auth/login
        respuesta = await fetch(`${AUTH_API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credencialesConOrigen),
            credentials: 'include'
        });
    } catch (error) {
        const e = new Error(`No se pudo conectar con el servidor de autenticación. Verifique que el backend esté activo en ${AUTH_API_URL}.`);
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
            // CORREGIDO: Se agregó la ruta completa /api/auth/logout
            await fetch(`${AUTH_API_URL}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
        } catch (e) { }
        const error = new Error('Acceso denegado: Los estudiantes no tienen permiso para ingresar a la plataforma web.');
        error.status = 403;
        throw error;
    }

    return { datos };
}

const AuthService = {
    loginUsuario
};

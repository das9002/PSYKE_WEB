async function loginUsuario(credentials) {
    const credencialesConOrigen = {
        ...credentials,
        origen: 'WEB'
    };

    let respuesta;
    try {
        respuesta = await fetch(`${AUTH_API_URL}/login`, {
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
    return { datos };
}

const AuthService = {
    loginUsuario
};
/**
 * ProfileService.js - Servicio para la gestión del perfil de usuario/psicólogo.
 */
const ProfileService = {
    /**
     * Obtiene el token JWT guardado en el almacenamiento local o de sesión,
     * eliminando comillas extra si fue guardado mediante JSON.stringify.
     * @returns {string|null}
     */
    _obtenerToken() {
        if (typeof window.obtenerToken === 'function') {
            return window.obtenerToken();
        }

        const claves = ['psyke_token', 'token', 'jwt', 'access_token', 'auth_token'];
        for (let i = 0; i < claves.length; i++) {
            let val = localStorage.getItem(claves[i]) || sessionStorage.getItem(claves[i]);
            if (val) {
                val = String(val).trim();
                // Eliminar comillas dobles que rodean al token si existen
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.substring(1, val.length - 1);
                }
                if (val && val !== 'null' && val !== 'undefined') {
                    return val;
                }
            }
        }
        return null;
    },

    /**
     * Obtiene el objeto de usuario guardado localmente (como fallback de seguridad).
     * @returns {Object|null}
     */
    _obtenerUsuarioLocal() {
        if (typeof window.obtenerUsuario === 'function') {
            const u = window.obtenerUsuario();
            if (u) return u;
        }

        const claves = ['psyke_user', 'user', 'currentUser', 'usuario'];
        for (let i = 0; i < claves.length; i++) {
            const raw = localStorage.getItem(claves[i]) || sessionStorage.getItem(claves[i]);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') return parsed;
                } catch (e) { }
            }
        }
        return null;
    },

    /**
     * Obtiene el ID del usuario en sesión desde la caché local o helper global.
     * @returns {string|number|null}
     */
    _obtenerIdUsuarioActual() {
        const user = this._obtenerUsuarioLocal();
        if (user) {
            return user.id || user.idUsuario || user.usuarioId || user.sub || null;
        }
        return null;
    },

    /**
     * Realiza peticiones HTTP asegurando que se incluyan las cabeceras de autenticación.
     * @param {string} endpoint - Ruta relativa del endpoint.
     * @param {Object} [options={}] - Opciones adicionales de fetch.
     * @returns {Promise<any>}
     */
    async _hacerPeticion(endpoint, options = {}) {
        const token = this._obtenerToken();
        
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        // Incluye la cabecera Authorization si existe un token válido
        if (token && !headers['Authorization'] && !headers['authorization']) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers,
            credentials: 'include' // Para peticiones CORS entre Vercel, Heroku, etc.
        };

        // Normalización de la ruta del endpoint
        let cleanEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;

        try {
            // 1. Usar authFetch global si está disponible para peticiones de perfil/auth
            if (typeof window.authFetch === 'function' && (cleanEndpoint.includes('/me') || cleanEndpoint.includes('/auth'))) {
                const res = await window.authFetch(cleanEndpoint, config);
                if (res && res.ok) {
                    return await res.json();
                }
            }

            // 2. Usar Helpers globales de API si existen
            if (typeof window.peticionApi === 'function') {
                return await window.peticionApi(cleanEndpoint, config);
            } else if (typeof window.apiFetch === 'function') {
                return await window.apiFetch(cleanEndpoint, config);
            } else {
                // 3. Fallback directo con fetch nativo
                const baseUrl = (
                    window.AUTH_API_URL || 
                    window.API_BASE_URL || 
                    window.ENV?.API_URL || 
                    window.API_URL || 
                    'https://api-auth-1b19165bcf87.herokuapp.com/api'
                ).replace(/\/+$/, '');

                const res = await fetch(`${baseUrl}${cleanEndpoint}`, config);
                
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || `Error ${res.status}: ${res.statusText}`);
                }
                return await res.json();
            }
        } catch (error) {
            console.warn(`[ProfileService] Advertencia en petición a ${endpoint}:`, error.message);
            throw error;
        }
    },

    /**
     * Obtiene la información del perfil del usuario.
     * Si falla la comunicación con la API, retorna los datos locales sin cerrar sesión.
     * @param {string|number} [idUsuario] - ID opcional.
     * @returns {Promise<Object>}
     */
    async obtenerPerfil(idUsuario) {
        try {
            const endpoint = idUsuario ? `/usuarios/${idUsuario}` : '/me';
            return await this._hacerPeticion(endpoint);
        } catch (error) {
            console.warn('[ProfileService] Falló la consulta a la API, retornando datos locales:', error);
            
            const usuarioLocal = this._obtenerUsuarioLocal();
            if (usuarioLocal) {
                return usuarioLocal;
            }
            throw error;
        }
    },

    /**
     * Obtiene la información del perfil del usuario actual (/me).
     * @returns {Promise<Object>}
     */
    async obtenerMiPerfil() {
        return this.obtenerPerfil();
    },

    /**
     * Actualiza la información del perfil del usuario.
     * @param {string|number|Object} idUsuarioODatos - ID del usuario o datos a actualizar.
     * @param {Object} [datos] - Datos a enviar si el primer parámetro es un ID.
     * @returns {Promise<Object>}
     */
    async actualizarPerfil(idUsuarioODatos, datos) {
        let id;
        let payload;

        // Si el primer parámetro es un objeto, asumimos que son los datos a guardar
        if (typeof idUsuarioODatos === 'object' && idUsuarioODatos !== null) {
            payload = idUsuarioODatos;
            id = this._obtenerIdUsuarioActual();
        } else {
            id = idUsuarioODatos || this._obtenerIdUsuarioActual();
            payload = datos;
        }

        if (!payload || typeof payload !== 'object') {
            return Promise.reject(new Error('Los datos a actualizar deben ser un objeto válido.'));
        }

        const endpoint = id ? `/usuarios/${id}` : '/me';
        const bodyContent = typeof payload === 'string' ? payload : JSON.stringify(payload);

        return this._hacerPeticion(endpoint, {
            method: 'PUT',
            body: bodyContent
        });
    }
};

// Exposición global explícita
window.ProfileService = ProfileService;

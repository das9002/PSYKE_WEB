document.addEventListener('DOMContentLoaded', async () => {
    'use strict';

    // 1. Referencias a elementos del DOM
    const form = document.getElementById('editProfileForm');
    const btnVolver = document.getElementById('btnVolver');
    const actionCambiarEmail = document.getElementById('actionCambiarEmail');
    const actionAgregarTelefono = document.getElementById('actionAgregarTelefono');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const switchOscuro = document.getElementById('switchOscuro');
    const logoutBtn = document.getElementById('logoutBtn');

    // 2. Helpers para manejo de notificaciones seguras
    const NotifHelper = {
        exito(msg, titulo = 'Éxito') {
            if (typeof Notif !== 'undefined' && typeof Notif.exito === 'function') {
                Notif.exito(msg, titulo);
            } else if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'success', title: titulo, text: msg, timer: 2000, showConfirmButton: false });
            } else {
                alert(`${titulo}: ${msg}`);
            }
        },
        error(msg, titulo = 'Error') {
            if (typeof Notif !== 'undefined' && typeof Notif.error === 'function') {
                Notif.error(msg, titulo);
            } else if (typeof Swal !== 'undefined') {
                Swal.fire({ icon: 'error', title: titulo, text: msg });
            } else {
                alert(`${titulo}: ${msg}`);
            }
        },
        async confirmar(titulo, msg) {
            if (typeof Notif !== 'undefined' && typeof Notif.confirmar === 'function') {
                return await Notif.confirmar(titulo, msg);
            } else if (typeof Swal !== 'undefined') {
                const res = await Swal.fire({
                    title: titulo,
                    text: msg,
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, continuar',
                    cancelButtonText: 'Cancelar'
                });
                return res.isConfirmed;
            } else {
                return confirm(`${titulo}\n${msg}`);
            }
        }
    };

    // 3. Helper para obtener el token sin comillas extra
    function obtenerTokenValido() {
        if (typeof window.obtenerToken === 'function') {
            return window.obtenerToken();
        }
        const claves = ['psyke_token', 'token', 'jwt', 'access_token'];
        for (let key of claves) {
            let val = localStorage.getItem(key) || sessionStorage.getItem(key);
            if (val) {
                val = String(val).trim();
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.substring(1, val.length - 1);
                }
                if (val && val !== 'null' && val !== 'undefined') return val;
            }
        }
        return null;
    }

    // 4. Helper para obtener usuario local de respaldo
    function obtenerUsuarioLocal() {
        if (typeof window.obtenerUsuario === 'function') {
            const u = window.obtenerUsuario();
            if (u) return u;
        }
        const claves = ['psyke_user', 'user', 'usuario'];
        for (let key of claves) {
            const raw = localStorage.getItem(key) || sessionStorage.getItem(key);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') return parsed;
                } catch (e) { }
            }
        }
        return null;
    }

    // 5. Generador de iniciales para el avatar
    function iniciales(nombres, apellidos) {
        const n = (nombres || '').trim();
        const a = (apellidos || '').trim();
        if (!n && !a) return 'PS';
        return ((n ? n[0] : '') + (a ? a[0] : '')).toUpperCase();
    }

    // 6. Resolver ruta dinámica de Login
    function resolverLogin() {
        const path = window.location.pathname;
        const carpeta = path.substring(0, path.lastIndexOf('/'));
        const profundidad = carpeta.split('/').filter(Boolean).length;
        return profundidad > 0 ? '../index.html' : 'index.html';
    }

    // 7. Obtener sesión actual con Token e Inmunidad a caídas
    async function obtenerUsuarioSesion() {
        const token = obtenerTokenValido();
        const usuarioLocal = obtenerUsuarioLocal();

        // Si no hay token ni usuario local, redirigir
        if (!token && !usuarioLocal) {
            console.warn('[profileController] Sin credenciales encontradas.');
            window.location.replace(resolverLogin());
            return null;
        }

        try {
            const baseUrl = (
                window.AUTH_API_URL || 
                window.API_BASE_URL || 
                'https://api-auth-1b19165bcf87.herokuapp.com/api/auth'
            ).replace(/\/+$/, '');

            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const respuesta = await fetch(`${baseUrl}/me`, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });

            if (respuesta.ok) {
                const datosServer = await respuesta.json();
                localStorage.setItem('psyke_user', JSON.stringify(datosServer));
                return datosServer;
            }

            // Solo redirige a login si explícitamente el servidor rechaza el Token (401)
            // Y no tenemos un usuario local válido guardado
            if (respuesta.status === 401 && !usuarioLocal) {
                window.location.replace(resolverLogin());
                return null;
            }
        } catch (e) {
            console.warn('[profileController] Servidor no disponible, utilizando datos de sesión local:', e);
        }

        // Si falla la red o devuelve 403/500, usamos el usuario guardado localmente
        return usuarioLocal;
    }

    // 8. Carga e inserción de datos en la interfaz de usuario
    async function cargarPerfil() {
        const usuarioSesion = await obtenerUsuarioSesion();
        if (!usuarioSesion) return;

        const idUsuario = usuarioSesion.idUsuario || usuarioSesion.id || usuarioSesion.usuarioId;
        let datos = usuarioSesion;

        // Intentar consultar al ProfileService para refrescar datos completos
        if (idUsuario && typeof ProfileService !== 'undefined' && typeof ProfileService.obtenerPerfil === 'function') {
            try {
                const datosFrescos = await ProfileService.obtenerPerfil(idUsuario);
                if (datosFrescos) datos = datosFrescos;
            } catch (error) {
                console.warn('[profileController] No se pudo obtener perfil fresco desde ProfileService, usando datos locales.');
            }
        }

        const inputNombre = document.getElementById('inputNombre');
        const inputApellido = document.getElementById('inputApellido');
        const inputEspecialidad = document.getElementById('inputEspecialidad');
        const inputEmail = document.getElementById('inputEmail');
        const inputTelefono = document.getElementById('inputTelefono');
        const avatarEl = document.querySelector('.avatar-circle');

        const nombres = datos.nombres ?? datos.nombre ?? '';
        const apellidos = datos.apellidos ?? datos.apellido ?? '';
        const especialidad = datos.especialidad ?? '';
        const correo = datos.correo ?? datos.email ?? '';
        const telefono = datos.telefono ?? datos.telefonoContacto ?? '';

        if (inputNombre) inputNombre.value = String(nombres).trim();
        if (inputApellido) inputApellido.value = String(apellidos).trim();
        if (inputEspecialidad) inputEspecialidad.value = String(especialidad).trim();
        if (inputEmail) inputEmail.value = String(correo).trim();
        if (inputTelefono) inputTelefono.value = String(telefono).trim();
        if (avatarEl) avatarEl.textContent = iniciales(nombres, apellidos);
    }

    // 9. Event Listeners para botones y acciones
    if (btnVolver) {
        btnVolver.addEventListener('click', (e) => {
            e.preventDefault();
            NotifHelper.exito('Regresando...', 'Espere');
            setTimeout(() => {
                window.location.href = "config.html";
            }, 500);
        });
    }

    if (actionCambiarEmail) {
        actionCambiarEmail.addEventListener('click', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('inputEmail');
            if (emailInput) {
                emailInput.removeAttribute('readonly');
                emailInput.focus();
            }
        });
    }

    if (actionAgregarTelefono) {
        actionAgregarTelefono.addEventListener('click', (e) => {
            e.preventDefault();
            const telInput = document.getElementById('inputTelefono');
            if (telInput) {
                telInput.removeAttribute('readonly');
                telInput.focus();
            }
        });
    }

    // 10. Envío del formulario de actualización
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nombres = document.getElementById('inputNombre')?.value.trim() || '';
            const apellidos = document.getElementById('inputApellido')?.value.trim() || '';
            const especialidad = document.getElementById('inputEspecialidad')?.value.trim() || '';
            const correo = document.getElementById('inputEmail')?.value.trim() || '';
            const telefono = document.getElementById('inputTelefono')?.value.trim() || '';

            const usuarioSesion = await obtenerUsuarioSesion();
            if (!usuarioSesion) {
                NotifHelper.error('No se encontró el usuario de sesión. Inicie sesión nuevamente.', 'Error de sesión');
                return;
            }

            const idUsuario = usuarioSesion.idUsuario || usuarioSesion.id || usuarioSesion.usuarioId;

            const datosPerfil = {
                nombres,
                apellidos,
                nombre: nombres,
                apellido: apellidos,
                especialidad,
                correo,
                telefono,
                tipoUsuario: usuarioSesion.tipoUsuario || 'PSICOLOGO',
                estadoCuenta: 'ACTIVO'
            };

            const avatarEl = document.querySelector('.avatar-circle');
            if (avatarEl) avatarEl.textContent = iniciales(nombres, apellidos);

            try {
                if (typeof ProfileService !== 'undefined' && typeof ProfileService.actualizarPerfil === 'function') {
                    await ProfileService.actualizarPerfil(idUsuario, datosPerfil);
                }

                // Actualizar sesión en localStorage
                const usuarioActualizado = { ...usuarioSesion, ...datosPerfil };
                localStorage.setItem('psyke_user', JSON.stringify(usuarioActualizado));

                NotifHelper.exito('¡Perfil actualizado con éxito!');
            } catch (error) {
                console.error('[profileController] Error al actualizar perfil:', error);
                
                // Si la red falla, actualizamos el almacenamiento local de todos modos
                const usuarioActualizado = { ...usuarioSesion, ...datosPerfil };
                localStorage.setItem('psyke_user', JSON.stringify(usuarioActualizado));

                NotifHelper.exito('¡Perfil guardado localmente!');
            }
        });
    }

    // 11. Menú lateral (Sidebar) y Hamburguesa
    if (hamburgerBtn && sidebar && overlay) {
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
            hamburgerBtn.innerHTML = sidebar.classList.contains('open')
                ? '<i class="bi bi-x"></i>'
                : '<i class="bi bi-list"></i>';
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            hamburgerBtn.innerHTML = '<i class="bi bi-list"></i>';
        });

        document.querySelectorAll('.sidebar .nav-link').forEach(link => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('active');
                hamburgerBtn.innerHTML = '<i class="bi bi-list"></i>';
            });
        });
    }

    // 12. Switch Tema Oscuro
    if (switchOscuro) {
        switchOscuro.checked = localStorage.getItem('psyke_dark_mode') === 'enabled';
        switchOscuro.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.documentElement.classList.add('dark-mode');
                localStorage.setItem('psyke_dark_mode', 'enabled');
            } else {
                document.documentElement.classList.remove('dark-mode');
                localStorage.setItem('psyke_dark_mode', 'disabled');
            }
        });
    }

    // 13. Cerrar Sesión
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const confirmado = await NotifHelper.confirmar('Cerrar sesión', '¿Estás seguro de que deseas cerrar sesión?');
            if (confirmado) {
                if (typeof window.cerrarSesionGlobal === 'function') {
                    window.cerrarSesionGlobal();
                } else {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.replace(resolverLogin());
                }
            }
        });
    }

    // Inicializar carga de perfil
    cargarPerfil();
});

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('editProfileForm');

    const btnVolver = document.getElementById('btnVolver');
    if (btnVolver) {
        btnVolver.addEventListener('click', (e) => {
            e.preventDefault();
            
            Notif.exito('Regresando...', 'Espere');
            
            setTimeout(() => {
                window.location.href = "../HTML/config.html";
            }, 600);
        });
    }

    function iniciales(nombres, apellidos) {
        const n = (nombres || '').trim();
        const a = (apellidos || '').trim();
        if (!n && !a) return 'PS';
        return ((n ? n[0] : '') + (a ? a[0] : '')).toUpperCase();
    }

    async function obtenerUsuarioSesion() {
        try {
            const respuesta = await fetch('http://localhost:8081/api/auth/me', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });

            if (respuesta.status === 401) {
                window.location.replace(resolverLogin());
                return null;
            }

            if (respuesta.status === 403) {
                console.warn('[profileController] Acceso denegado (403), pero se mantiene la sesión');
                return null;
            }

            if (respuesta.status >= 500) {
                console.error('[profileController] Error del servidor (5xx), se mantiene la sesión');
                return null;
            }

            if (respuesta.ok) {
                return await respuesta.json();
            }
        } catch (e) {
            console.error('[profileController] Error de red al verificar sesión:', e);
        }
        return null;
    }

    function resolverLogin() {
        const path = window.location.pathname;
        const carpeta = path.substring(0, path.lastIndexOf('/'));
        const profundidad = carpeta.split('/').filter(Boolean).length;
        return profundidad > 0 ? '../index.html' : 'index.html';
    }

    async function cargarPerfil() {
        const usuarioSesion = await obtenerUsuarioSesion();
        if (!usuarioSesion || !usuarioSesion.idUsuario) return;

        try {
            const datos = await ProfileService.obtenerPerfil(usuarioSesion.idUsuario);
            if (!datos) return;

            const inputNombre = document.getElementById('inputNombre');
            const inputApellido = document.getElementById('inputApellido');
            const inputEspecialidad = document.getElementById('inputEspecialidad');
            const inputEmail = document.getElementById('inputEmail');
            const inputTelefono = document.getElementById('inputTelefono');
            const avatarEl = document.querySelector('.avatar-circle');

            const nombres = datos.nombres ?? datos.nombre ?? inputNombre?.value;
            const apellidos = datos.apellidos ?? datos.apellido ?? inputApellido?.value;

            if (inputNombre && nombres) inputNombre.value = String(nombres).trim();
            if (inputApellido && apellidos) inputApellido.value = String(apellidos).trim();
            if (inputEspecialidad && datos.especialidad) inputEspecialidad.value = String(datos.especialidad).trim();
            if (inputEmail && (datos.correo ?? datos.email)) inputEmail.value = String(datos.correo ?? datos.email).trim();
            if (inputTelefono && (datos.telefono ?? datos.telefonoContacto)) inputTelefono.value = String(datos.telefono ?? datos.telefonoContacto).trim();
            if (avatarEl && (nombres || apellidos)) avatarEl.textContent = iniciales(nombres, apellidos);
        } catch (error) {
            const status = error?.status;
            if (status === 401) throw error;
            if (status === 403) {
                Notif.error('Acceso denegado: Permisos insuficientes para cargar el perfil.');
            } else if (status >= 500) {
                Notif.error('Error interno del servidor al cargar el perfil. Intente nuevamente más tarde.');
            }
        }
    }

    const actionCambiarEmail = document.getElementById('actionCambiarEmail');
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

    const actionAgregarTelefono = document.getElementById('actionAgregarTelefono');
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

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nombres = document.getElementById('inputNombre').value.trim();
            const apellidos = document.getElementById('inputApellido').value.trim();
            const especialidad = document.getElementById('inputEspecialidad').value.trim();
            const correo = document.getElementById('inputEmail').value.trim();
            const telefono = document.getElementById('inputTelefono').value.trim();

            const usuarioSesion = await obtenerUsuarioSesion();
            if (!usuarioSesion || !usuarioSesion.idUsuario) {
                Notif.error('No se encontró el usuario de sesión. Inicie sesión nuevamente.', 'Error de sesión');
                return;
            }

            const datosPerfil = {
                nombres,
                apellidos,
                especialidad,
                correo,
                telefono,
                tipoUsuario: usuarioSesion.tipoUsuario || 'PSICOLOGO',
                estadoCuenta: 'ACTIVO'
            };

            const avatarEl = document.querySelector('.avatar-circle');
            if (avatarEl) avatarEl.textContent = iniciales(nombres, apellidos);

            try {
                await ProfileService.actualizarPerfil(usuarioSesion.idUsuario, datosPerfil);
                Notif.exito('¡Perfil actualizado con éxito!');
            } catch (error) {
                const status = error?.status;
                if (status === 401) throw error;
                if (status === 403) {
                    Notif.error('Acceso denegado: Permisos insuficientes para actualizar el perfil.');
                } else if (status >= 500) {
                    Notif.error('Error interno del servidor al actualizar el perfil. Intente nuevamente más tarde.');
                } else {
                    Notif.exito('¡Perfil actualizado en la sesión!');
                }
            }
        });
    }

    cargarPerfil();
});

document.addEventListener('DOMContentLoaded', () => {
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebarOverlay');

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

        const switchOscuro = document.getElementById('switchOscuro');
        if (switchOscuro) {
            switchOscuro.addEventListener('change', (e) => {
                if(e.target.checked) {
                    console.log("Modo oscuro activado");
                } else {
                    console.log("Modo oscuro desactivado");
                }
            });
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                Notif.confirmar('Cerrar sesión', '¿Estás seguro de que deseas cerrar sesión?').then(confirmado => {
                    if (confirmado) {
                        Notif.exito('Sesión cerrada correctamente.');
                    }
                });
            });
        }
    });
document.addEventListener('DOMContentLoaded', () => {

    // 1. Visibilidad de contraseña
    const eyeButtons = document.querySelectorAll('.btn-eye-toggle');
    eyeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = btn.querySelector('i');

            if (!input || !icon) return;

            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            } else {
                input.type = 'password';
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            }
        });
    });

    // 2. Requisitos de la nueva contraseña
    const newPassword = document.getElementById('newPassword');
    const requirements = {
        length: { element: document.getElementById('reqLength'), regex: /.{8,}/ },
        upper: { element: document.getElementById('reqUpper'), regex: /[A-Z]/ },
        number: { element: document.getElementById('reqNumber'), regex: /[0-9]/ },
        special: { element: document.getElementById('reqSpecial'), regex: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/ }
    };

    if (newPassword) {
        newPassword.addEventListener('input', () => {
            const val = newPassword.value;

            for (const key in requirements) {
                const req = requirements[key];
                if (!req.element) continue;

                const isValid = req.regex.test(val);
                const item = req.element;
                const icon = item.querySelector('i');

                if (isValid) {
                    item.classList.remove('invalid');
                    item.classList.add('valid');
                    if (icon) {
                        icon.classList.remove('bi-x-circle-fill');
                        icon.classList.add('bi-check-circle-fill');
                    }
                } else {
                    item.classList.remove('valid');
                    item.classList.add('invalid');
                    if (icon) {
                        icon.classList.remove('bi-check-circle-fill');
                        icon.classList.add('bi-x-circle-fill');
                    }
                }
            }
        });
    }

    // 3. Envío del formulario
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nPass = newPassword ? newPassword.value : '';
            const confirmInput = document.getElementById('confirmPassword');
            const cPass = confirmInput ? confirmInput.value : '';

            if (nPass !== cPass) {
                mostrarMensaje('La nueva contraseña y su confirmación no coinciden.', 'error');
                return;
            }

            const cumpleRequisitos = Object.values(requirements).every(req => req.regex.test(nPass));
            if (!cumpleRequisitos) {
                mostrarMensaje('La nueva contraseña no cumple con todos los requisitos de seguridad.', 'error');
                return;
            }

            const token = localStorage.getItem('token') || localStorage.getItem('psyke_token') || sessionStorage.getItem('token');
            if (!token) {
                mostrarMensaje('No hay sesión activa. Inicie sesión nuevamente.', 'error');
                setTimeout(() => window.location.href = '../HTML/login.html', 2000);
                return;
            }

            // Obtener el ID del usuario autenticado vía /auth/me
            let idUsuario = null;
            try {
                const authBaseUrl = window.AUTH_API_URL || window.ENV?.API_BASE_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth';
                const respAuth = await fetch(`${authBaseUrl}/me`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (respAuth.ok) {
                    const authData = await respAuth.json();
                    idUsuario = authData.idUsuario || authData.id;
                } else if (respAuth.status === 401) {
                    mostrarMensaje('Su sesión ha expirado.', 'error');
                    setTimeout(() => window.location.href = '../HTML/login.html', 2000);
                    return;
                }
            } catch (err) {
                console.error('Error al verificar sesión auth:', err);
            }

            if (!idUsuario) {
                mostrarMensaje('No se pudo determinar el ID del usuario en sesión.', 'error');
                return;
            }

            // Obtener el usuario COMPLETO desde ProfileService o API para no perder datos obligatorios
            let perfilCompleto = null;
            try {
                if (typeof ProfileService.obtenerPerfil === 'function') {
                    perfilCompleto = await ProfileService.obtenerPerfil(idUsuario);
                } else {
                    const apiBaseUrl = window.ENV?.API_SERVICE_URL || 'https://api-service-4d465a47b94c.herokuapp.com/api';
                    const respPerfil = await fetch(`${apiBaseUrl}/usuarios/${idUsuario}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (respPerfil.ok) {
                        perfilCompleto = await respPerfil.json();
                    }
                }
            } catch (err) {
                console.error('Error al obtener perfil completo:', err);
            }

            if (!perfilCompleto) {
                mostrarMensaje('No se pudieron obtener los datos completos del perfil.', 'error');
                return;
            }

            // Unir perfil completo + la nueva contraseña
            const payload = {
                ...perfilCompleto,
                contrasena: nPass
            };

            console.log('Payload completo enviado:', payload);

            try {
                await ProfileService.actualizarPerfil(idUsuario, payload);
                mostrarMensaje('¡Tu contraseña ha sido actualizada con éxito!', 'exito');
                passwordForm.reset();
            } catch (error) {
                console.error('Error al actualizar:', error);
                mostrarMensaje('No se pudo actualizar la contraseña: ' + error.message, 'error');
            }
        });
    }

    // 4. Botón Volver
    const btnVolver = document.getElementById('btnVolver');
    if (btnVolver) {
        btnVolver.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = "../HTML/config.html";
        });
    }
});

function mostrarMensaje(mensaje, tipo = 'info') {
    if (window.Notif) {
        if (tipo === 'exito') Notif.exito(mensaje);
        else if (tipo === 'error') Notif.error(mensaje, 'Error');
        else Notif.informar(mensaje);
    } else {
        alert(mensaje);
    }
}

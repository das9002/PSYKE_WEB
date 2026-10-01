document.addEventListener('DOMContentLoaded', () => {

    // 1. Alternar visibilidad de contraseña (Ojito)
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

    // 2. Requisitos de validación de la nueva contraseña
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

    // 3. Envío del formulario de cambio de contraseña
    const passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const nPass = newPassword ? newPassword.value : '';
            const confirmInput = document.getElementById('confirmPassword');
            const cPass = confirmInput ? confirmInput.value : '';

            // Validar que las contraseñas coincidan
            if (nPass !== cPass) {
                if (window.Notif) {
                    Notif.informar('La nueva contraseña y su confirmación no coinciden.');
                } else {
                    alert('La nueva contraseña y su confirmación no coinciden.');
                }
                return;
            }

            // Validar que cumpla todos los requisitos de complejidad
            const cumpleRequisitos = Object.values(requirements).every(req => req.regex.test(nPass));
            if (!cumpleRequisitos) {
                if (window.Notif) {
                    Notif.informar('La nueva contraseña debe cumplir con todos los requisitos de seguridad.');
                } else {
                    alert('La nueva contraseña debe cumplir con todos los requisitos de seguridad.');
                }
                return;
            }

            // Obtener token JWT almacenado en el navegador
            const token = localStorage.getItem('token') || localStorage.getItem('psyke_token') || sessionStorage.getItem('token');

            if (!token) {
                if (window.Notif) {
                    Notif.error('No se encontró un token de sesión. Inicie sesión nuevamente.', 'Error de sesión');
                } else {
                    alert('No se encontró un token de sesión.');
                }
                setTimeout(() => window.location.href = '../HTML/login.html', 2000);
                return;
            }

            // Obtener datos del usuario autenticado enviando la cabecera Authorization
            let usuarioSesion = null;
            try {
                const baseUrl = window.AUTH_API_URL || window.ENV?.API_BASE_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth';
                
                const respuesta = await fetch(`${baseUrl}/me`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}` // Cabecera corregida para solucionar el error 401
                    },
                    credentials: 'include'
                });

                if (respuesta.ok) {
                    usuarioSesion = await respuesta.json();
                } else if (respuesta.status === 401) {
                    if (window.Notif) {
                        Notif.error('Su sesión ha expirado. Inicie sesión nuevamente.', 'Sesión Expirada');
                    } else {
                        alert('Su sesión ha expirado.');
                    }
                    setTimeout(() => window.location.href = '../HTML/login.html', 2000);
                    return;
                }
            } catch (err) {
                console.error('Error de red al obtener sesión:', err);
            }

            if (!usuarioSesion || !usuarioSesion.idUsuario) {
                if (window.Notif) {
                    Notif.error('No se pudo obtener la información del usuario en sesión.', 'Error de sesión');
                } else {
                    alert('No se pudo obtener la información del usuario en sesión.');
                }
                return;
            }

            const datosContrasena = {
                correo: usuarioSesion.correo || '',
                tipoUsuario: usuarioSesion.tipoUsuario || 'PSICOLOGO',
                estadoCuenta: 'ACTIVO',
                contrasena: nPass
            };

            // Enviar actualización
            try {
                await ProfileService.actualizarPerfil(usuarioSesion.idUsuario, datosContrasena);
                if (window.Notif) {
                    Notif.exito('¡Tu contraseña ha sido actualizada con éxito!');
                } else {
                    alert('¡Tu contraseña ha sido actualizada con éxito!');
                }
                passwordForm.reset();
            } catch (error) {
                if (window.Notif) {
                    Notif.error('No se pudo actualizar la contraseña: ' + error.message, 'Error al actualizar');
                } else {
                    alert('No se pudo actualizar la contraseña: ' + error.message);
                }
            }
        });
    }

    // 4. Redirección del botón Volver
    const btnVolver = document.getElementById('btnVolver');
    if (btnVolver) {
        btnVolver.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = "../HTML/config.html";
        });
    }
});

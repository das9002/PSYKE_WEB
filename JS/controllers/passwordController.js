document.addEventListener('DOMContentLoaded', () => {

    // 1. Visibilidad de contraseña (Ojito)
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

            // 3.1 Obtener ID del usuario desde /auth/me
            let idUsuario = null;
            let datosSesion = {};
            try {
                const authBaseUrl = window.AUTH_API_URL || window.ENV?.API_BASE_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth';
                const respAuth = await fetch(`${authBaseUrl}/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (respAuth.ok) {
                    datosSesion = await respAuth.json();
                    idUsuario = datosSesion.idUsuario || datosSesion.id;
                } else if (respAuth.status === 401) {
                    mostrarMensaje('Su sesión ha expirado.', 'error');
                    setTimeout(() => window.location.href = '../HTML/login.html', 2000);
                    return;
                }
            } catch (err) {
                console.error('Error al obtener /auth/me:', err);
            }

            if (!idUsuario) {
                mostrarMensaje('No se pudo obtener el ID del usuario.', 'error');
                return;
            }

            // 3.2 Obtener datos del perfil completo desde el backend
            const apiServiceUrl = window.ENV?.API_SERVICE_URL || 'https://api-service-4d465a47b94c.herokuapp.com/api';
            let usuarioActual = {};

            try {
                const resUser = await fetch(`${apiServiceUrl}/usuarios/${idUsuario}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (resUser.ok) {
                    usuarioActual = await resUser.json();
                }
            } catch (e) {
                console.warn('No se pudo consultar GET /usuarios/', e);
            }

            // 3.3 Normalizar el campo tipoUsuario (Soporta ADMIN, ESTUDIANTE y PSICOLOGO)
            let tipoBruto = (usuarioActual.tipoUsuario || datosSesion.tipoUsuario || 'PSICOLOGO').toString().toUpperCase().trim();
            tipoBruto = tipoBruto.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remueve tildes ('PSICÓLOGO' -> 'PSICOLOGO')

            let tipoUsuarioValido = 'PSICOLOGO';
            if (tipoBruto.includes('ADMIN')) {
                tipoUsuarioValido = 'ADMIN';
            } else if (tipoBruto.includes('ESTUDIANTE') || tipoBruto.includes('ALUMNO')) {
                tipoUsuarioValido = 'ESTUDIANTE';
            } else if (tipoBruto.includes('PSICOLOGO')) {
                tipoUsuarioValido = 'PSICOLOGO';
            }

            // 3.4 Construir el Payload correcto y completo
            const payload = {
                ...datosSesion,
                ...usuarioActual,
                idUsuario: idUsuario,
                tipoUsuario: tipoUsuarioValido,
                contrasena: nPass,
                password: nPass
            };

            // 3.5 Enviar actualización a la API
            try {
                const response = await fetch(`${apiServiceUrl}/usuarios/${idUsuario}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                const data = await response.json().catch(() => ({}));

                if (response.ok) {
                    mostrarMensaje('¡Tu contraseña ha sido actualizada con éxito!', 'exito');
                    passwordForm.reset();
                } else {
                    console.error('Detalles del error:', data);
                    let detalleErrores = '';
                    if (data.details) {
                        detalleErrores = Object.entries(data.details)
                            .map(([campo, msg]) => `• ${campo}: ${msg}`)
                            .join('\n');
                    }
                    mostrarMensaje(`Error al actualizar:\n${detalleErrores || data.message || 'Error de validación'}`, 'error');
                }
            } catch (error) {
                console.error('Error de red al actualizar contraseña:', error);
                mostrarMensaje('Error de conexión: ' + error.message, 'error');
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

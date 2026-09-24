document.addEventListener('DOMContentLoaded', () => {
         
        const eyeButtons = document.querySelectorAll('.btn-eye-toggle');
        eyeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const input = document.getElementById(targetId);
                const icon = btn.querySelector('i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.replace('bi-eye-slash', 'bi-eye');
                } else {
                    input.type = 'password';
                    icon.classList.replace('bi-eye', 'bi-eye-slash');
                }
            });
        });

        const newPassword = document.getElementById('newPassword');
        const requirements = {
            length: { element: document.getElementById('reqLength'), regex: /.{8,}/ },
            upper: { element: document.getElementById('reqUpper'), regex: /[A-Z]/ },
            number: { element: document.getElementById('reqNumber'), regex: /[0-9]/ },
            special: { element: document.getElementById('reqSpecial'), regex: /[!@#\$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/ }
        };

        newPassword.addEventListener('input', () => {
            const val = newPassword.value;
            
            for (const key in requirements) {
                const isValid = requirements[key].regex.test(val);
                const item = requirements[key].element;
                const icon = item.querySelector('i');
                
                if (isValid) {
                    item.classList.replace('invalid', 'valid');
                    icon.classList.replace('bi-x-circle-fill', 'bi-check-circle-fill');
                } else {
                    item.classList.replace('valid', 'invalid');
                    icon.classList.replace('bi-check-circle-fill', 'bi-x-circle-fill');
                }
            }
        });

        const passwordForm = document.getElementById('passwordForm');
        if (passwordForm) {
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nPass = newPassword.value;
                const cPass = document.getElementById('confirmPassword').value;

                if (nPass !== cPass) {
                    Notif.informar('La nueva contraseña y su confirmación no coinciden.');
                    return;
                }

                // Obtener datos del usuario autenticado via /auth/me
                let usuarioSesion = null;
                try {
                    const respuesta = await fetch('http://localhost:8081/api/auth/me', {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include'
                    });
                    if (respuesta.ok) {
                        usuarioSesion = await respuesta.json();
                    }
                } catch (err) { }

                if (!usuarioSesion || !usuarioSesion.idUsuario) {
                    Notif.error('No se encontró el usuario de sesión. Inicie sesión nuevamente.', 'Error de sesión');
                    return;
                }

                const datosContrasena = {
                    correo: usuarioSesion.correo || '',
                    tipoUsuario: usuarioSesion.tipoUsuario || 'PSICOLOGO',
                    estadoCuenta: 'ACTIVO',
                    contrasena: nPass
                };

                try {
                    await ProfileService.actualizarPerfil(usuarioSesion.idUsuario, datosContrasena);
                    Notif.exito('¡Tu contraseña ha sido actualizada con éxito!');
                } catch (error) {
                    Notif.error('No se pudo actualizar la contraseña: ' + error.message, 'Error al actualizar');
                }
            });
        }

        const btnVolver = document.getElementById('btnVolver');
        if (btnVolver) {
            btnVolver.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = "../HTML/config.html";
            });
        }
    });
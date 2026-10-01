document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('container');
    const toggleContainer = document.querySelector('.toggle-container');
    const registerBtn = document.getElementById('register');
    const loginBtn = document.getElementById('login');

    const signInForm = document.querySelector('.sign-in form');
    const signUpForm = document.querySelector('.sign-up form');
    const forgotPasswordLink = document.getElementById('forgot-password') || document.querySelector('.forgot-password');

    const isMobile = () => window.innerWidth <= 540;

    // --- VALIDACIÓN DE FORMULARIOS ---
    function validateForm(form) {
        if (!form) return false;
        let valid = true;

        form.querySelectorAll('input').forEach(input => {
            const errEl = input.nextElementSibling;

            input.classList.remove('input-error');
            if (errEl && errEl.classList.contains('error-msg')) {
                errEl.classList.remove('visible');
            }

            if (!input.value.trim()) {
                input.classList.add('input-error');
                if (errEl && errEl.classList.contains('error-msg')) {
                    errEl.textContent = 'Este campo es requerido';
                    errEl.classList.add('visible');
                }
                valid = false;
            } else if (input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
                input.classList.add('input-error');
                if (errEl && errEl.classList.contains('error-msg')) {
                    errEl.textContent = 'Ingresa un email válido';
                    errEl.classList.add('visible');
                }
                valid = false;
            }
        });

        return valid;
    }

    // Limpieza de errores al escribir
    document.querySelectorAll('.container input').forEach(input => {
        input.addEventListener('input', () => {
            input.classList.remove('input-error');
            const errEl = input.nextElementSibling;
            if (errEl && errEl.classList.contains('error-msg')) {
                errEl.classList.remove('visible');
            }
        });
    });

    // --- ANIMACIONES Y NAVEGACIÓN MOBILE / DESKTOP ---
    function mobileSweep(direction, callback) {
        if (!toggleContainer) {
            callback();
            return;
        }
        const sweepClass = direction === 'down' ? 'sweeping' : 'sweeping-up';

        toggleContainer.classList.add(sweepClass);

        toggleContainer.addEventListener('animationend', function onEnd() {
            toggleContainer.removeEventListener('animationend', onEnd);
            toggleContainer.classList.remove(sweepClass);
            callback();
        }, { once: true });
    }

    function goToSignUp() {
        if (isMobile()) {
            mobileSweep('down', () => {
                if (container) container.classList.add('active');
            });
        } else {
            if (container) container.classList.add('active');
        }
    }

    function goToSignIn() {
        if (isMobile()) {
            mobileSweep('up', () => {
                if (container) container.classList.remove('active');
            });
        } else {
            if (container) container.classList.remove('active');
        }
    }

    if (registerBtn) registerBtn.addEventListener('click', goToSignUp);
    if (loginBtn) loginBtn.addEventListener('click', goToSignIn);

    // --- LÓGICA DE REDIRECCIÓN SEGÚN ROL ---
    function redirigirSegunRol(tipoUsuario) {
        switch (tipoUsuario) {
            case 'ADMIN':
                window.location.href = 'views/admin.html';
                break;
            case 'PSICOLOGO':
                window.location.href = 'views/psicologo.html';
                break;
            case 'ESTUDIANTE':
                window.location.href = 'views/estudiante.html';
                break;
            default:
                window.location.href = 'views/dashboard.html';
                break;
        }
    }

    // --- PETICIÓN DE LOGIN ---
    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!validateForm(signInForm)) return;

            const correo = signInForm.querySelector('input[type="email"]').value.trim();
            const contrasena = signInForm.querySelector('input[type="password"]').value;

            try {
                const response = await authFetch('/login', {
                    method: 'POST',
                    body: {
                        correo: correo,
                        contrasena: contrasena,
                        origen: 'WEB'
                    }
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Credenciales incorrectas');
                }

                // Guardar token y datos del usuario
                localStorage.setItem('psyke_token', data.token || data.accessToken);
                localStorage.setItem('psyke_user', JSON.stringify(data));

                if (typeof Notif !== 'undefined' && Notif.exito) {
                    Notif.exito('¡Inicio de sesión exitoso!');
                }

                setTimeout(() => redirigirSegunRol(data.tipoUsuario), 1000);

            } catch (error) {
                if (typeof Notif !== 'undefined' && Notif.error) {
                    Notif.error(error.message, 'Error de autenticación');
                } else {
                    alert(error.message);
                }
            }
        });
    }

    // --- PETICIÓN DE REGISTRO ---
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!validateForm(signUpForm)) return;

            const correo = signUpForm.querySelector('input[type="email"]').value.trim();
            const contrasena = signUpForm.querySelector('input[type="password"]').value;
            const selectRol = signUpForm.querySelector('select');
            const tipoUsuario = selectRol ? selectRol.value : 'ESTUDIANTE';

            try {
                const response = await authFetch('/register', {
                    method: 'POST',
                    body: {
                        correo: correo,
                        contrasena: contrasena,
                        tipoUsuario: tipoUsuario
                    }
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Error al registrar usuario');
                }

                localStorage.setItem('psyke_token', data.token || data.accessToken);
                localStorage.setItem('psyke_user', JSON.stringify(data));

                if (typeof Notif !== 'undefined' && Notif.exito) {
                    Notif.exito('¡Cuenta creada con éxito!');
                }

                setTimeout(() => redirigirSegunRol(data.tipoUsuario), 1000);

            } catch (error) {
                if (typeof Notif !== 'undefined' && Notif.error) {
                    Notif.error(error.message, 'Error de registro');
                } else {
                    alert(error.message);
                }
            }
        });
    }

    // --- PETICIÓN DE RECUPERACIÓN DE CONTRASEÑA ---
    async function solicitarRecuperacion(correo) {
        try {
            const response = await authFetch('/recuperar-contrasena', {
                method: 'POST',
                body: { correo: correo }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'No se pudo procesar la solicitud');
            }

            if (typeof Notif !== 'undefined' && Notif.exito) {
                Notif.exito(data.message || 'Se enviaron las instrucciones a tu correo.');
            } else {
                alert(data.message || 'Se enviaron las instrucciones a tu correo.');
            }
        } catch (error) {
            if (typeof Notif !== 'undefined' && Notif.error) {
                Notif.error(error.message, 'Error de recuperación');
            } else {
                alert(error.message);
            }
        }
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();

            const inputEmail = signInForm ? signInForm.querySelector('input[type="email"]') : null;
            const correoActual = inputEmail ? inputEmail.value.trim() : '';

            const correo = prompt('Ingresa tu correo electrónico registrado:', correoActual);

            if (correo && correo.trim()) {
                solicitarRecuperacion(correo.trim());
            }
        });
    }
});

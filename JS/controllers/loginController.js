document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. Manejo del Formulario de Inicio de Sesión
    // ==========================================
    const formLogin = document.getElementById('loginForm');
    if (formLogin) {
        formLogin.addEventListener('submit', async (evento) => {
            evento.preventDefault();

            const inputCorreo = document.getElementById('loginEmail');
            const inputContrasena = document.getElementById('loginPassword');

            const credenciales = {
                correo: inputCorreo ? inputCorreo.value.trim() : '',
                contrasena: inputContrasena ? inputContrasena.value : ''
            };

            // Validación con fallback defensivo si LoginValidaciones no se ha cargado
            let validacion = { isValid: true, message: '' };
            if (typeof LoginValidaciones !== 'undefined' && typeof LoginValidaciones.validarLogin === 'function') {
                validacion = LoginValidaciones.validarLogin(credenciales);
            } else if (!credenciales.correo || !credenciales.contrasena) {
                validacion = { isValid: false, message: 'Por favor, ingresa tu correo y contraseña.' };
            }

            if (!validacion.isValid) {
                if (typeof Notif !== 'undefined' && Notif.error) {
                    Notif.error(validacion.message, 'Datos inválidos');
                } else {
                    alert(validacion.message);
                }
                return;
            }

            try {
                sessionStorage.removeItem('psyke_redirecting');

                await AuthService.loginUsuario(credenciales);

                sessionStorage.setItem('mostrarBienvenidaToast', 'true');
                window.location.href = 'HTML/inicio.html';

            } catch (error) {
                if (typeof Notif !== 'undefined' && Notif.error) {
                    Notif.error(error.message || 'Credenciales inválidas o servicio fuera de línea', 'Error de inicio de sesión');
                } else {
                    alert(error.message || 'Error al iniciar sesión');
                }
            }
        });
    }

    // ==========================================
    // 2. Manejo de "¿Olvidaste tu contraseña?"
    // ==========================================
    const linkOlvide = document.getElementById('forgotPasswordLink');
    if (linkOlvide) {
        linkOlvide.addEventListener('click', async (evento) => {
            evento.preventDefault();

            // Verificar disponibilidad de SweetAlert2
            if (typeof Swal === 'undefined') {
                const correoPrompt = prompt('Ingresa tu correo electrónico registrado:');
                if (correoPrompt && correoPrompt.trim()) {
                    ejecutarRecuperacion(correoPrompt.trim());
                }
                return;
            }

            // Despliega ventana modal emergente para pedir el correo
            const { value: correo } = await Swal.fire({
                title: 'Recuperar Contraseña',
                text: 'Ingresa tu correo electrónico registrado para enviarte un enlace de recuperación:',
                input: 'email',
                inputPlaceholder: 'correo@ejemplo.com',
                showCancelButton: true,
                confirmButtonText: 'Enviar enlace',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                inputValidator: (value) => {
                    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                        return 'Debes ingresar un correo electrónico válido.';
                    }
                }
            });

            if (correo) {
                ejecutarRecuperacion(correo);
            }
        });
    }

    /**
     * Procesa la solicitud de recuperación llamando al servicio o fallbacks.
     */
    async function ejecutarRecuperacion(correo) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Enviando solicitud...',
                text: 'Por favor espera un momento.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
        }

        try {
            // 1. Preferir AuthService.recuperarContrasena (Centralizado en authService.js)
            if (typeof AuthService !== 'undefined' && typeof AuthService.recuperarContrasena === 'function') {
                await AuthService.recuperarContrasena(correo);
            } 
            // 2. Uso de authFetch de config.js (Apunta directamente a Heroku)
            else if (typeof window.authFetch === 'function') {
                const response = await window.authFetch('/recuperar-contrasena', {
                    method: 'POST',
                    body: { correo }
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || 'No se pudo enviar la solicitud.');
                }
            } 
            // 3. Fallback directo a la URL de Auth en Heroku
            else {
                const authUrl = (typeof window.AUTH_API_URL !== 'undefined') 
                    ? window.AUTH_API_URL 
                    : 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth';

                const response = await fetch(`${authUrl.replace(/\/+$/, '')}/recuperar-contrasena`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.message || 'No se pudo enviar la solicitud.');
                }
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: '¡Correo enviado!',
                    text: 'Hemos enviado las instrucciones a tu correo electrónico para restablecer tu contraseña.',
                    confirmButtonColor: '#3085d6'
                });
            } else if (typeof Notif !== 'undefined' && Notif.exito) {
                Notif.exito('Hemos enviado las instrucciones a tu correo electrónico.');
            } else {
                alert('Hemos enviado las instrucciones a tu correo electrónico.');
            }

        } catch (error) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'Ocurrió un problema al intentar enviar el correo de recuperación.',
                    confirmButtonColor: '#d33'
                });
            } else if (typeof Notif !== 'undefined' && Notif.error) {
                Notif.error(error.message, 'Error de recuperación');
            } else {
                alert(error.message || 'Error al enviar el correo de recuperación.');
            }
        }
    }
});

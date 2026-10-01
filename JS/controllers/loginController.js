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

            const validacion = LoginValidaciones.validarLogin(credenciales);
            if (!validacion.isValid) {
                Notif.error(validacion.message, 'Datos inválidos');
                return;
            }

            try {
                sessionStorage.removeItem('psyke_redirecting');

                const { datos } = await AuthService.loginUsuario(credenciales);

                sessionStorage.setItem('mostrarBienvenidaToast', 'true');
                window.location.href = 'HTML/inicio.html';
            } catch (error) {
                Notif.error(error.message || 'Credenciales inválidas o servicio fuera de línea', 'Error de inicio de sesión');
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
                    if (!value) {
                        return 'Debes ingresar un correo electrónico válido.';
                    }
                }
            });

            // Si el usuario ingresó un correo y dio clic en "Enviar enlace"
            if (correo) {
                Swal.fire({
                    title: 'Enviando solicitud...',
                    text: 'Por favor espera un momento.',
                    allowOutsideClick: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                try {
                    // 1. Intenta consumir AuthService si existe la función
                    if (typeof AuthService !== 'undefined' && typeof AuthService.recuperarContrasena === 'function') {
                        await AuthService.recuperarContrasena(correo);
                    } 
                    // 2. Usa authFetch de config.js (incluye automáticamente AUTH_API_URL)
                    else if (typeof authFetch === 'function') {
                        const response = await authFetch('/recuperar-contrasena', {
                            method: 'POST',
                            body: { correo }
                        });

                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            throw new Error(errorData.message || 'No se pudo enviar la solicitud.');
                        }
                    } 
                    // 3. Fallback directo a la URL de Auth en Heroku/Local
                    else {
                        const authUrl = (typeof AUTH_API_URL !== 'undefined') 
                            ? AUTH_API_URL 
                            : 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth';

                        const response = await fetch(`${authUrl}/recuperar-contrasena`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ correo })
                        });

                        if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            throw new Error(errorData.message || 'No se pudo enviar la solicitud.');
                        }
                    }

                    Swal.fire({
                        icon: 'success',
                        title: '¡Correo enviado!',
                        text: 'Hemos enviado las instrucciones a tu correo electrónico para restablecer tu contraseña.',
                        confirmButtonColor: '#3085d6'
                    });

                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.message || 'Ocurrió un problema al intentar enviar el correo de recuperación.',
                        confirmButtonColor: '#d33'
                    });
                }
            }
        });
    }
});

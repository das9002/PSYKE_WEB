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

            // Validación defensiva con fallback
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
            iniciarFlujoRecuperacion();
        });
    }

    let cooldownReenvio = 0;
    let timerInterval = null;

    /**
     * Paso 1: Pedir el correo electrónico registrado al usuario.
     */
    async function iniciarFlujoRecuperacion() {
        if (typeof Swal === 'undefined') {
            const correoPrompt = prompt('Ingresa tu correo electrónico registrado:');
            if (correoPrompt && correoPrompt.trim()) {
                enviarCodigoYMostrarPaso2(correoPrompt.trim());
            }
            return;
        }

        const { value: correo } = await Swal.fire({
            title: 'Recuperar Contraseña',
            text: 'Ingresa tu correo registrado para enviarte un código de verificación:',
            input: 'email',
            inputPlaceholder: 'correo@ejemplo.com',
            showCancelButton: true,
            confirmButtonText: 'Enviar código',
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
            enviarCodigoYMostrarPaso2(correo.trim());
        }
    }

    /**
     * Solicita el envío del código a la API y abre el modal del Paso 2.
     */
    async function enviarCodigoYMostrarPaso2(correo) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Enviando código...',
                text: 'Por favor espera unos segundos.',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
        }

        try {
            // Llama a la API limpia (sin utilizar authFetch para evitar error 401 por tokens viejos)
            if (typeof AuthService !== 'undefined' && (AuthService.solicitarCodigoRecuperacion || AuthService.recuperarContrasena)) {
                const metodo = AuthService.solicitarCodigoRecuperacion || AuthService.recuperarContrasena;
                await metodo(correo);
            } else {
                const authUrl = (window.AUTH_API_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth').replace(/\/+$/, '');
                const res = await fetch(`${authUrl}/recuperar-contrasena`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo })
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || 'No se pudo enviar el código de recuperación.');
                }
            }

            // Iniciar cooldown de 30 segundos para reenvío de código
            cooldownReenvio = 30;

            // Abrir modal para que el usuario ingrese el código enviado y su nueva contraseña
            mostrarModalCodigoYPassword(correo);

        } catch (error) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'Ocurrió un problema al solicitar el código de recuperación.',
                    confirmButtonColor: '#d33'
                });
            } else {
                alert(error.message || 'Error al enviar el código de recuperación.');
            }
        }
    }

    /**
     * Paso 2: Modal para ingresar el código recibido (5 min de vigencia) y la nueva contraseña.
     */
    async function mostrarModalCodigoYPassword(correo) {
        if (typeof Swal === 'undefined') {
            const codigo = prompt(`Ingresa el código enviado a ${correo}:`);
            const nuevaPass = prompt('Ingresa tu nueva contraseña:');
            if (codigo && nuevaPass) {
                completarRestablecimiento(correo, codigo, nuevaPass);
            }
            return;
        }

        const { value: formValues } = await Swal.fire({
            title: 'Restablecer Contraseña',
            html: `
                <p style="font-size: 0.9em; color: #555; margin-bottom: 15px;">
                    Enviamos un código a <b>${correo}</b>.<br>
                    Tienes <b style="color: #d33;">5 minutos</b> para ingresar el código recibido.
                </p>
                <input id="swal-codigo" class="swal2-input" placeholder="Código de verificación" maxlength="10">
                <input id="swal-pass1" type="password" class="swal2-input" placeholder="Nueva contraseña">
                <input id="swal-pass2" type="password" class="swal2-input" placeholder="Confirmar nueva contraseña">
                <div style="margin-top: 15px;">
                    <button id="btn-reenviar-codigo" type="button" class="swal2-styled" style="background-color: #6c757d; padding: 6px 15px; font-size: 0.85em;" disabled>
                        Reenviar código (30s)
                    </button>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: 'Cambiar Contraseña',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            didOpen: () => {
                const btnReenviar = document.getElementById('btn-reenviar-codigo');

                // Temporizador de 30 segundos antes de permitir reenviar otro código
                clearInterval(timerInterval);
                timerInterval = setInterval(() => {
                    if (cooldownReenvio > 0) {
                        cooldownReenvio--;
                        btnReenviar.textContent = `Reenviar código (${cooldownReenvio}s)`;
                    } else {
                        clearInterval(timerInterval);
                        btnReenviar.textContent = 'Reenviar código';
                        btnReenviar.disabled = false;
                        btnReenviar.style.backgroundColor = '#17a2b8';
                    }
                }, 1000);

                btnReenviar.addEventListener('click', () => {
                    if (cooldownReenvio === 0) {
                        clearInterval(timerInterval);
                        enviarCodigoYMostrarPaso2(correo);
                    }
                });
            },
            willClose: () => {
                clearInterval(timerInterval);
            },
            preConfirm: () => {
                const codigo = document.getElementById('swal-codigo').value.trim();
                const pass1 = document.getElementById('swal-pass1').value;
                const pass2 = document.getElementById('swal-pass2').value;

                if (!codigo) {
                    Swal.showValidationMessage('Debes ingresar el código de verificación.');
                    return false;
                }
                if (!pass1 || pass1.length < 6) {
                    Swal.showValidationMessage('La nueva contraseña debe tener al menos 6 caracteres.');
                    return false;
                }
                if (pass1 !== pass2) {
                    Swal.showValidationMessage('Las contraseñas no coinciden.');
                    return false;
                }

                return { codigo, pass1 };
            }
        });

        if (formValues) {
            completarRestablecimiento(correo, formValues.codigo, formValues.pass1);
        }
    }

    /**
     * Completa el proceso enviando el código validado y la nueva contraseña a la API.
     */
    async function completarRestablecimiento(correo, codigo, nuevaContrasena) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Actualizando contraseña...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });
        }

        try {
            if (typeof AuthService !== 'undefined' && (AuthService.cambiarContrasenaConCodigo || AuthService.restablecerContrasena)) {
                const metodo = AuthService.cambiarContrasenaConCodigo || AuthService.restablecerContrasena;
                await metodo(correo, codigo, nuevaContrasena);
            } else {
                const authUrl = (window.AUTH_API_URL || 'https://api-auth-1b19165bcf87.herokuapp.com/api/auth').replace(/\/+$/, '');
                const res = await fetch(`${authUrl}/restablecer-contrasena`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ correo, codigo, nuevaContrasena })
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.message || 'Código inválido o expirado.');
                }
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'success',
                    title: '¡Contraseña actualizada!',
                    text: 'Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión con tu nueva clave.',
                    confirmButtonColor: '#3085d6'
                });
            } else {
                alert('¡Contraseña actualizada con éxito! Ya puedes iniciar sesión.');
            }

        } catch (error) {
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'Ocurrió un problema al actualizar la contraseña.',
                    confirmButtonColor: '#d33'
                });
            } else {
                alert(error.message || 'Error al actualizar la contraseña.');
            }
        }
    }
});

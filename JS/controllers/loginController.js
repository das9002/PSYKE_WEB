document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('loginForm');
    const linkOlvide = document.getElementById('forgotPasswordLink');
    const inputCorreo = document.getElementById('loginEmail');
    const inputClave = document.getElementById('loginPassword');
    const btnVerPassword = document.getElementById('btnVerPassword');

    function limpiarCampos() {
        if (inputCorreo) inputCorreo.value = '';
        if (inputClave) {
            inputClave.value = '';
            inputClave.type = 'password';
        }
        if (btnVerPassword) {
            btnVerPassword.querySelector('i').className = 'fa-solid fa-eye-slash';
            btnVerPassword.setAttribute('aria-label', 'Mostrar contraseña');
            btnVerPassword.title = 'Mostrar contraseña';
        }
    }

    limpiarCampos();
    window.addEventListener('pageshow', limpiarCampos);

    if (btnVerPassword && inputClave) {
        btnVerPassword.addEventListener('click', () => {
            const mostrar = inputClave.type === 'password';
            inputClave.type = mostrar ? 'text' : 'password';
            btnVerPassword.querySelector('i').className = mostrar ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
            const texto = mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña';
            btnVerPassword.setAttribute('aria-label', texto);
            btnVerPassword.title = texto;
            inputClave.focus();
        });
    }

    if (formLogin) {
        formLogin.addEventListener('submit', async (evento) => {
            evento.preventDefault();

            const inputCorreo = document.getElementById('loginEmail');
            const inputContrasena = document.getElementById('loginPassword');
            const boton = formLogin.querySelector('button[type="submit"]');

            const credenciales = {
                correo: inputCorreo ? inputCorreo.value.trim() : '',
                contrasena: inputContrasena ? inputContrasena.value : ''
            };

            const validacion = typeof LoginValidaciones !== 'undefined'
                ? LoginValidaciones.validarLogin(credenciales)
                : { isValid: Boolean(credenciales.correo && credenciales.contrasena), message: 'Ingresa tu correo y contraseña.' };

            if (!validacion.isValid) {
                Notif.advertencia(validacion.message, 'Datos incompletos');
                return;
            }

            let textoOriginalBtn = '';
            if (boton) {
                textoOriginalBtn = boton.innerHTML;
                boton.disabled = true;
                boton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Iniciando...';
            }

            try {
                await AuthService.loginUsuario(credenciales);
                window.location.href = 'HTML/inicio.html?bienvenida=1';
            } catch (error) {
                const titulo = error.tipo === 'RED' ? 'Sin conexión' : 'No se pudo iniciar sesión';
                Notif.error(error.message, titulo);
                if (boton) {
                    boton.disabled = false;
                    boton.innerHTML = textoOriginalBtn;
                }
            }
        });
    }

    if (linkOlvide) {
        linkOlvide.addEventListener('click', () => {
            const correo = document.getElementById('loginEmail')?.value.trim();
            if (correo) {
                linkOlvide.href = `HTML/recuperarContrasena.html?correo=${encodeURIComponent(correo)}`;
            }
        });
    }
});

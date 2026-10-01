document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('loginForm');
    const linkOlvide = document.getElementById('forgotPasswordLink');

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

            if (boton) boton.disabled = true;

            try {
                sessionStorage.removeItem('psyke_redirecting');
                await AuthService.loginUsuario(credenciales);
                sessionStorage.setItem('mostrarBienvenidaToast', 'true');
                window.location.href = 'HTML/inicio.html';
            } catch (error) {
                const titulo = error.tipo === 'RED' ? 'Sin conexión' : 'No se pudo iniciar sesión';
                Notif.error(error.message, titulo);
                if (boton) boton.disabled = false;
            }
        });
    }

    if (linkOlvide) {
        linkOlvide.addEventListener('click', (evento) => {
            evento.preventDefault();
            Notif.informar(
                'Por seguridad, el restablecimiento de contraseñas lo realiza el administrador del sistema. ' +
                'Comunícate con el departamento de psicología o con el administrador de Psyke para que te asigne una contraseña temporal. ' +
                'Después podrás cambiarla desde Configuración > Cambiar contraseña.',
                '¿Olvidaste tu contraseña?'
            );
        });
    }
});

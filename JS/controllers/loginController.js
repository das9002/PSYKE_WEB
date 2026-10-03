
document.addEventListener('DOMContentLoaded', () => {

    const formLogin = document.getElementById('loginForm');
    if (!formLogin) return;

    formLogin.addEventListener('submit', async (evento) => {
        evento.preventDefault();

        const inputCorreo = document.getElementById('loginEmail');
        const inputContrasena = document.getElementById('loginPassword');

        const credenciales = {
            correo: inputCorreo.value,
            contrasena: inputContrasena.value
        };

        const validacion = LoginValidaciones.validarLogin(credenciales);
        if (!validacion.isValid) {
            Notif.error(validacion.message, 'Datos inválidos');
            return;
        }

        const btnSubmit = formLogin.querySelector('button[type="submit"]');
        const textoOriginal = btnSubmit ? btnSubmit.innerHTML : 'Inicia Sesión';

        if (btnSubmit) {
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Iniciando...';
        }

        try {
            sessionStorage.removeItem('psyke_redirecting');

            const { datos } = await AuthService.loginUsuario(credenciales);

            sessionStorage.setItem('mostrarBienvenidaToast', 'true');
            window.location.href = 'HTML/inicio.html';
        } catch (error) {
            if (btnSubmit) {
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = textoOriginal;
            }
            Notif.error(error.message || 'Credenciales inválidas o servicio fuera de línea', 'Error de inicio de sesión');
        }
    });
});
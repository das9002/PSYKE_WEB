
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

        try {
            const { datos } = await AuthService.loginUsuario(credenciales);

            sessionStorage.setItem('mostrarBienvenidaToast', 'true');
            window.location.href = 'HTML/inicio.html';
        } catch (error) {
            Notif.error(error.message || 'Credenciales inválidas o servicio fuera de línea', 'Error de inicio de sesión');
        }
    });
});
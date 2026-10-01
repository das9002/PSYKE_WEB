document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('passwordForm');
    const inputActual = document.getElementById('currentPassword');
    const inputNueva = document.getElementById('newPassword');
    const inputConfirmar = document.getElementById('confirmPassword');
    const botonGuardar = document.getElementById('btnActualizarContrasena');

    function rutaLogin() {
        return '../index.html';
    }

    if (typeof obtenerToken === 'function' && !obtenerToken()) {
        window.location.replace(rutaLogin());
        return;
    }

    ContrasenaValidaciones.activarOjos();
    ContrasenaValidaciones.pintarRequisitos('');

    function marcarCampo(input, invalido) {
        if (input) input.classList.toggle('is-invalid', invalido);
    }

    if (inputNueva) {
        inputNueva.addEventListener('input', () => {
            ContrasenaValidaciones.pintarRequisitos(inputNueva.value);
            marcarCampo(inputNueva, false);
        });
    }

    [inputActual, inputConfirmar].forEach(input => {
        if (input) input.addEventListener('input', () => marcarCampo(input, false));
    });

    function validarFormulario() {
        const actual = inputActual.value;
        const nueva = inputNueva.value;
        const confirmacion = inputConfirmar.value;

        if (!actual) {
            marcarCampo(inputActual, true);
            return 'Ingresa tu contraseña actual.';
        }
        if (nueva && nueva === actual) {
            marcarCampo(inputNueva, true);
            return 'La nueva contraseña debe ser diferente a la actual.';
        }

        const error = ContrasenaValidaciones.validarNueva(nueva, confirmacion);
        if (error) {
            marcarCampo(error.campo === 'nueva' ? inputNueva : inputConfirmar, true);
            return error.mensaje;
        }
        return null;
    }

    function bloquear(bloqueado) {
        if (!botonGuardar) return;
        botonGuardar.disabled = bloqueado;
        botonGuardar.querySelector('span').textContent = bloqueado ? 'Actualizando...' : 'Actualizar contraseña';
    }

    async function cambiarContrasena() {
        const sesion = await AuthService.obtenerSesion();
        if (!sesion || !sesion.idUsuario) {
            throw new Error('No se pudo identificar al usuario de la sesión.');
        }

        const actualCorrecta = await AuthService.verificarContrasenaActual(sesion.correo, inputActual.value);
        if (!actualCorrecta) {
            const error = new Error('La contraseña actual es incorrecta.');
            error.campo = inputActual;
            throw error;
        }

        await apiFetch(`/usuarios/${sesion.idUsuario}`, {
            method: 'PUT',
            body: {
                correo: sesion.correo,
                contrasena: inputNueva.value,
                tipoUsuario: sesion.tipoUsuario,
                estadoCuenta: sesion.estadoCuenta || 'ACTIVO'
            }
        });
    }

    if (form) {
        form.addEventListener('submit', async (evento) => {
            evento.preventDefault();

            const errorValidacion = validarFormulario();
            if (errorValidacion) {
                Notif.advertencia(errorValidacion, 'Revisa los campos');
                return;
            }

            const confirmado = await Notif.confirmar(
                '¿Cambiar contraseña?',
                'Usarás la nueva contraseña la próxima vez que inicies sesión.',
                'Sí, cambiar'
            );
            if (!confirmado) return;

            bloquear(true);
            Notif.cargando('Actualizando contraseña...');

            try {
                await cambiarContrasena();
                Notif.cerrar();
                form.reset();
                ContrasenaValidaciones.pintarRequisitos('');
                await Notif.exitoModal('Tu contraseña se actualizó correctamente.', 'Contraseña actualizada');
                window.location.href = 'config.html';
            } catch (error) {
                Notif.cerrar();
                if (error.campo) marcarCampo(error.campo, true);

                if (error.status === 401) {
                    Notif.error('Tu sesión ha expirado. Inicia sesión nuevamente.', 'Sesión expirada');
                    setTimeout(() => window.location.replace(rutaLogin()), 1500);
                } else if (error.status === 403) {
                    Notif.error('Tu usuario no tiene permiso para cambiar la contraseña desde la web.', 'Acción no permitida');
                } else if (error.tipo === 'RED') {
                    Notif.error('No se pudo conectar con el servidor. Revisa tu conexión.', 'Sin conexión');
                } else {
                    Notif.error(error.message || 'No se pudo actualizar la contraseña.', 'No se pudo actualizar');
                }
            } finally {
                bloquear(false);
            }
        });
    }
});

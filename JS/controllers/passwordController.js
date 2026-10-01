document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('passwordForm');
    const inputActual = document.getElementById('currentPassword');
    const inputNueva = document.getElementById('newPassword');
    const inputConfirmar = document.getElementById('confirmPassword');
    const botonGuardar = document.getElementById('btnActualizarContrasena');

    const requisitos = {
        longitud: { elemento: document.getElementById('reqLength'), regla: /.{8,}/ },
        mayuscula: { elemento: document.getElementById('reqUpper'), regla: /[A-Z]/ },
        minuscula: { elemento: document.getElementById('reqLower'), regla: /[a-z]/ },
        numero: { elemento: document.getElementById('reqNumber'), regla: /[0-9]/ },
        especial: { elemento: document.getElementById('reqSpecial'), regla: /[^A-Za-z0-9\s]/ }
    };

    const ESPACIOS = /\s/;

    function rutaLogin() {
        return '../index.html';
    }

    if (typeof obtenerToken === 'function' && !obtenerToken()) {
        window.location.replace(rutaLogin());
        return;
    }

    document.querySelectorAll('.btn-eye-toggle').forEach(boton => {
        boton.addEventListener('click', () => {
            const input = document.getElementById(boton.dataset.target);
            const icono = boton.querySelector('i');
            if (!input || !icono) return;

            const mostrar = input.type === 'password';
            input.type = mostrar ? 'text' : 'password';
            icono.classList.toggle('bi-eye', !mostrar);
            icono.classList.toggle('bi-eye-slash', mostrar);
            boton.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
        });
    });

    function pintarRequisitos(valor) {
        Object.values(requisitos).forEach(({ elemento, regla }) => {
            if (!elemento) return;
            const cumple = regla.test(valor);
            elemento.classList.toggle('valid', cumple);
            elemento.classList.toggle('invalid', !cumple);
            const icono = elemento.querySelector('i');
            if (icono) {
                icono.classList.toggle('bi-check-circle-fill', cumple);
                icono.classList.toggle('bi-x-circle-fill', !cumple);
            }
        });
    }

    function cumpleRequisitos(valor) {
        return Object.values(requisitos).every(({ regla }) => regla.test(valor));
    }

    function marcarCampo(input, invalido) {
        if (input) input.classList.toggle('is-invalid', invalido);
    }

    if (inputNueva) {
        inputNueva.addEventListener('input', () => {
            pintarRequisitos(inputNueva.value);
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
        if (!nueva) {
            marcarCampo(inputNueva, true);
            return 'Ingresa la nueva contraseña.';
        }
        if (ESPACIOS.test(nueva)) {
            marcarCampo(inputNueva, true);
            return 'La nueva contraseña no puede contener espacios.';
        }
        if (!cumpleRequisitos(nueva)) {
            marcarCampo(inputNueva, true);
            return 'La nueva contraseña no cumple con todos los requisitos de seguridad.';
        }
        if (nueva.length > 100) {
            marcarCampo(inputNueva, true);
            return 'La nueva contraseña no puede superar los 100 caracteres.';
        }
        if (nueva === actual) {
            marcarCampo(inputNueva, true);
            return 'La nueva contraseña debe ser diferente a la actual.';
        }
        if (nueva !== confirmacion) {
            marcarCampo(inputConfirmar, true);
            return 'La confirmación no coincide con la nueva contraseña.';
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
                pintarRequisitos('');
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

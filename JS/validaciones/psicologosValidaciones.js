
const PsicologosValidaciones = (() => {

    const EXP_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const EXP_SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    const EXP_TELEFONO = /^\+?[0-9\s()-]{8,16}$/;

    function requerido(valor) {
        return String(valor ?? '').trim().length > 0;
    }

    function emailValido(email) {
        return EXP_EMAIL.test(String(email ?? '').trim());
    }

    function soloLetras(valor) {
        return EXP_SOLO_LETRAS.test(String(valor ?? '').trim());
    }

    function telefonoValido(telefono) {
        return EXP_TELEFONO.test(String(telefono ?? '').trim());
    }

    function validarPsicologo(datos, esEdicion = false) {
        const errores = {};

        if (!requerido(datos.nombresCompletos)) {
            errores.nombresCompletos = 'Los nombres son obligatorios.';
        } else if (!soloLetras(datos.nombresCompletos)) {
            errores.nombresCompletos = 'Los nombres solo pueden contener letras y espacios.';
        }

        if (!requerido(datos.apellidosCompletos)) {
            errores.apellidosCompletos = 'Los apellidos son obligatorios.';
        } else if (!soloLetras(datos.apellidosCompletos)) {
            errores.apellidosCompletos = 'Los apellidos solo pueden contener letras y espacios.';
        }

        const correo = datos.correo ?? datos.usuario?.correo ?? '';
        if (!requerido(correo)) {
            errores.correo = 'El correo institucional es obligatorio.';
        } else if (!emailValido(correo)) {
            errores.correo = 'Ingrese un correo electrónico válido.';
        }

        if (requerido(datos.telefono) && !telefonoValido(datos.telefono)) {
            errores.telefono = 'Ingrese un teléfono válido (ej. +503 7890-1234).';
        }

        if (datos.usuario && typeof datos.usuario === 'object') {
            if (requerido(datos.usuario.tipoUsuario) && datos.usuario.tipoUsuario !== 'PSICOLOGO') {
                errores.usuario = 'El tipo de usuario debe ser PSICOLOGO.';
            }
            if (requerido(datos.usuario.estadoCuenta) && !['ACTIVO', 'INACTIVO'].includes(datos.usuario.estadoCuenta)) {
                errores.usuario = 'El estado de cuenta debe ser ACTIVO o INACTIVO.';
            }
            if (!esEdicion && !requerido(datos.usuario.contrasena)) {
                errores.usuario = 'La contraseña es obligatoria al registrar el usuario.';
            }
        }

        return {
            valido: Object.keys(errores).length === 0,
            errores
        };
    }

    function validarContrasena(contrasena) {
        const texto = String(contrasena ?? '');
        const errores = {};

        if (!requerido(texto)) {
            errores.contrasena = 'La contraseña es obligatoria.';
        } else if (texto.length < 8 || !/[A-Za-z]/.test(texto) || !/\d/.test(texto)) {
            errores.contrasena = 'La contraseña debe tener al menos 8 caracteres, incluir letras y números.';
        }

        return {
            valido: Object.keys(errores).length === 0,
            errores
        };
    }

    return {
        requerido,
        emailValido,
        soloLetras,
        telefonoValido,
        validarPsicologo,
        validarContrasena
    };
})();

const EstudiantesValidaciones = (() => {

    const EXP_EMAIL_INSTITUCIONAL = /^[a-zA-Z0-9._%+-]+@ricaldone\.edu\.sv$/i;
    const EXP_SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
    const EXP_CARNET = /^\d{8}$/;

    const LIMITE_NOMBRES = 100;
    const LIMITE_APELLIDOS = 100;
    const LIMITE_CORREO = 100;
    const LIMITE_INFO_FAMILIAR = 1000;

    function requerido(valor) {
        return String(valor ?? '').trim().length > 0;
    }

    function emailInstitucionalValido(email) {
        return EXP_EMAIL_INSTITUCIONAL.test(String(email ?? '').trim());
    }

    function soloLetras(valor) {
        return EXP_SOLO_LETRAS.test(String(valor ?? '').trim());
    }

    function carnetValido(carnet) {
        return EXP_CARNET.test(String(carnet ?? '').trim());
    }

    function validarEstudiante(datos) {
        const errores = {};

        if (!requerido(datos.codigoCarnet)) {
            errores.codigoCarnet = 'El carnet es obligatorio.';
        } else if (!carnetValido(datos.codigoCarnet)) {
            errores.codigoCarnet = 'El carnet debe contener exactamente 8 dígitos.';
        }

        if (!requerido(datos.nombres)) {
            errores.nombres = 'Los nombres son obligatorios.';
        } else if (!soloLetras(datos.nombres)) {
            errores.nombres = 'Los nombres solo pueden contener letras y espacios.';
        } else if (String(datos.nombres).trim().length > LIMITE_NOMBRES) {
            errores.nombres = `Los nombres no pueden superar ${LIMITE_NOMBRES} caracteres.`;
        }

        if (!requerido(datos.apellidos)) {
            errores.apellidos = 'Los apellidos son obligatorios.';
        } else if (!soloLetras(datos.apellidos)) {
            errores.apellidos = 'Los apellidos solo pueden contener letras y espacios.';
        } else if (String(datos.apellidos).trim().length > LIMITE_APELLIDOS) {
            errores.apellidos = `Los apellidos no pueden superar ${LIMITE_APELLIDOS} caracteres.`;
        }

        const correo = datos.correo ?? datos.usuario?.correo ?? '';
        if (!requerido(correo)) {
            errores.correo = 'El correo institucional es obligatorio.';
        } else if (!emailInstitucionalValido(correo)) {
            errores.correo = 'El correo debe pertenecer al dominio @ricaldone.edu.sv.';
        } else if (String(correo).trim().length > LIMITE_CORREO) {
            errores.correo = `El correo no puede superar ${LIMITE_CORREO} caracteres.`;
        }

        if (!requerido(datos.grado)) {
            errores.grado = 'Seleccione el grado del estudiante.';
        }

        if (!requerido(datos.seccion)) {
            errores.seccion = 'Seleccione la sección del estudiante.';
        }

        if (datos.nivel === 'Bachillerato' && !requerido(datos.especialidad)) {
            errores.especialidad = 'Seleccione la especialidad para el nivel de Bachillerato.';
        }

        if (requerido(datos.informacionFamiliar) && String(datos.informacionFamiliar).trim().length > LIMITE_INFO_FAMILIAR) {
            errores.informacionFamiliar = `La información familiar no puede superar ${LIMITE_INFO_FAMILIAR} caracteres.`;
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
        emailInstitucionalValido,
        soloLetras,
        carnetValido,
        validarEstudiante,
        validarContrasena
    };
})();
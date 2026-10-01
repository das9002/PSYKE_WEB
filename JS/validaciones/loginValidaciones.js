
const LoginValidaciones = (() => {

    function requerido(valor) {
        return String(valor ?? '').trim().length > 0;
    }

    function sinEspaciosExtremos(valor) {
        return String(valor ?? '') === String(valor ?? '').trim();
    }

    function validarLogin(datos) {
        const correo = String(datos.correo ?? '');
        const contrasena = String(datos.contrasena ?? '');

        if (!requerido(correo)) {
            return { isValid: false, message: 'El usuario o correo es requerido.' };
        }

        if (!sinEspaciosExtremos(correo)) {
            return { isValid: false, message: 'El usuario o correo no debe contener espacios en blanco al inicio o al final.' };
        }

        if (!requerido(contrasena)) {
            return { isValid: false, message: 'La contraseña es requerida.' };
        }

        if (!sinEspaciosExtremos(contrasena)) {
            return { isValid: false, message: 'La contraseña no debe contener espacios en blanco al inicio o al final.' };
        }

        return { isValid: true, message: '' };
    }

    return {
        requerido,
        sinEspaciosExtremos,
        validarLogin
    };
})();
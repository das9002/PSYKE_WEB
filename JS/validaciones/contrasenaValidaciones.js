const ContrasenaValidaciones = (() => {
    const REQUISITOS = [
        { id: 'reqLength', regla: /.{8,}/ },
        { id: 'reqUpper', regla: /[A-Z]/ },
        { id: 'reqLower', regla: /[a-z]/ },
        { id: 'reqNumber', regla: /[0-9]/ },
        { id: 'reqSpecial', regla: /[^A-Za-z0-9\s]/ }
    ];

    function cumpleRequisitos(valor) {
        return REQUISITOS.every(({ regla }) => regla.test(valor));
    }

    function pintarRequisitos(valor) {
        REQUISITOS.forEach(({ id, regla }) => {
            const elemento = document.getElementById(id);
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

    function validarNueva(nueva, confirmacion) {
        if (!nueva) return { campo: 'nueva', mensaje: 'Ingresa la nueva contraseña.' };
        if (/\s/.test(nueva)) return { campo: 'nueva', mensaje: 'La nueva contraseña no puede contener espacios.' };
        if (nueva.length > 100) return { campo: 'nueva', mensaje: 'La nueva contraseña no puede superar los 100 caracteres.' };
        if (!cumpleRequisitos(nueva)) return { campo: 'nueva', mensaje: 'La nueva contraseña no cumple con todos los requisitos de seguridad.' };
        if (nueva !== confirmacion) return { campo: 'confirmacion', mensaje: 'La confirmación no coincide con la nueva contraseña.' };
        return null;
    }

    function activarOjos(raiz = document) {
        raiz.querySelectorAll('.btn-eye-toggle').forEach(boton => {
            boton.addEventListener('click', () => {
                const input = document.getElementById(boton.dataset.target);
                const icono = boton.querySelector('i');
                if (!input || !icono) return;

                const mostrar = input.type === 'password';
                input.type = mostrar ? 'text' : 'password';
                icono.classList.toggle('bi-eye', mostrar);
                icono.classList.toggle('bi-eye-slash', !mostrar);
                boton.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
            });
        });
    }

    return { cumpleRequisitos, pintarRequisitos, validarNueva, activarOjos };
})();

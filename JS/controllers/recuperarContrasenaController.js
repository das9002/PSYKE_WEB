document.addEventListener('DOMContentLoaded', () => {
    const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const secciones = {
        1: document.getElementById('pasoCorreo'),
        2: document.getElementById('pasoCodigo'),
        3: document.getElementById('pasoContrasena')
    };

    const formCorreo = document.getElementById('formCorreo');
    const formCodigo = document.getElementById('formCodigo');
    const formContrasena = document.getElementById('formContrasena');

    const inputCorreo = document.getElementById('inputCorreo');
    const inputCodigo = document.getElementById('inputCodigo');
    const inputNueva = document.getElementById('newPassword');
    const inputConfirmar = document.getElementById('confirmPassword');

    const btnEnviar = document.getElementById('btnEnviarCodigo');
    const btnVerificar = document.getElementById('btnVerificarCodigo');
    const btnReenviar = document.getElementById('btnReenviarCodigo');
    const btnCambiarCorreo = document.getElementById('btnCambiarCorreo');
    const btnGuardar = document.getElementById('btnGuardarContrasena');

    const textoCorreoDestino = document.getElementById('correoDestino');
    const textoVigencia = document.getElementById('vigenciaCodigo');

    const estado = {
        correo: '',
        token: '',
        expiraCodigo: 0,
        reenvioDesde: 0,
        intervalo: null
    };

    const correoInicial = new URLSearchParams(window.location.search).get('correo');
    if (correoInicial && inputCorreo) inputCorreo.value = correoInicial.trim();

    ContrasenaValidaciones.activarOjos();
    ContrasenaValidaciones.pintarRequisitos('');

    function irAPaso(numero) {
        Object.entries(secciones).forEach(([clave, seccion]) => {
            seccion.classList.toggle('d-none', Number(clave) !== numero);
        });
        document.querySelectorAll('.pasos-recuperacion .paso').forEach(paso => {
            const n = Number(paso.dataset.paso);
            paso.classList.toggle('activo', n === numero);
            paso.classList.toggle('completo', n < numero);
        });
        const foco = { 1: inputCorreo, 2: inputCodigo, 3: inputNueva }[numero];
        if (foco) setTimeout(() => foco.focus(), 50);
    }

    function marcar(input, invalido) {
        if (input) input.classList.toggle('is-invalid', invalido);
    }

    function cargandoBoton(boton, cargando, textoCargando) {
        if (!boton) return;
        if (cargando) {
            boton.dataset.textoOriginal = boton.innerHTML;
            boton.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${textoCargando}`;
        } else if (boton.dataset.textoOriginal) {
            boton.innerHTML = boton.dataset.textoOriginal;
        }
        boton.disabled = cargando;
    }

    function formatoTiempo(segundos) {
        const m = Math.floor(segundos / 60);
        const s = segundos % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function detenerTemporizador() {
        clearInterval(estado.intervalo);
        estado.intervalo = null;
    }

    function actualizarTemporizador() {
        const ahora = Date.now();
        const restanteCodigo = Math.max(0, Math.ceil((estado.expiraCodigo - ahora) / 1000));
        const restanteReenvio = Math.max(0, Math.ceil((estado.reenvioDesde - ahora) / 1000));

        if (restanteCodigo > 0) {
            textoVigencia.textContent = `El código vence en ${formatoTiempo(restanteCodigo)}.`;
            textoVigencia.classList.remove('vencido');
        } else {
            textoVigencia.textContent = 'El código venció. Solicita uno nuevo.';
            textoVigencia.classList.add('vencido');
        }

        if (!btnReenviar.dataset.enviando) {
            btnReenviar.disabled = restanteReenvio > 0;
            btnReenviar.textContent = restanteReenvio > 0
                ? `Reenviar código (${restanteReenvio}s)`
                : 'Reenviar código';
        }
    }

    function iniciarTemporizador(segundosVigencia, segundosReenvio) {
        const ahora = Date.now();
        estado.expiraCodigo = ahora + (segundosVigencia || 600) * 1000;
        estado.reenvioDesde = ahora + (segundosReenvio || 30) * 1000;
        detenerTemporizador();
        actualizarTemporizador();
        estado.intervalo = setInterval(actualizarTemporizador, 1000);
    }

    function mensajeError(error, porDefecto) {
        if (error.tipo === 'RED') return 'No se pudo conectar con el servidor. Revisa tu conexión.';
        return error.message || porDefecto;
    }

    function aplicarEsperaReenvio(error) {
        const segundos = Number(error.detalles && error.detalles.segundosRestantes);
        if (segundos > 0) {
            estado.reenvioDesde = Date.now() + segundos * 1000;
            actualizarTemporizador();
        }
    }

    formCorreo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const correo = inputCorreo.value.trim();

        if (!CORREO_VALIDO.test(correo)) {
            marcar(inputCorreo, true);
            Notif.advertencia('Ingresa un correo electrónico válido.', 'Correo inválido');
            return;
        }

        cargandoBoton(btnEnviar, true, 'Enviando...');
        try {
            const respuesta = await AuthService.solicitarCodigoRecuperacion(correo);
            estado.correo = correo;
            textoCorreoDestino.textContent = correo;
            inputCodigo.value = '';
            marcar(inputCodigo, false);
            iniciarTemporizador(respuesta.expiraEnSegundos, respuesta.reenvioEnSegundos);
            irAPaso(2);
            Notif.exito('Revisa tu bandeja de entrada.', 'Código enviado');
        } catch (error) {
            if (error.status === 404) marcar(inputCorreo, true);
            if (error.status === 429 && estado.correo === correo) {
                irAPaso(2);
                aplicarEsperaReenvio(error);
            }
            Notif.error(mensajeError(error, 'No se pudo enviar el código.'), 'No se pudo enviar');
        } finally {
            cargandoBoton(btnEnviar, false);
        }
    });

    inputCorreo.addEventListener('input', () => marcar(inputCorreo, false));

    inputCodigo.addEventListener('input', () => {
        const limpio = inputCodigo.value.replace(/\D/g, '').slice(0, 6);
        if (inputCodigo.value !== limpio) inputCodigo.value = limpio;
        marcar(inputCodigo, false);
    });

    btnReenviar.addEventListener('click', async () => {
        if (!estado.correo || btnReenviar.disabled) return;

        btnReenviar.dataset.enviando = '1';
        btnReenviar.disabled = true;
        btnReenviar.textContent = 'Enviando...';
        try {
            const respuesta = await AuthService.solicitarCodigoRecuperacion(estado.correo);
            inputCodigo.value = '';
            marcar(inputCodigo, false);
            delete btnReenviar.dataset.enviando;
            iniciarTemporizador(respuesta.expiraEnSegundos, respuesta.reenvioEnSegundos);
            Notif.exito('Te enviamos un nuevo código. El anterior ya no funciona.', 'Código reenviado');
        } catch (error) {
            delete btnReenviar.dataset.enviando;
            aplicarEsperaReenvio(error);
            actualizarTemporizador();
            Notif.error(mensajeError(error, 'No se pudo reenviar el código.'), 'No se pudo reenviar');
        }
    });

    btnCambiarCorreo.addEventListener('click', () => {
        detenerTemporizador();
        irAPaso(1);
    });

    formCodigo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codigo = inputCodigo.value.trim();

        if (!/^\d{6}$/.test(codigo)) {
            marcar(inputCodigo, true);
            Notif.advertencia('El código debe tener 6 dígitos.', 'Código incompleto');
            return;
        }

        if (Date.now() > estado.expiraCodigo) {
            marcar(inputCodigo, true);
            Notif.advertencia('El código venció. Usa "Reenviar código" para recibir uno nuevo.', 'Código vencido');
            return;
        }

        cargandoBoton(btnVerificar, true, 'Verificando...');
        try {
            const respuesta = await AuthService.verificarCodigoRecuperacion(estado.correo, codigo);
            estado.token = respuesta.tokenRestablecimiento;
            detenerTemporizador();
            inputNueva.value = '';
            inputConfirmar.value = '';
            ContrasenaValidaciones.pintarRequisitos('');
            irAPaso(3);
            Notif.exito('Ahora crea tu nueva contraseña.', 'Código correcto');
        } catch (error) {
            marcar(inputCodigo, true);
            inputCodigo.select();
            if (error.status === 429) {
                estado.expiraCodigo = 0;
                actualizarTemporizador();
            }
            Notif.error(mensajeError(error, 'No se pudo verificar el código.'), 'Código no válido');
        } finally {
            cargandoBoton(btnVerificar, false);
        }
    });

    inputNueva.addEventListener('input', () => {
        ContrasenaValidaciones.pintarRequisitos(inputNueva.value);
        marcar(inputNueva, false);
    });
    inputConfirmar.addEventListener('input', () => marcar(inputConfirmar, false));

    formContrasena.addEventListener('submit', async (e) => {
        e.preventDefault();

        const error = ContrasenaValidaciones.validarNueva(inputNueva.value, inputConfirmar.value);
        if (error) {
            marcar(error.campo === 'nueva' ? inputNueva : inputConfirmar, true);
            Notif.advertencia(error.mensaje, 'Revisa los campos');
            return;
        }

        cargandoBoton(btnGuardar, true, 'Guardando...');
        try {
            await AuthService.restablecerContrasena(estado.correo, estado.token, inputNueva.value);
            estado.token = '';
            formContrasena.reset();
            await Notif.exitoModal('Tu contraseña se cambió correctamente. Ya puedes iniciar sesión con la nueva.', 'Contraseña actualizada');
            window.location.href = '../index.html';
        } catch (err) {
            if (err.status === 400 && /autorizaci[oó]n/i.test(err.message)) {
                estado.token = '';
                irAPaso(1);
                Notif.error('El tiempo para cambiar la contraseña terminó. Solicita un nuevo código.', 'Autorización vencida');
            } else {
                if (/diferente/i.test(err.message || '')) marcar(inputNueva, true);
                Notif.error(mensajeError(err, 'No se pudo cambiar la contraseña.'), 'No se pudo guardar');
            }
        } finally {
            cargandoBoton(btnGuardar, false);
        }
    });

    irAPaso(1);
});

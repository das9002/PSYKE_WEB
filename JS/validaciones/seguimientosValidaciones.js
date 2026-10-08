
const SeguimientosValidaciones = (() => {

    function requerido(valor) {
        return String(valor ?? '').trim().length > 0;
    }

    function hoyLocal() {
        const ahora = new Date();
        return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    }

    function esIdValido(valor) {
        const num = Number(valor);
        return Number.isInteger(num) && num > 0;
    }

    function esFechaISO(fecha) {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(fecha ?? ''));
    }

    function validarFechaAtencion(fecha) {
        if (!requerido(fecha)) return 'La fecha del seguimiento es obligatoria.';
        if (!esFechaISO(fecha)) return 'La fecha del seguimiento no tiene un formato válido (AAAA-MM-DD).';
        if (String(fecha) > hoyLocal()) return 'La fecha del seguimiento no puede ser futura.';
        return '';
    }

    function validarProceso(proceso) {
        if (!requerido(proceso)) return 'El tipo de proceso o intervención es obligatorio.';
        if (String(proceso).length > 100) return 'El tipo de proceso no puede exceder los 100 caracteres.';
        return '';
    }

    function validarObservaciones(observaciones) {
        if (!requerido(observaciones)) return 'Las observaciones y notas clínicas son obligatorias.';
        if (String(observaciones).length > 4000) return 'Las observaciones no pueden exceder los 4000 caracteres.';
        return '';
    }

    function validarEstado(estado) {
        const validos = ['Estable', 'Seguimiento', 'Prioritario'];
        if (!requerido(estado)) return 'El estado o progreso del estudiante es obligatorio.';
        if (!validos.includes(estado)) return 'El estado debe ser Estable, Seguimiento o Prioritario.';
        return '';
    }

    function validarPsicologo(idPsicologo) {
        if (!esIdValido(idPsicologo)) return 'Seleccione un psicólogo de la lista.';
        return '';
    }

    function validarMarcadorCritico(marcador) {
        if (!requerido(marcador)) return 'Seleccione el marcador crítico.';
        if (!['SI', 'NO'].includes(marcador)) return 'El marcador crítico debe ser SI o NO.';
        return '';
    }

    function validarCitaVinculada(textoCita) {
        const texto = String(textoCita ?? '').trim();
        if (!texto) return '';
        if (!/\d+/.test(texto)) return 'Ingrese el número de la cita vinculada (ej. CIT-104 o 104) o déjelo vacío.';
        return '';
    }

    function validarEstudiante(idExpediente) {
        if (!esIdValido(idExpediente)) return 'Seleccione primero un estudiante para registrar su seguimiento.';
        return '';
    }

    function validarSeguimiento(datos) {
        const errores = {};

        const msgEstudiante = validarEstudiante(datos.idExpediente);
        if (msgEstudiante) errores.estudiante = msgEstudiante;

        const msgFecha = validarFechaAtencion(datos.fecha);
        if (msgFecha) errores.fecha = msgFecha;

        const msgProceso = validarProceso(datos.proceso);
        if (msgProceso) errores.proceso = msgProceso;

        const msgObs = validarObservaciones(datos.observaciones);
        if (msgObs) errores.observaciones = msgObs;

        const msgEstado = validarEstado(datos.estado);
        if (msgEstado) errores.estado = msgEstado;

        const msgPsi = validarPsicologo(datos.idPsicologo);
        if (msgPsi) errores.psicologo = msgPsi;

        const msgCrit = validarMarcadorCritico(datos.marcadorCritico);
        if (msgCrit) errores.marcadorCritico = msgCrit;

        const msgCita = validarCitaVinculada(datos.citaTexto);
        if (msgCita) errores.cita = msgCita;

        return {
            valido: Object.keys(errores).length === 0,
            errores
        };
    }

    return {
        requerido,
        hoyLocal,
        esIdValido,
        esFechaISO,
        validarFechaAtencion,
        validarProceso,
        validarObservaciones,
        validarEstado,
        validarPsicologo,
        validarMarcadorCritico,
        validarCitaVinculada,
        validarEstudiante,
        validarSeguimiento
    };
})();

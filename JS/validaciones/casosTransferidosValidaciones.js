
const CasosTransferidosValidaciones = (() => {

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

    function validarEstudiante(idEstudiante) {
        if (!esIdValido(idEstudiante)) return 'Seleccione el estudiante del caso a transferir.';
        return '';
    }

    function validarPsicologoEmisor(idPsicologo) {
        if (!esIdValido(idPsicologo)) return 'Seleccione el psicólogo que realiza la transferencia.';
        return '';
    }

    function validarDestino(idPsicologoDestino, institucionDestino) {
        const tienePsicologo = esIdValido(idPsicologoDestino);
        const tieneInstitucion = requerido(institucionDestino);
        if (!tienePsicologo && !tieneInstitucion) {
            return 'Indique el destino del caso: un psicólogo interno o una institución/entidad externa.';
        }
        return '';
    }

    function validarFecha(fecha) {
        if (!requerido(fecha)) return 'La fecha de la transferencia es obligatoria.';
        if (!esFechaISO(fecha)) return 'La fecha no tiene un formato válido (AAAA-MM-DD).';
        if (String(fecha) > hoyLocal()) return 'La fecha de la transferencia no puede ser futura.';
        return '';
    }

    function validarMotivo(motivo) {
        if (!requerido(motivo)) return 'El motivo de la transferencia es obligatorio.';
        if (String(motivo).length > 500) return 'El motivo no puede exceder los 500 caracteres.';
        return '';
    }

    function validarNotas(notas) {
        if (!requerido(notas)) return 'Las notas o situación del estudiante son obligatorias.';
        if (String(notas).length > 4000) return 'Las notas no pueden exceder los 4000 caracteres.';
        return '';
    }

    function validarEstado(estado) {
        const validos = ['PENDIENTE', 'APROBADA', 'RECHAZADA'];
        if (!requerido(estado)) return 'El estado de la transferencia es obligatorio.';
        if (!validos.includes(estado)) return 'El estado debe ser PENDIENTE, APROBADA o RECHAZADA.';
        return '';
    }

    function validarTransferencia(datos) {
        const errores = {};

        const msgEstudiante = validarEstudiante(datos.idEstudiante);
        if (msgEstudiante) errores.estudiante = msgEstudiante;

        const msgEmisor = validarPsicologoEmisor(datos.idPsicologoEmisor);
        if (msgEmisor) errores.psicologoEmisor = msgEmisor;

        const msgDestino = validarDestino(datos.idPsicologoDestino, datos.institucionDestino);
        if (msgDestino) errores.destino = msgDestino;

        const msgFecha = validarFecha(datos.fechaTransferencia);
        if (msgFecha) errores.fecha = msgFecha;

        const msgMotivo = validarMotivo(datos.motivoTransferencia);
        if (msgMotivo) errores.motivo = msgMotivo;

        const msgNotas = validarNotas(datos.notasTransferencia);
        if (msgNotas) errores.notas = msgNotas;

        const msgEstado = validarEstado(datos.estadoTransferencia);
        if (msgEstado) errores.estado = msgEstado;

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
        validarEstudiante,
        validarPsicologoEmisor,
        validarDestino,
        validarFecha,
        validarMotivo,
        validarNotas,
        validarEstado,
        validarTransferencia
    };
})();
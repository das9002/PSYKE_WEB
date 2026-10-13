(function (global) {
    'use strict';

    function enviar(idEstudiante, tipo, mensaje) {
        return global.peticionApi('/notificaciones/recordatorio', {
            method: 'POST',
            body: JSON.stringify({ idEstudiante, tipo, mensaje })
        });
    }

    global.RecordatoriosService = { enviar };
})(window);

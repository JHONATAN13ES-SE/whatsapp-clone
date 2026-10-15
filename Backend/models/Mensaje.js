const mongoose = require('mongoose');

const mensajeSchema = new mongoose.Schema({
    sala: { type: String, required: true },
    emisor: { type: String, required: true },
    contenido: { type: String, required: true },
    tipo: { type: String, default: 'texto' }, // Puede ser 'texto' o 'imagen'
    leido: { type: Boolean, default: false }, // Control del doble check azul
    fecha: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Mensaje', mensajeSchema);
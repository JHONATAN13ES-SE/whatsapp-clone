require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');
const path = require('path');
const Mensaje = require('./models/Mensaje');

const app = express();
app.use(cors());

// Aumentamos el límite de JSON para permitir el envío de imágenes en Base64
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);

// Permitir conexiones de cualquier origen para que funcione con la IP pública de AWS
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Conexión a MongoDB Atlas
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("Conectado exitosamente a MongoDB Atlas"))
    .catch(err => console.error("Error conectando a MongoDB:", err));

let usuariosActivos = [];

io.on("connection", (socket) => {
    
    // Registrar usuario conectado
    socket.on("registrar_usuario", (nombre) => {
        usuariosActivos = usuariosActivos.filter(u => u.nombre !== nombre);
        usuariosActivos.push({ id: socket.id, nombre: nombre });
        io.emit("usuarios_activos", usuariosActivos);
    });

    // Unirse a una sala (grupo o chat privado 1 a 1)
    socket.on("unirse_sala", async (sala) => {
        socket.join(sala);
        const historial = await Mensaje.find({ sala }).sort({ fecha: 1 });
        socket.emit("historial_mensajes", historial);
    });

    // Escuchar el estado "escribiendo..."
    socket.on("escribiendo", ({ sala, emisor, isTyping }) => {
        socket.to(sala).emit("alguien_escribiendo", { emisor, isTyping });
    });

    // Marcar mensajes como leídos (doble check azul)
    socket.on("marcar_leidos", async ({ sala, receptor }) => {
        await Mensaje.updateMany(
            { sala: sala, emisor: { $ne: receptor }, leido: false },
            { $set: { leido: true } }
        );
        io.to(sala).emit("mensajes_actualizados_leidos");
    });

    // Recibir y transmitir mensaje (texto o imagen)
    socket.on("enviar_mensaje", async (datosMensaje) => {
        const nuevoMensaje = new Mensaje(datosMensaje);
        await nuevoMensaje.save();
        io.to(datosMensaje.sala).emit("recibir_mensaje", datosMensaje);
    });

    // Desconexión de usuario
    socket.on("disconnect", () => {
        usuariosActivos = usuariosActivos.filter(user => user.id !== socket.id);
        io.emit("usuarios_activos", usuariosActivos);
    });
});

// =========================================================
// SERVIR FRONTEND REACT COMPILADO EN PRODUCCIÓN (AWS EC2)
// =========================================================
app.use(express.static(path.join(__dirname, '../frontend/build')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

// Escuchar en el puerto asignado
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Servidor activo en el puerto ${PORT}`);
});
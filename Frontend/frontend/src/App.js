import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";

const socket = io.connect(window.location.origin);

function App() {
  const [nombre, setNombre] = useState("");
  const [conectado, setConectado] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [chatActual, setChatActual] = useState(null); 
  const [nombreGrupo, setNombreGrupo] = useState(""); 
  
  const [mensajeActual, setMensajeActual] = useState("");
  const [listaMensajes, setListaMensajes] = useState([]);
  
  const [quienEscribe, setQuienEscribe] = useState("");
  let typingTimeout = useRef(null);
  const scrollRef = useRef(null);

  const gruposFijos = ["General", "Sistemas Distribuidos", "Juegos"];

  const obtenerIconoUsuario = (nombreUsuario) => {
    if (!nombreUsuario) return "👤";
    const nombreMin = nombreUsuario.trim().toLowerCase();
    const excepcionesMasculinas = ["luca", "andrea", "joshua", "bautista", "elias"]; 
    const excepcionesFemeninas = ["luz", "beatriz", "carmen", "isabel", "leonor", "raquel", "rut", "abigail"];
    if (excepcionesFemeninas.includes(nombreMin)) return "👩";
    if (excepcionesMasculinas.includes(nombreMin)) return "👨";
    if (nombreMin.endsWith("a")) return "👩";
    return "👨";
  };

  useEffect(() => {
    socket.on("usuarios_activos", (lista) => setUsuarios(lista));
    socket.on("recibir_mensaje", (datos) => {
      setListaMensajes((prev) => [...prev, datos]);
    });
    socket.on("historial_mensajes", (historial) => setListaMensajes(historial));

    socket.on("alguien_escribiendo", ({ emisor, isTyping }) => {
      if (isTyping) setQuienEscribe(emisor);
      else setQuienEscribe("");
    });

    socket.on("mensajes_actualizados_leidos", () => {
      setListaMensajes((prev) => prev.map(m => ({ ...m, leido: true })));
    });

    return () => {
      socket.off("usuarios_activos");
      socket.off("recibir_mensaje");
      socket.off("historial_mensajes");
      socket.off("alguien_escribiendo");
      socket.off("mensajes_actualizados_leidos");
    };
  }, []);

  useEffect(() => {
    if (chatActual) {
      socket.emit("marcar_leidos", { sala: chatActual.sala, receptor: nombre });
    }
  }, [chatActual, listaMensajes.length, nombre]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" });
  }, [listaMensajes, quienEscribe]);

  const ingresar = () => {
    if (nombre.trim() !== "") {
      socket.emit("registrar_usuario", nombre);
      setConectado(true);
    }
  };

  const iniciarChatPrivado = (contactoNombre) => {
    const idSalaPrivada = [nombre, contactoNombre].sort().join("_");
    setChatActual({ nombre: contactoNombre, sala: idSalaPrivada, tipo: "privado" });
    setListaMensajes([]); 
    socket.emit("unirse_sala", idSalaPrivada);
  };

  const iniciarChatGrupal = (grupo) => {
    if (grupo.trim() !== "") {
      setChatActual({ nombre: grupo, sala: grupo, tipo: "grupo" });
      setListaMensajes([]);
      socket.emit("unirse_sala", grupo);
      setNombreGrupo("");
    }
  };

  const manejarEscritura = (e) => {
    setMensajeActual(e.target.value);
    socket.emit("escribiendo", { sala: chatActual.sala, emisor: nombre, isTyping: true });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket.emit("escribiendo", { sala: chatActual.sala, emisor: nombre, isTyping: false });
    }, 1500);
  };

  const enviarMensaje = async () => {
    if (mensajeActual.trim() !== "") {
      const datosMensaje = { sala: chatActual.sala, emisor: nombre, contenido: mensajeActual, tipo: 'texto' };
      await socket.emit("enviar_mensaje", datosMensaje);
      setMensajeActual("");
      socket.emit("escribiendo", { sala: chatActual.sala, emisor: nombre, isTyping: false });
    }
  };

  const enviarImagen = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const datosMensaje = { sala: chatActual.sala, emisor: nombre, contenido: reader.result, tipo: 'imagen' };
        await socket.emit("enviar_mensaje", datosMensaje);
      };
    }
  };

  // Si no está conectado, mostramos el Login
  if (!conectado) {
    return (
      <div className="login-container">
        <div className="login">
          <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="logo" width="80" style={{marginBottom: '20px'}}/>
          <h2>Clon de WhatsApp</h2>
          <input type="text" placeholder="Ingresa tu nombre..." value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyPress={(e) => { e.key === "Enter" && ingresar(); }} />
          <button onClick={ingresar}>INGRESAR</button>
        </div>
      </div>
    );
  }

  // Interfaz Principal Responsiva (Web y Móvil)
  return (
    <div className={`whatsapp-container ${chatActual ? 'chat-activo' : ''}`}>
      
      {/* PANEL IZQUIERDO: CONTACTOS */}
      <div className="sidebar">
        <div className="header-perfil">
          <div className="avatar">{obtenerIconoUsuario(nombre)}</div>
          <h2>{nombre}</h2>
        </div>
        
        <div className="contactos-body">
          <p className="texto-ayuda">Mis Grupos</p>
          <div className="nuevo-grupo-container">
            <input type="text" placeholder="Crear o unirse a grupo..." value={nombreGrupo} onChange={(e) => setNombreGrupo(e.target.value)} />
            <button onClick={() => iniciarChatGrupal(nombreGrupo)}>Ir</button>
          </div>
          
          {gruposFijos.map((grupo, index) => (
            <div key={`g-${index}`} className="contacto-item" onClick={() => iniciarChatGrupal(grupo)}>
              <div className="avatar avatar-grupo">&#128101;</div>
              <div className="contacto-info">
                <h4>{grupo}</h4>
                <span className="text-gris">Toque para entrar</span>
              </div>
            </div>
          ))}

          <p className="texto-ayuda" style={{marginTop: '10px'}}>Contactos en Línea</p>
          {usuarios.filter((u) => u.nombre !== nombre).map((usuario, index) => (
              <div key={`u-${index}`} className="contacto-item" onClick={() => iniciarChatPrivado(usuario.nombre)}>
                <div className="avatar">{obtenerIconoUsuario(usuario.nombre)}</div>
                <div className="contacto-info">
                  <h4>{usuario.nombre}</h4>
                  <span className="en-linea">En línea</span>
                </div>
              </div>
          ))}
        </div>
      </div>

      {/* PANEL DERECHO: CHAT AREA */}
      <div className="chat-area">
        {!chatActual ? (
          // PANTALLA VACÍA (Cuando entras desde PC y no has elegido chat)
          <div className="chat-vacio">
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="logo" width="100"/>
            <h2>WhatsApp Web</h2>
            <p>Envía y recibe mensajes sin mantener tu teléfono conectado.<br/>Haz clic en un contacto o grupo para comenzar.</p>
          </div>
        ) : (
          // PANTALLA DE CONVERSACIÓN ACTIVA
          <>
            <div className="chat-header">
              {/* Este botón solo aparecerá en celulares */}
              <button className="btn-volver" onClick={() => setChatActual(null)}>&#8592;</button>
              
              <div className={`avatar-pequeno ${chatActual.tipo === 'grupo' ? 'avatar-grupo' : ''}`}>
                {chatActual.tipo === 'grupo' ? '👥' : obtenerIconoUsuario(chatActual.nombre)}
              </div>
              <div style={{display: 'flex', flexDirection: 'column'}}>
                <h2>{chatActual.nombre}</h2>
                {quienEscribe !== "" && quienEscribe !== nombre ? (
                   <span style={{fontSize: '12px', color: '#25D366', fontWeight: 'bold'}}>{quienEscribe} escribiendo...</span>
                ) : (
                   <span style={{fontSize: '12px', color: '#e0e0e0'}}>
                     {chatActual.tipo === 'grupo' ? 'Grupo público' : 'Chat cifrado'}
                   </span>
                )}
              </div>
            </div>

            <div className="chat-body">
              {listaMensajes.map((msg, index) => (
                <div key={index} className={`mensaje-contenedor ${msg.emisor === nombre ? "mensaje-mio" : "mensaje-otro"}`}>
                  <div className="mensaje-burbuja">
                    {chatActual.tipo === 'grupo' && msg.emisor !== nombre && (
                      <span className="mensaje-emisor">{msg.emisor}</span>
                    )}
                    {msg.tipo === 'imagen' ? (
                      <img src={msg.contenido} alt="enviado" className="imagen-chat" />
                    ) : (
                      msg.contenido
                    )}
                    <div className="info-mensaje">
                      <span className="hora-mensaje">
                        {new Date(msg.fecha || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      {msg.emisor === nombre && (
                        <span className={`doble-check ${msg.leido ? 'check-azul' : 'check-gris'}`}> ✓✓</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={scrollRef} />
            </div>

            <div className="chat-footer">
              <label className="btn-adjuntar">
                📎
                <input type="file" accept="image/*" style={{display: 'none'}} onChange={enviarImagen} />
              </label>
              <input type="text" value={mensajeActual} placeholder="Escribe un mensaje aquí" onChange={manejarEscritura} onKeyPress={(e) => { e.key === "Enter" && enviarMensaje(); }} />
              <button onClick={enviarMensaje}>&#10148;</button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}

export default App;
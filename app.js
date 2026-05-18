const firebaseConfig = {
    databaseURL: "https://proyectoprueba-85368-default-rtdb.firebaseio.com/",
    projectId: "proyectoprueba-85368"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

const rSensores = database.ref('/datacenter/sensores');
const rAlertas = database.ref('/datacenter/alertas');
const rComandos = database.ref('/datacenter/comandos');
const rUsuarios = database.ref('/datacenter/usuarios');

// Elementos Telemetría
const lblTemp = document.getElementById('lbl-temp');
const lblHum = document.getElementById('lbl-hum');
const lblGas = document.getElementById('lbl-gas');
const badgeGas = document.getElementById('badge-gas');
const panelAlerta = document.getElementById('panel-alerta');
const btnDesbloquear = document.getElementById('btn-desbloquear');
//const btnAbrir = document.getElementById('btn-abrir');

// Elementos Administración
const txtId = document.getElementById('txt-id');
const txtNombre = document.getElementById('txt-nombre');
const btnRegistrarUsr = document.getElementById('btn-registrar-usr');
const listaUsuariosBody = document.getElementById('lista-usuarios-body');

// --- ESCUCHAR SENSORES Y ALERTAS ---
rSensores.on('value', (snapshot) => {
    const data = snapshot.val();
    if(data) {
        lblTemp.innerText = data.temperatura ? data.temperatura.toFixed(1) : "--";
        lblHum.innerText = data.humedad ? data.humedad.toFixed(1) : "--";
        const gas = data.gas || 0;
        lblGas.innerText = gas + " PPM";
        badgeGas.innerText = gas > 600 ? "¡⚠️ Peligro Gas!" : "Normal";
        badgeGas.style.backgroundColor = gas > 600 ? "#ef4444" : "#10b981";
    }
});

rAlertas.on('value', (snapshot) => {
    const data = snapshot.val();
    if(data && data.intruso === true) panelAlerta.classList.remove('hidden');
    else panelAlerta.classList.add('hidden');
});

btnDesbloquear.addEventListener('click', () => rAlertas.update({ intruso: false }));
//btnAbrir.addEventListener('click', () => {
    rComandos.update({ rostroValido: true });
    setTimeout(() => { rComandos.update({ rostroValido: false }); }, 3000);
});

// --- NUEVA LÓGICA: GESTIÓN DE USUARIOS DINÁMICA ---

// 1. Renderizar la tabla de usuarios en tiempo real desde Firebase
rUsuarios.on('value', (snapshot) => {
    listaUsuariosBody.innerHTML = "";
    const usuarios = snapshot.val();
    
    if (usuarios) {
        Object.keys(usuarios).forEach((id) => {
            const nombre = usuarios[id];
            const fila = document.createElement('tr');
            
            fila.innerHTML = `
                <td><strong>ID ${id}</strong></td>
                <td>${nombre}</td>
                <td>
                    <button class="btn-danger btn-sm" onclick="eliminarUsuario(${id}, '${nombre}')">❌ Eliminar</button>
                </td>
            `;
            listaUsuariosBody.appendChild(fila);
        });
    } else {
        listaUsuariosBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#94a3b8;">No hay usuarios registrados</td></tr>`;
    }
});

// 2. Evento: Solicitar Registro de Huella y Nombre
btnRegistrarUsr.addEventListener('click', () => {
    const id = parseInt(txtId.value);
    const nombre = txtNombre.value.trim();

    if (isNaN(id) || id < 1 || id > 127) {
        alert("Por favor ingresa un ID válido entre 1 y 127.");
        return;
    }
    if (nombre === "") {
        alert("Por favor ingresa el nombre de la persona para asociar a la IA.");
        return;
    }

    // Guardamos el nombre en la lista de usuarios
    rUsuarios.child(id).set(nombre);
    
    // Enviamos el comando al ESP32 para que abra el proceso físico de enrolar en ese ID
    rComandos.update({ solicitudEnrolarID: id })
    .then(() => {
        alert(`¡Solicitud enviada! Dirígete al Rack físico. El ESP32 se activará para registrar la huella en el ID: ${id}`);
        txtId.value = "";
        txtNombre.value = "";
    });
});

// 3. Función Global: Eliminar Usuario (Llamada desde el botón de la tabla)
window.eliminarUsuario = function(id, nombre) {
    if (id === 1) {
        alert("No puedes eliminar al Administrador principal (ID 1) desde la PWA por seguridad.");
        return;
    }

    if (confirm(`¿Estás seguro de que deseas eliminar a ${nombre} (ID ${id}) del sistema físico y de la IA?`)) {
        // A) Lo borramos de la lista de mapeo de nombres
        rUsuarios.child(id).remove();
        
        // B) Le ordenamos al ESP32 que borre la huella física de su memoria
        rComandos.update({ solicitudBorrarID: id });
        
        // C) Le ordenamos a Python que elimine/ignore este label en la IA
        rComandos.update({ eliminarRostroLabel: nombre });
        
        alert("Comandos de eliminación enviados a todo el ecosistema.");
    }
};

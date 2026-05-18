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

// Elementos Administración
const txtId = document.getElementById('txt-id');
const txtNombre = document.getElementById('txt-nombre');
const btnRegistrarUsr = document.getElementById('btn-registrar-usr');
const listaUsuariosBody = document.getElementById('lista-usuarios-body');

// --- NUEVOS ELEMENTOS DE ESTADO PARA EL 2FA ---
const panelEstado2FA = document.getElementById('panel-estado-2fa');
const lblEstado2FA = document.getElementById('lbl-estado-2fa');

// --- 1. ESCUCHAR SENSORES Y ALERTAS DE INTRUSO ---
rSensores.on('value', (snapshot) => {
    const data = snapshot.val();
    if(data) {
        lblTemp.innerText = data.temperatura ? data.temperatura.toFixed(1) : "--";
        lblHum.innerText = data.humedad ? data.humedad.toFixed(0) : "--";
        lblGas.innerText = data.gas ? data.gas : "0";
        
        if(data.gas > 600) {
            badgeGas.innerText = "¡PELIGRO: GAS ALTO!";
            badgeGas.className = "badge status-danger";
        } else {
            badgeGas.innerText = "SISTEMA SEGURO";
            badgeGas.className = "badge status-success";
        }
    }
});

rAlertas.on('value', (snapshot) => {
    const data = snapshot.val();
    if(data && data.intruso === true) {
        panelAlerta.style.display = "block";
        btnDesbloquear.style.display = "block";
        document.body.style.border = "4px solid #ef4444"; // Alerta visual global
    } else {
        panelAlerta.style.display = "none";
        btnDesbloquear.style.display = "none";
        document.body.style.border = "none";
    }
});

// --- 2. ESCUCHAR EL PROCESO DINÁMICO DEL 2FA (NUEVO) ---
rComandos.on('value', (snapshot) => {
    const comandos = snapshot.val();
    if (comandos) {
        const huellaID = comandos.huellaValidadaID || 0;
        const rostroOK = comandos.rostroValido || false;

        if (huellaID > 0 && !rostroOK) {
            panelEstado2FA.style.display = "block";
            panelEstado2FA.style.backgroundColor = "rgba(245, 158, 11, 0.15)";
            panelEstado2FA.style.borderColor = "#f59e0b";
            lblEstado2FA.innerHTML = `⏳ <b>[FASE 2FA]</b> Huella ID #${huellaID} detectada. Esperando validación de rostro...`;
        } else if (huellaID > 0 && rostroOK) {
            panelEstado2FA.style.display = "block";
            panelEstado2FA.style.backgroundColor = "rgba(16, 185, 129, 0.15)";
            panelEstado2FA.style.borderColor = "#10b981";
            lblEstado2FA.innerHTML = `✅ <b>[ACCESO CONCEDIDO]</b> Rostro verificado correctamente. Abriendo rack.`;
        } else {
            // Estado Standby (LED Azul / Sin escaneo activo)
            panelEstado2FA.style.display = "block";
            panelEstado2FA.style.backgroundColor = "rgba(59, 130, 246, 0.15)";
            panelEstado2FA.style.borderColor = "#3b82f6";
            lblEstado2FA.innerHTML = `🔵 <b>[ESTADO]</b> Monitor en espera. Cámara en modo de ahorro seguro.`;
        }
    }
});

// Acción del Botón Desbloquear (Solo Administrador)
btnDesbloquear.addEventListener('click', () => {
    if(confirm("¿Deseas revocar la alarma de intruso y restablecer el Rack remotamente?")) {
        rAlertas.update({ intruso: false });
    }
});

// --- 3. CRUD: CREAR / SOLICITAR ENROLAMIENTO ---
btnRegistrarUsr.addEventListener('click', () => {
    const id = parseInt(txtId.value);
    // [CORRECCIÓN CRÍTICA]: Se aplica .toUpperCase() directo al dato para garantizar matching estricto con Python
    const nombre = txtNombre.value.trim().toUpperCase();

    if (isNaN(id) || id < 1 || id > 127) {
        alert("Por favor ingresa un ID válido entre 1 y 127.");
        return;
    }
    if (nombre === "") {
        alert("Por favor ingresa el nombre del operador para vincularlo a la IA.");
        return;
    }

    // Guardar mapeo definitivo en la base de datos
    rUsuarios.child(id).set(nombre);
    
    // Notificar al hardware para iniciar la captura dactilar física
    rComandos.update({ solicitudEnrolarID: id })
    .then(() => {
        alert(`Solicitud enviada. El ESP32 se configurará en modo Enrolamiento para el ID: ${id}`);
        txtId.value = "";
        txtNombre.value = "";
    });
});

// --- 4. CRUD: ELIMINAR USUARIO (Mapeo + Hardware + IA) ---
window.eliminarUsuario = function(id, nombre) {
    if (id === 1) {
        alert("Por motivos de seguridad crítica, no puedes remover la Huella Maestra (ID 1).");
        return;
    }

    if (confirm(`¿Proceder a eliminar a ${nombre} (ID ${id}) de la base de datos, memoria física del sensor y registros de la IA?`)) {
        // A) Eliminar mapeo local en nube
        rUsuarios.child(id).remove();
        
        // B) Ordenar purga física en la base de datos del sensor AS608
        rComandos.update({ solicitudBorrarID: id });
        
        // C) Pasar flag a Python para desvincular el label del modelo local
        rComandos.update({ eliminarRostroLabel: nombre });
    }
};

// --- 5. RENDER DINÁMICO DE LA TABLA DE OPERADORES ---
rUsuarios.on('value', (snapshot) => {
    listaUsuariosBody.innerHTML = "";
    const data = snapshot.val();
    if (data) {
        Object.keys(data).forEach((id) => {
            const nombre = data[id];
            const fila = document.createElement('tr');
            
            fila.innerHTML = `
                <td><span class="badge-id">${id}</span></td>
                <td><b>${nombre}</b></td>
                <td>
                    <button class="btn-danger btn-sm" onclick="eliminarUsuario(${id}, '${nombre}')">🗑️ ELIMINAR</button>
                </td>
            `;
            listaUsuariosBody.appendChild(fila);
        });
    } else {
        listaUsuariosBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">Sin operadores registrados</td></tr>`;
    }
});

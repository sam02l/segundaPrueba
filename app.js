// --- CONFIGURACIÓN DE TU PROYECTO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyYourAPIKeyHere...", // Opcional para Realtime Database con Legacy tokens
    databaseURL: "https://proyectoprueba-85368-default-rtdb.firebaseio.com/",
    projectId: "proyectoprueba-85368"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Nodos de Referencia
const rSensores = database.ref('/datacenter/sensores');
const rAlertas = database.ref('/datacenter/alertas');
const rComandos = database.ref('/datacenter/comandos');

// Elementos del DOM
const lblTemp = document.getElementById('lbl-temp');
const lblHum = document.getElementById('lbl-hum');
const lblGas = document.getElementById('lbl-gas');
const badgeGas = document.getElementById('badge-gas');
const panelAlerta = document.getElementById('panel-alerta');
const btnDesbloquear = document.getElementById('btn-desbloquear');
const btnAbrir = document.getElementById('btn-abrir');

// 1. Escuchar Telemetría de Sensores en Tiempo Real
rSensores.on('value', (snapshot) => {
    const data = snapshot.val();
    if(data) {
        lblTemp.innerText = data.temperatura ? data.temperatura.toFixed(1) : "--";
        lblHum.innerText = data.humedad ? data.humedad.toFixed(1) : "--";
        
        const gas = data.gas || 0;
        lblGas.innerText = gas;

        // Evaluar estado del gas de forma visual
        if(gas > 600) {
            badgeGas.innerText = "¡⚠️ Peligro Gas!";
            badgeGas.style.backgroundColor = "#ef4444";
            badgeGas.style.color = "white";
        } else {
            badgeGas.innerText = "Normal";
            badgeGas.style.backgroundColor = "#10b981";
            badgeGas.style.color = "white";
        }
    }
});

// 2. Escuchar Estado de Alerta por Intruso
rAlertas.on('value', (snapshot) => {
    const data = snapshot.val();
    if(data && data.intruso === true) {
        panelAlerta.classList.remove('hidden');
    } else {
        panelAlerta.classList.add('hidden');
    }
});

// 3. Acción: Desbloqueo de Intrusión desde la PWA
btnDesbloquear.addEventListener('click', () => {
    rAlertas.update({ intruso: false })
    .then(() => alert("Comando de desbloqueo enviado."))
    .catch(err => console.error("Error:", err));
});

// 4. Acción: Apertura Remota Forzada (Simula validación aprobada de rostro)
btnAbrir.addEventListener('click', () => {
    btnAbrir.disabled = true;
    btnAbrir.innerText = "Enviando Solicitud...";
    
    rComandos.update({ rostroValido: true })
    .then(() => {
        setTimeout(() => {
            btnAbrir.disabled = false;
            btnAbrir.innerText = "🔓 Forzar Apertura";
        }, 3000);
    })
    .catch(err => {
        alert("Fallo al conectar.");
        btnAbrir.disabled = false;
    });
});

// Registrar Service Worker para soporte PWA (Opcional Local)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.log(err));
    });
}

// si CDN no carga, do valida
if (typeof Matter === 'undefined') {
    const errorBox = document.getElementById('cdn-error');
    if (errorBox) errorBox.hidden = false;
    throw new Error('Matter.js no se cargó desde el CDN.');
}

// Módulos necesarios de Matter.js
const { Engine, World, Bodies, Mouse, MouseConstraint, Events, Composite } = Matter;

// Reloj digital: usa la hora local del navegador de quien visita la página.
// Se inicializa y actualiza ANTES de que Matter.js mida el tamaño de las burbujas
// (evento 'load'), y el texto siempre tiene el mismo ancho (HH:MM:SS en monoespaciada)
// para que el tamaño del cuerpo físico no cambie cuando cambian los dígitos.
function updateClock() {
    const timeEl = document.getElementById('clock-time');
    if (!timeEl) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    timeEl.textContent = `${hh}:${mm}:${ss}`;
}
updateClock();
setInterval(updateClock, 1000);

// Crear motor físico
const engine = Engine.create({
    gravity: { x: 0, y: 1, scale: 0.001 } // Gravedad hacia abajo estándar
});
const world = engine.world;

const wrapper = document.getElementById('physics-wrapper');
const htmlElements = document.querySelectorAll('.physics-item');
const physicsBodies = [];

// Paredes (Límites del navegador)
let ground, leftWall, rightWall, topWall;
const wallThickness = 100;

function createWalls() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // Eliminar si ya existían (para cuando cambiamos el tamaño de pantalla)
    if (ground) Composite.remove(world, [ground, leftWall, rightWall, topWall]);

    ground = Bodies.rectangle(w / 2, h + wallThickness / 2, w * 3, wallThickness, { isStatic: true });
    leftWall = Bodies.rectangle(-wallThickness / 2, h / 2, wallThickness, h * 3, { isStatic: true });
    rightWall = Bodies.rectangle(w + wallThickness / 2, h / 2, wallThickness, h * 3, { isStatic: true });
    topWall = Bodies.rectangle(w / 2, -wallThickness / 2, w * 3, wallThickness, { isStatic: true });

    Composite.add(world, [ground, leftWall, rightWall, topWall]);
}

// Inicializar elementos físicos cuando el DOM esté renderizado completamente
window.addEventListener('load', () => {
    createWalls();

    htmlElements.forEach((el) => {
        // Obtener tamaño real renderizado del bloque HTML
        const width = el.offsetWidth;
        const height = el.offsetHeight;

        // Posición de inicio aleatoria arriba del viewport para el efecto "caída"
        const posX = Math.random() * (window.innerWidth - width) + width / 2;
        const posY = 100;

        // Crear cuerpo físico rectangular en Matter.js coincidente con el tamaño HTML
        const body = Bodies.rectangle(posX, posY, width, height, {
            restitution: 0.5, // Rebote (0 = nada, 1 = infinito)
            friction: 0.1,    // Fricción al deslizarse
            frictionAir: 0.02 // Resistencia al aire
        });

        // Guardamos una referencia mutua entre el nodo HTML y el cuerpo físico
        body.element = el;
        physicsBodies.push(body);
        Composite.add(world, body);
    });

    // Configurar interacción con el Mouse/Arrastre
    const mouse = Mouse.create(wrapper);
    const mouseConstraint = MouseConstraint.create(engine, {
        mouse: mouse,
        constraint: {
            stiffness: 0.2,
            render: { visible: false }
        }
    });

    Composite.add(world, mouseConstraint);

    // botones clickeables en celulares y tablets
    document.querySelectorAll('a.physics-item').forEach(link => {
        let startX = 0;
        let startY = 0;

        link.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        link.addEventListener('touchend', (e) => {
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const diffX = Math.abs(endX - startX);
            const diffY = Math.abs(endY - startY);

            // Tap en lugar de arrastre
            if (diffX < 10 && diffY < 10) {
                e.preventDefault(); 
                const target = link.getAttribute('target') || '_self';
                window.open(link.href, target);
            }
        });
    });

    // Ciclo de animación principal: Sincronizar el CSS de los elementos con Matter.js
    Events.on(engine, 'afterUpdate', () => {
        physicsBodies.forEach((body) => {
            const { x, y } = body.position;
            const angle = body.angle;
            const el = body.element;

            // Centramos el elemento y aplicamos coordenadas XY y rotación angular
            el.style.transform = `translate(${x - el.offsetWidth / 2}px, ${y - el.offsetHeight / 2}px) rotate(${angle}rad)`;

            // Revelar la burbuja solo una vez que ya tiene una posición real
            if (!el.classList.contains('is-ready')) {
                el.classList.add('is-ready');
            }
        });
    });

    // Ejecutar el motor
    let lastTime = performance.now();
    function update(time) {
        const delta = time - lastTime;
        lastTime = time;
        Engine.update(engine, Math.min(delta, 30));
        requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
});

// Ajustar paredes dinámicamente si el usuario cambia el tamaño de la ventana
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(createWalls, 150);
});

// OPTIONAL: Activar inclinación usando giroscopio en móviles
function handleDeviceOrientation(event) {
    if (event.beta !== null && event.gamma !== null) {
        const gravityX = Math.min(Math.max(event.gamma / 30, -1), 1);
        const gravityY = Math.min(Math.max(event.beta / 30, -1), 1);
        engine.gravity.x = gravityX;
        engine.gravity.y = gravityY;
    }
}

const tiltButton = document.getElementById('tilt-button');

if (typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function') {
    if (tiltButton) {
        tiltButton.hidden = false;
        tiltButton.addEventListener('click', async () => {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === 'granted') {
                    window.addEventListener('deviceorientation', handleDeviceOrientation);
                    tiltButton.hidden = true;
                } else {
                    tiltButton.textContent = 'Inclinación no permitida';
                }
            } catch (err) {
                tiltButton.textContent = 'No se pudo activar la inclinación';
            }
        });
    }
} else if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', handleDeviceOrientation);
}
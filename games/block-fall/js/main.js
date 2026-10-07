const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.scale(BLOCK_SIZE, BLOCK_SIZE);

const holdCtx = document.getElementById('holdCanvas').getContext('2d');
holdCtx.scale(BLOCK_SIZE, BLOCK_SIZE);
const nextCtx = document.getElementById('nextCanvas').getContext('2d');
nextCtx.scale(BLOCK_SIZE, BLOCK_SIZE);

const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('highScore');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayBtn = document.getElementById('overlayBtn');

let board = new Board(ctx);
let piece = new Piece(ctx);

let score = 0, lines = 0, level = 1;
let highScore = localStorage.getItem('tetrisHighScore') || 0;
highScoreEl.innerText = highScore;

let dropCounter = 0, dropInterval = 1000, lastTime = 0;
let heldTypeId = null, canHold = true;
let isPaused = false, isGameOver = false, animationId;

function getGhostY() {
    let ghostY = piece.y;
    while (board.isValid(piece, piece.x, ghostY + 1)) ghostY++;
    return ghostY;
}

function hardDrop() {
    if (isPaused || isGameOver) return;
    piece.y = getGhostY();
    drop();
}

function holdPiece() {
    if (!canHold || isPaused || isGameOver) return;
    if (heldTypeId === null) {
        heldTypeId = piece.typeId;
        piece.spawn();
    } else {
        const temp = piece.typeId;
        piece.typeId = heldTypeId;
        heldTypeId = temp;
        piece.shape = SHAPES[piece.typeId];
        piece.color = COLORS[piece.typeId];
        piece.x = 3; piece.y = 0; piece.rotationIndex = 0;
    }
    canHold = false; dropCounter = 0;
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(board.grid, 0, 0, null, 1, ctx);
    
    if (!isGameOver) {
        drawMatrix(piece.shape, piece.x, getGhostY(), piece.color, 0.2, ctx);
        drawMatrix(piece.shape, piece.x, piece.y, piece.color, 1, ctx);
    }
    drawUI();
}

function drawUI() {
    holdCtx.clearRect(0, 0, 4, 4);
    nextCtx.clearRect(0, 0, 4, 4);
    const getOffset = (id) => (id === 4) ? {x: 1, y: 1} : (id === 1) ? {x: 0, y: 0.5} : {x: 0.5, y: 0.5};

    if (heldTypeId !== null) drawMatrix(SHAPES[heldTypeId], getOffset(heldTypeId).x, getOffset(heldTypeId).y, COLORS[heldTypeId], 1, holdCtx);
    if (Piece.nextTypeId !== null) drawMatrix(SHAPES[Piece.nextTypeId], getOffset(Piece.nextTypeId).x, getOffset(Piece.nextTypeId).y, COLORS[Piece.nextTypeId], 1, nextCtx);
}

function drawMatrix(matrix, offsetX, offsetY, color = null, alpha = 1, targetCtx = ctx) {
    targetCtx.globalAlpha = alpha;
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const blockColor = color || COLORS[value];
                targetCtx.fillStyle = blockColor;
                targetCtx.fillRect(x + offsetX, y + offsetY, 1, 1);
                
                // Внутренний светлый объемный куб
                targetCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                targetCtx.fillRect(x + offsetX + 0.2, y + offsetY + 0.2, 0.6, 0.6);
                
                targetCtx.lineWidth = 0.05;
                targetCtx.strokeStyle = '#000';
                targetCtx.strokeRect(x + offsetX, y + offsetY, 1, 1);
            }
        });
    });
    targetCtx.globalAlpha = 1;
}

function drop() {
    piece.y++;
    if (!board.isValid(piece)) {
        piece.y--; 
        merge(board.grid, piece); 
        const linesCleared = board.clearLines(); 
        if (linesCleared > 0) updateScore(linesCleared);
        
        piece.spawn(); 
        canHold = true; 
        
        if (!board.isValid(piece)) gameOver();
    }
    dropCounter = 0;
}

function updateScore(linesCleared) {
    const linePoints = [0, 100, 300, 500, 800]; 
    score += linePoints[linesCleared] * level;
    lines += linesCleared;
    level = Math.floor(lines / 10) + 1; 
    dropInterval = Math.max(100, 1000 - (level - 1) * 100); 

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('tetrisHighScore', highScore);
        highScoreEl.innerText = highScore;
    }

    scoreEl.innerText = score;
    levelEl.innerText = level;
    linesEl.innerText = lines;
}

function gameOver() {
    isGameOver = true;
    cancelAnimationFrame(animationId);
    overlayTitle.innerText = "GAME OVER";
    overlayTitle.style.color = "#ff3344";
    overlayBtn.innerText = "RESTART";
    overlayBtn.onclick = resetGame;
    overlay.style.display = "flex";
}

function togglePause() {
    if (isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        cancelAnimationFrame(animationId);
        overlayTitle.innerText = "PAUSED";
        overlayTitle.style.color = "#00ff66";
        overlayBtn.innerText = "RESUME";
        overlayBtn.onclick = togglePause;
        overlay.style.display = "flex";
    } else {
        overlay.style.display = "none";
        lastTime = performance.now();
        update(lastTime);
    }
}

function resetGame() {
    board.grid = board.getEmptyGrid();
    score = 0; lines = 0; level = 1; dropInterval = 1000;
    heldTypeId = null; canHold = true; Piece.nextTypeId = null;
    isGameOver = false; isPaused = false;
    
    scoreEl.innerText = score; levelEl.innerText = level; linesEl.innerText = lines;
    overlay.style.display = "none";
    piece = new Piece(ctx); 
    lastTime = performance.now();
    update(lastTime);
}

function merge(grid, piece) {
    piece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) grid[y + piece.y][x + piece.x] = piece.typeId;
        });
    });
}

function update(time = 0) {
    if (isPaused || isGameOver) return;
    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) drop();

    draw();
    animationId = requestAnimationFrame(update);
}

// --- УПРАВЛЕНИЕ И СИСТЕМА ЗАЖАТИЯ (DAS / ARR) ---
function moveLeft() { if (!isPaused && !isGameOver) { piece.x--; if (!board.isValid(piece)) piece.x++; } }
function moveRight() { if (!isPaused && !isGameOver) { piece.x++; if (!board.isValid(piece)) piece.x--; } }
function rotate() { if (!isPaused && !isGameOver) piece.rotate(board); }

// Универсальная функция для зажатия (работает и для мыши/тача, и для клавиатуры)
function bindRepeatingControl(btnElement, keyCodes, action, initialDelay = 160, repeatInterval = 50) {
    let timer = null;
    let interval = null;
    let isPressed = false;

    const start = () => {
        if (isPressed || isPaused || isGameOver) return;
        isPressed = true;
        action();
        timer = setTimeout(() => {
            interval = setInterval(() => {
                if (!isPaused && !isGameOver) action();
            }, repeatInterval);
        }, initialDelay);
    };

    const stop = () => {
        isPressed = false;
        clearTimeout(timer);
        clearInterval(interval);
    };

    if (btnElement) {
        btnElement.addEventListener('pointerdown', (e) => { e.preventDefault(); start(); });
        btnElement.addEventListener('pointerup', stop);
        btnElement.addEventListener('pointerleave', stop);
        btnElement.addEventListener('pointercancel', stop);
    }

    keyCodes.forEach(code => {
        window.addEventListener('keydown', (e) => {
            if (e.code === code && !e.repeat) { e.preventDefault(); start(); }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === code) stop();
        });
    });
}

// 3. Зажатие кнопок: Влево, Вправо и Вниз (ускоренное падение)
bindRepeatingControl(document.getElementById('btnLeft'), ['ArrowLeft', 'KeyA'], moveLeft, 170, 45);
bindRepeatingControl(document.getElementById('btnRight'), ['ArrowRight', 'KeyD'], moveRight, 170, 45);
bindRepeatingControl(document.getElementById('btnDown'), ['ArrowDown', 'KeyS'], () => { if (!isPaused && !isGameOver) drop(); }, 80, 50);

// Одиночные нажатия: Поворот, Hold, Hard Drop, Пауза
document.getElementById('btnRotate').addEventListener('pointerdown', (e) => { e.preventDefault(); rotate(); });
document.getElementById('btnHold').addEventListener('pointerdown', (e) => { e.preventDefault(); holdPiece(); });
document.getElementById('btnDrop').addEventListener('pointerdown', (e) => { e.preventDefault(); hardDrop(); });

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') rotate();
    if (e.code === 'Space') hardDrop();
    if (e.code === 'KeyC' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') holdPiece();
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
});

// Авто-пауза при сворачивании
document.addEventListener("visibilitychange", () => {
    if (document.hidden && !isPaused && !isGameOver) togglePause();
});

// PWA Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then(() => console.log("SW Registered"));
}

update();

(() => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    const COLS = 30;
    const ROWS = 20;
    const CELL_SIZE = 25; 
    
    canvas.width = COLS * CELL_SIZE;
    canvas.height = ROWS * CELL_SIZE;

    let gameState = {
        mode: 'pvp',
        colors: { p1: '#3498db', p2: '#e74c3c' },
        grid: Array(ROWS).fill().map(() => Array(COLS).fill(0)),
        currentPlayer: 1,
        scores: { p1: 0, p2: 0 },
        isFirstMove: { 1: true, 2: true },
        placedShapes: [],
        consecutiveSkips: 0
    };

    let currentRoll = { w: 0, h: 0, x: -1, y: -1 };
    let isRolling = false;
    let drag = { isDragging: false, offsetX: 0, offsetY: 0 };

    const startScreen = document.getElementById('start-screen');
    const gameUI = document.getElementById('game-ui');
    const startBtn = document.getElementById('start-btn');
    const rollDiceBtn = document.getElementById('roll-dice-btn');
    const diceResult = document.getElementById('dice-result');
    const rotateBtn = document.getElementById('rotate-btn');
    const confirmBtn = document.getElementById('confirm-btn');
    const p1ScoreEl = document.querySelector('#player1-score span');
    const p2ScoreEl = document.querySelector('#player2-score span');

    // --- ПАЛИТРА ЦВЕТОВ ---
    const PALETTE = [
        '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#3498db', 
        '#9b59b6', '#222222', '#ff9ff3', '#00cec9', '#8b4513'
    ];

    let selectedColorP1 = PALETTE[4]; // Синий
    let selectedColorP2 = PALETTE[0]; // Красный

    function createColorGrid(containerId, defaultColor, onSelect) {
        const container = document.getElementById(containerId);
        PALETTE.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.backgroundColor = color;
            if (color === defaultColor) swatch.classList.add('selected');
            
            swatch.addEventListener('click', () => {
                Array.from(container.children).forEach(c => c.classList.remove('selected'));
                swatch.classList.add('selected');
                onSelect(color);
            });
            container.appendChild(swatch);
        });
    }

    createColorGrid('grid-p1', selectedColorP1, (color) => selectedColorP1 = color);
    createColorGrid('grid-p2', selectedColorP2, (color) => selectedColorP2 = color);

    // --- ГЕНЕРАЦИЯ ШУМА КАРАНДАША ---
    let pencilNoisePattern = null;

    function generatePencilNoise() {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = 50;
        offCanvas.height = 50;
        const octx = offCanvas.getContext('2d');
        
        // 1. Диагональная штриховка
        octx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        octx.lineWidth = 0.8;
        for (let i = -50; i < 100; i += 4) {
            octx.beginPath();
            octx.moveTo(i, 0);
            octx.lineTo(i + 50, 50);
            octx.stroke();
        }
        
        // 2. Зернистость (шум бумаги и грифеля)
        for (let i = 0; i < 600; i++) {
            // Темные точки
            octx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.2})`;
            octx.fillRect(Math.random() * 50, Math.random() * 50, 1, 1);
            
            // Светлые точки (эффект непрокрашенной бумаги)
            octx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.3})`;
            octx.fillRect(Math.random() * 50, Math.random() * 50, 1.5, 1.5);
        }
        
        pencilNoisePattern = ctx.createPattern(offCanvas, 'repeat');
    }
    
    // Создаем текстуру при запуске
    generatePencilNoise();

    // --- ОТРИСОВКА ---

    function drawGrid() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 1;
        for (let i = 0; i <= COLS; i++) {
            ctx.beginPath(); ctx.moveTo(i * CELL_SIZE, 0); ctx.lineTo(i * CELL_SIZE, canvas.height);
            ctx.strokeStyle = '#a4c8e1'; ctx.stroke();
        }
        for (let i = 0; i <= ROWS; i++) {
            ctx.beginPath(); ctx.moveTo(0, i * CELL_SIZE); ctx.lineTo(canvas.width, i * CELL_SIZE);
            ctx.strokeStyle = '#a4c8e1'; ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(CELL_SIZE, 0); ctx.lineTo(CELL_SIZE, canvas.height);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(canvas.width - CELL_SIZE, 0); ctx.lineTo(canvas.width - CELL_SIZE, canvas.height);
        ctx.stroke();
    }

    function drawPlacedShapes() {
        gameState.placedShapes.forEach(shape => {
            const px = shape.x * CELL_SIZE;
            const py = shape.y * CELL_SIZE;
            const pw = shape.w * CELL_SIZE;
            const ph = shape.h * CELL_SIZE;

            // 1. Базовый полупрозрачный цвет
            ctx.fillStyle = shape.color;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(px, py, pw, ph);
            
            // 2. Накладываем текстуру карандаша
            if (pencilNoisePattern) {
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = pencilNoisePattern;
                ctx.fillRect(px, py, pw, ph);
            }
            
            // 3. Обводка (чуть небрежная)
            ctx.strokeStyle = '#2c3e50'; 
            ctx.lineWidth = 2; 
            ctx.strokeRect(px, py, pw, ph);
        });
    }

    function drawGhostShape() {
        if (currentRoll.w === 0 || currentRoll.h === 0) {
            rotateBtn.classList.add('hidden'); confirmBtn.classList.add('hidden'); return;
        }

        const isOutOfBounds = currentRoll.x + currentRoll.w > COLS || currentRoll.y + currentRoll.h > ROWS || currentRoll.x < 0 || currentRoll.y < 0;
        const isValid = !isOutOfBounds && isValidPlacement(currentRoll.x, currentRoll.y, currentRoll.w, currentRoll.h, gameState.currentPlayer);

        const px = currentRoll.x * CELL_SIZE;
        const py = currentRoll.y * CELL_SIZE;
        const pw = currentRoll.w * CELL_SIZE;
        const ph = currentRoll.h * CELL_SIZE;

        // Цвет превью
        ctx.fillStyle = isValid ? (gameState.currentPlayer === 1 ? gameState.colors.p1 : gameState.colors.p2) : 'rgba(150, 150, 150, 0.5)';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(px, py, pw, ph);

        // Текстура для превью (если позиция верная)
        if (pencilNoisePattern && isValid) {
            ctx.globalAlpha = 0.8;
            ctx.fillStyle = pencilNoisePattern;
            ctx.fillRect(px, py, pw, ph);
        }
        ctx.globalAlpha = 1.0;

        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;

        const isHumanTurn = gameState.mode === 'pvp' || gameState.currentPlayer === 1;

        if (!isOutOfBounds && !drag.isDragging && isHumanTurn) {
            rotateBtn.classList.remove('hidden');
            rotateBtn.style.left = `${(currentRoll.x + currentRoll.w) * CELL_SIZE * scaleX}px`;
            rotateBtn.style.top = `${currentRoll.y * CELL_SIZE * scaleY}px`;

            if (isValid) {
                confirmBtn.classList.remove('hidden');
                confirmBtn.style.left = `${(currentRoll.x + currentRoll.w) * CELL_SIZE * scaleX}px`;
                confirmBtn.style.top = `${(currentRoll.y + currentRoll.h) * CELL_SIZE * scaleY}px`;
            } else {
                confirmBtn.classList.add('hidden');
            }
        } else {
            rotateBtn.classList.add('hidden'); confirmBtn.classList.add('hidden');
        }
    }

    function draw() {
        drawGrid(); drawPlacedShapes(); drawGhostShape();
        document.getElementById('player1-score').style.border = gameState.currentPlayer === 1 ? '2px solid ' + gameState.colors.p1 : 'none';
        document.getElementById('player2-score').style.border = gameState.currentPlayer === 2 ? '2px solid ' + gameState.colors.p2 : 'none';
    }

    // --- ЛОГИКА ПРАВИЛ ---

    function isValidPlacement(x, y, w, h, player) {
        for (let r = y; r < y + h; r++) {
            for (let c = x; c < x + w; c++) {
                if (gameState.grid[r][c] !== 0) return false;
            }
        }
        if (gameState.isFirstMove[player]) {
            if (player === 1 && x === 0) return true;
            if (player === 2 && x + w === COLS) return true;
            return false;
        }
        let touchesOwn = false;
        for (let r = y; r < y + h; r++) {
            if (x > 0 && gameState.grid[r][x - 1] === player) touchesOwn = true;
            if (x + w < COLS && gameState.grid[r][x + w] === player) touchesOwn = true;
        }
        for (let c = x; c < x + w; c++) {
            if (y > 0 && gameState.grid[y - 1][c] === player) touchesOwn = true;
            if (y + h < ROWS && gameState.grid[y + h][c] === player) touchesOwn = true;
        }
        return touchesOwn;
    }

    function hasValidMoves(w, h, player) {
        for (let y = 0; y <= ROWS - h; y++) {
            for (let x = 0; x <= COLS - w; x++) {
                if (isValidPlacement(x, y, w, h, player)) return true;
            }
        }
        for (let y = 0; y <= ROWS - w; y++) {
            for (let x = 0; x <= COLS - h; x++) {
                if (isValidPlacement(x, y, h, w, player)) return true;
            }
        }
        return false;
    }

    function applyMove() {
        const p = gameState.currentPlayer;
        for (let r = currentRoll.y; r < currentRoll.y + currentRoll.h; r++) {
            for (let c = currentRoll.x; c < currentRoll.x + currentRoll.w; c++) {
                gameState.grid[r][c] = p;
            }
        }
        gameState.placedShapes.push({
            x: currentRoll.x, y: currentRoll.y, w: currentRoll.w, h: currentRoll.h,
            color: p === 1 ? gameState.colors.p1 : gameState.colors.p2
        });
        gameState.scores[`p${p}`] += (currentRoll.w * currentRoll.h);
        p1ScoreEl.textContent = gameState.scores.p1;
        p2ScoreEl.textContent = gameState.scores.p2;
        gameState.isFirstMove[p] = false;
        switchTurn();
    }

    function switchTurn() {
        gameState.currentPlayer = gameState.currentPlayer === 1 ? 2 : 1;
        currentRoll = { w: 0, h: 0, x: -1, y: -1 };
        diceResult.textContent = `🎲 🎲`;
        draw();

        if (gameState.mode === 'pve' && gameState.currentPlayer === 2) {
            rollDiceBtn.disabled = true;
            setTimeout(botTurn, 1000);
        } else {
            rollDiceBtn.disabled = false;
        }
    }

    function endGame() {
        const winner = gameState.scores.p1 > gameState.scores.p2 ? "Игрок 1" : (gameState.scores.p2 > gameState.scores.p1 ? "Игрок 2" : "Ничья");
        setTimeout(() => {
            alert(`Игра окончена! Нет доступных ходов.\nСчет:\nИгрок 1: ${gameState.scores.p1}\nИгрок 2: ${gameState.scores.p2}\n\nПобедитель: ${winner}!`);
            location.reload();
        }, 500);
    }

    // --- ЛОГИКА БОТА (ИИ) ---

    function calculateBestMove(w, h, player) {
        let bestMove = null;
        let bestScore = -Infinity;

        const orientations = [{ width: w, height: h }, { width: h, height: w }];
        if (w === h) orientations.pop();

        for (let o of orientations) {
            for (let y = 0; y <= ROWS - o.height; y++) {
                for (let x = 0; x <= COLS - o.width; x++) {
                    if (isValidPlacement(x, y, o.width, o.height, player)) {
                        let score = 0;
                        score += (COLS - x) * 10; 
                        let distToCenterY = Math.abs(y + o.height / 2 - ROWS / 2);
                        score -= distToCenterY * 2;
                        score += Math.random() * 5;

                        if (score > bestScore) {
                            bestScore = score;
                            bestMove = { x: x, y: y, w: o.width, h: o.height };
                        }
                    }
                }
            }
        }
        return bestMove;
    }

    function botTurn() {
        if (gameState.consecutiveSkips >= 2) return;

        performDiceRoll((d1, d2) => {
            if (!hasValidMoves(d1, d2, 2)) {
                draw();
                setTimeout(() => {
                    alert(`Бот не может разместить фигуру ${d1}x${d2}. Пропуск хода!`);
                    gameState.consecutiveSkips++;
                    if (gameState.consecutiveSkips >= 2) endGame();
                    else switchTurn();
                }, 500);
            } else {
                gameState.consecutiveSkips = 0;
                const bestMove = calculateBestMove(d1, d2, 2);
                currentRoll.x = bestMove.x;
                currentRoll.y = bestMove.y;
                currentRoll.w = bestMove.w;
                currentRoll.h = bestMove.h;
                draw();
                setTimeout(() => { applyMove(); }, 1000);
            }
        });
    }

    // --- БРОСОК КУБИКОВ ---

    function performDiceRoll(callback) {
        isRolling = true; rollDiceBtn.disabled = true;
        let rolls = 0;
        const interval = setInterval(() => {
            const d1 = Math.floor(Math.random() * 6) + 1;
            const d2 = Math.floor(Math.random() * 6) + 1;
            diceResult.textContent = `🎲 ${d1} x ${d2}`;
            rolls++;
            if (rolls > 15) {
                clearInterval(interval);
                currentRoll.w = d1; currentRoll.h = d2;
                isRolling = false;
                callback(d1, d2);
            }
        }, 50);
    }

    // --- DRAG & DROP И СОБЫТИЯ ---

    function getPointerPos(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) };
    }

    function startDrag(e) {
        if (currentRoll.w === 0 || (gameState.mode === 'pve' && gameState.currentPlayer === 2)) return;
        const pos = getPointerPos(e);
        const col = Math.floor(pos.x / CELL_SIZE);
        const row = Math.floor(pos.y / CELL_SIZE);

        if (col >= currentRoll.x && col < currentRoll.x + currentRoll.w && row >= currentRoll.y && row < currentRoll.y + currentRoll.h) {
            drag.isDragging = true;
            drag.offsetX = pos.x - (currentRoll.x * CELL_SIZE);
            drag.offsetY = pos.y - (currentRoll.y * CELL_SIZE);
            if(e.cancelable) e.preventDefault();
            draw();
        }
    }

    function doDrag(e) {
        if (!drag.isDragging) return;
        const pos = getPointerPos(e);
        currentRoll.x = Math.floor((pos.x - drag.offsetX) / CELL_SIZE);
        currentRoll.y = Math.floor((pos.y - drag.offsetY) / CELL_SIZE);
        if(e.cancelable) e.preventDefault();
        draw();
    }

    function endDrag() {
        if (drag.isDragging) { drag.isDragging = false; draw(); }
    }

    canvas.addEventListener('mousedown', startDrag); window.addEventListener('mousemove', doDrag); window.addEventListener('mouseup', endDrag);
    canvas.addEventListener('touchstart', startDrag, { passive: false }); window.addEventListener('touchmove', doDrag, { passive: false }); window.addEventListener('touchend', endDrag);

    // --- КНОПКИ ---

    rollDiceBtn.addEventListener('click', () => {
        if (isRolling || currentRoll.w > 0) return; 
        performDiceRoll((d1, d2) => {
            currentRoll.x = Math.floor(COLS / 2 - d1 / 2);
            currentRoll.y = Math.floor(ROWS / 2 - d2 / 2);
            
            if (!hasValidMoves(d1, d2, gameState.currentPlayer)) {
                draw();
                setTimeout(() => {
                    alert(`Игрок ${gameState.currentPlayer} не может разместить фигуру ${d1}x${d2}. Пропуск хода!`);
                    gameState.consecutiveSkips++;
                    if (gameState.consecutiveSkips >= 2) endGame();
                    else switchTurn();
                }, 500);
            } else {
                gameState.consecutiveSkips = 0;
                draw();
            }
        });
    });

    rotateBtn.addEventListener('click', () => {
        const temp = currentRoll.w; currentRoll.w = currentRoll.h; currentRoll.h = temp; draw();
    });

    confirmBtn.addEventListener('click', applyMove);

    startBtn.addEventListener('click', () => {
        gameState.mode = document.getElementById('game-mode').value;
        gameState.colors.p1 = selectedColorP1;
        gameState.colors.p2 = selectedColorP2;
        startScreen.classList.add('hidden'); gameUI.classList.remove('hidden');
        draw();
    });

})();
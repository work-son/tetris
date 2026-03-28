import Sound from './sound.js';

const canvas = document.getElementById('game-board');
const context = canvas.getContext('2d');
const nextPieceCanvas = document.getElementById('next-piece');
const nextPieceContext = nextPieceCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const soundToggleButton = document.getElementById('sound-toggle-button'); // Updated ID

const BLOCK_SIZE = 20;
const BOARD_WIDTH = 12;
const BOARD_HEIGHT = 20;

// Sound instance
const sound = new Sound();

// Set canvas sizes
canvas.width = BOARD_WIDTH * BLOCK_SIZE;
canvas.height = BOARD_HEIGHT * BLOCK_SIZE;
nextPieceCanvas.width = 4 * BLOCK_SIZE;
nextPieceCanvas.height = 4 * BLOCK_SIZE;

context.scale(BLOCK_SIZE, BLOCK_SIZE);
nextPieceContext.scale(BLOCK_SIZE, BLOCK_SIZE);

let board;
let score;
let dropCounter;
let lastTime;
let dropInterval;
let gameRunning;
let gamePaused = false;
let animationFrameId;

const player = {
    pos: {x: 0, y: 0},
    matrix: null,
};

let nextPiece = null;

const colors = [
    null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF',
];

function createBoard(width, height) {
    return Array.from({ length: height }, () => Array(width).fill(0));
}

function createPiece(type) {
    if (type === 'T') return [[0, 0, 0], [1, 1, 1], [0, 1, 0]];
    if (type === 'O') return [[2, 2], [2, 2]];
    if (type === 'L') return [[0, 3, 0], [0, 3, 0], [0, 3, 3]];
    if (type === 'J') return [[0, 4, 0], [0, 4, 0], [4, 4, 0]];
    if (type === 'I') return [[0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0], [0, 5, 0, 0]];
    if (type === 'S') return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
    if (type === 'Z') return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
}

function drawMatrix(matrix, offset, ctx = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                ctx.fillStyle = colors[value];
                ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(board, {x: 0, y: 0});
    drawMatrix(player.matrix, player.pos);
    drawNextPiece();
}

function drawNextPiece() {
    nextPieceContext.fillStyle = '#000';
    nextPieceContext.fillRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);
    if (nextPiece) {
        const x = (4 - nextPiece[0].length) / 2;
        const y = (4 - nextPiece.length) / 2;
        drawMatrix(nextPiece, { x, y }, nextPieceContext);
    }
}

function merge(board, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function boardSweep() {
    let rowCount = 1;
    outer: for (let y = board.length - 1; y > 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) continue outer;
        }
        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        ++y;
        score += rowCount * 10;
        rowCount *= 2;
        dropInterval = Math.max(200, dropInterval - 10);
        sound.clearLine();
    }
}

function collide(board, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (board[y + o.y] && board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function playerDrop() {
    player.pos.y++;
    if (collide(board, player)) {
        player.pos.y--;
        merge(board, player);
        sound.land(); // Use the new landing sound
        playerReset();
        boardSweep();
        updateScore();
    } else {
        sound.move();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    if (!gameRunning) return;
    while (!collide(board, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(board, player);
    sound.land(); // Use the new landing sound
    playerReset();
    boardSweep();
    updateScore();
    dropCounter = 0;
}

function playerMove(offset) {
    if (!gameRunning || gamePaused) return;
    player.pos.x += offset;
    if (collide(board, player)) {
        player.pos.x -= offset;
    } else {
        sound.move();
    }
}

function playerRotate(dir) {
    if (!gameRunning || gamePaused) return;
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide(board, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
    sound.rotate();
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    if (dir > 0) matrix.forEach(row => row.reverse());
    else matrix.reverse();
}

function startGame() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    board = createBoard(BOARD_WIDTH, BOARD_HEIGHT);
    score = 0;
    dropInterval = 1000;
    gameRunning = true;
    gamePaused = false;
    playerReset();
    updateScore();
    lastTime = 0;
    update();
    startButton.textContent = "RESTART GAME";
    pauseButton.textContent = "PAUSE";
}

function playerReset() {
    const pieces = 'TJLOSZI';
    if (nextPiece === null) {
        player.matrix = createPiece(pieces[pieces.length * Math.random() | 0]);
    } else {
        player.matrix = nextPiece;
    }
    nextPiece = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.pos.y = 0;
    player.pos.x = (board[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

    if (collide(board, player)) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        gameRunning = false;
        sound.gameOver();
        startButton.textContent = "START GAME";
        alert('Game Over');
        init();
    }
}

function togglePause() {
    if (!gameRunning) return;
    gamePaused = !gamePaused;
    if (gamePaused) {
        cancelAnimationFrame(animationFrameId);
        pauseButton.textContent = "RESUME";
    } else {
        lastTime = performance.now();
        update();
        pauseButton.textContent = "PAUSE";
    }
}

function update(time = 0) {
    if (!gameRunning || gamePaused) return;
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }
    draw();
    animationFrameId = requestAnimationFrame(update);
}

function updateScore() {
    scoreElement.innerText = score;
}

function handleSoundToggle() {
    const isMuted = sound.toggleSound();
    if (isMuted) {
        soundToggleButton.textContent = 'SOUND FX: OFF';
        soundToggleButton.classList.add('muted');
    } else {
        soundToggleButton.textContent = 'SOUND FX: ON';
        soundToggleButton.classList.remove('muted');
    }
}

function init() {
    board = createBoard(BOARD_WIDTH, BOARD_HEIGHT);
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(board, {x:0, y:0});
    nextPieceContext.fillStyle = '#000';
    nextPieceContext.fillRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);
    scoreElement.innerText = '0';
    gameRunning = false;
    pauseButton.textContent = "PAUSE";
}

document.addEventListener('keydown', event => {
    if (event.keyCode === 80) { // 'P' key
        togglePause();
        return;
    }
    if (!gameRunning || gamePaused) return;

    if (event.keyCode === 37) playerMove(-1);
    else if (event.keyCode === 39) playerMove(1);
    else if (event.keyCode === 40) playerDrop();
    else if (event.keyCode === 81) playerRotate(-1);
    else if (event.keyCode === 87 || event.keyCode === 38) playerRotate(1);
    else if (event.keyCode === 32) {
        event.preventDefault();
        playerHardDrop();
    }
});

startButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
soundToggleButton.addEventListener('click', handleSoundToggle);

init();

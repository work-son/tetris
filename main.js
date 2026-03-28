import Sound from './sound.js';

// DOM Elements
const canvas = document.getElementById('game-board');
const context = canvas.getContext('2d');
const nextPieceCanvas = document.getElementById('next-piece');
const nextPieceContext = nextPieceCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');
const soundToggleButton = document.getElementById('sound-toggle-button');
const leaderboardList = document.getElementById('leaderboard');
const highscoreModal = document.getElementById('highscore-modal');
const highscoreForm = document.getElementById('highscore-form');
const initialsInput = document.getElementById('initials');

// Game Constants
const BLOCK_SIZE = 20;
const BOARD_WIDTH = 12;
const BOARD_HEIGHT = 20;
const HIGH_SCORE_COUNT = 10;

// Services
const sound = new Sound();

// Game State
let board, player, nextPiece, score, dropCounter, lastTime, dropInterval, gameRunning, gamePaused, animationFrameId;
let highScores = [];

// Setup
function setupCanvases() {
    canvas.width = BOARD_WIDTH * BLOCK_SIZE;
    canvas.height = BOARD_HEIGHT * BLOCK_SIZE;
    nextPieceCanvas.width = 4 * BLOCK_SIZE;
    nextPieceCanvas.height = 4 * BLOCK_SIZE;
    context.scale(BLOCK_SIZE, BLOCK_SIZE);
    nextPieceContext.scale(BLOCK_SIZE, BLOCK_SIZE);
}

const colors = [
    null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF',
];

// --- Leaderboard Functions ---

function loadHighScores() {
    const storedScores = localStorage.getItem('tetrisHighScores');
    highScores = storedScores ? JSON.parse(storedScores) : [];
}

function saveHighScores() {
    localStorage.setItem('tetrisHighScores', JSON.stringify(highScores));
}

function displayHighScores() {
    leaderboardList.innerHTML = '';
    if (highScores.length === 0) {
        leaderboardList.innerHTML = `<li>No scores yet!</li>`;
        return;
    }
    highScores.forEach((score, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${index + 1}. ${score.initials}</span><span>${score.score}</span>`;
        leaderboardList.appendChild(li);
    });
}

function checkHighScore(currentScore) {
    if (currentScore === 0) return false;
    const lowestScore = highScores.length < HIGH_SCORE_COUNT ? 0 : highScores[HIGH_SCORE_COUNT - 1].score;
    return currentScore > lowestScore;
}

function addNewHighScore(currentScore, initials) {
    const newScore = { score: currentScore, initials };
    highScores.push(newScore);
    highScores.sort((a, b) => b.score - a.score);
    highScores.splice(HIGH_SCORE_COUNT);
    saveHighScores();
    displayHighScores();
}

// --- Game Logic ---

function createBoard() {
    return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(0));
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

function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(board, {x: 0, y: 0});
    drawMatrix(player.matrix, player.pos);
    drawNextPiece();
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

function drawNextPiece() {
    nextPieceContext.fillStyle = '#111';
    nextPieceContext.fillRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);
    if (nextPiece) {
        const x = (4 - nextPiece[0].length) / 2;
        const y = (4 - nextPiece.length) / 2;
        drawMatrix(nextPiece, { x, y }, nextPieceContext);
    }
}

function merge() {
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
        board.splice(y, 1);
        board.unshift(Array(BOARD_WIDTH).fill(0));
        ++y;
        score += rowCount * 10;
        rowCount *= 2;
        dropInterval = Math.max(200, dropInterval - 10);
        sound.clearLine();
    }
}

function collide() {
    for (let y = 0; y < player.matrix.length; ++y) {
        for (let x = 0; x < player.matrix[y].length; ++x) {
            if (player.matrix[y][x] !== 0 && (board[y + player.pos.y] && board[y + player.pos.y][x + player.pos.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function playerDrop() {
    player.pos.y++;
    if (collide()) {
        player.pos.y--;
        merge();
        sound.land();
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
    while (!collide()) player.pos.y++;
    player.pos.y--;
    merge();
    sound.land();
    playerReset();
    boardSweep();
    updateScore();
    dropCounter = 0;
}

function playerMove(offset) {
    if (!gameRunning || gamePaused) return;
    player.pos.x += offset;
    if (collide()) player.pos.x -= offset;
    else sound.move();
}

function playerRotate(dir) {
    if (!gameRunning || gamePaused) return;
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide()) {
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
    board = createBoard();
    score = 0;
    dropInterval = 1000;
    gameRunning = true;
    gamePaused = false;
    player = { pos: {x: 0, y: 0}, matrix: null };
    nextPiece = null;
    playerReset();
    updateScore();
    lastTime = 0;
    update();
    startButton.textContent = "RESTART GAME";
    pauseButton.textContent = "PAUSE";
}

function playerReset() {
    const pieces = 'TJLOSZI';
    player.matrix = nextPiece || createPiece(pieces[pieces.length * Math.random() | 0]);
    nextPiece = createPiece(pieces[pieces.length * Math.random() | 0]);
    player.pos.y = 0;
    player.pos.x = (board[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

    if (collide()) {
        gameOver();
    }
}

function gameOver() {
    cancelAnimationFrame(animationFrameId);
    gameRunning = false;
    sound.gameOver();
    startButton.textContent = "START GAME";

    if (checkHighScore(score)) {
        highscoreModal.style.display = 'flex';
        initialsInput.focus();
    } else {
        alert(`Game Over! Your score: ${score}`);
        init();
    }
}

function togglePause() {
    if (!gameRunning) return;
    gamePaused = !gamePaused;
    pauseButton.textContent = gamePaused ? "RESUME" : "PAUSE";
    if (gamePaused) cancelAnimationFrame(animationFrameId);
    else {
        lastTime = performance.now();
        update();
    }
}

function update(time = 0) {
    if (!gameRunning || gamePaused) return;
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;
    if (dropCounter > dropInterval) playerDrop();
    draw();
    animationFrameId = requestAnimationFrame(update);
}

function updateScore() {
    scoreElement.innerText = score;
}

function handleSoundToggle() {
    const isMuted = sound.toggleSound();
    soundToggleButton.textContent = isMuted ? 'SOUND FX: OFF' : 'SOUND FX: ON';
    soundToggleButton.classList.toggle('muted', isMuted);
}

function handleHighScoreSubmit(event) {
    event.preventDefault();
    const initials = initialsInput.value.toUpperCase();
    if (initials.length === 3) {
        addNewHighScore(score, initials);
        highscoreModal.style.display = 'none';
        initialsInput.value = '';
        init();
    }
}

function init() {
    board = createBoard();
    context.fillStyle = '#111';
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawMatrix(board, {x:0, y:0});
    nextPieceContext.fillStyle = '#111';
    nextPieceContext.fillRect(0, 0, nextPieceCanvas.width, nextPieceCanvas.height);
    scoreElement.innerText = '0';
    gameRunning = false;
    pauseButton.textContent = "PAUSE";
    loadHighScores();
    displayHighScores();
}

// Event Listeners
document.addEventListener('keydown', event => {
    if (event.code === 'KeyP') {
        togglePause();
        return;
    }
    if (!gameRunning || gamePaused) return;

    if (event.code === 'ArrowLeft') playerMove(-1);
    else if (event.code === 'ArrowRight') playerMove(1);
    else if (event.code === 'ArrowDown') playerDrop();
    else if (event.code === 'KeyQ') playerRotate(-1);
    else if (event.code === 'KeyW' || event.code === 'ArrowUp') playerRotate(1);
    else if (event.code === 'Space') {
        event.preventDefault();
        playerHardDrop();
    }
});

startButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
soundToggleButton.addEventListener('click', handleSoundToggle);
highscoreForm.addEventListener('submit', handleHighScoreSubmit);

// Initial Load
setupCanvases();
init();

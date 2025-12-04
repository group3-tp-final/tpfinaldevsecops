
let gameState = {
    isPlaying: false,
    clicks: 0,
    timeLeft: 10,
    timer: null,
    username: ''
};


const API_BASE_URL = getApiUrl();

function getApiUrl() {
    
    if (window.BACKEND_URL) {
        return window.BACKEND_URL;
    }
    
    
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8081';
    }
    
    if (port === '8080') {
        return window.location.origin.replace(':8080', ':8081');
    }
    
    return window.location.origin.replace(/:\d+$/, ':8081') || 'http://localhost:8081';
}


const clickButton = document.getElementById('clickButton');
const clickCount = document.getElementById('clickCount');
const timer = document.getElementById('timer');
const gameStatus = document.getElementById('gameStatus');
const usernameInput = document.getElementById('username');
const startButton = document.getElementById('startButton');
const leaderboard = document.getElementById('leaderboard');
const particles = document.getElementById('particles');


const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency = 440, duration = 100, type = 'sine') {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (e) {
        console.log('Audio context not available:', e);
    }
}


function createParticle(x, y) {
    const emojis = ['💥', '🔥', '⚡', '✨', '🌟', '💫', '🎉', '🎊'];
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    particle.style.animationDuration = (Math.random() * 2 + 1) + 's';
    particle.style.fontSize = (Math.random() * 20 + 20) + 'px';
    particles.appendChild(particle);
    
    setTimeout(() => {
        particle.remove();
    }, 3000);
}


function showAchievementNotification(achievement) {
    const notification = document.getElementById('achievementNotification');
    const icon = document.getElementById('achievementIcon');
    const title = document.getElementById('achievementTitle');
    const desc = document.getElementById('achievementDesc');
    
    icon.textContent = achievement.icon || '🏆';
    icon.style.color = achievement.color || '#FFD700';
    title.textContent = achievement.name || 'Achievement Unlocked!';
    desc.textContent = achievement.description || '';
    
    notification.classList.remove('hidden');
    
    
    playSound(523, 200, 'sine'); 
    setTimeout(() => playSound(659, 200, 'sine'), 150); 
    setTimeout(() => playSound(784, 400, 'sine'), 300); 
    
    
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 5000);
}


async function loadAllAchievements() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/achievements`);
        
        if (!response.ok) {
            throw new Error('Failed to load achievements');
        }
        
        const achievements = await response.json();
        displayAllAchievements(achievements);
    } catch (error) {
        console.error('Error loading achievements:', error);
        document.getElementById('achievements').innerHTML = '<div class="loading">Failed to load achievements.</div>';
    }
}


function displayAllAchievements(achievements) {
    const achievementsContainer = document.getElementById('achievements');
    
    if (achievements.length === 0) {
        achievementsContainer.innerHTML = '<div class="loading">No achievements available.</div>';
        return;
    }
    
    achievementsContainer.innerHTML = achievements.map(achievement => {
        const maxCPS = achievement.max_cps ? ` - ${achievement.max_cps.toFixed(1)} CPS` : '+ CPS';
        return `
            <div class="achievement-item" style="border-left: 5px solid ${achievement.color || '#FFD700'}">
                <div class="achievement-icon">${achievement.icon || '🏆'}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${escapeHtml(achievement.name)}</div>
                    <div class="achievement-description">${escapeHtml(achievement.description)}</div>
                    <div class="achievement-requirement">${achievement.min_cps.toFixed(1)}${maxCPS}</div>
                </div>
            </div>
        `;
    }).join('');
}


async function loadUserAchievements(username) {
    if (!username) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/achievements/${encodeURIComponent(username)}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                return; 
            }
            throw new Error('Failed to load user achievements');
        }
        
        const achievements = await response.json();
        displayUserAchievements(achievements);
    } catch (error) {
        console.error('Error loading user achievements:', error);
    }
}


function displayUserAchievements(achievements) {
    
    
    console.log('User achievements:', achievements);
}


function initGame() {
    startButton.addEventListener('click', startGame);
    clickButton.addEventListener('click', handleClick);
    
    
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !gameState.isPlaying) {
            startGame();
        }
    });
    
    
    loadLeaderboard();
    loadAllAchievements();
    setInterval(loadLeaderboard, 30000); 
}


function startGame(autoStart = false) {
    
    const username = autoStart ? (gameState.username || usernameInput.value.trim() || '') : usernameInput.value.trim();
    
    
    if (!autoStart && !username) {
        alert('Please enter your epic username!');
        return;
    }
    
    gameState.username = username || ''; 
    gameState.isPlaying = true;
    gameState.clicks = 0;
    gameState.timeLeft = 10;
    
    clickCount.textContent = '0';
    timer.textContent = '10';
    gameStatus.textContent = autoStart ? 'GO! CLICK LIKE CRAZY!' : 'GET READY...';
    gameStatus.className = 'game-status playing';
    
    startButton.disabled = true;
    usernameInput.disabled = true;
    
    
    if (autoStart) {
        startTimer();
        playSound(800, 200, 'square');
    } else {
        setTimeout(() => {
            gameStatus.textContent = 'GO! CLICK LIKE CRAZY!';
            startTimer();
            playSound(800, 200, 'square');
        }, 1000);
    }
}


function handleClick() {
    
    if (!gameState.isPlaying) {
        
        if (!gameState.username && usernameInput.value.trim()) {
            gameState.username = usernameInput.value.trim();
        }
        startGame(true); 
        
    }
    
    
    if (!gameState.isPlaying) {
        return; 
    }
    
    
    gameState.clicks++;
    clickCount.textContent = gameState.clicks;
    
    
    clickButton.classList.add('clicked');
    setTimeout(() => {
        clickButton.classList.remove('clicked');
    }, 100);
    
    
    const frequency = 200 + (gameState.clicks * 10);
    playSound(frequency, 50, 'square');
    
    
    const rect = clickButton.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    createParticle(x, y);
    
    
    if (gameState.clicks % 10 === 0) {
        document.body.style.animation = 'shake 0.1s';
        setTimeout(() => {
            document.body.style.animation = '';
        }, 100);
        playSound(600, 300, 'triangle');
    }
}


function startTimer() {
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        timer.textContent = gameState.timeLeft;
        
        if (gameState.timeLeft <= 3) {
            timer.style.color = '#ff006e';
            timer.style.animation = 'pulse 0.5s infinite';
            playSound(400, 100, 'sawtooth');
        }
        
        if (gameState.timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}


function promptForUsername() {
    return new Promise((resolve) => {
        const username = prompt(`🎮 Great game! You clicked ${gameState.clicks} times!\n\nPlease enter your epic username to save your score:`, '');
        resolve(username ? username.trim() : null);
    });
}


function endGame() {
    clearInterval(gameState.timer);
    gameState.isPlaying = false;
    
    gameStatus.textContent = `GAME OVER! You clicked ${gameState.clicks} times!`;
    gameStatus.className = 'game-status finished';
    
    
    playSound(523, 100, 'sine'); 
    setTimeout(() => playSound(659, 100, 'sine'), 100); 
    setTimeout(() => playSound(784, 200, 'sine'), 200); 
    
    
    const rect = clickButton.getBoundingClientRect();
    for (let i = 0; i < 20; i++) {
        setTimeout(() => {
            const x = rect.left + Math.random() * rect.width;
            const y = rect.top + Math.random() * rect.height;
            createParticle(x, y);
        }, i * 50);
    }
    
    
    const finalUsername = gameState.username || usernameInput.value.trim();
    
    if (!finalUsername) {
        
        promptForUsername().then((username) => {
            if (username) {
                gameState.username = username;
                usernameInput.value = username;
                submitScoreAndHandleResult(username);
            } else {
                
                resetGameUI();
                gameStatus.textContent = 'Score not saved. Enter a username next time!';
            }
        });
    } else {
        
        if (!gameState.username) {
            gameState.username = finalUsername;
        }
        submitScoreAndHandleResult(gameState.username);
    }
}


function submitScoreAndHandleResult(username) {
    submitScore(username, gameState.clicks).then((result) => {
        if (result && result.achievements && result.achievements.length > 0) {
            
            result.achievements.forEach((achievement, index) => {
                setTimeout(() => {
                    showAchievementNotification(achievement);
                }, index * 2000); 
            });
        }
        loadLeaderboard();
        if (username) {
            loadUserAchievements(username);
        }
        resetGameUI();
    });
}


function resetGameUI() {
    startButton.disabled = false;
    usernameInput.disabled = false;
    timer.style.color = '';
    timer.style.animation = '';
}


async function submitScore(username, clicks) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/scores`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: username,
                clicks: clicks
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to submit score');
        }
        
        const result = await response.json();
        console.log('Score submitted:', result);
        return result;
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Failed to submit score. Please try again.');
        return null;
    }
}


async function loadLeaderboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/leaderboard`);
        
        if (!response.ok) {
            throw new Error('Failed to load leaderboard');
        }
        
        const scores = await response.json();
        displayLeaderboard(scores);
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        leaderboard.innerHTML = '<div class="loading">Failed to load leaderboard. Check if backend is running.</div>';
    }
}


function displayLeaderboard(scores) {
    if (scores.length === 0) {
        leaderboard.innerHTML = '<div class="loading">No scores yet. Be the first!</div>';
        return;
    }
    
    leaderboard.innerHTML = scores.map((entry, index) => {
        const isTop = entry.rank <= 3;
        const date = new Date(entry.game_date).toLocaleDateString();
        return `
            <div class="leaderboard-entry ${isTop ? 'top' : ''}">
                <span class="rank">#${entry.rank}</span>
                <span class="username">${escapeHtml(entry.username)}</span>
                <span class="clicks">${entry.clicks} clicks</span>
                <span class="date">${date}</span>
            </div>
        `;
    }).join('');
}


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);


document.addEventListener('DOMContentLoaded', initGame);


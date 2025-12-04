// Configuration
const CONFIG = {
    GAME_DURATION: 10, // secondes
    BACKEND_PORT: 5433,
    FRONTEND_PORT: 33000,
    LEADERBOARD_REFRESH_INTERVAL: 30000, // ms
    PARTICLE_LIFETIME: 3000, // ms
    NOTIFICATION_DURATION: 5000, // ms
    ACHIEVEMENT_NOTIFICATION_DELAY: 2000, // ms
    CLICK_ANIMATION_DURATION: 100, // ms
    SHAKE_ANIMATION_DURATION: 100, // ms
    SHAKE_MILESTONE: 10, // nombre de clics
    COUNTDOWN_WARNING_THRESHOLD: 3, // secondes
    PARTICLE_BURST_COUNT: 20,
    AUDIO: {
        DEFAULT_FREQUENCY: 440,
        DEFAULT_DURATION: 100,
        DEFAULT_TYPE: 'sine',
        GAIN_START: 0.3,
        GAIN_END: 0.01,
        CLICK_BASE_FREQUENCY: 200,
        CLICK_FREQUENCY_INCREMENT: 10,
        CLICK_DURATION: 50,
        MILESTONE_FREQUENCY: 600,
        MILESTONE_DURATION: 300,
        COUNTDOWN_FREQUENCY: 400,
        COUNTDOWN_DURATION: 100,
        GAME_OVER_SEQUENCE: [
            { frequency: 523, duration: 100, delay: 0 },
            { frequency: 659, duration: 100, delay: 100 },
            { frequency: 784, duration: 200, delay: 200 }
        ],
        ACHIEVEMENT_SEQUENCE: [
            { frequency: 523, duration: 200, delay: 0 },
            { frequency: 659, duration: 200, delay: 150 },
            { frequency: 784, duration: 400, delay: 300 }
        ],
        START_FREQUENCY: 800,
        START_DURATION: 200
    },
    PARTICLES: {
        EMOJIS: ['💥', '🔥', '⚡', '✨', '🌟', '💫', '🎉', '🎊'],
        MIN_ANIMATION_DURATION: 1, // secondes
        MAX_ANIMATION_DURATION: 3, // secondes
        MIN_FONT_SIZE: 20, // px
        MAX_FONT_SIZE: 40, // px
        BURST_DELAY: 50 // ms entre chaque particule
    },
    COLORS: {
        DEFAULT_ACHIEVEMENT: '#FFD700',
        COUNTDOWN_WARNING: '#ff006e'
    },
    ANIMATION: {
        PULSE_DURATION: 0.5, // secondes
        SHAKE_OFFSET: 10 // px
    }
};

let gameState = {
    isPlaying: false,
    clicks: 0,
    timeLeft: CONFIG.GAME_DURATION,
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
        return `http://localhost:${CONFIG.BACKEND_PORT}`;
    }
    
    if (port === String(CONFIG.FRONTEND_PORT)) {
        return window.location.origin.replace(`:${CONFIG.FRONTEND_PORT}`, `:${CONFIG.BACKEND_PORT}`);
    }
    
    return window.location.origin.replace(/:\d+$/, `:${CONFIG.BACKEND_PORT}`) || `http://localhost:${CONFIG.BACKEND_PORT}`;
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

function playSound(frequency = CONFIG.AUDIO.DEFAULT_FREQUENCY, duration = CONFIG.AUDIO.DEFAULT_DURATION, type = CONFIG.AUDIO.DEFAULT_TYPE) {
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(CONFIG.AUDIO.GAIN_START, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(CONFIG.AUDIO.GAIN_END, audioContext.currentTime + duration / 1000);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration / 1000);
    } catch (e) {
        console.log('Audio context not available:', e);
    }
}


function createParticle(x, y) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.textContent = CONFIG.PARTICLES.EMOJIS[Math.floor(Math.random() * CONFIG.PARTICLES.EMOJIS.length)];
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    const animDuration = Math.random() * (CONFIG.PARTICLES.MAX_ANIMATION_DURATION - CONFIG.PARTICLES.MIN_ANIMATION_DURATION) + CONFIG.PARTICLES.MIN_ANIMATION_DURATION;
    particle.style.animationDuration = animDuration + 's';
    const fontSize = Math.random() * (CONFIG.PARTICLES.MAX_FONT_SIZE - CONFIG.PARTICLES.MIN_FONT_SIZE) + CONFIG.PARTICLES.MIN_FONT_SIZE;
    particle.style.fontSize = fontSize + 'px';
    particles.appendChild(particle);
    
    setTimeout(() => {
        particle.remove();
    }, CONFIG.PARTICLE_LIFETIME);
}


function showAchievementNotification(achievement) {
    const notification = document.getElementById('achievementNotification');
    const icon = document.getElementById('achievementIcon');
    const title = document.getElementById('achievementTitle');
    const desc = document.getElementById('achievementDesc');
    
    icon.textContent = achievement.icon || '🏆';
    icon.style.color = achievement.color || CONFIG.COLORS.DEFAULT_ACHIEVEMENT;
    title.textContent = achievement.name || 'Achievement Unlocked!';
    desc.textContent = achievement.description || '';
    
    notification.classList.remove('hidden');
    
    
    CONFIG.AUDIO.ACHIEVEMENT_SEQUENCE.forEach(sound => {
        setTimeout(() => playSound(sound.frequency, sound.duration, 'sine'), sound.delay);
    });
    
    
    setTimeout(() => {
        notification.classList.add('hidden');
    }, CONFIG.NOTIFICATION_DURATION);
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
            <div class="achievement-item" style="border-left: 5px solid ${achievement.color || CONFIG.COLORS.DEFAULT_ACHIEVEMENT}">
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
    setInterval(loadLeaderboard, CONFIG.LEADERBOARD_REFRESH_INTERVAL); 
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
    gameState.timeLeft = CONFIG.GAME_DURATION;
    
    clickCount.textContent = '0';
    timer.textContent = String(CONFIG.GAME_DURATION);
    gameStatus.textContent = autoStart ? 'GO! CLICK LIKE CRAZY!' : 'GET READY...';
    gameStatus.className = 'game-status playing';
    
    startButton.disabled = true;
    usernameInput.disabled = true;
    
    
    if (autoStart) {
        startTimer();
        playSound(CONFIG.AUDIO.START_FREQUENCY, CONFIG.AUDIO.START_DURATION, 'square');
    } else {
        setTimeout(() => {
            gameStatus.textContent = 'GO! CLICK LIKE CRAZY!';
            startTimer();
            playSound(CONFIG.AUDIO.START_FREQUENCY, CONFIG.AUDIO.START_DURATION, 'square');
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
    }, CONFIG.CLICK_ANIMATION_DURATION);
    
    
    const frequency = CONFIG.AUDIO.CLICK_BASE_FREQUENCY + (gameState.clicks * CONFIG.AUDIO.CLICK_FREQUENCY_INCREMENT);
    playSound(frequency, CONFIG.AUDIO.CLICK_DURATION, 'square');
    
    
    const rect = clickButton.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    createParticle(x, y);
    
    
    if (gameState.clicks % CONFIG.SHAKE_MILESTONE === 0) {
        document.body.style.animation = `shake ${CONFIG.SHAKE_ANIMATION_DURATION / 1000}s`;
        setTimeout(() => {
            document.body.style.animation = '';
        }, CONFIG.SHAKE_ANIMATION_DURATION);
        playSound(CONFIG.AUDIO.MILESTONE_FREQUENCY, CONFIG.AUDIO.MILESTONE_DURATION, 'triangle');
    }
}


function startTimer() {
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        timer.textContent = gameState.timeLeft;
        
        if (gameState.timeLeft <= CONFIG.COUNTDOWN_WARNING_THRESHOLD) {
            timer.style.color = CONFIG.COLORS.COUNTDOWN_WARNING;
            timer.style.animation = `pulse ${CONFIG.ANIMATION.PULSE_DURATION}s infinite`;
            playSound(CONFIG.AUDIO.COUNTDOWN_FREQUENCY, CONFIG.AUDIO.COUNTDOWN_DURATION, 'sawtooth');
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
    
    
    CONFIG.AUDIO.GAME_OVER_SEQUENCE.forEach(sound => {
        setTimeout(() => playSound(sound.frequency, sound.duration, 'sine'), sound.delay);
    });
    
    
    const rect = clickButton.getBoundingClientRect();
    for (let i = 0; i < CONFIG.PARTICLE_BURST_COUNT; i++) {
        setTimeout(() => {
            const x = rect.left + Math.random() * rect.width;
            const y = rect.top + Math.random() * rect.height;
            createParticle(x, y);
        }, i * CONFIG.PARTICLES.BURST_DELAY);
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
                }, index * CONFIG.ACHIEVEMENT_NOTIFICATION_DELAY); 
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
        25% { transform: translateX(-${CONFIG.ANIMATION.SHAKE_OFFSET}px); }
        75% { transform: translateX(${CONFIG.ANIMATION.SHAKE_OFFSET}px); }
    }
`;
document.head.appendChild(style);


document.addEventListener('DOMContentLoaded', initGame);


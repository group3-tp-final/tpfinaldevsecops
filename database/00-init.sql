CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    clicks INTEGER NOT NULL,
    game_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    min_cps DECIMAL(5,2) NOT NULL,
    max_cps DECIMAL(5,2),
    icon VARCHAR(10),
    color VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    score_id INTEGER REFERENCES scores(id) ON DELETE SET NULL,
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_clicks ON scores(clicks DESC);
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_game_date ON scores(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);

CREATE OR REPLACE VIEW leaderboard AS
SELECT 
    u.username,
    s.clicks,
    s.game_date,
    ROW_NUMBER() OVER (ORDER BY s.clicks DESC, s.game_date DESC) as rank
FROM scores s
JOIN users u ON s.user_id = u.id
ORDER BY s.clicks DESC, s.game_date DESC
LIMIT 100;

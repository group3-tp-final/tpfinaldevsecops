INSERT INTO achievements (name, description, min_cps, max_cps, icon, color) VALUES
    ('Turtle', 'Slow and steady... but too slow!', 0.0, 5.0, '🐢', '#808080'),
    ('Snail', 'Still crawling along', 5.1, 10.0, '🐌', '#A0A0A0'),
    ('Human', 'Average clicking speed', 10.1, 15.0, '👤', '#4169E1'),
    ('Cheetah', 'Fast like the wind!', 15.1, 20.0, '🐆', '#FF8C00'),
    ('Lightning', 'Electric speed!', 20.1, 25.0, '⚡', '#FFD700'),
    ('Machine', 'You are a clicking machine!', 25.1, 30.0, '🤖', '#00CED1'),
    ('Rap God', 'Extreme clicking mastery!', 30.1, NULL, '🎤', '#FF006E')
ON CONFLICT (name) DO NOTHING;

INSERT INTO users (username) VALUES
    ('ClickMaster3000'),
    ('SpeedyGonzales'),
    ('ButtonBasher'),
    ('ClickGod'),
    ('TurboClicker')
ON CONFLICT (username) DO NOTHING;

INSERT INTO scores (user_id, clicks, duration_seconds, game_date) VALUES
    (1, 156, 10, CURRENT_TIMESTAMP - INTERVAL '1 day'),
    (2, 142, 10, CURRENT_TIMESTAMP - INTERVAL '2 days'),
    (3, 178, 10, CURRENT_TIMESTAMP - INTERVAL '3 hours'),
    (4, 201, 10, CURRENT_TIMESTAMP - INTERVAL '5 hours'),
    (5, 165, 10, CURRENT_TIMESTAMP - INTERVAL '1 hour'),
    (1, 189, 10, CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
    (2, 167, 10, CURRENT_TIMESTAMP - INTERVAL '45 minutes')
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    score_record RECORD;
    user_cps DECIMAL(5,2);
    best_achievement_id INTEGER;
BEGIN
    FOR score_record IN 
        SELECT s.id, s.user_id, s.clicks, s.duration_seconds
        FROM scores s
        ORDER BY s.user_id, s.clicks DESC
    LOOP
        user_cps := score_record.clicks::DECIMAL / GREATEST(score_record.duration_seconds, 1)::DECIMAL;
        
        SELECT id INTO best_achievement_id
        FROM achievements
        WHERE min_cps <= user_cps 
          AND (max_cps IS NULL OR max_cps >= user_cps)
        ORDER BY min_cps DESC
        LIMIT 1;
        
        IF best_achievement_id IS NOT NULL THEN
            INSERT INTO user_achievements (user_id, achievement_id, score_id)
            VALUES (score_record.user_id, best_achievement_id, score_record.id)
            ON CONFLICT (user_id, achievement_id) DO NOTHING;
        END IF;
    END LOOP;
END $$;

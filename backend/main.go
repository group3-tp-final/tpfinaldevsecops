package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/lib/pq"
)

// Configuration constants
const (
	DefaultDBHost     = "localhost"
	DefaultDBPort     = "5432"
	DefaultDBUser     = "postgres"
	DefaultDBPassword = "clicker"
	DefaultDBName     = "clicker"
	DefaultServerPort = "8081"
	
	GameDurationSeconds = 10
	LeaderboardLimit    = 100
	
	HTTPStatusCreated = http.StatusCreated
	HTTPStatusOK      = http.StatusOK
	
	SSLMode = "disable"
	
	ServiceName = "clicker-game-api"
)

type Server struct {
	DB *sql.DB
}

type User struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
}

type Score struct {
	ID             int       `json:"id"`
	UserID         int       `json:"user_id"`
	Username       string    `json:"username"`
	Clicks         int       `json:"clicks"`
	GameDate       time.Time `json:"game_date"`
	DurationSeconds int      `json:"duration_seconds"`
}

type LeaderboardEntry struct {
	Username string    `json:"username"`
	Clicks   int       `json:"clicks"`
	GameDate time.Time `json:"game_date"`
	Rank     int       `json:"rank"`
}

type SubmitScoreRequest struct {
	Username string `json:"username"`
	Clicks   int    `json:"clicks"`
}

type Achievement struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	MinCPS      float64 `json:"min_cps"`
	MaxCPS      *float64 `json:"max_cps,omitempty"`
	Icon        string  `json:"icon"`
	Color       string  `json:"color"`
}

type UserAchievement struct {
	AchievementID int       `json:"achievement_id"`
	Name          string    `json:"name"`
	Description   string    `json:"description"`
	Icon          string    `json:"icon"`
	Color         string    `json:"color"`
	EarnedAt      time.Time `json:"earned_at"`
}

type SubmitScoreResponse struct {
	Score       Score            `json:"score"`
	Achievements []UserAchievement `json:"achievements,omitempty"`
}

func (s *Server) getLeaderboard(w http.ResponseWriter, r *http.Request) {
	query := fmt.Sprintf(`
		SELECT 
			u.username,
			s.clicks,
			s.game_date,
			ROW_NUMBER() OVER (ORDER BY s.clicks DESC, s.game_date DESC) as rank
		FROM scores s
		JOIN users u ON s.user_id = u.id
		ORDER BY s.clicks DESC, s.game_date DESC
		LIMIT %d
	`, LeaderboardLimit)

	rows, err := s.DB.Query(query)
	if err != nil {
		http.Error(w, fmt.Sprintf("Database query failed: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var entries []LeaderboardEntry
	for rows.Next() {
		var entry LeaderboardEntry
		err := rows.Scan(&entry.Username, &entry.Clicks, &entry.GameDate, &entry.Rank)
		if err != nil {
			http.Error(w, fmt.Sprintf("Row scan failed: %v", err), http.StatusInternalServerError)
			return
		}
		entries = append(entries, entry)
	}

	if err = rows.Err(); err != nil {
		http.Error(w, fmt.Sprintf("Rows error: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func (s *Server) submitScore(w http.ResponseWriter, r *http.Request) {
	var req SubmitScoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Username == "" {
		http.Error(w, "Username is required", http.StatusBadRequest)
		return
	}

	if req.Clicks < 0 {
		http.Error(w, "Clicks must be non-negative", http.StatusBadRequest)
		return
	}

	var userID int
	err := s.DB.QueryRow(
		"SELECT id FROM users WHERE username = $1",
		req.Username,
	).Scan(&userID)

	if err == sql.ErrNoRows {
		err = s.DB.QueryRow(
			"INSERT INTO users (username) VALUES ($1) RETURNING id",
			req.Username,
		).Scan(&userID)
		if err != nil {
			http.Error(w, fmt.Sprintf("Failed to create user: %v", err), http.StatusInternalServerError)
			return
		}
	} else if err != nil {
		http.Error(w, fmt.Sprintf("Database query failed: %v", err), http.StatusInternalServerError)
		return
	}

	var scoreID int
	err = s.DB.QueryRow(
		"INSERT INTO scores (user_id, clicks, duration_seconds) VALUES ($1, $2, $3) RETURNING id",
		userID, req.Clicks, GameDurationSeconds,
	).Scan(&scoreID)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to save score: %v", err), http.StatusInternalServerError)
		return
	}

	var score Score
	err = s.DB.QueryRow(
		`SELECT s.id, s.user_id, u.username, s.clicks, s.game_date, s.duration_seconds
		 FROM scores s
		 JOIN users u ON s.user_id = u.id
		 WHERE s.id = $1`,
		scoreID,
	).Scan(&score.ID, &score.UserID, &score.Username, &score.Clicks, &score.GameDate, &score.DurationSeconds)

	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to retrieve score: %v", err), http.StatusInternalServerError)
		return
	}

	achievements := s.checkAndAwardAchievements(userID, scoreID, req.Clicks, GameDurationSeconds)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(HTTPStatusCreated)
	json.NewEncoder(w).Encode(SubmitScoreResponse{
		Score:        score,
		Achievements: achievements,
	})
}

func (s *Server) checkAndAwardAchievements(userID, scoreID, clicks, durationSeconds int) []UserAchievement {
	cps := float64(clicks) / float64(durationSeconds)
	var earnedAchievements []UserAchievement

	query := `
		SELECT id, name, description, min_cps, max_cps, icon, color
		FROM achievements
		WHERE min_cps <= $1 AND (max_cps IS NULL OR max_cps >= $1)
		ORDER BY min_cps DESC
		LIMIT 1
	`

	var achievement Achievement
	var maxCPS sql.NullFloat64
	err := s.DB.QueryRow(query, cps).Scan(
		&achievement.ID, &achievement.Name, &achievement.Description,
		&achievement.MinCPS, &maxCPS, &achievement.Icon, &achievement.Color,
	)

	if err == sql.ErrNoRows {
		return earnedAchievements
	}
	if err != nil {
		log.Printf("Error finding achievement: %v", err)
		return earnedAchievements
	}

	if maxCPS.Valid {
		achievement.MaxCPS = &maxCPS.Float64
	}

	var exists bool
	err = s.DB.QueryRow(
		"SELECT EXISTS(SELECT 1 FROM user_achievements WHERE user_id = $1 AND achievement_id = $2)",
		userID, achievement.ID,
	).Scan(&exists)

	if err != nil {
		log.Printf("Error checking existing achievement: %v", err)
		return earnedAchievements
	}

	if !exists {
		_, err = s.DB.Exec(
			"INSERT INTO user_achievements (user_id, achievement_id, score_id) VALUES ($1, $2, $3)",
			userID, achievement.ID, scoreID,
		)

		if err != nil {
			log.Printf("Error awarding achievement: %v", err)
			return earnedAchievements
		}

		var userAchievement UserAchievement
		err = s.DB.QueryRow(
			`SELECT a.id, a.name, a.description, a.icon, a.color, ua.earned_at
			 FROM user_achievements ua
			 JOIN achievements a ON ua.achievement_id = a.id
			 WHERE ua.user_id = $1 AND ua.achievement_id = $2
			 ORDER BY ua.earned_at DESC
			 LIMIT 1`,
			userID, achievement.ID,
		).Scan(
			&userAchievement.AchievementID, &userAchievement.Name,
			&userAchievement.Description, &userAchievement.Icon,
			&userAchievement.Color, &userAchievement.EarnedAt,
		)

		if err == nil {
			earnedAchievements = append(earnedAchievements, userAchievement)
			log.Printf("User %d earned achievement: %s (%.2f CPS)", userID, achievement.Name, cps)
		}
	}

	return earnedAchievements
}

func (s *Server) getAchievements(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT id, name, description, min_cps, max_cps, icon, color
		FROM achievements
		ORDER BY min_cps ASC
	`

	rows, err := s.DB.Query(query)
	if err != nil {
		http.Error(w, fmt.Sprintf("Database query failed: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var achievements []Achievement
	for rows.Next() {
		var achievement Achievement
		var maxCPS sql.NullFloat64
		err := rows.Scan(
			&achievement.ID, &achievement.Name, &achievement.Description,
			&achievement.MinCPS, &maxCPS, &achievement.Icon, &achievement.Color,
		)
		if err != nil {
			http.Error(w, fmt.Sprintf("Row scan failed: %v", err), http.StatusInternalServerError)
			return
		}
		if maxCPS.Valid {
			achievement.MaxCPS = &maxCPS.Float64
		}
		achievements = append(achievements, achievement)
	}

	if err = rows.Err(); err != nil {
		http.Error(w, fmt.Sprintf("Rows error: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(achievements)
}

func (s *Server) getUserAchievements(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	username := vars["username"]

	if username == "" {
		http.Error(w, "Username is required", http.StatusBadRequest)
		return
	}

	var userID int
	err := s.DB.QueryRow("SELECT id FROM users WHERE username = $1", username).Scan(&userID)
	if err == sql.ErrNoRows {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, fmt.Sprintf("Database query failed: %v", err), http.StatusInternalServerError)
		return
	}

	query := `
		SELECT a.id, a.name, a.description, a.icon, a.color, ua.earned_at
		FROM user_achievements ua
		JOIN achievements a ON ua.achievement_id = a.id
		WHERE ua.user_id = $1
		ORDER BY ua.earned_at DESC
	`

	rows, err := s.DB.Query(query, userID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Database query failed: %v", err), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var achievements []UserAchievement
	for rows.Next() {
		var achievement UserAchievement
		err := rows.Scan(
			&achievement.AchievementID, &achievement.Name,
			&achievement.Description, &achievement.Icon,
			&achievement.Color, &achievement.EarnedAt,
		)
		if err != nil {
			http.Error(w, fmt.Sprintf("Row scan failed: %v", err), http.StatusInternalServerError)
			return
		}
		achievements = append(achievements, achievement)
	}

	if err = rows.Err(); err != nil {
		http.Error(w, fmt.Sprintf("Rows error: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(achievements)
}

func (s *Server) healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "healthy",
		"service": ServiceName,
	})
}

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w)
		if r.Method == "OPTIONS" {
			w.WriteHeader(HTTPStatusOK)
			return
		}
		next(w, r)
	}
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

func main() {
	dbHost := getEnv("DB_HOST", DefaultDBHost)
	dbPort := getEnv("DB_PORT", DefaultDBPort)
	dbUser := getEnv("DB_USER", DefaultDBUser)
	dbPassword := getEnv("DB_PASSWORD", DefaultDBPassword)
	dbName := getEnv("DB_NAME", DefaultDBName)

	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		dbHost, dbPort, dbUser, dbPassword, dbName, SSLMode)

	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	log.Println("Database connection established")

	server := &Server{DB: db}

	r := mux.NewRouter()
	r.HandleFunc("/health", corsMiddleware(server.healthCheck)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/leaderboard", corsMiddleware(server.getLeaderboard)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/scores", corsMiddleware(server.submitScore)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/achievements", corsMiddleware(server.getAchievements)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/achievements/{username}", corsMiddleware(server.getUserAchievements)).Methods("GET", "OPTIONS")

	port := getEnv("PORT", DefaultServerPort)
	log.Printf("Server starting on port %s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

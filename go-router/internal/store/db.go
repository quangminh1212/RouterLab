package store

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"
)

type ProviderConnection struct {
	ID                   string                 `json:"id"`
	Provider             string                 `json:"provider"`
	Name                 string                 `json:"name"`
	AuthType             string                 `json:"authType"`
	APIKey               string                 `json:"apiKey,omitempty"`
	AccessToken          string                 `json:"accessToken,omitempty"`
	RefreshToken         string                 `json:"refreshToken,omitempty"`
	IsActive             bool                   `json:"isActive"`
	Priority             int                    `json:"priority"`
	GlobalPriority       *int                   `json:"globalPriority,omitempty"`
	DefaultModel         string                 `json:"defaultModel,omitempty"`
	ProviderSpecificData map[string]interface{} `json:"providerSpecificData,omitempty"`
	CreatedAt            string                 `json:"createdAt,omitempty"`
	UpdatedAt            string                 `json:"updatedAt,omitempty"`
}

type APIKey struct {
	ID        string `json:"id"`
	Key       string `json:"key"`
	Name      string `json:"name"`
	CreatedAt string `json:"createdAt,omitempty"`
}

type Settings struct {
	RequireAPIKey              bool   `json:"requireApiKey"`
	RequireLogin               bool   `json:"requireLogin"`
	StickyRoundRobinLimit      int    `json:"stickyRoundRobinLimit"`
	ComboStrategy              string `json:"comboStrategy"`
	ComboStickyRoundRobinLimit int    `json:"comboStickyRoundRobinLimit"`
	OutboundProxyEnabled       bool   `json:"outboundProxyEnabled"`
	OutboundProxyURL           string `json:"outboundProxyUrl"`
	OutboundNoProxy            string `json:"outboundNoProxy"`
	ObservabilityEnabled       bool   `json:"observabilityEnabled"`
	ObservabilityMaxRecords    int    `json:"observabilityMaxRecords"`
}

type DB struct {
	ProviderConnections []ProviderConnection   `json:"providerConnections"`
	APIKeys             []APIKey               `json:"apiKeys"`
	Settings            Settings               `json:"settings"`
	ModelAliases        map[string]string      `json:"modelAliases"`
	Pricing             map[string]interface{} `json:"pricing"`
}

type Store struct {
	mu       sync.RWMutex
	db       DB
	dbPath   string
	loadedAt time.Time
}

func DataDir() string {
	if d := os.Getenv("DATA_DIR"); d != "" {
		return d
	}
	if runtime.GOOS == "windows" {
		appdata := os.Getenv("APPDATA")
		if appdata == "" {
			home, _ := os.UserHomeDir()
			appdata = filepath.Join(home, "AppData", "Roaming")
		}
		return filepath.Join(appdata, "xlabrouter")
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".xlabrouter")
}

func NewStore() (*Store, error) {
	dir := DataDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}
	s := &Store{dbPath: filepath.Join(dir, "db.json")}
	if err := s.load(); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) load() error {
	data, err := os.ReadFile(s.dbPath)
	if os.IsNotExist(err) {
		s.db = defaultDB()
		s.loadedAt = time.Now()
		return nil
	}
	if err != nil {
		return fmt.Errorf("read db.json: %w", err)
	}
	data = bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
	var db DB
	if err := json.Unmarshal(data, &db); err != nil {
		return fmt.Errorf("parse db.json: %w", err)
	}
	if db.ModelAliases == nil {
		db.ModelAliases = map[string]string{}
	}
	if db.Pricing == nil {
		db.Pricing = map[string]interface{}{}
	}
	s.db = db
	s.loadedAt = time.Now()
	return nil
}

func defaultDB() DB {
	return DB{
		ProviderConnections: []ProviderConnection{},
		APIKeys:             []APIKey{},
		Settings: Settings{
			RequireLogin:               true,
			StickyRoundRobinLimit:      3,
			ComboStrategy:              "fallback",
			ComboStickyRoundRobinLimit: 1,
			ObservabilityEnabled:       true,
			ObservabilityMaxRecords:    1000,
		},
		ModelAliases: map[string]string{},
		Pricing:      map[string]interface{}{},
	}
}

func (s *Store) Reload() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.load()
}

func (s *Store) GetSettings() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.db.Settings
}

func (s *Store) GetActiveConnections(provider string) []ProviderConnection {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var out []ProviderConnection
	for _, c := range s.db.ProviderConnections {
		if !c.IsActive {
			continue
		}
		if provider != "" && c.Provider != provider {
			continue
		}
		out = append(out, c)
	}
	for i := 1; i < len(out); i++ {
		for j := i; j > 0 && out[j].Priority < out[j-1].Priority; j-- {
			out[j], out[j-1] = out[j-1], out[j]
		}
	}
	return out
}

func (s *Store) GetAllConnections() []ProviderConnection {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]ProviderConnection, len(s.db.ProviderConnections))
	for i, c := range s.db.ProviderConnections {
		c.APIKey = ""
		c.AccessToken = ""
		c.RefreshToken = ""
		out[i] = c
	}
	return out
}

func (s *Store) ValidateAPIKey(key string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, k := range s.db.APIKeys {
		if k.Key == key {
			return true
		}
	}
	return false
}

func (s *Store) GetModelAliases() map[string]string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]string, len(s.db.ModelAliases))
	for k, v := range s.db.ModelAliases {
		out[k] = v
	}
	return out
}

func (s *Store) DBSnapshot() ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	safe := s.db
	conns := make([]ProviderConnection, len(safe.ProviderConnections))
	for i, c := range safe.ProviderConnections {
		c.APIKey = ""
		c.AccessToken = ""
		c.RefreshToken = ""
		conns[i] = c
	}
	safe.ProviderConnections = conns
	safe.APIKeys = nil
	return json.Marshal(safe)
}

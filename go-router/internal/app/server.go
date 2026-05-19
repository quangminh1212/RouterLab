package app

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"runtime"
	"strings"
	"time"

	"xlabrouter-go/internal/proxy"
	"xlabrouter-go/internal/store"
)

type Server struct {
	store     *store.Store
	forwarder *proxy.Forwarder
	mux       *http.ServeMux
	startedAt time.Time
}

func NewServer() (*Server, error) {
	st, err := store.NewStore()
	if err != nil {
		return nil, err
	}
	s := &Server{
		store:     st,
		forwarder: proxy.NewForwarder(st),
		mux:       http.NewServeMux(),
		startedAt: time.Now(),
	}
	s.routes()
	go s.backgroundReload()
	return s, nil
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	w.Header().Set("X-Powered-By", "xlabrouter-go")
	s.mux.ServeHTTP(w, r)
	if d := time.Since(start); d > 500*time.Millisecond {
		log.Printf("slow request %s %s took %s", r.Method, r.URL.Path, d)
	}
}

func (s *Server) routes() {
	s.mux.HandleFunc("/api/health", s.handleHealth)
	s.mux.HandleFunc("/api/settings", s.handleSettings)
	s.mux.HandleFunc("/api/providers", s.handleProviders)
	s.mux.HandleFunc("/api/models", s.handleModels)
	s.mux.HandleFunc("/api/debug/db", s.handleDebugDB)
	s.mux.HandleFunc("/v1/chat/completions", s.handleProxy)
	s.mux.HandleFunc("/v1/messages", s.handleProxy)
	s.mux.HandleFunc("/v1/responses", s.handleProxy)
	s.mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"name":      "xlabrouter-go",
			"status":    "ok",
			"uptimeSec": int(time.Since(s.startedAt).Seconds()),
		})
	})
}

func (s *Server) backgroundReload() {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		if err := s.store.Reload(); err != nil {
			log.Printf("db reload failed: %v", err)
		}
	}
}

func (s *Server) authorize(r *http.Request) error {
	settings := s.store.GetSettings()
	if !settings.RequireAPIKey {
		return nil
	}
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	if auth == "" || !strings.HasPrefix(strings.ToLower(auth), "bearer ") {
		return fmt.Errorf("missing bearer token")
	}
	key := strings.TrimSpace(auth[len("Bearer "):])
	if !s.store.ValidateAPIKey(key) {
		return fmt.Errorf("invalid api key")
	}
	return nil
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"ok":        true,
		"status":    "ok",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"runtime": map[string]interface{}{
			"goVersion":      runtime.Version(),
			"goroutines":     runtime.NumGoroutine(),
			"heapAlloc":      m.HeapAlloc,
			"heapInuse":      m.HeapInuse,
			"nextGC":         m.NextGC,
			"loadedFromData": store.DataDir(),
		},
	})
}

func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, s.store.GetSettings())
}

func (s *Server) handleProviders(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"connections": s.store.GetAllConnections()})
}

func (s *Server) handleModels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	aliases := s.store.GetModelAliases()
	models := make([]map[string]string, 0, len(aliases))
	for model, alias := range aliases {
		models = append(models, map[string]string{
			"fullModel": model,
			"alias":     alias,
		})
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"models": models})
}

func (s *Server) handleDebugDB(w http.ResponseWriter, r *http.Request) {
	data, err := s.store.DBSnapshot()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(data)
}

func (s *Server) handleProxy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]string{"error": "method not allowed"})
		return
	}
	if err := s.authorize(r); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": err.Error()})
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 16*1024*1024))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed to read body"})
		return
	}
	resp, err := s.forwarder.Forward(r.Context(), r.URL.Path, body)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{"error": err.Error()})
		return
	}
	defer resp.Body.Close()

	for _, k := range []string{"Content-Type", "Cache-Control", "X-Request-Id"} {
		if v := resp.Header.Get(k); v != "" {
			w.Header().Set(k, v)
		}
	}
	if w.Header().Get("Content-Type") == "" {
		w.Header().Set("Content-Type", "application/json")
	}
	w.WriteHeader(resp.StatusCode)

	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 16*1024)
	for {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			if _, writeErr := w.Write(buf[:n]); writeErr != nil {
				return
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if readErr == io.EOF {
			return
		}
		if readErr != nil {
			return
		}
	}
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(data)
}
